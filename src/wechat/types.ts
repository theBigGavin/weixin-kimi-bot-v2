/**
 * 微信账号类型定义
 * 
 * 定义微信账号领域的核心类型和工厂函数
 * 支持 N:M 关系：一个微信账号可以绑定多个 Agent
 */

/**
 * 微信账号信息
 */
export interface WechatAccount {
  /** 微信用户唯一ID (wxid_xxxx) */
  id: string;
  /** 微信昵称 */
  nickname?: string;
  /** 头像URL */
  avatar?: string;
  /** 注册/首次登录时间 */
  createdAt: number;
  /** 最后登录时间 */
  lastLoginAt: number;
}

/**
 * Agent 绑定信息
 */
export interface AgentBinding {
  /** Agent ID */
  agentId: string;
  /** 绑定时间 */
  boundAt: number;
  /** 是否为默认Agent */
  isDefault: boolean;
  /** 绑定类型: creator(创建者) / binder(绑定者) */
  bindingType: 'creator' | 'binder';
}

/**
 * 微信账号绑定配置
 * 存储在 wechat-accounts/{prefix}/bindings.json
 */
export interface WechatBindings {
  /** 微信用户ID */
  wechatId: string;
  /** 绑定的Agent列表 */
  agents: AgentBinding[];
  /** 默认Agent ID */
  defaultAgentId?: string;
  /** 当前使用的Agent ID */
  currentAgentId?: string;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * 微信凭证信息
 * 存储在 wechat-accounts/{prefix}/credentials.json
 */
export interface WechatCredentials {
  /** 微信用户ID */
  wechatId: string;
  /** 登录token */
  token?: string;
  /** 刷新token */
  refreshToken?: string;
  /** token过期时间 */
  expiresAt?: number;
  /** 登录会话cookie */
  cookies?: Record<string, string>;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * 创建微信账号信息
 * @param id 微信用户ID
 * @param nickname 昵称（可选）
 * @returns WechatAccount
 */
export function createWechatAccount(id: string, nickname?: string): WechatAccount {
  const now = Date.now();
  return {
    id,
    nickname,
    createdAt: now,
    lastLoginAt: now,
  };
}

/**
 * 创建空的微信绑定配置
 * @param wechatId 微信用户ID
 * @returns WechatBindings
 */
export function createWechatBindings(wechatId: string): WechatBindings {
  return {
    wechatId,
    agents: [],
    updatedAt: Date.now(),
  };
}

/**
 * 创建Agent绑定信息
 * @param agentId Agent ID
 * @param bindingType 绑定类型
 * @param isDefault 是否为默认
 * @returns AgentBinding
 */
export function createAgentBinding(
  agentId: string,
  bindingType: 'creator' | 'binder' = 'creator',
  isDefault: boolean = false
): AgentBinding {
  return {
    agentId,
    boundAt: Date.now(),
    isDefault,
    bindingType,
  };
}

/**
 * 创建微信凭证
 * @param wechatId 微信用户ID
 * @returns WechatCredentials
 */
export function createWechatCredentials(wechatId: string): WechatCredentials {
  return {
    wechatId,
    updatedAt: Date.now(),
  };
}

/**
 * 绑定状态
 */
export enum BindingStatus {
  /** 成功 */
  SUCCESS = 'success',
  /** Agent不存在 */
  AGENT_NOT_FOUND = 'agent_not_found',
  /** 已达到最大绑定数 */
  MAX_BINDINGS_REACHED = 'max_bindings_reached',
  /** 私有Agent不允许绑定 */
  PRIVATE_AGENT = 'private_agent',
  /** 不在允许列表中 */
  NOT_INVITED = 'not_invited',
  /** 已经绑定 */
  ALREADY_BOUND = 'already_bound',
  /** 其他错误 */
  ERROR = 'error',
}

/**
 * 绑定结果
 */
export interface BindingResult {
  /** 是否成功 */
  success: boolean;
  /** 状态 */
  status: BindingStatus;
  /** 错误信息 */
  message?: string;
  /** Agent名称（如果成功） */
  agentName?: string;
}
