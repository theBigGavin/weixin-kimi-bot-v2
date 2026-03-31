/**
 * 微信账号管理器
 * 
 * 管理微信账号的生命周期、凭证存储和 Agent 绑定关系
 * 实现 N:M 关系：一个微信账号可以绑定多个 Agent
 */

import { Store } from '../store.js';
import {
  WechatAccount,
  WechatBindings,
  WechatCredentials,
  BindingStatus,
  BindingResult,
  createWechatAccount,
  createWechatBindings,
  createAgentBinding,
  createWechatCredentials,
} from './types.js';

/**
 * 微信账号管理器
 */
export class WechatManager {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  // ===== 账号管理 =====

  /**
   * 创建或更新微信账号
   * @param id 微信用户ID
   * @param nickname 昵称（可选）
   * @returns WechatAccount
   */
  async createAccount(id: string, nickname?: string): Promise<WechatAccount> {
    const account = createWechatAccount(id, nickname);
    
    // 保存到用户命名空间
    const nsStore = this.getWechatStore(id);
    await nsStore.set('account', account);
    
    // 初始化绑定配置
    const bindings = createWechatBindings(id);
    await nsStore.set('bindings', bindings);
    
    return account;
  }

  /**
   * 获取微信账号信息
   * @param id 微信用户ID
   * @returns WechatAccount 或 null
   */
  async getAccount(id: string): Promise<WechatAccount | null> {
    const nsStore = this.getWechatStore(id);
    return nsStore.get<WechatAccount>('account');
  }

  /**
   * 更新账号最后登录时间
   * @param id 微信用户ID
   */
  async updateLastLogin(id: string): Promise<void> {
    const nsStore = this.getWechatStore(id);
    const account = await nsStore.get<WechatAccount>('account');
    if (account) {
      account.lastLoginAt = Date.now();
      await nsStore.set('account', account);
    }
  }

  /**
   * 检查账号是否存在
   * @param id 微信用户ID
   * @returns 是否存在
   */
  async hasAccount(id: string): Promise<boolean> {
    const nsStore = this.getWechatStore(id);
    return nsStore.has('account');
  }

  // ===== 凭证管理 =====

  /**
   * 保存微信凭证（按用户隔离）
   * @param wechatId 微信用户ID
   * @param credentials 凭证信息
   */
  async saveCredentials(
    wechatId: string,
    credentials: Partial<WechatCredentials>
  ): Promise<void> {
    const nsStore = this.getWechatStore(wechatId);
    const existing = await nsStore.get<WechatCredentials>('credentials');
    
    const updated: WechatCredentials = {
      ...createWechatCredentials(wechatId),
      ...existing,
      ...credentials,
      wechatId,
      updatedAt: Date.now(),
    };
    
    await nsStore.set('credentials', updated);
  }

  /**
   * 获取微信凭证
   * @param wechatId 微信用户ID
   * @returns WechatCredentials 或 null
   */
  async getCredentials(wechatId: string): Promise<WechatCredentials | null> {
    const nsStore = this.getWechatStore(wechatId);
    return nsStore.get<WechatCredentials>('credentials');
  }

  /**
   * 删除微信凭证
   * @param wechatId 微信用户ID
   */
  async deleteCredentials(wechatId: string): Promise<void> {
    const nsStore = this.getWechatStore(wechatId);
    await nsStore.delete('credentials');
  }

  // ===== Agent 绑定管理 =====

  /**
   * 绑定 Agent 到微信账号
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @param isDefault 是否为默认Agent
   * @param bindingType 绑定类型
   * @returns BindingResult
   */
  async bindAgent(
    wechatId: string,
    agentId: string,
    isDefault: boolean = false,
    bindingType: 'creator' | 'binder' = 'creator'
  ): Promise<BindingResult> {
    const nsStore = this.getWechatStore(wechatId);
    const bindings = await nsStore.get<WechatBindings>('bindings') || createWechatBindings(wechatId);

    // 检查是否已绑定
    const existingIndex = bindings.agents.findIndex(b => b.agentId === agentId);
    if (existingIndex !== -1) {
      return {
        success: false,
        status: BindingStatus.ALREADY_BOUND,
        message: '您已绑定此 Agent',
      };
    }

    // 创建绑定
    const binding = createAgentBinding(agentId, bindingType, isDefault);
    bindings.agents.push(binding);

    // 如果是第一个绑定或设置为默认，更新默认Agent
    if (isDefault || bindings.agents.length === 1) {
      bindings.defaultAgentId = agentId;
    }

    bindings.updatedAt = Date.now();
    await nsStore.set('bindings', bindings);

    return {
      success: true,
      status: BindingStatus.SUCCESS,
      agentName: agentId, // 调用方可以替换为实际的Agent名称
    };
  }

  /**
   * 解绑 Agent
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否成功
   */
  async unbindAgent(wechatId: string, agentId: string): Promise<boolean> {
    const nsStore = this.getWechatStore(wechatId);
    const bindings = await nsStore.get<WechatBindings>('bindings');
    
    if (!bindings) return false;

    const index = bindings.agents.findIndex(b => b.agentId === agentId);
    if (index === -1) return false;

    // 移除绑定
    bindings.agents.splice(index, 1);

    // 如果解绑的是默认Agent，需要更新默认
    if (bindings.defaultAgentId === agentId) {
      bindings.defaultAgentId = bindings.agents.length > 0 ? bindings.agents[0].agentId : undefined;
    }

    // 如果解绑的是当前使用的Agent，清除当前
    if (bindings.currentAgentId === agentId) {
      bindings.currentAgentId = undefined;
    }

    bindings.updatedAt = Date.now();
    await nsStore.set('bindings', bindings);

    return true;
  }

