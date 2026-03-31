/**
 * Kimi CLI Module
 * 
 * Provides Kimi CLI integration for executing AI requests
 */

// Types
export type {
  KimiError,
  KimiResponse,
  KimiConfig,
  KimiRequest,
  ContextMessage,
} from './types.js';

export {
  isKimiError,
  createKimiResponse,
  createKimiError,
  KimiErrorCode,
} from './types.js';

// Executor
export type {
  KimiExecutorOptions,
  KimiExecutionResult,
} from './executor.js';

export {
  buildKimiCommand,
  parseKimiOutput,
  executeKimi,
} from './executor.js';

// Client utilities (legacy compatibility)
export {
  formatSystemPrompt,
  sanitizePrompt,
  estimateTokens,
  truncateContext,
} from './client.js';
