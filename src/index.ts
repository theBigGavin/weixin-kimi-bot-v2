/**
 * weixin-kimi-bot — Bridge WeChat messages to Kimi via ACP protocol.
 *
 * Flow: WeChat → ILinkClient.poll() → TaskRouter → [DIRECT/LONGTASK/FLOWTASK] → ILinkClient.sendText()
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

// Task Router & Execution Managers
import { TaskRouter, ExecutionMode, createTaskSubmission, TaskPriority } from './task-router/index.js';
import { LongTaskManager } from './longtask/manager.js';
import { FlowTaskManager } from './flowtask/manager.js';

// Memory System
import { MemoryManager, MemoryExtractor, type DialogueMessage } from './memory/index.js';

const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const RESET_COMMANDS = new Set(['新对话', '/reset', '/clear']);
const CONFIRM_KEYWORDS = new Set(['确认', 'confirm', 'yes', 'y', '确定', '执行', '继续', '好', 'ok']);
const CANCEL_KEYWORDS = new Set(['取消', 'cancel', 'no', 'n', '停止', 'abort']);
const SKIP_KEYWORDS = new Set(['跳过', 'skip', 's', 'next']);

// --- Global Managers ---

let acpManager: ACPManager | null = null;
let agentManager: AgentManager | null = null;
let taskRouter: TaskRouter | null = null;
let longTaskManager: LongTaskManager | null = null;
let flowTaskManager: FlowTaskManager | null = null;
let memoryManager: MemoryManager | null = null;
let memoryExtractor: MemoryExtractor | null = null;
const commandHandler = new CommandHandler();

// In-memory dialogue cache for memory extraction (userId -> messages)
const dialogueCache = new Map<string, DialogueMessage[]>();

// Track active flow tasks waiting for user confirmation
const waitingFlowTasks = new Map<string, { taskId: string; agentId: string }>();

// --- Initialization Functions ---

function initAgentManager(): AgentManager {
  if (agentManager) return agentManager;
  
  const store = new FileStore(getBaseDir());
  agentManager = new AgentManager(store);
  
  return agentManager;
}

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

function initTaskRouter(): TaskRouter {
  if (taskRouter) return taskRouter;
  taskRouter = new TaskRouter();
  return taskRouter;
}

function initMemoryManager(): MemoryManager {
  if (memoryManager) return memoryManager;
  
  memoryManager = new MemoryManager({
    baseDir: getBaseDir(),
  });
  
  return memoryManager;
}

function initMemoryExtractor(): MemoryExtractor {
  if (memoryExtractor) return memoryExtractor;
  
  memoryExtractor = new MemoryExtractor({
    enabled: true,
    minDialogLength: 3,
    maxFactsPerExtraction: 3,
  });
  
  return memoryExtractor;
}

async function initLongTaskManager(store: FileStore): Promise<LongTaskManager> {
  if (longTaskManager) return longTaskManager;

  const manager = new LongTaskManager({
    maxConcurrent: 3,
    pollInterval: 5000,
    timeout: 30 * 60 * 1000,
    store,
    acpManager: initACPManager(),
  });

  // Set up callbacks for notifications
  manager.setCallbacks({
    onProgress: async (taskId: string, progress: number, message: string) => {
      console.log(`[LongTask ${taskId}] Progress: ${progress}% - ${message}`);
      // Note: We don't send WeChat messages here because we don't have user context
      // Progress notifications will be shown when user checks task status
    },
    onComplete: async (taskId: string, _result: string) => {
      console.log(`[LongTask ${taskId}] Completed`);
      // Result will be retrieved when user checks task status
    },
    onFail: async (taskId: string, error: string) => {
      console.error(`[LongTask ${taskId}] Failed: ${error}`);
    },
  });

  // Load persisted tasks
  await manager.loadTasks();
  
  longTaskManager = manager;
  return manager;
}

async function initFlowTaskManager(store: FileStore): Promise<FlowTaskManager> {
  if (flowTaskManager) return flowTaskManager;

  const manager = new FlowTaskManager({
    store,
    acpManager: initACPManager(),
  });

  // Set up callbacks
  manager.setCallbacks({
    onWaitingConfirm: async (taskId: string, step) => {
      console.log(`[FlowTask ${taskId}] Waiting for confirmation on step: ${step.description}`);
    },
    onStepComplete: async (taskId: string, stepIndex: number, _result: string) => {
      console.log(`[FlowTask ${taskId}] Step ${stepIndex} completed`);
    },
    onComplete: async (taskId: string, _results) => {
      console.log(`[FlowTask ${taskId}] All steps completed`);
      // Clean up waiting state
      for (const [userId, taskInfo] of waitingFlowTasks) {
        if (taskInfo.taskId === taskId) {
          waitingFlowTasks.delete(userId);
          break;
        }
      }
    },
    onFail: async (taskId: string, error: string) => {
      console.error(`[FlowTask ${taskId}] Failed: ${error}`);
    },
  });

  // Load persisted tasks
  await manager.loadTasks();
  
  flowTaskManager = manager;
  return manager;
}

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

// --- Message text extraction ---

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

// --- Task Execution Handlers ---

/**
 * Execute task in DIRECT mode (synchronous)
 */
