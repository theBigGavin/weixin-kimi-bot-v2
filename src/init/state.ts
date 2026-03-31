/**
 * Global State Module
 * 
 * Centralizes all global state and constants.
 */

import type { DialogueMessage } from '../memory/index.js';
import type { CommandHandler } from '../handlers/command-handler.js';

// Constants
export const SESSION_EXPIRED_ERRCODE = -14;
export const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour
export const RESET_COMMANDS = new Set(['新对话', '/reset', '/clear']);
export const CONFIRM_KEYWORDS = new Set(['确认', 'confirm', 'yes', 'y', '确定', '执行', '继续', '好', 'ok']);
export const CANCEL_KEYWORDS = new Set(['取消', 'cancel', 'no', 'n', '停止', 'abort']);
export const SKIP_KEYWORDS = new Set(['跳过', 'skip', 's', 'next']);

// Global state - lazy initialization to avoid circular dependency issues
let commandHandlerInstance: CommandHandler | null = null;

export async function getCommandHandler(): Promise<CommandHandler> {
  if (!commandHandlerInstance) {
    const module = await import('../handlers/command-handler.js');
    commandHandlerInstance = new module.CommandHandler();
  }
  return commandHandlerInstance;
}

// For backward compatibility - will be set by init module
export let commandHandler: CommandHandler;

export function setCommandHandler(handler: CommandHandler): void {
  commandHandler = handler;
}

// In-memory dialogue cache for memory extraction (userId -> messages)
export const dialogueCache = new Map<string, DialogueMessage[]>();

// Track active flow tasks waiting for user confirmation
export const waitingFlowTasks = new Map<string, { taskId: string; agentId: string }>();

// ============================================================================
// Daily Statistics (for daily report)
// ============================================================================

export const dailyStats = {
  messagesReceived: 0,
  commandsExecuted: 0,
  tasksCompleted: 0,
  startTime: Date.now(),
};

export function recordMessageReceived(): void {
  dailyStats.messagesReceived++;
}

export function recordCommandExecuted(): void {
  dailyStats.commandsExecuted++;
}

export function recordTaskCompleted(): void {
  dailyStats.tasksCompleted++;
}

export function getDailyStats(): typeof dailyStats {
  return { ...dailyStats };
}

export function resetDailyStats(): void {
  dailyStats.messagesReceived = 0;
  dailyStats.commandsExecuted = 0;
  dailyStats.tasksCompleted = 0;
  dailyStats.startTime = Date.now();
}
