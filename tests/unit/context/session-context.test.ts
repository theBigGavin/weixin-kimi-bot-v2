import { describe, it, expect, beforeEach } from 'vitest';
import { SessionContextManager, getSessionStats } from '../../../src/context/session-context.js';
import { createSessionContext, createContextMessage, ConversationState } from '../../../src/context/types.js';

describe('context/session-context', () => {
  describe('SessionContextManager', () => {
    let manager: SessionContextManager;

    beforeEach(() => {
      manager = new SessionContextManager();
    });

    it('应该创建会话', () => {
      const session = manager.createSession('user1', 'agent1');
      expect(session.userId).toBe('user1');
      expect(session.agentId).toBe('agent1');
      expect(session.state.current).toBe(ConversationState.IDLE);
    });

    it('应该获取会话', () => {
      const created = manager.createSession('user1', 'agent1');
      const retrieved = manager.getSession(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('应该添加消息', () => {
      const session = manager.createSession('user1', 'agent1');
      manager.addMessage(session.id, 'user', 'Hello');
      
      const updated = manager.getSession(session.id);
      expect(updated?.messages).toHaveLength(1);
      expect(updated?.messages[0].content).toBe('Hello');
    });

    it('应该更新状态', () => {
      const session = manager.createSession('user1', 'agent1');
      const newState = { ...session.state, current: ConversationState.EXPLORING };
      manager.updateState(session.id, newState);
      
      const updated = manager.getSession(session.id);
      expect(updated?.state.current).toBe(ConversationState.EXPLORING);
    });

    it('应该添加选项', () => {
      const session = manager.createSession('user1', 'agent1');
      const option = { id: 'opt1', label: '选项1' };
      manager.addOption(session.id, option);
      
      const updated = manager.getSession(session.id);
      expect(updated?.activeOptions['opt1']).toBeDefined();
    });

    it('应该清除选项', () => {
      const session = manager.createSession('user1', 'agent1');
      manager.addOption(session.id, { id: 'opt1', label: '选项1' });
      manager.clearOptions(session.id);
      
      const updated = manager.getSession(session.id);
      expect(Object.keys(updated?.activeOptions || {})).toHaveLength(0);
    });

    it('应该设置主题', () => {
      const session = manager.createSession('user1', 'agent1');
      manager.setTopic(session.id, '测试主题');
      
      const updated = manager.getSession(session.id);
      expect(updated?.state.topic).toBe('测试主题');
    });

    it('应该结束会话', () => {
      const session = manager.createSession('user1', 'agent1');
      manager.endSession(session.id);
      
      const updated = manager.getSession(session.id);
      expect(updated?.state.current).toBe(ConversationState.COMPLETED);
    });

    it('应该删除会话', () => {
      const session = manager.createSession('user1', 'agent1');
      manager.deleteSession(session.id);
      
      const retrieved = manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('应该清理过期会话', () => {
      const session = manager.createSession('user1', 'agent1');
      // 模拟过期
      const s = manager.getSession(session.id);
      if (s) s.updatedAt = Date.now() - 100000;
      
      const count = manager.cleanupExpiredSessions(1000);
      expect(count).toBe(1);
    });
  });

  describe('getSessionStats', () => {
    it('应该返回会话统计', () => {
      const session = createSessionContext('user1', 'agent1');
      session.messages.push(createContextMessage('user', 'Hello'));
      session.messages.push(createContextMessage('assistant', 'Hi'));
      
      const stats = getSessionStats(session);
      expect(stats.messageCount).toBe(2);
      expect(stats.userMessageCount).toBe(1);
      expect(stats.assistantMessageCount).toBe(1);
    });
  });
});