async function executeDirect(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  console.log(`[${agentId}] 🚀 DIRECT mode execution`);
  
  const start = Date.now();
  
  // Record user message in dialogue cache
  let dialogue = dialogueCache.get(fromUser) || [];
  dialogue.push({
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });
  
  // Limit dialogue cache size (keep last 20 messages)
  if (dialogue.length > 20) {
    dialogue = dialogue.slice(-20);
  }
  dialogueCache.set(fromUser, dialogue);
  
  try {
    const manager = initACPManager();
    const response = await manager.prompt(fromUser, { text });

    const duration = Date.now() - start;
    console.log(`[${agentId}] ✅ Kimi 响应完成 (${(duration / 1000).toFixed(1)}s)`);

    if (response.error) {
      throw new Error(response.error);
    }

    // Record assistant response in dialogue cache
    dialogue.push({
      role: 'assistant',
      content: response.text,
      timestamp: Date.now(),
    });
    dialogueCache.set(fromUser, dialogue);

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

    // Trigger memory extraction after successful dialogue
    await extractAndSaveMemory(fromUser, agentId);

  } catch (err) {
    console.error(`[${agentId}] ❌ 处理失败:`, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    await client
      .sendText(fromUser, `处理消息时出错: ${errorMsg}`, contextToken)
      .catch(() => {});
  }
}

/**
 * Extract and save memory from dialogue
 * Automatically extracts important information and saves to memory
 */
async function extractAndSaveMemory(
  userId: string,
  agentId: string
): Promise<void> {
  try {
    const extractor = initMemoryExtractor();
    const memManager = initMemoryManager();
    
    // Get dialogue history
    const dialogue = dialogueCache.get(userId) || [];
    
    // Check if should extract
    if (!extractor.shouldExtract(dialogue)) {
      return;
    }
    
    // Get agent info
    const agent = await getAgent(agentId, userId);
    if (!agent) {
      console.log(`[Memory] Agent not found: ${agentId}`);
      return;
    }
    
    // Load current memory
    let memory = await memManager.loadMemory(agentId, agent.name);
    
    // Check if auto-extract is enabled
    if (!memory.config.autoExtract) {
      return;
    }
    
    console.log(`[Memory] Extracting memory for ${agentId}...`);
    
    // Build extraction prompt and call LLM
    // Note: We use a lightweight extraction via ACP
    const extractionPrompt = extractor.buildExtractionPrompt(dialogue);
    
    try {
      // Use ACP manager for extraction (reuse connection)
      const acp = initACPManager();
      const extractionResult = await acp.prompt(userId, { 
        text: extractionPrompt,
        // Use a simpler model/config for extraction if available
      });
      
      if (extractionResult.error) {
        console.error('[Memory] Extraction failed:', extractionResult.error);
        return;
      }
      
      // Parse extraction result
      const extraction = extractor.parseExtractionResult(extractionResult.text);
      
      // Check if anything was extracted
      const totalExtracted = 
        (extraction.facts?.length || 0) + 
        (extraction.projects?.length || 0) + 
        (extraction.learnings?.length || 0);
      
      if (totalExtracted === 0) {
        console.log('[Memory] No new information to extract');
        return;
      }
      
      // Merge into existing memory
      memory = extractor.mergeIntoMemory(memory, extraction);
      
      // Save updated memory
      await memManager.saveMemory(memory);
      
      console.log(`[Memory] Saved: ${extraction.facts?.length || 0} facts, ${extraction.projects?.length || 0} projects`);
      
      // Clear dialogue cache after successful extraction
      dialogueCache.delete(userId);
      
    } catch (extractErr) {
      console.error('[Memory] Extraction error:', extractErr);
    }
    
  } catch (err) {
    console.error('[Memory] Failed to extract/save memory:', err);
    // Don't throw - memory extraction should not break the main flow
  }
}

/**
 * Execute task in LONGTASK mode (asynchronous)
 */
async function executeLongTask(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  console.log(`[${agentId}] ⏳ LONGTASK mode execution`);
  
  const ltManager = longTaskManager!;
  
  // Create task submission
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.NORMAL,
  });
  
  // Submit task
  const task = ltManager.submit(submission);
  
  // Send immediate acknowledgment
  const ackMessage = 
    `📋 任务已提交（长任务模式）\n` +
    `任务ID: ${task.id}\n` +
    `状态: 等待执行...\n\n` +
    `任务将在后台执行，完成后可通过 /task status ${task.id} 查看结果。`;
  
  await client.sendText(fromUser, ackMessage, contextToken);
  
  // Start execution asynchronously
  const started = await ltManager.start(task.id, fromUser);
  if (started) {
    console.log(`[${agentId}] ✅ LongTask ${task.id} started`);
  } else {
    await client.sendText(
      fromUser, 
      `任务已排队，当前有 ${ltManager.getActiveCount()} 个任务正在执行。`,
      contextToken
    );
  }
}

