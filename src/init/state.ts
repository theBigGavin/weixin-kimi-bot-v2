/**
 * Global State Module
 * 
 * Centralizes all global state and constants.
 */

import { CommandHandler } from '../handlers/command-handler.js';
import type { DialogueMessage } from '../memory/index.js';

// Constants
export const SESSION_EXPIRED_ERRCODE = -14;
export const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour
export const RESET_COMMANDS = new Set(['新对话', '/reset', '/clear']);
export const CONFIRM_KEYWORDS = new Set(['确认', 'confirm', 'yes', 'y', '确定', '执行', '继续', '好', 'ok']);
export const CANCEL_KEYWORDS = new Set(['取消', 'cancel', 'no', 'n', '停止', 'abort']);
export const SKIP_KEYWORDS = new Set(['跳过', 'skip', 's', 'next']);

// Global state
export const commandHandler = new CommandHandler();

// In-memory dialogue cache for memory extraction (userId -> messages)
export const dialogueCache = new Map<string, DialogueMessage[]>();

// Track active flow tasks waiting for user confirmation
export const waitingFlowTasks = new Map<string, { taskId: string; agentId: string }>();