  /**
   * 获取绑定配置
   * @param wechatId 微信用户ID
   * @returns WechatBindings 或 null
   */
  async getBindings(wechatId: string): Promise<WechatBindings | null> {
    const nsStore = this.getWechatStore(wechatId);
    return nsStore.get<WechatBindings>('bindings');
  }

  /**
   * 获取绑定的 Agent ID 列表
   * @param wechatId 微信用户ID
   * @returns Agent ID 数组
   */
  async getBoundAgentIds(wechatId: string): Promise<string[]> {
    const bindings = await this.getBindings(wechatId);
    return bindings?.agents.map(b => b.agentId) || [];
  }

  /**
   * 检查是否已绑定指定 Agent
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否已绑定
   */
  async isBound(wechatId: string, agentId: string): Promise<boolean> {
    const bindings = await this.getBindings(wechatId);
    return bindings?.agents.some(b => b.agentId === agentId) || false;
  }

  /**
   * 设置默认 Agent
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否成功
   */
  async setDefaultAgent(wechatId: string, agentId: string): Promise<boolean> {
    const nsStore = this.getWechatStore(wechatId);
    const bindings = await nsStore.get<WechatBindings>('bindings');
    
    if (!bindings) return false;

    // 检查是否已绑定
    const binding = bindings.agents.find(b => b.agentId === agentId);
    if (!binding) return false;

    // 更新默认标记
    bindings.agents.forEach(b => b.isDefault = false);
    binding.isDefault = true;
    bindings.defaultAgentId = agentId;
    bindings.updatedAt = Date.now();

    await nsStore.set('bindings', bindings);
    return true;
  }

  /**
   * 获取默认 Agent ID
   * @param wechatId 微信用户ID
   * @returns Agent ID 或 undefined
   */
  async getDefaultAgentId(wechatId: string): Promise<string | undefined> {
    const bindings = await this.getBindings(wechatId);
    return bindings?.defaultAgentId;
  }

  /**
   * 设置当前使用的 Agent
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否成功
   */
  async setCurrentAgent(wechatId: string, agentId: string): Promise<boolean> {
    const nsStore = this.getWechatStore(wechatId);
    const bindings = await nsStore.get<WechatBindings>('bindings');
    
    if (!bindings) return false;

    // 检查是否已绑定
    const exists = bindings.agents.some(b => b.agentId === agentId);
    if (!exists) return false;

    bindings.currentAgentId = agentId;
    bindings.updatedAt = Date.now();

    await nsStore.set('bindings', bindings);
    return true;
  }

  /**
   * 获取当前使用的 Agent ID
   * @param wechatId 微信用户ID
   * @returns Agent ID 或 undefined
   */
  async getCurrentAgentId(wechatId: string): Promise<string | undefined> {
    const bindings = await this.getBindings(wechatId);
    // 优先返回当前，如果没有则返回默认
    return bindings?.currentAgentId || bindings?.defaultAgentId;
  }

  /**
   * 更新绑定信息（如最后使用时间）
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   */
  async updateBindingActivity(wechatId: string, agentId: string): Promise<void> {
    const nsStore = this.getWechatStore(wechatId);
    const bindings = await nsStore.get<WechatBindings>('bindings');
    
    if (!bindings) return;

    const binding = bindings.agents.find(b => b.agentId === agentId);
    if (binding) {
      // 可以在这里扩展记录最后使用时间
      bindings.updatedAt = Date.now();
      await nsStore.set('bindings', bindings);
    }
  }

  // ===== 跨账号查询 =====

  /**
   * 获取所有绑定了指定 Agent 的微信用户
   * @param agentId Agent ID
   * @returns 微信ID数组
   */
  async getWechatIdsByAgent(agentId: string): Promise<string[]> {
    // 注意：这里需要扫描所有微信账号的绑定信息
    // 在实际生产环境中，可能需要建立反向索引
    const wechatIds: string[] = [];
    
    // 获取所有存储键，筛选出 wechat-accounts 命名空间下的
    const keys = await this.store.keys();
    const wechatKeys = keys.filter(k => k.startsWith('wechat:'));
    
    for (const key of wechatKeys) {
      const bindings = await this.store.get<WechatBindings>(key);
      if (bindings?.agents?.some(b => b.agentId === agentId)) {
        // 使用 bindings 中存储的完整 wechatId
        wechatIds.push(bindings.wechatId);
      }
    }
    
    return wechatIds;
  }

  /**
   * 列出所有已注册的微信账号
   * @returns 微信账号数组
   */
  async listAllAccounts(): Promise<WechatAccount[]> {
    const accounts: WechatAccount[] = [];
    const keys = await this.store.keys();
    const accountKeys = keys.filter(k => k.endsWith(':account'));
    
    for (const key of accountKeys) {
      const account = await this.store.get<WechatAccount>(key);
      if (account) {
        accounts.push(account);
      }
    }
    
    return accounts;
  }

  // ===== 辅助方法 =====

  /**
   * 获取微信账号的命名空间存储
   * @param wechatId 微信用户ID
   * @returns 命名空间存储
   */
  private getWechatStore(wechatId: string): Store {
    // 提取前缀用于命名空间
    const prefix = this.extractWechatPrefix(wechatId);
    return this.store.namespace(`wechat:${prefix}`);
  }

  /**
   * 提取微信ID前缀
   * @param wechatId 微信ID
   * @returns 前缀
   */
  private extractWechatPrefix(wechatId: string): string {
    let cleaned = wechatId;
    if (cleaned.startsWith('wxid_')) {
      cleaned = cleaned.slice(5);
    }
    return cleaned.slice(0, 8);
  }
}

export default WechatManager;
