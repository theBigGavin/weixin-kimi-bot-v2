/**
 * Agent 生命周期管理器
 * 
 * 提供 Agent 的创建、查询、更新、删除和状态管理功能
 */

/** 移除 readonly 修饰符的辅助类型 */
export type Writable<T> = { -readonly [P in keyof T]: T[P] };

import { mkdir } from 'fs/promises';
import { AgentConfig } from '../types/index.js';
import { Store } from '../store.js';
import {
  Agent,
  AgentRuntime,
  AgentStatus,
  CreateAgentConfigParams,
  createAgentConfig,
  createAgentRuntime,
} from './types.js';
import { ValidationError, validateAgentConfig } from './validation.js';
import { getTemplateById } from '../templates/definitions.js';
import { getDefaultLogger } from '../logging/index.js';

/**
 * Agent 管理器
 */
export class AgentManager {
  private store: Store;
  private runtimes: Map<string, AgentRuntime> = new Map();

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * 创建新的 Agent
   * @param params 创建参数
   * @returns 创建的 Agent
   */
  async createAgent(params: CreateAgentConfigParams): Promise<Agent> {
    // 验证输入
    if (!params.name || params.name.trim() === '') {
      throw new ValidationError({ name: 'Agent名称不能为空' });
    }

    if (!params.wechatAccountId || params.wechatAccountId.trim() === '') {
      throw new ValidationError({ wechatAccountId: '微信账号ID不能为空' });
    }

    // 应用模板配置
    let finalParams = { ...params };
    if (params.templateId) {
      const template = getTemplateById(params.templateId);
      if (template) {
        // 使用模板的默认模型和配置
        finalParams.model = params.model || template.defaults.model;
        finalParams.maxTurns = params.maxTurns || template.defaults.maxTurns;
        finalParams.temperature = params.temperature ?? template.defaults.temperature;
        
        // 根据模板工具权限设置特性
        if (!finalParams.features) {
          finalParams.features = {};
        }
        if (params.features?.shellExec === undefined) {
          finalParams.features.shellExec = template.tools.codeExecution;
        }
        if (params.features?.webSearch === undefined) {
          finalParams.features.webSearch = template.tools.webSearch;
        }
        if (params.features?.fileAccess === undefined) {
          finalParams.features.fileAccess = template.tools.fileOperations;
        }
      }
    }

    // 创建配置
    const config = createAgentConfig(finalParams);

    // 验证完整配置
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      const fields: Record<string, string> = {};
      validation.errors.forEach((error, index) => {
        fields[`error_${index}`] = error;
      });
      throw new ValidationError(fields);
    }

    // 创建运行时
    const runtime = createAgentRuntime(config.id);
    this.runtimes.set(config.id, runtime);

    // 构建 Agent 对象（包含便捷访问属性）
    const agent: Agent = {
      config,
      runtime,
      id: config.id,
      name: config.name,
      ai: config.ai,
      memory: config.memory,
      wechat: config.wechat,
    };

    // 创建工作目录（如果不存在）
    try {
      await mkdir(config.workspace.path, { recursive: true });
      getDefaultLogger().debug(`[AgentManager] Created workspace directory: ${config.workspace.path}`);
    } catch (error) {
      getDefaultLogger().warn(`[AgentManager] Failed to create workspace directory: ${config.workspace.path}`, error);
      // 不阻断 Agent 创建流程，但记录警告
    }

    // 保存到存储
    await this.saveAgent(agent);

