/**
 * Client Polling Module
 * 
 * Handles multi-agent client initialization and message polling.
 */

import { ILinkClient, type WeixinMessage, MessageType } from 'weixin-ilink';
import {
  loadAllCredentials,
  loadConfig,
  loadSyncBuf,
  saveSyncBuf,
  getContextToken,
  type Credentials,
} from '../config/index.js';
import { FileStore } from '../store.js';
import { getBaseDir } from '../paths.js';
import {
  initAgentManager,
  initACPManager,
  initTaskRouter,
  initLongTaskManager,
  initFlowTaskManager,
  initSchedulerManager,
  initCommandHandler,
  initNotificationService,
  registerWechatChannel,
  getCommandHandler,
  getAcpManager,
  getTaskRouter,
  getAgent,
} from '../init/managers.js';
import { RESET_COMMANDS, SESSION_PAUSE_MS, SESSION_EXPIRED_ERRCODE, recordMessageReceived } from '../init/state.js';
import { extractText } from '../message-handlers/extract.js';
import { executeDirect, executeLongTask, executeFlowTask, handleFlowTaskConfirmation } from '../message-handlers/execute.js';

import { ExecutionMode, createTaskSubmission, TaskPriority } from '../task-router/index.js';

export interface AgentClient {
  agentId: string;
  credentials: Credentials;
  client: ILinkClient;
}

const agentClients = new Map<string, AgentClient>();

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function initAgentClients(): AgentClient[] {
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

export async function main(): Promise<void> {
  const clients = initAgentClients();
  
  if (clients.length === 0) {
    console.error('未找到登录凭证。请先运行: npm run login');
    process.exit(1);
  }

  const config = loadConfig();
  const store = new FileStore(getBaseDir());
  
  initAgentManager();
  initACPManager();
  initTaskRouter();
  await initLongTaskManager(store);
  await initFlowTaskManager(store);
  initSchedulerManager();
  initCommandHandler();
  initNotificationService();

  // Register WeChat notification channels for each agent
  for (const ac of clients) {
    registerWechatChannel(ac.agentId, async (notification) => {
      // Send notification via WeChat
      const contextToken = getContextToken(ac.agentId) ?? '';
      await ac.client.sendText(
        ac.credentials.accountId,
        `${notification.title}\n\n${notification.message}`,
        contextToken
      );
    });
  }

  console.log('=== 微信 Kimi Bot (智能任务路由 v2) 已启动 ===');
  console.log(`已加载 ${clients.length} 个 Agent:`);
  for (const ac of clients) {
    console.log(`  - ${ac.agentId}: ${ac.credentials.accountId}`);
  }
  console.log(`模型: ${config.model}`);
  console.log(`工作目录: ${config.cwd}`);
  console.log(`多轮对话: ${config.multiTurn ? '开启' : '关闭'}`);
  console.log('执行模式: DIRECT | LONGTASK | FLOWTASK');
  console.log('等待消息中...\n');

  process.on('SIGINT', async () => {
    console.log('\n\n正在关闭...');
    const acp = getAcpManager();
    if (acp) {
      await acp.closeAll();
    }
    process.exit(0);
  });

  const pollPromises = clients.map(ac => pollAgentClient(ac, config));
  await Promise.all(pollPromises);
}

export async function pollAgentClient(
  agentClient: AgentClient,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  let consecutiveFailures = 0;
  const { agentId, client } = agentClient;

  while (true) {
    try {
      const resp = await client.poll();

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
      saveSyncBuf(client.cursor);

      const msgs = resp.msgs ?? [];
      for (const msg of msgs) {
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

async function handleMessage(
  client: ILinkClient,
  msg: WeixinMessage,
  _config: ReturnType<typeof loadConfig>,
  agentId: string
): Promise<void> {
  if (msg.message_type !== MessageType.USER) return;

  const fromUser = msg.from_user_id;
  if (!fromUser) return;

  const extractedText = extractText(msg);
  if (!extractedText) return;

  // Narrow types after checks
  const userId: string = fromUser;
  const text: string = extractedText;

  console.log(`[${agentId}] 收到消息: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  recordMessageReceived();

  const contextToken = getContextToken(agentId) ?? '';

  // Handle reset commands
  if (RESET_COMMANDS.has(text.trim())) {
    await client.sendText(userId, '🔄 已重置当前会话。', contextToken);
    return;
  }

  // Check for flow task confirmation
  const flowHandled = await handleFlowTaskConfirmation(client, userId, text, contextToken, agentId);
  if (flowHandled) return;

  // Handle commands
  const handler = getCommandHandler();
  if (handler && handler.isCommand(text)) {
    await executeEnhancedCommand(client, userId, text, contextToken, agentId);
    return;
  }

  // Route to appropriate execution mode
  const router = getTaskRouter();
  if (!router) {
    await client.sendText(userId, '系统初始化中，请稍后重试。', contextToken);
    return;
  }

  const submission = createTaskSubmission({
    prompt: text,
    userId,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.NORMAL,
  });

  const decision = router.route(submission);

  switch (decision.mode) {
    case ExecutionMode.DIRECT:
      await executeDirect(client, userId, text, contextToken, agentId);
      break;
    case ExecutionMode.LONGTASK:
      await executeLongTask(client, userId, text, contextToken, agentId);
      break;
    case ExecutionMode.FLOWTASK:
      await executeFlowTask(client, userId, text, contextToken, agentId);
      break;
  }
}

async function executeEnhancedCommand(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  const agent = await getAgent(agentId, fromUser);
  const handler = getCommandHandler()!;
  
  const result = await handler.execute(text, agent, async (progressMsg) => {
    await client.sendText(fromUser, progressMsg, contextToken);
  });

  await client.sendText(fromUser, result.response, contextToken);
}