/**
 * Execute task in FLOWTASK mode (structured with confirmations)
 */
async function executeFlowTask(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  console.log(`[${agentId}] 🔄 FLOWTASK mode execution`);
  
  const ftManager = flowTaskManager!;
  
  // Create task submission
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.HIGH, // Flow tasks are high priority
  });
  
  // Generate execution plan
  const plan = ftManager.createPlan(text);
  
  // Create task
  const task = ftManager.create(submission, plan);
  
  // Send plan to user
  let planMessage = `📋 流程任务已创建\n任务ID: ${task.id}\n\n执行计划:\n`;
  plan.forEach((step, index) => {
    const confirmIcon = step.requiresConfirmation ? '⚠️' : '⏵';
    const duration = Math.round(step.estimatedDuration / 60000);
    planMessage += `${index + 1}. ${confirmIcon} ${step.description} (~${duration}分钟)\n`;
  });
  planMessage += `\n总步骤: ${plan.length} | 预估耗时: ${Math.round(plan.reduce((sum, s) => sum + s.estimatedDuration, 0) / 60000)}分钟\n\n`;
  planMessage += `发送 "确认" 开始执行，或发送 "取消" 放弃任务。`;
  
  await client.sendText(fromUser, planMessage, contextToken);
  
  // Store task waiting for initial confirmation
  waitingFlowTasks.set(fromUser, { taskId: task.id, agentId });
  
  console.log(`[${agentId}] ⏳ FlowTask ${task.id} waiting for confirmation`);
}

/**
 * Handle flow task confirmation from user
 */
async function handleFlowTaskConfirmation(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  _agentId: string
): Promise<boolean> {
  const waitingInfo = waitingFlowTasks.get(fromUser);
  if (!waitingInfo) return false;
  
  const { taskId } = waitingInfo;
  const ftManager = flowTaskManager!;
  const task = ftManager.getTask(taskId);
  
  if (!task) {
    waitingFlowTasks.delete(fromUser);
    return false;
  }
  
  // Check for confirmation
  const lowerText = text.toLowerCase().trim();
  const isConfirm = CONFIRM_KEYWORDS.has(lowerText);
  const isCancel = CANCEL_KEYWORDS.has(lowerText);
  const isSkip = SKIP_KEYWORDS.has(lowerText);
  
  if (isCancel) {
    // Cancel task
    await ftManager.cancel(taskId);
    waitingFlowTasks.delete(fromUser);
    await client.sendText(fromUser, `❌ 任务已取消`, contextToken);
    return true;
  }
  
  if (isSkip && task.status === 'waiting_confirm') {
    // Skip current step
    await client.sendText(fromUser, `⏭️ 跳过当前步骤...`, contextToken);
    await ftManager.skipStep(taskId, fromUser);
    return true;
  }
  
  if (isConfirm) {
    if (task.status === 'pending') {
      // Start the task
      await client.sendText(fromUser, `🚀 开始执行流程任务...`, contextToken);
      await ftManager.start(taskId, fromUser);
      
      // If first step needs confirmation, update waiting state
      const currentStep = ftManager.getCurrentStep(taskId);
      if (currentStep?.requiresConfirmation) {
        await client.sendText(
          fromUser,
          `⏳ 步骤 ${currentStep.order}: ${currentStep.description}\n发送 "确认" 继续执行此步骤。`,
          contextToken
        );
      }
      return true;
    } else if (task.status === 'waiting_confirm') {
      // Continue from confirmation
      await client.sendText(fromUser, `▶️ 继续执行...`, contextToken);
      await ftManager.confirmAndContinue(taskId, fromUser);
      
      // Check if next step needs confirmation
      const nextStep = ftManager.getCurrentStep(taskId);
      if (nextStep?.requiresConfirmation) {
        await client.sendText(
          fromUser,
          `⏳ 步骤 ${nextStep.order}: ${nextStep.description}\n发送 "确认" 继续执行此步骤。`,
          contextToken
        );
      }
      
      // Check if task was completed after confirmation
      const updatedTask = ftManager.getTask(taskId);
      if (updatedTask?.status === 'completed') {
        waitingFlowTasks.delete(fromUser);
        const report = ftManager.generateReport(taskId);
        await client.sendText(fromUser, report, contextToken);
      }
      return true;
    }
  }
  
  // Check if we need to prompt for confirmation on current waiting step
  if (task.status === 'waiting_confirm') {
    const currentStep = ftManager.getCurrentStep(taskId);
    if (currentStep) {
      await client.sendText(
        fromUser,
        `⏳ 等待确认: 步骤 ${currentStep.order} - ${currentStep.description}\n发送 "确认" 继续，或 "跳过" 跳过此步骤。`,
        contextToken
      );
      return true;
    }
  }
  
  return false;
}