    return agent;
  }

  /**
   * 获取 Agent
   * @param agentId Agent ID
   * @returns Agent 或 null
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    const data = await this.store.get<{ config: AgentConfig; runtime?: AgentRuntime }>(
      `agents/${agentId}`
    );

    if (!data) {
      return null;
    }

    // 获取或重建运行时
    let runtime = this.runtimes.get(agentId);
    if (!runtime && data.runtime) {
      runtime = data.runtime;
      this.runtimes.set(agentId, runtime);
    } else if (!runtime) {
      runtime = createAgentRuntime(agentId);
      this.runtimes.set(agentId, runtime);
    }

    // 构建完整的 Agent 对象（包含便捷访问属性）
    return {
      config: data.config,
      runtime,
      id: data.config.id,
      name: data.config.name,
      ai: data.config.ai,
      memory: data.config.memory,
      wechat: data.config.wechat,
    };
  }

  /**
   * 列出所有 Agent
   * @returns Agent 列表
   */
  async listAgents(): Promise<Agent[]> {
    const keys = await this.store.keys();
    // 只匹配一级 agent 键，排除子数据项（如 agents:xxx:credentials）
    // 匹配 agents:agentId 或 agents/agentId，但不匹配 agents:agentId:subkey
    const agentKeys = keys.filter(key => /^agents:[^:]+$/.test(key) || /^agents\/[^\/]+$/.test(key));

    const agents: Agent[] = [];
    for (const key of agentKeys) {
      const agentId = key.replace(/^agents[:\/]/, '');
      const agent = await this.getAgent(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * 更新 Agent 配置
   * @param agentId Agent ID
   * @param updates 更新的字段
   * @returns 更新后的 Agent
   */
  async updateAgent(
    agentId: string,
    updates: {
      name?: string;
      customSystemPrompt?: string;
      maxTurns?: number;
      temperature?: number;
      features?: Partial<AgentConfig['features']>;
      memory?: Partial<AgentConfig['memory']>;
      // Phase III: 共享绑定相关字段
      visibility?: 'private' | 'shared' | 'invite_only';
      maxBindings?: number;
      currentBindingCount?: number;
      allowedWechatIds?: string[];
    }
  ): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // 创建新的配置对象（不可变更新）
    const newConfig: AgentConfig = {
      ...agent.config,
      ai: { ...agent.config.ai },
      features: { ...agent.config.features },
      memory: { ...agent.config.memory },
      wechat: { ...agent.config.wechat },
      workspace: { ...agent.config.workspace },
      allowedWechatIds: [...agent.config.allowedWechatIds],
    };

    // 应用更新
    if (updates.name !== undefined) {
      (newConfig as Writable<typeof newConfig>).name = updates.name;
    }
    if (updates.customSystemPrompt !== undefined) {
      (newConfig.ai as Writable<typeof newConfig.ai>).customSystemPrompt = updates.customSystemPrompt;
    }
    if (updates.maxTurns !== undefined) {
      (newConfig.ai as Writable<typeof newConfig.ai>).maxTurns = updates.maxTurns;
    }
    if (updates.temperature !== undefined) {
      (newConfig.ai as Writable<typeof newConfig.ai>).temperature = updates.temperature;
    }
    if (updates.features) {
      Object.assign(newConfig.features, updates.features);
    }
    if (updates.memory) {
      Object.assign(newConfig.memory, updates.memory);
    }
    // Phase III: 共享绑定字段
    if (updates.visibility !== undefined) {
      (newConfig as Writable<typeof newConfig>).visibility = updates.visibility;
    }
    if (updates.maxBindings !== undefined) {
      (newConfig as Writable<typeof newConfig>).maxBindings = updates.maxBindings;
    }
    if (updates.currentBindingCount !== undefined) {
      (newConfig as Writable<typeof newConfig>).currentBindingCount = updates.currentBindingCount;
    }
    if (updates.allowedWechatIds !== undefined) {
      (newConfig as Writable<typeof newConfig>).allowedWechatIds = updates.allowedWechatIds;
    }

    // 验证更新后的配置
    const validation = validateAgentConfig(newConfig);
    if (!validation.valid) {
      throw new ValidationError({ update: validation.errors.join(', ') });
    }

    // 更新 agent 配置
    const updatedAgent: Agent = {
      ...agent,
      config: newConfig,
    };

    // 保存
    await this.saveAgent(updatedAgent);

    return updatedAgent;
  }

  /**
   * 删除 Agent
   * @param agentId Agent ID
   */
  async deleteAgent(agentId: string): Promise<void> {
    // 删除运行时
    this.runtimes.delete(agentId);

    // 删除存储
    await this.store.delete(`agents/${agentId}`);
  }

  /**
   * 激活 Agent
   * @param agentId Agent ID
   * @returns 更新后的 Agent
   */
  async activateAgent(agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.runtime.status = AgentStatus.ACTIVE;
    agent.runtime.lastActivityAt = Date.now();
    
    await this.saveAgent(agent);
    
    return agent;
  }

  /**
   * 暂停 Agent
   * @param agentId Agent ID
   * @returns 更新后的 Agent
   */
  async pauseAgent(agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.runtime.status = AgentStatus.PAUSED;
    agent.runtime.lastActivityAt = Date.now();
    
    await this.saveAgent(agent);
    
    return agent;
  }

  /**
   * 构建或获取运行时
   * @param agentId Agent ID
   * @returns AgentRuntime
   */
  buildRuntime(agentId: string): AgentRuntime {
    let runtime = this.runtimes.get(agentId);
    if (!runtime) {
      runtime = createAgentRuntime(agentId);
      this.runtimes.set(agentId, runtime);
    }
    return runtime;
  }

  /**
   * 获取运行时
   * @param agentId Agent ID
   * @returns AgentRuntime 或 null
   */
  getRuntime(agentId: string): AgentRuntime | null {
    return this.runtimes.get(agentId) || null;
  }

  /**
   * 记录消息活动
   * @param agentId Agent ID
   */
  async recordMessageActivity(agentId: string): Promise<void> {
    const runtime = this.getRuntime(agentId);
    if (runtime) {
      runtime.messageCount++;
      runtime.lastActivityAt = Date.now();
      
      // 保存运行时状态
      await this.saveRuntime(agentId, runtime);
    }
  }

  /**
   * 记录错误
   * @param agentId Agent ID
   * @param error 错误对象
   */
  async recordError(agentId: string, error: Error): Promise<void> {
    const runtime = this.getRuntime(agentId);
    if (runtime) {
      runtime.errorCount++;
      runtime.warnings.push(error.message);
      runtime.lastActivityAt = Date.now();

      // 如果错误太多，更新状态
      if (runtime.errorCount > 10) {
        runtime.status = AgentStatus.ERROR;
      }

      await this.saveRuntime(agentId, runtime);
    }
  }

  /**
   * 保存 Agent
   * @param agent Agent 对象
   */
  private async saveAgent(agent: Agent): Promise<void> {
    await this.store.set(`agents/${agent.config.id}`, {
      config: agent.config,
      runtime: agent.runtime,
    });
  }

  /**
   * 保存运行时
   * @param agentId Agent ID
   * @param runtime 运行时状态
   */
  private async saveRuntime(agentId: string, runtime: AgentRuntime): Promise<void> {
    const data = await this.store.get<{ config: AgentConfig }>(`agents/${agentId}`);
    if (data) {
      await this.store.set(`agents/${agentId}`, {
        config: data.config,
        runtime,
      });
    }
  }

  // ===== Phase III: 共享绑定功能 =====

  /**
   * 检查微信用户是否可以绑定指定 Agent
   * @param agentId Agent ID
   * @param wechatId 微信用户ID
   * @returns 是否可以绑定
   */
  async canBind(agentId: string, wechatId: string): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    if (!agent) return false;

    const config = agent.config;

    // 检查是否已满
    if (config.currentBindingCount >= config.maxBindings) {
      return false;
    }

    // 检查是否为创建者（创建者已经绑定）
    if (config.primaryWechatId === wechatId) {
      return false; // 创建者不需要再次绑定
    }

    // 根据可见性判断
    switch (config.visibility) {
      case 'private':
        // 私有：不允许其他人绑定
        return false;

      case 'shared':
        // 共享：任何人都可以绑定
        return true;

      case 'invite_only':
        // 邀请制：检查是否在允许列表中
        return config.allowedWechatIds?.includes(wechatId) || false;

      default:
        return false;
    }
  }

  /**
   * 获取无法绑定的原因
   * @param agentId Agent ID
   * @param wechatId 微信用户ID
   * @returns 原因描述
   */
  async getBindRejectionReason(agentId: string, wechatId: string): Promise<string> {
    const agent = await this.getAgent(agentId);
    if (!agent) return 'Agent 不存在';

    const config = agent.config;

    if (config.currentBindingCount >= config.maxBindings) {
      return 'Agent 已达到最大绑定用户数';
    }

    if (config.primaryWechatId === wechatId) {
      return '您是此 Agent 的创建者';
    }

    switch (config.visibility) {
      case 'private':
        return '此 Agent 为私有，不接受绑定';
      case 'invite_only':
        return '此 Agent 为邀请制，您不在允许列表中';
      default:
        return '无法绑定';
    }
  }

  /**
   * 检查是否为 Agent 所有者（创建者）
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否为所有者
   */
  async isAgentOwner(wechatId: string, agentId: string): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    if (!agent) return false;
    return agent.config.primaryWechatId === wechatId;
  }

  /**
   * 增加绑定计数
   * @param agentId Agent ID
   */
  async incrementBindingCount(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const newCount = agent.config.currentBindingCount + 1;
    await this.updateAgent(agentId, {
      currentBindingCount: newCount,
    });
  }

  /**
   * 减少绑定计数
   * @param agentId Agent ID
   */
  async decrementBindingCount(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    if (agent.config.currentBindingCount > 0) {
      const newCount = agent.config.currentBindingCount - 1;
      await this.updateAgent(agentId, {
        currentBindingCount: newCount,
      });
    }
  }

  /**
   * 添加允许绑定的用户 (invite_only 模式)
   * @param agentId Agent ID
   * @param wechatId 微信用户ID
   */
  async addAllowedUser(agentId: string, wechatId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const allowedIds = [...agent.config.allowedWechatIds];
    if (!allowedIds.includes(wechatId)) {
      allowedIds.push(wechatId);
      await this.updateAgent(agentId, {
        allowedWechatIds: allowedIds,
      });
    }
  }

  /**
   * 移除允许绑定的用户
   * @param agentId Agent ID
   * @param wechatId 微信用户ID
   */
  async removeAllowedUser(agentId: string, wechatId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    const allowedIds = agent.config.allowedWechatIds.filter(id => id !== wechatId);
    if (allowedIds.length !== agent.config.allowedWechatIds.length) {
      await this.updateAgent(agentId, {
        allowedWechatIds: allowedIds,
      });
    }
  }

  /**
   * 列出所有共享的 Agent (visibility = shared)
   * @returns Agent 列表
   */
  async listSharedAgents(): Promise<Agent[]> {
    const allAgents = await this.listAgents();
    return allAgents.filter(agent => agent.config.visibility === 'shared');
  }
}
