import { describe, it, expect } from 'vitest';
import {
  ConversationState,
  IntentType,
  ExecutionMode,
  LongTaskStatus,
  FlowTaskStatus,
  MessageType,
  createAgentId,
  createTaskId,
  createContextId,
  createMemoryId,
  createOptionId,
} from '../../../src/types/index.js';

describe('types/index', () => {
  describe('枚举类型', () => {
    it('应该定义 ConversationState 状态枚举', () => {
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

    it('应该定义 IntentType 意图枚举', () => {
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
    });

    it('应该定义 ExecutionMode 执行模式枚举', () => {
      expect(ExecutionMode.DIRECT).toBe('direct');
      expect(ExecutionMode.LONGTASK).toBe('longtask');
      expect(ExecutionMode.FLOWTASK).toBe('flowtask');
    });

    it('应该定义 LongTaskStatus 长任务状态枚举', () => {
      expect(LongTaskStatus.PENDING).toBe('pending');
      expect(LongTaskStatus.RUNNING).toBe('running');
      expect(LongTaskStatus.COMPLETED).toBe('completed');
      expect(LongTaskStatus.FAILED).toBe('failed');
      expect(LongTaskStatus.CANCELLED).toBe('cancelled');
    });

    it('应该定义 FlowTaskStatus 流程任务状态枚举', () => {
      expect(FlowTaskStatus.PENDING).toBe('pending');
      expect(FlowTaskStatus.RUNNING).toBe('running');
      expect(FlowTaskStatus.WAITING_CONFIRM).toBe('waiting_confirm');
      expect(FlowTaskStatus.COMPLETED).toBe('completed');
      expect(FlowTaskStatus.FAILED).toBe('failed');
      expect(FlowTaskStatus.CANCELLED).toBe('cancelled');
    });

    it('应该定义 MessageType 消息类型枚举', () => {
      expect(MessageType.TEXT).toBe('text');
      expect(MessageType.IMAGE).toBe('image');
      expect(MessageType.FILE).toBe('file');
      expect(MessageType.VOICE).toBe('voice');
      expect(MessageType.VIDEO).toBe('video');
    });
  });

  describe('ID生成函数', () => {
    it('createAgentId 应该生成正确的格式', () => {
      const id = createAgentId('测试Agent');
      expect(id).toMatch(/^测试Agent_\d{8}_[a-z0-9]{8}$/);
    });

    it('createAgentId 应该处理特殊字符', () => {
      const id = createAgentId('Test Agent_123');
      expect(id).toMatch(/^Test_Agent_123_\d{8}_[a-z0-9]{8}$/);
    });

    it('createTaskId 应该生成正确的格式', () => {
      const id = createTaskId();
      expect(id).toMatch(/^task_[a-z0-9]{12}$/);
    });

    it('createContextId 应该生成正确的格式', () => {
      const id = createContextId();
      expect(id).toMatch(/^ctx_[a-z0-9]{12}$/);
    });

    it('createMemoryId 应该生成正确的格式', () => {
      const id = createMemoryId();
      expect(id).toMatch(/^mem_[a-z0-9]{12}$/);
    });

    it('createOptionId 应该生成正确的格式', () => {
      const id = createOptionId();
      expect(id).toMatch(/^opt_[a-z0-9]{12}$/);
    });

    it('所有ID生成函数应该生成唯一的ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createTaskId());
        ids.add(createContextId());
        ids.add(createMemoryId());
        ids.add(createOptionId());
      }
      // 400个ID应该都是唯一的
      expect(ids.size).toBe(400);
    });
  });
});
