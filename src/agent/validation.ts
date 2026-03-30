/**
 * Agent 配置验证
 * 
 * 提供 Agent 配置的验证功能和错误处理
 */

import { AgentConfig } from '../types/index.js';

/**
 * 验证错误类
 */
export class ValidationError extends Error {
  fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证 Agent 配置
 * @param config Agent 配置
 * @returns 验证结果
 */
export function validateAgentConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];

  // 验证 ID
  if (!config.id || config.id.trim() === '') {
    errors.push('Agent ID不能为空');
  }

  // 验证名称
  if (!config.name || config.name.trim() === '') {
    errors.push('Agent名称不能为空');
  } else if (config.name.length > 50) {
    errors.push('Agent名称不能超过50个字符');
  }

  // 验证微信账号ID
  if (!config.wechat?.accountId || config.wechat.accountId.trim() === '') {
    errors.push('微信账号ID不能为空');
  }

  // 验证工作目录
  if (!config.workspace?.path || config.workspace.path.trim() === '') {
    errors.push('工作目录路径不能为空');
  }

  // 验证 AI 配置
  if (config.ai) {
    // 验证 maxTurns
    if (config.ai.maxTurns !== undefined) {
      if (config.ai.maxTurns <= 0) {
        errors.push('maxTurns必须大于0');
      } else if (config.ai.maxTurns > 1000) {
        errors.push('maxTurns不能超过1000');
      }
    }

    // 验证 temperature
    if (config.ai.temperature !== undefined) {
      if (config.ai.temperature < 0 || config.ai.temperature > 2) {
        errors.push('temperature必须在0-2之间');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证微信ID格式
 * @param wechatId 微信ID
 * @returns 是否有效
 */
export function validateWechatId(wechatId: string): boolean {
  if (!wechatId || wechatId.trim() === '') {
    return false;
  }

  // 微信ID通常以wxid_开头
  if (!wechatId.startsWith('wxid_')) {
    return false;
  }

  // 检查长度（wxid_ + 至少1个字符）
  if (wechatId.length <= 5) {
    return false;
  }

  return true;
}

/**
 * 验证工作目录路径
 * @param path 路径
 * @returns 是否有效
 */
export function validateWorkspacePath(path: string): boolean {
  if (!path || path.trim() === '') {
    return false;
  }

  // 检查是否是有效的路径格式
  // 允许绝对路径和相对路径
  const trimmedPath = path.trim();
  
  // 至少应该包含一些字符
  if (trimmedPath.length < 2) {
    return false;
  }

  // 检查是否包含非法字符
  const illegalChars = /[<>:"|?*]/;
  if (illegalChars.test(trimmedPath)) {
    return false;
  }

  return true;
}

/**
 * 检查 Agent ID 格式是否有效
 * @param agentId Agent ID
 * @returns 是否有效
 */
export function isValidAgentId(agentId: string): boolean {
  if (!agentId || agentId.trim() === '') {
    return false;
  }

  // 格式: 名称_日期_8位随机码
  // 例如: TestAgent_20240315_abcdef12
  const pattern = /^[a-zA-Z0-9\u4e00-\u9fa5_]+_\d{8}_[a-z0-9]{8}$/;
  return pattern.test(agentId);
}

/**
 * 清理 Agent 名称
 * @param name 原始名称
 * @returns 清理后的名称
 */
export function sanitizeAgentName(name: string): string {
  if (!name) return '';

  // 替换非法字符为下划线
  let sanitized = name.replace(/[\/\\<>:"|?*]/g, '_');

  // 截断过长的名称
  const MAX_LENGTH = 50;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH);
  }

  return sanitized;
}

/**
 * 验证并抛出错误
 * @param config Agent 配置
 * @throws ValidationError 验证失败时抛出
 */
export function validateAgentConfigOrThrow(config: AgentConfig): void {
  const result = validateAgentConfig(config);
  if (!result.valid) {
    const fields: Record<string, string> = {};
    result.errors.forEach((error, index) => {
      fields[`error_${index}`] = error;
    });
    throw new ValidationError(fields);
  }
}
