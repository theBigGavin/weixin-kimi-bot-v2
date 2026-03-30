/**
 * Kimi CLI 类型定义
 * 
 * 定义 Kimi CLI 调用相关的类型和工具函数
 */

/**
 * Kimi 调用错误
 */
export interface KimiError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

/**
 * Kimi 调用响应
 */
export interface KimiResponse {
  text: string;
  durationMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: KimiError;
}

/**
 * Kimi 调用配置
 */
export interface KimiConfig {
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  interactive?: boolean;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Kimi 调用请求
 */
export interface KimiRequest {
  prompt: string;
  config?: KimiConfig;
}

/**
 * 上下文消息
 */
export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

/**
 * 检查是否为 KimiError
 * @param error 错误对象
 * @returns 是否为 KimiError
 */
export function isKimiError(error: unknown): error is KimiError {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === 'string' &&
    typeof e.message === 'string' &&
    typeof e.retryable === 'boolean'
  );
}

/**
 * 创建 Kimi 响应
 * @param text 响应文本
 * @param durationMs 耗时
 * @param error 错误信息
 * @returns KimiResponse
 */
export function createKimiResponse(
  text: string,
  durationMs: number,
  error?: KimiError
): KimiResponse {
  return {
    text,
    durationMs,
    error,
  };
}

/**
 * 创建 Kimi 错误
 * @param code 错误码
 * @param message 错误消息
 * @param retryable 是否可重试
 * @returns KimiError
 */
export function createKimiError(
  code: string,
  message: string,
  retryable: boolean = false
): KimiError {
  return {
    code,
    message,
    retryable,
  };
}

/**
 * 预定义的错误码
 */
export const KimiErrorCode = {
  TIMEOUT: 'TIMEOUT',
  AUTH_ERROR: 'AUTH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_PROMPT: 'INVALID_PROMPT',
  CLI_NOT_FOUND: 'CLI_NOT_FOUND',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;
