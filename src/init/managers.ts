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
  
  schedulerManager.registerHandler('reminder', async (data) => {
    console.log('[Scheduler] Reminder:', data?.message);
  });
  
  schedulerManager.registerHandler('daily_report', async (data) => {
    console.log('[Scheduler] Daily report for agent:', data?.agentId);
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