// --- Main Message Handler ---

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
    
    // Inject task managers into command handler context
    const progressCallback = async (progressMsg: string) => {
      await client.sendText(fromUser, progressMsg, contextToken);
    };
    
    // Enhanced command handler with task managers
    const result = await executeEnhancedCommand(
      text, 
      agent, 
      progressCallback,
      fromUser,
      contextToken
    );
    
    await client.sendText(fromUser, result.response, contextToken);
    console.log(`[${agentId}] ✅ 命令执行完成: ${result.type}`);
    return;
  }

  // Check if user is responding to a waiting flow task
  const isFlowResponse = await handleFlowTaskConfirmation(
    client, fromUser, text, contextToken, agentId
  );
  if (isFlowResponse) {
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

  // Route task based on complexity
  const router = initTaskRouter();
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.NORMAL,
  });
  
  const decision = router.route(submission);
  console.log(`[${agentId}] 📊 Task routed: ${decision.mode} (confidence: ${decision.confidence})`);
  console.log(`[${agentId}]    Analysis: ${decision.analysis?.complexity}, ${decision.analysis?.estimatedDuration}ms, risk: ${decision.analysis?.riskLevel}`);

  // Execute based on mode
  switch (decision.mode) {
    case ExecutionMode.DIRECT:
      await executeDirect(client, fromUser, text, contextToken, agentId);
      break;
      
    case ExecutionMode.LONGTASK:
      await executeLongTask(client, fromUser, text, contextToken, agentId);
      break;
      
    case ExecutionMode.FLOWTASK:
      await executeFlowTask(client, fromUser, text, contextToken, agentId);
      break;
      
    default:
      await executeDirect(client, fromUser, text, contextToken, agentId);
  }
}

/**
 * Enhanced command execution with task manager support
 */
async function executeEnhancedCommand(
  message: string,
  agent: Agent,
  onProgress: (msg: string) => Promise<void>,
  userId: string,
  _contextToken: string
): Promise<{ type: string; success: boolean; response: string }> {
  const parsed = message.match(/^\/([a-zA-Z]+)(?:\s+(.*))?$/);
  if (!parsed) {
    return {
      type: 'unknown',
      success: false,
      response: '无法解析命令',
    };
  }

  const [, command, argsStr] = parsed;
  const args = argsStr ? argsStr.trim().split(/\s+/) : [];

  // Handle task commands
  if (command === 'task') {
    return handleTaskCommand(args, userId);
  }

  // Delegate to standard command handler
  const commandHandler = new CommandHandler();
  return commandHandler.execute(message, agent, onProgress);
}

/**
 * Handle /task commands
 */
async function handleTaskCommand(
  args: string[],
  _userId: string
): Promise<{ type: string; success: boolean; response: string }> {
  const action = args[0] || 'list';

  switch (action) {
    case 'list':
      return handleTaskList();
    case 'status':
      return handleTaskStatus(args[1]);
    case 'cancel':
      return await handleTaskCancel(args[1]);
    default:
      return {
        type: 'task',
        success: false,
        response: `未知操作: ${action}\n可用操作: list, status <id>, cancel <id>`,
      };
  }
}

