import { describe, it, expect, beforeEach } from 'vitest';
import { FlowTaskManager } from '../../../src/flowtask/manager.js';
import { FlowTaskStatus, createFlowTaskId, FlowStep } from '../../../src/flowtask/types.js';
import { TaskSubmission, TaskPriority } from '../../../src/task-router/types.js';

describe('flowtask/manager', () => {
  let manager: FlowTaskManager;
  
  const createSubmission = (prompt: string): TaskSubmission => ({
    id: 'task_test',
    prompt,
    userId: 'user_test',
    contextId: 'ctx_test',
    priority: TaskPriority.NORMAL,
    createdAt: Date.now(),
  });

  const createPlan = (): FlowStep[] => [
    { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
    { id: 'step2', order: 2, description: '步骤2', requiresConfirmation: true, estimatedDuration: 10000 },
    { id: 'step3', order: 3, description: '步骤3', requiresConfirmation: false, estimatedDuration: 5000 },
  ];

  beforeEach(() => {
    manager = new FlowTaskManager();
  });

  describe('create', () => {
    it('应该创建流程任务', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      
      expect(task.id).toMatch(/^ft_/);
      expect(task.status).toBe(FlowTaskStatus.PENDING);
      expect(task.plan).toHaveLength(3);
      expect(task.currentStep).toBe(0);
    });
  });

  describe('start', () => {
    it('应该启动任务', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const started = manager.start(task.id);
      
      expect(started?.status).toBe(FlowTaskStatus.RUNNING);
      expect(started?.startedAt).toBeDefined();
    });

    it('不存在的任务返回null', () => {
      const result = manager.start('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('executeStep', () => {
    it('应该执行步骤', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      manager.start(task.id);
      
      const updated = await manager.executeStep(task.id, async (step) => {
        return `完成: ${step.description}`;
      });
      
      expect(updated?.currentStep).toBe(1);
      expect(updated?.results).toHaveLength(1);
      expect(updated?.results[0].status).toBe('completed');
    });

    it('需要确认时进入等待状态', async () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: true, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      manager.start(task.id);
      
      const updated = await manager.executeStep(task.id, async () => '结果');
      
      expect(updated?.status).toBe(FlowTaskStatus.WAITING_CONFIRM);
    });

    it('执行失败应标记失败', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      manager.start(task.id);
      
      const updated = await manager.executeStep(task.id, async () => {
        throw new Error('执行错误');
      });
      
      expect(updated?.status).toBe(FlowTaskStatus.FAILED);
      expect(updated?.results[0].status).toBe('failed');
      expect(updated?.results[0].error).toBe('Error: 执行错误');
    });

    it('非运行状态返回null', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const result = await manager.executeStep(task.id, async () => '结果');
      expect(result).toBeNull();
    });
  });

  describe('confirmAndContinue', () => {
    it('应该确认并继续', async () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: true, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      manager.start(task.id);
      
      // 先执行步骤进入等待确认状态
      await manager.executeStep(task.id, async () => '结果');
      
      const confirmed = manager.confirmAndContinue(task.id);
      
      expect(confirmed?.status).toBe(FlowTaskStatus.RUNNING);
    });

    it('非等待状态返回null', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const result = manager.confirmAndContinue(task.id);
      expect(result).toBeNull();
    });
  });

  describe('skipStep', () => {
    it('应该跳过当前步骤', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const updated = manager.skipStep(task.id);
      
      expect(updated?.currentStep).toBe(1);
      expect(updated?.results[0].status).toBe('skipped');
    });

    it('所有步骤完成后标记完成', () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      const updated = manager.skipStep(task.id);
      
      expect(updated?.status).toBe(FlowTaskStatus.COMPLETED);
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('应该取消任务', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const cancelled = manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(FlowTaskStatus.CANCELLED);
    });

    it('已完成任务不能取消', () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      manager.skipStep(task.id); // 这会标记为完成
      
      const cancelled = manager.cancel(task.id);
      expect(cancelled).toBeNull();
    });
  });

  describe('getTask', () => {
    it('应该获取任务', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const retrieved = manager.getTask(task.id);
      
      expect(retrieved?.id).toBe(task.id);
    });
  });

  describe('getCurrentStep', () => {
    it('应该获取当前步骤', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const step = manager.getCurrentStep(task.id);
      
      expect(step?.id).toBe('step1');
    });

    it('完成所有步骤返回null', () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      manager.skipStep(task.id);
      
      const step = manager.getCurrentStep(task.id);
      expect(step).toBeNull();
    });
  });
});
