/**
 * Manager Initialization Module
 * 
 * Centralizes all manager initialization logic.
 */

import { ACPManager } from '../acp/index.js';
import { AgentManager } from '../agent/manager.js';
import { createAgent, type Agent } from '../agent/types.js';
import { FlowTaskManager } from '../flowtask/manager.js';
import { LongTaskManager } from '../longtask/manager.js';
import { MemoryManager, MemoryExtractor } from '../memory/index.js';
import { FileStore } from '../store.js';
import { TaskRouter } from '../task-router/index.js';
import { SchedulerManager } from '../scheduler/manager.js';
import { getBaseDir } from '../paths.js';
import { waitingFlowTasks, setCommandHandler } from './state.js';
import { CommandHandler } from '../handlers/command-handler.js';
import { NotificationService, NotificationChannel } from '../notifications/index.js';
import { createTaskNotifier, type TaskNotificationService } from '../notifications/index.js';

// Manager instances
let commandHandler: CommandHandler | null = null;
let acpManager: ACPManager | null = null;
let agentManager: AgentManager | null = null;
let taskRouter: TaskRouter | null = null;
let longTaskManager: LongTaskManager | null = null;
let flowTaskManager: FlowTaskManager | null = null;
let memoryManager: MemoryManager | null = null;
let memoryExtractor: MemoryExtractor | null = null;
let schedulerManager: SchedulerManager | null = null;
let notificationService: NotificationService | null = null;

// Map to store task notifiers per agent
const taskNotifiers = new Map<string, TaskNotificationService>();

export function initAgentManager(): AgentManager {
  if (agentManager) return agentManager;
  
  const store = new FileStore(getBaseDir());
  agentManager = new AgentManager(store);
  
  return agentManager;
}

