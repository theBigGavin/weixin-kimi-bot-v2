import { describe, it, expect } from 'vitest';
import {
  ExecutionMode,
  TaskPriority,
  TaskComplexity,
  LongTaskStatus,
  FlowTaskStatus,
  createLongTaskId,
  createFlowTaskId,
  createTaskSubmission,
  createTaskAnalysis,
  createTaskDecision,
} from '../../../src/task-router/types.js';
import { createTaskId } from '../../../src/types/index.js';

describe('task-router/types', () => {
  describe('枚举类型', () => {
    it('应该定义 ExecutionMode 执行模式枚举', () => {
      expect(ExecutionMode.DIRECT).toBe('direct');
      expect(ExecutionMode.LONGTASK).toBe('longtask');
      expect(ExecutionMode.FLOWTASK).toBe('flowtask');
    });

    it('应该定义 TaskPriority 优先级枚举', () => {
      expect(TaskPriority.LOW).toBe('low');
      expect(TaskPriority.NORMAL).toBe('normal');
      expect(TaskPriority.HIGH).toBe('high');
      expect(TaskPriority.URGENT).toBe('urgent');
    });

    it('应该定义 TaskComplexity 复杂度枚举', () => {
      expect(TaskComplexity.SIMPLE).toBe(0);
      expect(TaskComplexity.MODERATE).toBe(1);
      expect(TaskComplexity.COMPLEX).toBe(2);
      expect(TaskComplexity.VERY_COMPLEX).toBe(3);
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
  });

  describe('ID生成函数', () => {
    it('createTaskId 应该生成正确的格式', () => {
      const id = createTaskId();
      expect(id).toMatch(/^task_[a-z0-9]{12}$/);
    });

    it('createLongTaskId 应该生成正确的格式', () => {
      const id = createLongTaskId();
      expect(id).toMatch(/^lt_[a-z0-9]{12}$/);
    });

    it('createFlowTaskId 应该生成正确的格式', () => {
      const id = createFlowTaskId();
      expect(id).toMatch(/^ft_[a-z0-9]{12}$/);
    });
  });

  describe('createTaskSubmission', () => {
    it('应该创建基本任务提交', () => {
      const submission = createTaskSubmission({
        prompt: '帮我写代码',
        userId: 'user_123',
        contextId: 'ctx_456',
      });

      expect(submission.id).toMatch(/^task_/);
      expect(submission.prompt).toBe('帮我写代码');
      expect(submission.userId).toBe('user_123');
      expect(submission.contextId).toBe('ctx_456');
      expect(submission.createdAt).toBeGreaterThan(0);
    });

    it('应该使用自定义参数', () => {
      const submission = createTaskSubmission({
        prompt: '复杂任务',
        userId: 'user_1',
        contextId: 'ctx_1',
        model: 'kimi-code',
        priority: TaskPriority.HIGH,
      });

      expect(submission.model).toBe('kimi-code');
      expect(submission.priority).toBe(TaskPriority.HIGH);
    });
  });

  describe('createTaskAnalysis', () => {
    it('应该创建任务分析', () => {
      const analysis = createTaskAnalysis({
        complexity: TaskComplexity.MODERATE,
        estimatedDuration: 300000,
        keywords: ['重构', '测试'],
      });

      expect(analysis.complexity).toBe(TaskComplexity.MODERATE);
      expect(analysis.estimatedDuration).toBe(300000);
      expect(analysis.keywords).toEqual(['重构', '测试']);
      expect(analysis.riskLevel).toBe('low'); // 默认值
    });

    it('应该计算风险等级', () => {
      const highRisk = createTaskAnalysis({
        complexity: TaskComplexity.VERY_COMPLEX,
        requiresConfirmation: true,
        riskLevel: 'high',
      });
      expect(highRisk.riskLevel).toBe('high');
    });
  });

  describe('createTaskDecision', () => {
    it('应该创建任务决策', () => {
      const decision = createTaskDecision({
        mode: ExecutionMode.DIRECT,
        confidence: 0.9,
      });

      expect(decision.mode).toBe(ExecutionMode.DIRECT);
      expect(decision.confidence).toBe(0.9);
      expect(decision.reason).toBeDefined();
    });

    it('应该包含分析结果', () => {
      const analysis = createTaskAnalysis({
        complexity: TaskComplexity.COMPLEX,
      });
      
      const decision = createTaskDecision({
        mode: ExecutionMode.LONGTASK,
        confidence: 0.85,
        analysis,
      });

      expect(decision.analysis).toBeDefined();
      expect(decision.analysis?.complexity).toBe(TaskComplexity.COMPLEX);
    });
  });
});
