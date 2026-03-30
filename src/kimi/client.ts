/**
 * Kimi CLI 客户端
 * 
 * 提供 Kimi CLI 调用的封装和工具函数
 */

import {
  KimiResponse,
  KimiConfig,
  KimiError,
  KimiErrorCode,
  ContextMessage,
  createKimiResponse,
} from './types.js';

/**
 * 构建 Kimi CLI 命令
 * @param params 命令参数
 * @returns 完整的命令字符串
 */
export function buildKimiCommand(params: {
  prompt: string;
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  interactive?: boolean;
  maxTokens?: number;
  temperature?: number;
}): string {
  if (!params.prompt) {
    throw new Error('Prompt is required');
  }

  const parts: string[] = ['kimi'];

  if (params.model) {
    parts.push('--model', params.model);
  }

  if (params.cwd) {
    parts.push('--cwd', params.cwd);
  }

  if (params.systemPrompt) {
    parts.push('--system-prompt', escapeShellArg(params.systemPrompt));
  }

  if (params.interactive) {
    parts.push('--interactive');
  }

  if (params.maxTokens) {
    parts.push('--max-tokens', String(params.maxTokens));
  }

  if (params.temperature !== undefined) {
    parts.push('--temperature', String(params.temperature));
  }

  // 添加 prompt（需要转义）
  parts.push(escapeShellArg(params.prompt));

  return parts.join(' ');
}

/**
 * 转义 shell 参数
 * @param arg 参数值
 * @returns 转义后的参数
 */
function escapeShellArg(arg: string): string {
  // 使用单引号包裹，并将内部的单引号转义
  if (/[^a-zA-Z0-9_\-\/\.:]/.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

/**
 * 解析 Kimi CLI 输出
 * @param output CLI 原始输出
 * @returns 解析后的响应
 */
export function parseKimiOutput(output: string): KimiResponse {
  if (!output) {
    return createKimiResponse('', 0);
  }

  // 去除 ANSI 转义码
  const cleanedOutput = stripAnsiCodes(output);

  // 检查错误
  const error = detectError(cleanedOutput);
  if (error) {
    return createKimiResponse('', 0, error);
  }

  return createKimiResponse(cleanedOutput.trim(), 0);
}

/**
 * 去除 ANSI 转义码
 * @param str 输入字符串
 * @returns 清理后的字符串
 */
function stripAnsiCodes(str: string): string {
  // ANSI 转义码正则表达式
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return str.replace(ansiRegex, '');
}

/**
 * 检测错误
 * @param output 输出内容
 * @returns 错误对象或 undefined
 */
function detectError(output: string): KimiError | undefined {
  const lowerOutput = output.toLowerCase();

  if (lowerOutput.includes('authentication failed') || 
      lowerOutput.includes('unauthorized') ||
      lowerOutput.includes('401')) {
    return {
      code: KimiErrorCode.AUTH_ERROR,
      message: 'Authentication failed',
      retryable: false,
    };
  }

  if (lowerOutput.includes('timeout') || 
      lowerOutput.includes('etimedout')) {
    return {
      code: KimiErrorCode.TIMEOUT,
      message: 'Request timeout',
      retryable: true,
    };
  }

  if (lowerOutput.includes('rate limit') || 
      lowerOutput.includes('429')) {
    return {
      code: KimiErrorCode.RATE_LIMIT,
      message: 'Rate limit exceeded',
      retryable: true,
    };
  }

  if (lowerOutput.includes('network') || 
      lowerOutput.includes('econnrefused') ||
      lowerOutput.includes('enotfound')) {
    return {
      code: KimiErrorCode.NETWORK_ERROR,
      message: 'Network error',
      retryable: true,
    };
  }

  if (lowerOutput.startsWith('error:')) {
    return {
      code: KimiErrorCode.EXECUTION_ERROR,
      message: output.trim(),
      retryable: false,
    };
  }

  return undefined;
}

/**
 * 估算 token 数量
 * @param text 文本内容
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 简单的估算规则：
  // - 英文单词：每4个字符约1个token
  // - 中文字符：每个字符约1-2个token
  // - 这里使用一个保守的估算

  let tokens = 0;
  for (const char of text) {
    // 中文字符范围
    if (/[\u4e00-\u9fa5]/.test(char)) {
      tokens += 1.5; // 平均1.5个token
    } else if (/\s/.test(char)) {
      // 空白字符不计算或少量计算
      tokens += 0.1;
    } else {
      tokens += 0.25; // 其他字符每4个约1个token
    }
  }

  return Math.ceil(tokens);
}

/**
 * 格式化系统提示词
 * @param prompt 基础提示词
 * @param context 上下文信息
 * @returns 格式化后的提示词
 */
export function formatSystemPrompt(
  prompt: string,
  context?: {
    workDir?: string;
    template?: string;
    memories?: string[];
    customInstructions?: string;
  }
): string {
  if (!prompt) return '';

  const parts: string[] = [prompt];

  if (context?.workDir) {
    parts.push(`\n当前工作目录: ${context.workDir}`);
  }

  if (context?.template) {
    parts.push(`\n当前模板: ${context.template}`);
  }

  if (context?.memories && context.memories.length > 0) {
    parts.push('\n相关记忆:');
    context.memories.forEach(memory => {
      parts.push(`- ${memory}`);
    });
  }

  if (context?.customInstructions) {
    parts.push(`\n额外指令: ${context.customInstructions}`);
  }

  return parts.join('\n');
}

/**
 * 截断上下文以符合 token 限制
 * @param messages 消息列表
 * @param maxTokens 最大 token 数
 * @returns 截断后的消息列表
 */
export function truncateContext(
  messages: ContextMessage[],
  maxTokens: number
): ContextMessage[] {
  if (!messages || messages.length === 0) return [];

  let totalTokens = 0;
  const result: ContextMessage[] = [];

  // 从后向前遍历，保留最新消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content);

    if (totalTokens + messageTokens > maxTokens && result.length > 0) {
      // 已经超出限制，停止添加
      break;
    }

    result.unshift(message);
    totalTokens += messageTokens;
  }

  return result;
}

/**
 * 清理提示词中的危险字符
 * @param prompt 原始提示词
 * @returns 清理后的提示词
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt) return '';

  // 限制最大长度（约1MB文本）
  const MAX_LENGTH = 1000000;
  let sanitized = prompt;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH);
  }

  // 移除危险的 shell 字符
  // 但保留正常文本中可能使用的字符
  const dangerousPatterns = [
    /;\s*rm\s+-rf/gi,      // 删除命令
    /;\s*rm\s+-f/gi,       // 删除命令
    /`[^`]*`/g,            // 命令替换
    /\$\([^)]*\)/g,        // 命令替换
    /&&\s*rm/gi,          // 链式删除
    /\|\s*sh/gi,          // 管道到shell
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized.trim();
}