export function initACPManager(): ACPManager {
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

export function initTaskRouter(): TaskRouter {
  if (taskRouter) return taskRouter;
  taskRouter = new TaskRouter();
  return taskRouter;
}

export function initMemoryManager(): MemoryManager {
  if (memoryManager) return memoryManager;
  
  memoryManager = new MemoryManager({
    baseDir: getBaseDir(),
  });
  
  return memoryManager;
}

export function initMemoryExtractor(): MemoryExtractor {
  if (memoryExtractor) return memoryExtractor;
  
  memoryExtractor = new MemoryExtractor({
    enabled: true,
    minDialogLength: 3,
    maxFactsPerExtraction: 3,
  });
  
  return memoryExtractor;
}

export function initSchedulerManager(): SchedulerManager {
  if (schedulerManager) return schedulerManager;
  
  schedulerManager = SchedulerManager.getInstance();
  
  // Ensure notification service is initialized
  initNotificationService();
  
  schedulerManager.registerHandler('reminder', async (data) => {
    const agentId = data?.agentId as string;
    const message = data?.message as string;
    const userId = data?.userId as string;
    
    console.log('[Scheduler] Reminder:', message);
    
    // Send via notification service if we have agent info
    if (agentId && userId) {
      const notifier = getTaskNotifier(agentId, userId);
      if (notifier) {
        await notifier.scheduledReminder(message, data);
      }
    }
  });
  
  schedulerManager.registerHandler('daily_report', async (data) => {
    const agentId = data?.agentId as string;
    const userId = data?.userId as string;
    
    console.log('[Scheduler] Daily report for agent:', agentId);
    
    if (agentId && userId) {
      const notifier = getTaskNotifier(agentId, userId);
      if (notifier) {
        await notifier.dailyReport(`日报生成时间: ${new Date().toLocaleString()}`);
      }
    }
  });
  
  schedulerManager.registerHandler('health_check', async () => {
    console.log('[Scheduler] Health check running...');
  });
  
  schedulerManager.start();
  console.log('[Scheduler] Scheduler manager started');
  
  return schedulerManager;
}

export async function initLongTaskManager(store: FileStore): Promise<LongTaskManager> {
  if (longTaskManager) return longTaskManager;

  const manager = new LongTaskManager({
    maxConcurrent: 3,
    pollInterval: 5000,
    timeout: 30 * 60 * 1000,
    store,
    acpManager: initACPManager(),
  });

  manager.setCallbacks({
    onProgress: async (taskId: string, progress: number, message: string) => {
      console.log(`[LongTask ${taskId}] Progress: ${progress}% - ${message}`);
    },
    onComplete: async (taskId: string) => {
      console.log(`[LongTask ${taskId}] Completed`);
    },
    onFail: async (taskId: string, error: string) => {
      console.error(`[LongTask ${taskId}] Failed: ${error}`);
    },
  });

  await manager.loadTasks();
  
  longTaskManager = manager;
  return manager;
}

export async function initFlowTaskManager(store: FileStore): Promise<FlowTaskManager> {
  if (flowTaskManager) return flowTaskManager;

  const manager = new FlowTaskManager({
    store,
    acpManager: initACPManager(),
  });

  manager.setCallbacks({
    onWaitingConfirm: async (taskId: string, step) => {
      console.log(`[FlowTask ${taskId}] Waiting for confirmation on step: ${step.description}`);
    },
    onStepComplete: async (taskId: string, stepIndex: number) => {
      console.log(`[FlowTask ${taskId}] Step ${stepIndex} completed`);
    },
    onComplete: async (taskId: string) => {
      console.log(`[FlowTask ${taskId}] All steps completed`);
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

  await manager.loadTasks();
  
  flowTaskManager = manager;
  return manager;
}

export async function getAgent(agentId: string, fromUser: string): Promise<Agent> {
  const manager = initAgentManager();
  const agent = await manager.getAgent(agentId);
  
  if (agent) {
    return agent;
  }
  
  return createAgent({
    wechat: { accountId: fromUser },
  });
}

// Export getters for other modules
export function getAcpManager(): ACPManager | null { return acpManager; }
export function getAgentManager(): AgentManager | null { return agentManager; }
export function getTaskRouter(): TaskRouter | null { return taskRouter; }
export function getLongTaskManager(): LongTaskManager | null { return longTaskManager; }
export function getFlowTaskManager(): FlowTaskManager | null { return flowTaskManager; }
export function getMemoryManager(): MemoryManager | null { return memoryManager; }
export function getMemoryExtractor(): MemoryExtractor | null { return memoryExtractor; }
export function getSchedulerManager(): SchedulerManager | null { return schedulerManager; }

export function initCommandHandler(): CommandHandler {
  if (commandHandler) return commandHandler;
  
  commandHandler = new CommandHandler();
  setCommandHandler(commandHandler);
  return commandHandler;
}

export function getCommandHandler(): CommandHandler | null { return commandHandler; }

// ============================================================================
// Notification Service
// ============================================================================

export function initNotificationService(): NotificationService {
  if (notificationService) return notificationService;
  
  notificationService = new NotificationService();
  
  // Register console channel (always available)
  notificationService.registerChannel(NotificationChannel.CONSOLE, async (notification) => {
    console.log(`[Notification] ${notification.title}: ${notification.message}`);
  });
  
  notificationService.setDefaultChannel(NotificationChannel.CONSOLE);
  
  console.log('[Notification] Notification service initialized');
  return notificationService;
}

export function getNotificationService(): NotificationService | null {
  return notificationService;
}

/**
 * Register WeChat notification channel for an agent
 * This should be called when an agent client is initialized
 */
export function registerWechatChannel(
  agentId: string, 
  sender: (notification: { title: string; message: string; data?: Record<string, unknown> }) => Promise<void>
): void {
  if (!notificationService) {
    throw new Error('Notification service not initialized');
  }
  
  const channelName = `${NotificationChannel.WECHAT}_${agentId}`;
  
  notificationService.registerChannel(channelName as NotificationChannel, async (notification) => {
    await sender({
      title: notification.title,
      message: notification.message,
      data: notification.data,
    });
  });
  
  console.log(`[Notification] WeChat channel registered for agent: ${agentId}`);
}

/**
 * Get or create a task notifier for an agent
 */
export function getTaskNotifier(agentId: string, userId: string): TaskNotificationService | null {
  if (!notificationService) return null;
  
  const key = `${agentId}:${userId}`;
  const existingNotifier = taskNotifiers.get(key);
  
  if (existingNotifier) {
    return existingNotifier;
  }
  
  // Try to get agent-specific WeChat channel, fallback to console
  const channelName = `${NotificationChannel.WECHAT}_${agentId}` as NotificationChannel;
  const hasWechatChannel = notificationService.getRegisteredChannels().includes(channelName);
  
  const notifier = createTaskNotifier(
    notificationService,
    agentId,
    userId,
    hasWechatChannel ? channelName : NotificationChannel.CONSOLE
  );
  
  taskNotifiers.set(key, notifier);
  return notifier;
}
