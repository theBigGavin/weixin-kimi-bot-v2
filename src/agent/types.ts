/**
 * Agent 类型定义
 * 
 * 定义 Agent 领域的核心类型和工厂函数
 */

import { AgentConfig, createAgentId } from '../types/index.js';

/**
 * Agent 状态
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

/**
 * 模板类型
 */
export enum TemplateType {
  FOUNDER = 'founder',
  PROGRAMMER = 'programmer',
  WRITER = 'writer',
  VLOG_CREATOR = 'vlog-creator',
  CRYPTO_TRADER = 'crypto-trader',
  A_STOCK_TRADER = 'a-stock-trader',
  GENERAL = 'general',
}

/**
 * Agent ID 前缀
 */
export const AGENT_ID_PREFIX = 'agent';

/**
 * 默认 Agent 配置
 */
export const DEFAULT_AGENT_CONFIG = {
  ai: {
    model: 'kimi',
    templateId: TemplateType.GENERAL,
    maxTurns: 20,
    temperature: 0.7,
  },
  memory: {
    enabledL: true,
    enabledS: true,
    maxItems: 1000,
    autoExtract: true,
  },
  features: {
    scheduledTasks: true,
    notifications: true,
    fileAccess: true,
    shellExec: false,
    webSearch: true,
  },
};

/**
 * Agent 运行时状态
 */
export interface AgentRuntime {
  agentId: string;
  status: AgentStatus;
  currentContextId: string | null;
  startedAt: number;
  lastActivityAt: number | null;
  messageCount: number;
  errorCount: number;
  warnings: string[];
}

/**
 * 创建 Agent 配置参数
 */
export interface CreateAgentConfigParams {
  name: string;
  wechatAccountId: string;
  wechatNickname?: string;
  templateId?: string;
  model?: string;
  maxTurns?: number;
  temperature?: number;
  enableMemory?: boolean;
  features?: {
    shellExec?: boolean;
    webSearch?: boolean;
    fileAccess?: boolean;
    notifications?: boolean;
    scheduledTasks?: boolean;
  };
  customSystemPrompt?: string;
  baseWorkDir?: string;
}

/**
 * 创建 Agent 配置
 * @param params 创建参数
 * @returns AgentConfig
 */
export function createAgentConfig(params: CreateAgentConfigParams): AgentConfig {
  const id = createAgentId(params.name);
  const now = Date.now();
  
  // 构建工作目录路径
  const baseWorkDir = params.baseWorkDir || getDefaultBaseWorkDir();
  const workDir = `${baseWorkDir}/agents/${id}`;

  // 合并特性配置
  const features = {
    ...DEFAULT_AGENT_CONFIG.features,
    ...params.features,
  };

  // 记忆配置
  const memoryEnabled = params.enableMemory !== false;

  return {
    id,
    name: params.name,
    createdAt: now,
    wechat: {
      accountId: params.wechatAccountId,
      nickname: params.wechatNickname,
    },
    workspace: {
      path: workDir,
      createdAt: now,
    },
    ai: {
      model: params.model || DEFAULT_AGENT_CONFIG.ai.model,
      templateId: params.templateId || DEFAULT_AGENT_CONFIG.ai.templateId,
      customSystemPrompt: params.customSystemPrompt,
      maxTurns: params.maxTurns || DEFAULT_AGENT_CONFIG.ai.maxTurns,
      temperature: params.temperature ?? DEFAULT_AGENT_CONFIG.ai.temperature,
    },
    memory: {
      enabledL: memoryEnabled,
      enabledS: memoryEnabled,
      maxItems: DEFAULT_AGENT_CONFIG.memory.maxItems,
      autoExtract: DEFAULT_AGENT_CONFIG.memory.autoExtract,
    },
    features: {
      scheduledTasks: features.scheduledTasks,
      notifications: features.notifications,
      fileAccess: features.fileAccess,
      shellExec: features.shellExec,
      webSearch: features.webSearch,
    },
  };
}

/**
 * 创建 Agent 运行时状态
 * @param agentId Agent ID
 * @returns AgentRuntime
 */
export function createAgentRuntime(agentId: string): AgentRuntime {
  return {
    agentId,
    status: AgentStatus.INITIALIZING,
    currentContextId: null,
    startedAt: Date.now(),
    lastActivityAt: null,
    messageCount: 0,
    errorCount: 0,
    warnings: [],
  };
}

/**
 * 创建默认 Agent 配置
 * @param name Agent 名称
 * @param wechatAccountId 微信账号ID
 * @param overrides 覆盖的配置项
 * @returns AgentConfig
 */
export function createDefaultAgentConfig(
  name: string,
  wechatAccountId: string,
  overrides?: Partial<AgentConfig['ai']>
): AgentConfig {
  const config = createAgentConfig({
    name,
    wechatAccountId,
    templateId: DEFAULT_AGENT_CONFIG.ai.templateId,
    model: DEFAULT_AGENT_CONFIG.ai.model,
  });

  if (overrides) {
    Object.assign(config.ai, overrides);
  }

  return config;
}

/**
 * 获取默认基础工作目录
 * @returns 基础工作目录路径
 */
function getDefaultBaseWorkDir(): string {
  // 在Node.js环境中使用用户主目录
  if (typeof process !== 'undefined' && process.env) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return `${homeDir}/.weixin-kimi-bot`;
  }
  return '/tmp/.weixin-kimi-bot';
}

/**
 * Agent 运行时状态更新
 */
export interface AgentRuntimeUpdate {
  status?: AgentStatus;
  currentContextId?: string | null;
  lastActivityAt?: number;
  messageCount?: number;
  errorCount?: number;
  warnings?: string[];
}

/**
 * Agent 完整信息
 */
export interface Agent {
  config: AgentConfig;
  runtime: AgentRuntime;
  // 便捷访问属性
  id: string;
  name: string;
  ai: AgentConfig['ai'];
  memory: AgentConfig['memory'];
  wechat: AgentConfig['wechat'];
}

/**
 * 创建 Agent 实例（便捷工厂函数）
 * @param params 创建参数
 * @returns Agent 实例
 */
export function createAgent(params: {
  wechat: { accountId: string; nickname?: string };
  name?: string;
  templateId?: string;
}): Agent {
  const name = params.name || `Agent-${params.wechat.accountId.slice(0, 8)}`;
  const config = createAgentConfig({
    name,
    wechatAccountId: params.wechat.accountId,
    wechatNickname: params.wechat.nickname,
    templateId: params.templateId || TemplateType.GENERAL,
  });

  const runtime = createAgentRuntime(config.id);

  return {
    config,
    runtime,
    id: config.id,
    name: config.name,
    ai: config.ai,
    memory: config.memory,
    wechat: config.wechat,
  };
}
