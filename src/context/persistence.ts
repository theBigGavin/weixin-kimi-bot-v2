/**
 * 上下文持久化 - Phase 2 Refactoring
 * 
 * 改进点：
 * - 更好的错误处理和日志记录
 * - 消除空 catch 块
 */

import { SessionContext } from './types.js';
import { Store, StoreError } from '../store.js';
import { createAgentLogger, getDefaultLogger } from '../logging/index.js';

// ============================================================================
// Error Types
// ============================================================================

export class PersistenceError extends Error {
  constructor(
    message: string,
    public readonly userId?: string,
    public readonly agentId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PersistenceError';
  }
}

// ============================================================================
// Context Persistence Manager
// ============================================================================

export class ContextPersistence {
  constructor(private store: Store) {}

  /**
   * 保存会话上下文
   */
  async save(context: SessionContext): Promise<void> {
    const key = this.getStorageKey(context.userId, context.agentId);
    try {
      await this.store.set(key, context);
    } catch (error) {
      throw new PersistenceError(
        'Failed to save session context',
        context.userId,
        context.agentId,
        error as Error
      );
    }
  }

  /**
   * 加载会话上下文
   */
  async load(userId: string, agentId: string): Promise<SessionContext | null> {
    const key = this.getStorageKey(userId, agentId);
    try {
      return await this.store.get<SessionContext>(key);
    } catch (error) {
      // 存储错误（非 ENOENT）记录但不抛出，返回 null
      if (error instanceof StoreError) {
        createAgentLogger(agentId).warn(`Persistence: Failed to load context for ${userId}/${agentId}: ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * 删除会话上下文
   */
  async delete(userId: string, agentId: string): Promise<void> {
    const key = this.getStorageKey(userId, agentId);
    try {
      await this.store.delete(key);
    } catch (error) {
      throw new PersistenceError(
        'Failed to delete session context',
        userId,
        agentId,
        error as Error
      );
    }
  }

  /**
   * 列出用户的所有会话
   */
  async listByUser(userId: string): Promise<SessionContext[]> {
    let keys: string[];
    try {
      keys = await this.store.keys();
    } catch (error) {
      getDefaultLogger().warn(`Persistence: Failed to list keys for user ${userId}: ${(error as Error).message}`);
      return [];
    }
    
    const userKeys = keys.filter(k => k.startsWith(`context:${userId}:`));
    
    const contexts: SessionContext[] = [];
    for (const key of userKeys) {
      try {
        const context = await this.store.get<SessionContext>(key);
        if (context) {
          contexts.push(context);
        }
      } catch (error) {
        getDefaultLogger().warn(`Persistence: Failed to load context from ${key}: ${(error as Error).message}`);
      }
    }
    
    return contexts;
  }

  /**
   * 列出Agent的所有会话
   */
  async listByAgent(agentId: string): Promise<SessionContext[]> {
    let keys: string[];
    try {
      keys = await this.store.keys();
    } catch (error) {
      createAgentLogger(agentId).warn(`Persistence: Failed to list keys for agent ${agentId}: ${(error as Error).message}`);
      return [];
    }
    
    const agentKeys = keys.filter(k => k.includes(`:${agentId}`));
    
    const contexts: SessionContext[] = [];
    for (const key of agentKeys) {
      try {
        const context = await this.store.get<SessionContext>(key);
        if (context && context.agentId === agentId) {
          contexts.push(context);
        }
      } catch (error) {
        createAgentLogger(agentId).warn(`Persistence: Failed to load context from ${key}: ${(error as Error).message}`);
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
   * 归档会话
   */
  async archive(context: SessionContext): Promise<void> {
    const archiveKey = `archive:context:${context.userId}:${context.agentId}:${context.id}`;
    try {
      await this.store.set(archiveKey, {
        ...context,
        archivedAt: Date.now(),
      });
      
      // 删除活跃会话
      await this.delete(context.userId, context.agentId);
    } catch (error) {
      throw new PersistenceError(
        'Failed to archive session context',
        context.userId,
        context.agentId,
        error as Error
      );
    }
  }

  /**
   * 获取归档会话
   */
  async getArchived(
    userId: string,
    agentId: string,
    contextId: string
  ): Promise<(SessionContext & { archivedAt: number }) | null> {
    const key = `archive:context:${userId}:${agentId}:${contextId}`;
    try {
      return await this.store.get<SessionContext & { archivedAt: number }>(key);
    } catch (error) {
      getDefaultLogger().warn(`Persistence: Failed to get archived context ${contextId}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 清理过期会话
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    let keys: string[];
    try {
      keys = await this.store.keys();
    } catch (error) {
      getDefaultLogger().warn(`Persistence: Failed to list keys for cleanup: ${(error as Error).message}`);
      return 0;
    }
    
    const contextKeys = keys.filter(k => k.startsWith('context:'));
    
    const now = Date.now();
    let count = 0;
    
    for (const key of contextKeys) {
      try {
        const context = await this.store.get<SessionContext>(key);
        if (context && now - context.updatedAt > maxAge) {
          await this.store.delete(key);
          count++;
        }
      } catch (error) {
        getDefaultLogger().warn(`Persistence: Failed to process ${key} during cleanup: ${(error as Error).message}`);
      }
    }
    
    return count;
  }
}

// ============================================================================
// Export/Import Functions
// ============================================================================

export class ContextExporter {
  /**
   * 导出会话为JSON
   */
  static exportToJSON(context: SessionContext): string {
    return JSON.stringify(context, null, 2);
  }

  /**
   * 从JSON导入会话
   */
  static importFromJSON(json: string): SessionContext | null {
    try {
      const context = JSON.parse(json) as SessionContext;
      // 验证必要字段
      if (context.id && context.userId && context.agentId) {
        return context;
      }
      getDefaultLogger().warn('Persistence: Invalid context structure in import');
      return null;
    } catch (error) {
      getDefaultLogger().warn(`Persistence: Failed to parse context JSON: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 导出多个会话
   */
  static exportManyToJSON(contexts: SessionContext[]): string {
    return JSON.stringify(contexts, null, 2);
  }

  /**
   * 从JSON导入多个会话
   */
  static importManyFromJSON(json: string): SessionContext[] {
    try {
      const contexts = JSON.parse(json) as SessionContext[];
      if (!Array.isArray(contexts)) {
        getDefaultLogger().warn('Persistence: Import expects an array of contexts');
        return [];
      }
      return contexts.filter(c => {
        if (!c.id || !c.userId) {
          getDefaultLogger().warn('Persistence: Skipping invalid context in import');
          return false;
        }
        return true;
      });
    } catch (error) {
      getDefaultLogger().warn(`Persistence: Failed to parse contexts JSON: ${(error as Error).message}`);
      return [];
    }
  }
}