function handleTaskList(): { type: string; success: boolean; response: string } {
  const ltManager = longTaskManager;
  const ftManager = flowTaskManager;
  
  let response = '📋 任务列表\n================\n\n';
  
  // Long tasks
  if (ltManager) {
    const longTasks = ltManager.getAllTasks();
    if (longTasks.length > 0) {
      response += `【长任务】(${longTasks.length})\n`;
      longTasks.slice(0, 5).forEach(task => {
        const status = task.status === 'completed' ? '✅' : 
                       task.status === 'running' ? '🔄' : 
                       task.status === 'failed' ? '❌' : '⏳';
        response += `${status} ${task.id.substring(0, 16)}... ${task.status} (${task.progress}%)\n`;
      });
      if (longTasks.length > 5) {
        response += `... 还有 ${longTasks.length - 5} 个任务\n`;
      }
      response += '\n';
    }
  }
  
  // Flow tasks
  if (ftManager) {
    const flowTasks = ftManager.getAllTasks();
    if (flowTasks.length > 0) {
      response += `【流程任务】(${flowTasks.length})\n`;
      flowTasks.slice(0, 5).forEach(task => {
        const status = task.status === 'completed' ? '✅' : 
                       task.status === 'running' ? '🔄' :
                       task.status === 'waiting_confirm' ? '⏸️' :
                       task.status === 'failed' ? '❌' : '⏳';
        const progress = `${task.currentStep}/${task.plan.length}`;
        response += `${status} ${task.id.substring(0, 16)}... ${task.status} (${progress})\n`;
      });
      if (flowTasks.length > 5) {
        response += `... 还有 ${flowTasks.length - 5} 个任务\n`;
      }
      response += '\n';
    }
  }
  
  if (response === '📋 任务列表\n================\n\n') {
    response += '暂无任务\n';
  }
  
  response += '\n使用 /task status <id> 查看详情';
  
  return { type: 'task', success: true, response };
}

function handleTaskStatus(
  taskId: string
): { type: string; success: boolean; response: string } {
  if (!taskId) {
    return {
      type: 'task',
      success: false,
      response: '请提供任务ID: /task status <task-id>',
    };
  }

  // Check long tasks
  const ltManager = longTaskManager;
  if (ltManager) {
    const task = ltManager.getTask(taskId);
    if (task) {
      let response = `📋 长任务详情\n================\n\n`;
      response += `任务ID: ${task.id}\n`;
      response += `状态: ${task.status}\n`;
      response += `进度: ${task.progress}%\n`;
      response += `创建时间: ${new Date(task.createdAt).toLocaleString()}\n`;
      if (task.startedAt) {
        response += `开始时间: ${new Date(task.startedAt).toLocaleString()}\n`;
      }
      if (task.completedAt) {
        response += `完成时间: ${new Date(task.completedAt).toLocaleString()}\n`;
      }
      
      // Recent progress logs
      if (task.progressLogs.length > 0) {
        response += `\n最近进度:\n`;
        task.progressLogs.slice(-5).forEach(log => {
          response += `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\n`;
        });
      }
      
      // Result or error
      if (task.result) {
        response += `\n📄 执行结果:\n${task.result.substring(0, 1000)}`;
        if (task.result.length > 1000) {
          response += '\n... (内容已截断)';
        }
      }
      if (task.error) {
        response += `\n❌ 错误: ${task.error}`;
      }
      
      return { type: 'task', success: true, response };
    }
  }

  // Check flow tasks
  const ftManager = flowTaskManager;
  if (ftManager) {
    const task = ftManager.getTask(taskId);
    if (task) {
      const report = ftManager.generateReport(taskId);
      return { type: 'task', success: true, response: report };
    }
  }

  return {
    type: 'task',
    success: false,
    response: `未找到任务: ${taskId}`,
  };
}

async function handleTaskCancel(
  taskId: string
): Promise<{ type: string; success: boolean; response: string }> {
  if (!taskId) {
    return {
      type: 'task',
      success: false,
      response: '请提供任务ID: /task cancel <task-id>',
    };
  }

  // Try long tasks
  const ltManager = longTaskManager;
  if (ltManager) {
    const task = await ltManager.cancel(taskId);
    if (task) {
      return {
        type: 'task',
        success: true,
        response: `✅ 已取消长任务: ${taskId}`,
      };
    }
  }

  // Try flow tasks
  const ftManager = flowTaskManager;
  if (ftManager) {
    const task = await ftManager.cancel(taskId);
    if (task) {
      return {
        type: 'task',
        success: true,
        response: `✅ 已取消流程任务: ${taskId}`,
      };
    }
  }

  return {
    type: 'task',
    success: false,
    response: `未找到可取消的任务: ${taskId}`,
  };
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

  // Initialize store and managers
  const store = new FileStore(getBaseDir());
  initAgentManager();
  initACPManager();
  initTaskRouter();
  await initLongTaskManager(store);
  await initFlowTaskManager(store);

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
