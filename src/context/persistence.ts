/**
 * 上下文持久化
 * 
 * 会话上下文的存储和加载
 */

import { SessionContext } from './types.js';
import { Store } from '../store.js';

/**
 * 上下文持久化管理器
 */
export class ContextPersistence {
  constructor(private store: Store) {}

  /**
   * 保存会话上下文
   * @param context 会话上下文
   */
  async save(context: SessionContext): Promise<void> {
    const key = this.getStorageKey(context.userId, context.agentId);
    await this.store.set(key, context);
  }

  /**
   * 加载会话上下文
   * @param userId 用户ID
   * @param agentId Agent ID
   * @returns 会话上下文或null
   */
  async load(userId: string, agentId: string): Promise<SessionContext | null> {
    const key = this.getStorageKey(userId, agentId);
    return this.store.get<SessionContext>(key);
  }

  /**
   * 删除会话上下文
   * @param userId 用户ID
   * @param agentId Agent ID
   */
  async delete(userId: string, agentId: string): Promise<void> {
    const key = this.getStorageKey(userId, agentId);
    await this.store.delete(key);
  }

  /**
   * 列出用户的所有会话
   * @param userId 用户ID
   * @returns 会话列表
   */
  async listByUser(userId: string): Promise<SessionContext[]> {
    const keys = await this.store.keys();
    const userKeys = keys.filter(k => k.startsWith(`context:${userId}:`));
    
    const contexts: SessionContext[] = [];
    for (const key of userKeys) {
      const context = await this.store.get<SessionContext>(key);
      if (context) {
        contexts.push(context);
      }
    }
    
    return contexts;
  }

  /**
   * 列出Agent的所有会话
   * @param agentId Agent ID
   * @returns 会话列表
   */
  async listByAgent(agentId: string): Promise<SessionContext[]> {
    const keys = await this.store.keys();
    const agentKeys = keys.filter(k => k.includes(`:${agentId}`));
    
    const contexts: SessionContext[] = [];
    for (const key of agentKeys) {
      const context = await this.store.get<SessionContext>(key);
      if (context && context.agentId === agentId) {
        contexts.push(context);
      }
    }
    
    return contexts;
  }

  /**
   * 获取存储键
   */
  private getStorageKey(userId: string, agentId: string): string {
    return `context:${userId}:${agentId}`;
  }

  /**
   * 归档会话（移动到归档命名空间）
   * @param context 会话上下文
   */
  async archive(context: SessionContext): Promise<void> {
    const archiveKey = `archive:context:${context.userId}:${context.agentId}:${context.id}`;
    await this.store.set(archiveKey, {
      ...context,
      archivedAt: Date.now(),
    });
    
    // 删除活跃会话
    await this.delete(context.userId, context.agentId);
  }

  /**
   * 获取归档会话
   * @param userId 用户ID
   * @param agentId Agent ID
   * @param contextId 上下文ID
   * @returns 会话上下文或null
   */
  async getArchived(
    userId: string,
    agentId: string,
    contextId: string
  ): Promise<(SessionContext & { archivedAt: number }) | null> {
    const key = `archive:context:${userId}:${agentId}:${contextId}`;
    return this.store.get<SessionContext & { archivedAt: number }>(key);
  }

  /**
   * 清理过期会话
   * @param maxAge 最大存活时间（毫秒）
   * @returns 清理数量
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const keys = await this.store.keys();
    const contextKeys = keys.filter(k => k.startsWith('context:'));
    
    const now = Date.now();
    let count = 0;
    
    for (const key of contextKeys) {
      const context = await this.store.get<SessionContext>(key);
      if (context && now - context.updatedAt > maxAge) {
        await this.store.delete(key);
        count++;
      }
    }
    
    return count;
  }
}

/**
 * 导出/导入功能
 */
export class ContextExporter {
  /**
   * 导出会话为JSON
   * @param context 会话上下文
   * @returns JSON字符串
   */
  static exportToJSON(context: SessionContext): string {
    return JSON.stringify(context, null, 2);
  }

  /**
   * 从JSON导入会话
   * @param json JSON字符串
   * @returns 会话上下文或null
   */
  static importFromJSON(json: string): SessionContext | null {
    try {
      const context = JSON.parse(json) as SessionContext;
      // 验证必要字段
      if (context.id && context.userId && context.agentId) {
        return context;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 导出多个会话
   * @param contexts 会话列表
   * @returns JSON字符串
   */
  static exportManyToJSON(contexts: SessionContext[]): string {
    return JSON.stringify(contexts, null, 2);
  }

  /**
   * 从JSON导入多个会话
   * @param json JSON字符串
   * @returns 会话列表
   */
  static importManyFromJSON(json: string): SessionContext[] {
    try {
      const contexts = JSON.parse(json) as SessionContext[];
      return Array.isArray(contexts) ? contexts.filter(c => c.id && c.userId) : [];
    } catch {
      return [];
    }
  }
}
