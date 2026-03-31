/**
 * Agent ID 生成器
 * 
 * 实现新的 Agent ID 格式：{名称}_{微信ID前8位}_{4位随机码}
 * 示例：小助手_a1b2c3d4_x7k9
 */

/**
 * Agent ID 正则表达式
 * 格式：名称_微信前缀_随机码
 * - 名称：字母、数字、中文、下划线（至少1个字符）
 * - 微信前缀：1-8位字母数字
 * - 随机码：4位小写字母数字
 * 
 * 注意：使用正向肯定查找确保各部分都存在
 */
export const AGENT_ID_PATTERN = /^[a-zA-Z0-9\u4e00-\u9fa5_]+_[a-zA-Z0-9]{1,8}_[a-z0-9]{4}$/;

/**
 * Agent ID 组成部分
 */
export interface AgentIdParts {
  /** Agent 名称 */
  name: string;
  /** 微信ID前缀（前8位） */
  wechatPrefix: string;
  /** 4位随机码 */
  randomCode: string;
}

/**
 * 生成随机字符串
 * @param length 字符串长度
 * @param chars 字符集
 * @returns 随机字符串
 */
function generateRandomString(length: number, chars: string): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 清理 Agent 名称
 * - 保留：字母、数字、中文、下划线
 * - 替换其他特殊字符为下划线
 * - 去除连续下划线和首尾下划线
 * @param name 原始名称
 * @returns 清理后的名称
 */
export function sanitizeAgentName(name: string): string {
  // 替换特殊字符为下划线（保留字母、数字、中文、下划线）
  let sanitized = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_');
  
  // 合并连续的下划线
  sanitized = sanitized.replace(/_+/g, '_');
  
  // 去除首尾下划线
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  
  return sanitized;
}

/**
 * 提取微信ID前缀
 * - 去除 wxid_ 前缀
 * - 取前8位
 * @param wechatId 微信ID
 * @returns 前缀（1-8位）
 */
export function extractWechatPrefix(wechatId: string): string {
  // 去除 wxid_ 前缀
  let cleaned = wechatId;
  if (cleaned.startsWith('wxid_')) {
    cleaned = cleaned.slice(5);
  }
  
  // 取前8位
  return cleaned.slice(0, 8);
}

/**
 * 生成 Agent ID
 * 格式：{清理后的名称}_{微信ID前8位}_{4位随机码}
 * 
 * @param name Agent 名称
 * @param wechatId 微信用户ID
 * @returns Agent ID
 */
export function generateAgentId(name: string, wechatId: string): string {
  const sanitizedName = sanitizeAgentName(name);
  const wechatPrefix = extractWechatPrefix(wechatId);
  const randomCode = generateRandomString(4, 'abcdefghijklmnopqrstuvwxyz0123456789');
  
  return `${sanitizedName}_${wechatPrefix}_${randomCode}`;
}

/**
 * 解析 Agent ID
 * @param agentId Agent ID
 * @returns 组成部分，无效ID返回 null
 */
export function parseAgentId(agentId: string): AgentIdParts | null {
  if (!isValidAgentId(agentId)) {
    return null;
  }
  
  // 从后往前分割，因为名称可能包含下划线
  const lastUnderscoreIndex = agentId.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return null;
  
  const randomCode = agentId.slice(lastUnderscoreIndex + 1);
  const rest = agentId.slice(0, lastUnderscoreIndex);
  
  const secondLastUnderscoreIndex = rest.lastIndexOf('_');
  if (secondLastUnderscoreIndex === -1) return null;
  
  const wechatPrefix = rest.slice(secondLastUnderscoreIndex + 1);
  const name = rest.slice(0, secondLastUnderscoreIndex);
  
  return {
    name,
    wechatPrefix,
    randomCode,
  };
}

/**
 * 验证 Agent ID 格式
 * @param agentId Agent ID
 * @returns 是否有效
 */
export function isValidAgentId(agentId: string): boolean {
  if (!agentId || typeof agentId !== 'string') {
    return false;
  }
  
  return AGENT_ID_PATTERN.test(agentId);
}
