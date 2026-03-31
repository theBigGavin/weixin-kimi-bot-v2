/**
 * 会话上下文管理
 * 
 * 管理会话的生命周期、消息历史和状态
 */

import {
  SessionContext,
  ContextMessage,
  StateContext,
  Option,
  Intent,
  ConversationState,
  createSessionContext,
  createContextMessage,
} from './types.js';

/**
 * 会话上下文管理器
 */
export class SessionContextManager {
  private contexts: Map<string, SessionContext> = new Map();

  /**
   * 创建新会话
   * @param userId 用户ID
   * @param agentId Agent ID
   * @returns 会话上下文
   */
  createSession(userId: string, agentId: string): SessionContext {
    const session = createSessionContext(userId, agentId);
    this.contexts.set(session.id, session);
    return session;
  }

  /**
   * 获取会话
   * @param contextId 上下文ID
   * @returns 会话上下文或null
   */
  getSession(contextId: string): SessionContext | null {
    return this.contexts.get(contextId) || null;
  }

  /**
   * 添加消息
   * @param contextId 上下文ID
   * @param role 角色
   * @param content 内容
   * @param intent 意图
   * @returns 更新的会话或null
   */
  addMessage(
    contextId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    intent?: Intent
  ): SessionContext | null {
    const session = this.getSession(contextId);
    if (!session) return null;

    const message = createContextMessage(role, content, intent);
    session.messages.push(message);
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * 更新状态
   * @param contextId 上下文ID
   * @param state 新状态
   * @returns 更新的会话或null
   */
  updateState(
    contextId: string,
    state: StateContext
  ): SessionContext | null {
    const session = this.getSession(contextId);
    if (!session) return null;

    session.state = state;
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * 添加选项
   * @param contextId 上下文ID
   * @param option 选项
   * @returns 更新的会话或null
   */
  addOption(contextId: string, option: Option): SessionContext | null {
    const session = this.getSession(contextId);
    if (!session) return null;

    session.activeOptions[option.id] = option;
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * 清除选项
   * @param contextId 上下文ID
   * @returns 更新的会话或null
   */
  clearOptions(contextId: string): SessionContext | null {
    const session = this.getSession(contextId);
    if (!session) return null;

    session.activeOptions = {};
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * 获取最近消息
   * @param contextId 上下文ID
   * @param count 消息数量
   * @returns 消息列表
   */
  getRecentMessages(contextId: string, count: number = 10): ContextMessage[] {
    const session = this.getSession(contextId);
    if (!session) return [];

    return session.messages.slice(-count);
  }

  /**
   * 设置主题
   * @param contextId 上下文ID
   * @param topic 主题
   * @returns 更新的会话或null
   */
  setTopic(contextId: string, topic: string): SessionContext | null {
    const session = this.getSession(contextId);
    if (!session) return null;

    session.state.topic = topic;
    session.topicStack.push(topic);
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * 结束会话
   * @param contextId 上下文ID
   * @returns 是否成功
   */
  endSession(contextId: string): boolean {
    const session = this.getSession(contextId);
    if (!session) return false;

    session.state.current = ConversationState.COMPLETED;
    session.updatedAt = Date.now();

    return true;
  }

  /**
   * 删除会话
   * @param contextId 上下文ID
   * @returns 是否成功
   */
  deleteSession(contextId: string): boolean {
    return this.contexts.delete(contextId);
  }

  /**
   * 获取所有会话
   * @returns 会话列表
   */
  getAllSessions(): SessionContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * 清理过期会话
   * @param maxAge 最大存活时间（毫秒）
   * @returns 清理数量
   */
  cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let count = 0;

    for (const [id, session] of this.contexts) {
      if (now - session.updatedAt > maxAge) {
        this.contexts.delete(id);
        count++;
      }
    }

    return count;
  }
}

/**
 * 获取会话统计信息
 * @param session 会话上下文
 * @returns 统计信息
 */
export function getSessionStats(session: SessionContext) {
  return {
    messageCount: session.messages.length,
    userMessageCount: session.messages.filter(m => m.role === 'user').length,
    assistantMessageCount: session.messages.filter(m => m.role === 'assistant').length,
    activeOptionCount: Object.keys(session.activeOptions).length,
    duration: session.updatedAt - session.createdAt,
    currentState: session.state.current,
    currentTopic: session.state.topic,
  };
}
