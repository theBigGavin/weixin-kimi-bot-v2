/**
 * weixin-kimi-bot — Bridge WeChat messages to Kimi via ACP protocol.
 *
 * Flow: WeChat → ILinkClient.poll() → ACP (kimi acp) → ILinkClient.sendTextChunked() → WeChat
 */

import {
  ILinkClient,
  MessageType,
  MessageItemType,
  type WeixinMessage,
} from 'weixin-ilink';
import {
  loadAllCredentials,
  loadConfig,
  loadContextTokens,
  loadSyncBuf,
  saveSyncBuf,
  getContextToken,
  setContextToken,
  type Credentials,
} from './config/index.js';
import { ACPManager } from './acp/index.js';
import { CommandHandler } from './handlers/command-handler.js';
import { createAgent, type Agent } from './agent/types.js';
import { AgentManager } from './agent/manager.js';
import { FileStore } from './store.js';
import { getBaseDir } from './paths.js';

const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const RESET_COMMANDS = new Set(['新对话', '/reset', '/clear']);

// --- ACP Manager & Command Handler & Agent Manager ---

let acpManager: ACPManager | null = null;
let agentManager: AgentManager | null = null;
const commandHandler = new CommandHandler();

/**
 * Initialize Agent manager
 */
function initAgentManager(): AgentManager {
  if (agentManager) return agentManager;
  
  const store = new FileStore(getBaseDir());
  agentManager = new AgentManager(store);
  
  return agentManager;
}

/**
 * Get agent by ID, returns mock agent if not found
 */
async function getAgent(agentId: string, fromUser: string): Promise<Agent> {
  const manager = initAgentManager();
  const agent = await manager.getAgent(agentId);
  
  if (agent) {
    return agent;
  }
  
  // Fallback to mock agent
  return createAgent({
    wechat: { accountId: fromUser },
  });
}

/**
 * Initialize ACP manager
 */
function initACPManager(): ACPManager {
  if (acpManager) return acpManager;

  acpManager = new ACPManager({
    acpConfig: {
      command: 'kimi',
      args: ['acp'],
      cwd: process.cwd(),
    },
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  });

  return acpManager;
}

// --- Message text extraction ---

/**
 * Extract text content from WeChat message
 */
function extractText(msg: WeixinMessage): string {
  if (!msg.item_list?.length) return '';

  for (const item of msg.item_list) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text) {
      const ref = item.ref_msg;
      if (ref?.title) {
        return `[引用: ${ref.title}]\n${item.text_item.text}`;
      }
      return item.text_item.text;
    }
    // Voice ASR transcript
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return '';
}

// --- Process a single inbound message ---

/**
 * Handle incoming message
 */
async function handleMessage(
  client: ILinkClient,
  msg: WeixinMessage,
  config: ReturnType<typeof loadConfig>,
  agentId: string
): Promise<void> {
  // Only process user messages
  if (msg.message_type !== MessageType.USER) return;

  const fromUser = msg.from_user_id;
  if (!fromUser) return;

  const text = extractText(msg);
  if (!text) {
    console.log(`  [skip] 非文本消息 from ${fromUser}`);
    return;
  }

  // Cache context_token
  if (msg.context_token) {
    setContextToken(fromUser, msg.context_token);
  }
  const contextToken = msg.context_token || getContextToken(fromUser);
  if (!contextToken) {
    console.error(`  [error] 没有 context_token for ${fromUser}`);
    return;
  }

  console.log(
    `\n[${agentId}] 📩 收到消息 from ${fromUser}: ${text.substring(0, 80)}${
      text.length > 80 ? '...' : ''
    }`
  );

  // Check if it's a command
  if (commandHandler.isCommand(text)) {
    console.log(`[${agentId}] 🔧 执行命令: ${text.trim()}`);
    
    // Get real agent config from storage
    const agent = await getAgent(agentId, fromUser);
    
    const result = await commandHandler.execute(text, agent);
    await client.sendText(fromUser, result.response, contextToken);
    console.log(`[${agentId}] ✅ 命令执行完成: ${result.type}`);
    return;
  }

  // Handle reset commands (multi-turn only)
  if (config.multiTurn && RESET_COMMANDS.has(text.trim())) {
    if (acpManager) {
      await acpManager.closeUserSession(fromUser);
    }
    await client.sendText(fromUser, '已开始新对话', contextToken);
    console.log(`  🔄 已重置 ${fromUser} 的会话`);
    return;
  }

  // Show typing indicator (non-blocking, non-critical)
  client.sendTyping(fromUser, contextToken).catch(() => {});

  // Execute via ACP
  const start = Date.now();
  try {
    console.log(`[${agentId}] 🤖 正在调用 Kimi (ACP)...`);

    const manager = initACPManager();
    const response = await manager.prompt(fromUser, { text });

    const duration = Date.now() - start;
    console.log(`[${agentId}] ✅ Kimi 响应完成 (${(duration / 1000).toFixed(1)}s)`);

    if (response.error) {
      throw new Error(response.error);
    }

    // Send response back to WeChat
    const chunks = await client.sendTextChunked(
      fromUser,
      response.text,
      contextToken
    );
    console.log(
      `[${agentId}] 📤 已发送回复 (${response.text.length} chars, ${chunks} 条消息)`
    );

    // Log tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`[${agentId}] 🔧 工具调用: ${response.toolCalls.length} 次`);
      for (const tool of response.toolCalls) {
        console.log(`     - ${tool.title} (${tool.status})`);
      }
    }
  } catch (err) {
    console.error(`[${agentId}] ❌ 处理失败:`, err);

    // Send error message back to user
    const errorMsg = err instanceof Error ? err.message : String(err);
    await client
      .sendText(fromUser, `处理消息时出错: ${errorMsg}`, contextToken)
      .catch(() => {});
  }
}

