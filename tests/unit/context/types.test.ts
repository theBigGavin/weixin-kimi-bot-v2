import { describe, it, expect } from 'vitest';
import {
  ConversationState,
  IntentType,
  ReferenceType,
  createContextId,
  createOptionId,
  createMessageId,
  createStateContext,
  createIntent,
  createSessionContext,
} from '../../../src/context/types.js';

describe('context/types', () => {
  describe('ConversationState 枚举', () => {
    it('应该定义所有对话状态', () => {
      expect(ConversationState.IDLE).toBe('idle');
      expect(ConversationState.EXPLORING).toBe('exploring');
      expect(ConversationState.CLARIFYING).toBe('clarifying');
      expect(ConversationState.PROPOSING).toBe('proposing');
      expect(ConversationState.COMPARING).toBe('comparing');
      expect(ConversationState.CONFIRMING).toBe('confirming');
      expect(ConversationState.REFINING).toBe('refining');
      expect(ConversationState.PLANNING).toBe('planning');
      expect(ConversationState.EXECUTINGT).toBe('executingt');
      expect(ConversationState.EXECUTINGD).toBe('executingd');
      expect(ConversationState.EXECUTINGI).toBe('executingi');
      expect(ConversationState.EXECUTINGE).toBe('executinge');
      expect(ConversationState.REVIEWING).toBe('reviewing');
      expect(ConversationState.COMPLETED).toBe('completed');
    });
  });

  describe('IntentType 枚举', () => {
    it('应该定义所有意图类型', () => {
      expect(IntentType.SELECT_OPTION).toBe('select_option');
      expect(IntentType.CONFIRM).toBe('confirm');
      expect(IntentType.REJECT).toBe('reject');
      expect(IntentType.MODIFY).toBe('modify');
      expect(IntentType.EXECUTE).toBe('execute');
      expect(IntentType.PAUSE).toBe('pause');
      expect(IntentType.RESUME).toBe('resume');
      expect(IntentType.CANCEL).toBe('cancel');
      expect(IntentType.ASK_INFO).toBe('ask_info');
      expect(IntentType.REFERENCE).toBe('reference');
      expect(IntentType.GREETING).toBe('greeting');
      expect(IntentType.UNKNOWN).toBe('unknown');
    });
  });

  describe('ReferenceType 枚举', () => {
    it('应该定义所有引用类型', () => {
      expect(ReferenceType.OPTION_INDEX).toBe('option_index');
      expect(ReferenceType.OPTION_LABEL).toBe('option_label');
      expect(ReferenceType.OPTION_ANAPHORA).toBe('option_anaphora');
      expect(ReferenceType.TEMPORAL_ANAPHORA).toBe('temporal_anaphora');
      expect(ReferenceType.TASK_REFERENCE).toBe('task_reference');
      expect(ReferenceType.TOPIC_REFERENCE).toBe('topic_reference');
    });
  });

  describe('ID生成函数', () => {
    it('createContextId 应该生成正确的格式', () => {
      const id = createContextId();
      expect(id).toMatch(/^ctx_[a-z0-9]{12}$/);
    });

    it('createOptionId 应该生成正确的格式', () => {
      const id = createOptionId();
      expect(id).toMatch(/^opt_[a-z0-9]{12}$/);
    });

    it('createMessageId 应该生成正确的格式', () => {
      const id = createMessageId();
      expect(id).toMatch(/^msg_[a-z0-9]{12}$/);
    });

    it('所有ID应该唯一', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createContextId());
        ids.add(createOptionId());
        ids.add(createMessageId());
      }
      expect(ids.size).toBe(300);
    });
  });

  describe('createStateContext', () => {
    it('应该创建默认状态上下文', () => {
      const state = createStateContext();
      
      expect(state.current).toBe(ConversationState.IDLE);
      expect(state.previous).toBeNull();
      expect(state.topic).toBe('');
      expect(state.pendingDecision).toBeNull();
    });

    it('应该使用传入的状态', () => {
      const state = createStateContext(ConversationState.EXPLORING);
      
      expect(state.current).toBe(ConversationState.EXPLORING);
    });

    it('应该设置主题', () => {
      const state = createStateContext(ConversationState.PLANNING, '构建API');
      
      expect(state.current).toBe(ConversationState.PLANNING);
      expect(state.topic).toBe('构建API');
    });
  });

  describe('createIntent', () => {
    it('应该创建基本意图', () => {
      const intent = createIntent(IntentType.CONFIRM);
      
      expect(intent.type).toBe(IntentType.CONFIRM);
      expect(intent.confidence).toBe(1.0);
      expect(intent.entities).toEqual([]);
      expect(intent.references).toEqual([]);
    });

    it('应该使用自定义置信度', () => {
      const intent = createIntent(IntentType.EXECUTE, 0.85);
      
      expect(intent.confidence).toBe(0.85);
    });

    it('应该包含实体', () => {
      const entities = [{ type: 'number', value: '1', start: 0, end: 1 }];
      const intent = createIntent(IntentType.SELECT_OPTION, 0.9, entities);
      
      expect(intent.entities).toEqual(entities);
    });
  });

  describe('createSessionContext', () => {
    it('应该创建基本会话上下文', () => {
      const context = createSessionContext('user_123', 'agent_456');
      
      expect(context.id).toMatch(/^ctx_[a-z0-9]{12}$/);
      expect(context.userId).toBe('user_123');
      expect(context.agentId).toBe('agent_456');
      expect(context.state.current).toBe(ConversationState.IDLE);
      expect(context.messages).toEqual([]);
      expect(context.activeOptions).toEqual({});
    });

    it('应该使用自定义ID', () => {
      const context = createSessionContext('user_1', 'agent_1', 'custom_ctx_123');
      
      expect(context.id).toBe('custom_ctx_123');
    });

    it('应该包含时间戳', () => {
      const before = Date.now();
      const context = createSessionContext('user_1', 'agent_1');
      const after = Date.now();
      
      expect(context.createdAt).toBeGreaterThanOrEqual(before);
      expect(context.createdAt).toBeLessThanOrEqual(after);
      expect(context.updatedAt).toBe(context.createdAt);
    });
  });
});
