/**
 * 创世 Agent 类型定义
 */

/**
 * 创世 Agent 标识
 * 存储位置：~/.weixin-kimi-bot/founder.json
 */
export interface FounderInfo {
  /** 创世 Agent ID */
  agentId: string;
  /** 创建者微信ID */
  creatorWechatId: string;
  /** 创建时间 */
  createdAt: number;
  /** 系统版本 */
  systemVersion: string;
}

/**
 * 创世 Agent 权限
 */
export enum FounderPermission {
  // 系统管理
  SYSTEM_CONFIG = 'system:config',       // 修改系统配置
  SYSTEM_BACKUP = 'system:backup',       // 备份系统数据
  SYSTEM_RESTORE = 'system:restore',     // 恢复系统数据
  SYSTEM_LOGS = 'system:logs',           // 查看系统日志
  
  // Agent 管理
  AGENT_CREATE = 'agent:create',         // 为其他用户创建 Agent
  AGENT_DELETE_ANY = 'agent:delete:any', // 删除任意 Agent
  AGENT_MODIFY_ANY = 'agent:modify:any', // 修改任意 Agent
  AGENT_BIND_ANY = 'agent:bind:any',     // 绑定任意 Agent 到任意用户
  
  // 用户管理
  USER_LIST = 'user:list',               // 列出所有微信用户
  USER_BINDINGS = 'user:bindings',       // 查看用户绑定关系
}

/**
 * 所有创世 Agent 权限
 */
export const ALL_FOUNDER_PERMISSIONS: FounderPermission[] = [
  FounderPermission.SYSTEM_CONFIG,
  FounderPermission.SYSTEM_BACKUP,
  FounderPermission.SYSTEM_RESTORE,
  FounderPermission.SYSTEM_LOGS,
  FounderPermission.AGENT_CREATE,
  FounderPermission.AGENT_DELETE_ANY,
  FounderPermission.AGENT_MODIFY_ANY,
  FounderPermission.AGENT_BIND_ANY,
  FounderPermission.USER_LIST,
  FounderPermission.USER_BINDINGS,
];

/**
 * 系统版本
 */
export const SYSTEM_VERSION = '1.0.0';
