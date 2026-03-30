import { describe, it, expect } from 'vitest';
import {
  ConversationStateMachine,
  StateTransitionError,
  getValidTransitions,
  isValidTransition,
} from '../../../src/context/state-machine.js';
import { ConversationState, IntentType, createStateContext } from '../../../src/context/types.js';

describe('context/state-machine', () => {
  describe('ConversationStateMachine', () => {
    const stateMachine = new ConversationStateMachine();

    describe('基本状态转移', () => {
      it('IDLE + ASK_INFO -> EXPLORING', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.IDLE),
          { type: IntentType.ASK_INFO, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(true);
        expect(result.newState?.current).toBe(ConversationState.EXPLORING);
      });

      it('EXPLORING + EXECUTE -> PLANNING', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.EXPLORING),
          { type: IntentType.EXECUTE, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(true);
        expect(result.newState?.current).toBe(ConversationState.PLANNING);
      });

      it('PLANNING + CONFIRM -> EXECUTINGT', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.PLANNING),
          { type: IntentType.CONFIRM, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(true);
        expect(result.newState?.current).toBe(ConversationState.EXECUTINGT);
      });

      it('PROPOSING + SELECT_OPTION -> PLANNING', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.PROPOSING),
          { type: IntentType.SELECT_OPTION, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(true);
        expect(result.newState?.current).toBe(ConversationState.PLANNING);
      });

      it('任何状态 + CANCEL -> IDLE', () => {
        const states = Object.values(ConversationState);
        states.forEach(state => {
          const result = stateMachine.transition(
            createStateContext(state),
            { type: IntentType.CANCEL, confidence: 1, entities: [], references: [], rawText: '' }
          );
          expect(result.success).toBe(true);
          expect(result.newState?.current).toBe(ConversationState.IDLE);
        });
      });
    });

    describe('无效状态转移', () => {
      it('IDLE + CONFIRM 应该失败', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.IDLE),
          { type: IntentType.CONFIRM, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('COMPLETED + EXECUTE 应该回到 PLANNING', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.COMPLETED),
          { type: IntentType.EXECUTE, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.success).toBe(true);
        expect(result.newState?.current).toBe(ConversationState.PLANNING);
      });
    });

    describe('状态历史记录', () => {
      it('应该记录前一个状态', () => {
        const result = stateMachine.transition(
          createStateContext(ConversationState.IDLE),
          { type: IntentType.ASK_INFO, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.newState?.previous).toBe(ConversationState.IDLE);
      });
    });

    describe('主题跟踪', () => {
      it('应该保持主题不变', () => {
        const context = createStateContext(ConversationState.IDLE, '测试主题');
        const result = stateMachine.transition(
          context,
          { type: IntentType.ASK_INFO, confidence: 1, entities: [], references: [], rawText: '' }
        );
        expect(result.newState?.topic).toBe('测试主题');
      });
    });
  });

  describe('getValidTransitions', () => {
    it('应该返回IDLE状态的有效转移', () => {
      const transitions = getValidTransitions(ConversationState.IDLE);
      expect(transitions).toContain(IntentType.ASK_INFO);
      expect(transitions).toContain(IntentType.EXECUTE);
      expect(transitions).toContain(IntentType.GREETING);
    });

    it('应该返回PROPOSING状态的有效转移', () => {
      const transitions = getValidTransitions(ConversationState.PROPOSING);
      expect(transitions).toContain(IntentType.SELECT_OPTION);
      expect(transitions).toContain(IntentType.MODIFY);
      expect(transitions).toContain(IntentType.CANCEL);
    });

    it('应该始终包含CANCEL', () => {
      const states = Object.values(ConversationState);
      states.forEach(state => {
        const transitions = getValidTransitions(state);
        expect(transitions).toContain(IntentType.CANCEL);
      });
    });
  });

  describe('isValidTransition', () => {
    it('应该验证有效的转移', () => {
      expect(isValidTransition(ConversationState.IDLE, IntentType.ASK_INFO)).toBe(true);
      expect(isValidTransition(ConversationState.EXPLORING, IntentType.EXECUTE)).toBe(true);
    });

    it('应该拒绝无效的转移', () => {
      expect(isValidTransition(ConversationState.IDLE, IntentType.CONFIRM)).toBe(false);
      expect(isValidTransition(ConversationState.IDLE, IntentType.REJECT)).toBe(false);
    });
  });

  describe('StateTransitionError', () => {
    it('应该创建错误对象', () => {
      const error = new StateTransitionError(
        ConversationState.IDLE,
        IntentType.CONFIRM,
        '不能从IDLE状态确认'
      );
      expect(error.name).toBe('StateTransitionError');
      expect(error.fromState).toBe(ConversationState.IDLE);
      expect(error.intent).toBe(IntentType.CONFIRM);
      expect(error.message).toContain('不能从IDLE状态确认');
    });
  });
});