// --- Multi-Agent Support ---

interface AgentClient {
  agentId: string;
  credentials: Credentials;
  client: ILinkClient;
}

const agentClients = new Map<string, AgentClient>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Initialize all Agent clients
 */
function initAgentClients(): AgentClient[] {
  const allCreds = loadAllCredentials();
  
  if (allCreds.size === 0) {
    return [];
  }
  
  const clients: AgentClient[] = [];
  
  for (const [agentId, creds] of allCreds) {
    const client = new ILinkClient({
      baseUrl: creds.baseUrl,
      token: creds.botToken,
    });
    
    // Restore sync cursor for this agent
    client.cursor = loadSyncBuf();
    
    const agentClient: AgentClient = {
      agentId,
      credentials: creds,
      client,
    };
    
    agentClients.set(agentId, agentClient);
    clients.push(agentClient);
  }
  
  return clients;
}

// --- Main loop ---

async function main() {
  // Initialize all Agent clients
  const clients = initAgentClients();
  
  if (clients.length === 0) {
    console.error('未找到登录凭证。请先运行: npm run login');
    process.exit(1);
  }

  // Load config
  const config = loadConfig();

  console.log('=== 微信 Kimi Bot (ACP 多 Agent 模式) 已启动 ===');
  console.log(`已加载 ${clients.length} 个 Agent:`);
  for (const ac of clients) {
    console.log(`  - ${ac.agentId}: ${ac.credentials.accountId}`);
  }
  console.log(`模型: ${config.model}`);
  console.log(`工作目录: ${config.cwd}`);
  console.log(`多轮对话: ${config.multiTurn ? '开启' : '关闭'}`);
  console.log('等待消息中...\n');

  // Initialize Agent manager
  initAgentManager();
  
  // Restore state
  loadContextTokens();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n正在关闭...');
    if (acpManager) {
      await acpManager.closeAll();
    }
    process.exit(0);
  });

  // Poll all clients concurrently
  const pollPromises = clients.map(ac => pollAgentClient(ac, config));
  
  // Wait for all (they run forever unless error)
  await Promise.all(pollPromises);
}

/**
 * Poll a single Agent client
 */
async function pollAgentClient(
  agentClient: AgentClient,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  let consecutiveFailures = 0;
  const { agentId, client } = agentClient;

  while (true) {
    try {
      const resp = await client.poll();

      // Handle errors
      if (
        (resp.ret && resp.ret !== 0) ||
        (resp.errcode && resp.errcode !== 0)
      ) {
        if (
          resp.errcode === SESSION_EXPIRED_ERRCODE ||
          resp.ret === SESSION_EXPIRED_ERRCODE
        ) {
          console.error(`[${agentId}] ⚠️  Session 过期，暂停 1 小时后重试...`);
          console.error(`[${agentId}]    提示：可能需要重新登录 (npm run login)`);
          await sleep(SESSION_PAUSE_MS);
          continue;
        }

        consecutiveFailures++;
        console.error(
          `[${agentId}] getUpdates 错误: ret=${resp.ret} errcode=${resp.errcode} (${consecutiveFailures}/3)`
        );
        if (consecutiveFailures >= 3) {
          console.error(`[${agentId}] 连续失败 3 次，等待 30 秒...`);
          consecutiveFailures = 0;
          await sleep(30_000);
        } else {
          await sleep(2_000);
        }
        continue;
      }

      consecutiveFailures = 0;

      // Persist sync cursor
      saveSyncBuf(client.cursor);

      // Process messages
      const msgs = resp.msgs ?? [];
      for (const msg of msgs) {
        // Route message to the correct agent
        await handleMessage(client, msg, config, agentId);
      }
    } catch (err) {
      consecutiveFailures++;
      console.error(
        `[${agentId}] Poll 异常 (${consecutiveFailures}/3):`,
        err instanceof Error ? err.message : err
      );
      if (consecutiveFailures >= 3) {
        consecutiveFailures = 0;
        await sleep(30_000);
      } else {
        await sleep(2_000);
      }
    }
  }
}

// Only run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}
