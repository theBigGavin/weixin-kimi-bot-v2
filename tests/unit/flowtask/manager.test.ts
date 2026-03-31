import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowTaskManager } from '../../../src/flowtask/manager.js';
import { FlowTaskStatus, createFlowTaskId, FlowStep } from '../../../src/flowtask/types.js';
import { TaskSubmission, TaskPriority } from '../../../src/task-router/types.js';
import { ACPManager } from '../../../src/acp/index.js';

// Mock ACPManager
const mockAcpManager = {
  prompt: vi.fn().mockResolvedValue({ text: 'mock result' }),
} as unknown as ACPManager;

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
    manager = new FlowTaskManager({ acpManager: mockAcpManager });
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

  describe('createPlan', () => {
    it('应该为部署任务生成计划', () => {
      const plan = manager.createPlan('部署项目到生产环境');
      
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.some(s => s.description.includes('备份'))).toBe(true);
    });

    it('应该为重构任务生成计划', () => {
      const plan = manager.createPlan('重构代码');
      
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.some(s => s.description.includes('重构'))).toBe(true);
    });

    it('应该为迁移任务生成计划', () => {
      const plan = manager.createPlan('迁移数据到新的数据库');
      
      expect(plan.length).toBeGreaterThan(0);
      expect(plan.some(s => s.description.includes('迁移') || s.description.includes('数据'))).toBe(true);
    });
  });

  describe('start', () => {
    it('应该启动任务', async () => {
      // 使用不需要确认的计划（但多个步骤，避免立即完成）
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
        { id: 'step2', order: 2, description: '步骤2', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      const started = await manager.start(task.id);
      
      expect(started).toBe(true);
      
      const updatedTask = manager.getTask(task.id);
      // 状态可能是 running（执行中）或 waiting_confirm（等待确认）或 completed（已完成）
      expect(updatedTask?.startedAt).toBeDefined();
      expect([FlowTaskStatus.RUNNING, FlowTaskStatus.WAITING_CONFIRM, FlowTaskStatus.COMPLETED]).toContain(updatedTask?.status);
    });

    it('不存在的任务返回false', async () => {
      const result = await manager.start('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('confirmAndContinue', () => {
    it('非等待状态返回null', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const result = await manager.confirmAndContinue(task.id, 'user_test');
      expect(result).toBeNull();
    });
  });

  describe('skipStep', () => {
    it('应该跳过当前步骤', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const updated = await manager.skipStep(task.id, 'user_test');
      
      expect(updated?.currentStep).toBe(1);
      expect(updated?.results[0].status).toBe('skipped');
    });

    it('所有步骤完成后标记完成', async () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      const updated = await manager.skipStep(task.id, 'user_test');
      
      expect(updated?.status).toBe(FlowTaskStatus.COMPLETED);
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('应该取消任务', async () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const cancelled = await manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(FlowTaskStatus.CANCELLED);
    });

    it('已完成任务不能取消', async () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      await manager.skipStep(task.id, 'user_test'); // 这会标记为完成
      
      const cancelled = await manager.cancel(task.id);
      expect(cancelled).toBeNull();
    });
  });

  describe('getTask', () => {
    it('应该获取任务', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const retrieved = manager.getTask(task.id);
      
      expect(retrieved?.id).toBe(task.id);
    });

    it('不存在返回null', () => {
      const result = manager.getTask('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getCurrentStep', () => {
    it('应该获取当前步骤', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const step = manager.getCurrentStep(task.id);
      
      expect(step?.id).toBe('step1');
    });

    it('完成所有步骤返回null', async () => {
      const plan: FlowStep[] = [
        { id: 'step1', order: 1, description: '步骤1', requiresConfirmation: false, estimatedDuration: 5000 },
      ];
      const task = manager.create(createSubmission('测试'), plan);
      await manager.skipStep(task.id, 'user_test');
      
      const step = manager.getCurrentStep(task.id);
      expect(step).toBeNull();
    });
  });

  describe('getProgressDescription', () => {
    it('应该返回进度描述', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const desc = manager.getProgressDescription(task.id);
      
      expect(desc).toContain('0/3');
      expect(desc).toContain('pending');
    });

    it('任务不存在返回提示', () => {
      const desc = manager.getProgressDescription('non-existent');
      expect(desc).toBe('任务不存在');
    });
  });

  describe('generateReport', () => {
    it('应该生成任务报告', () => {
      const task = manager.create(createSubmission('测试'), createPlan());
      const report = manager.generateReport(task.id);
      
      expect(report).toContain('流程任务报告');
      expect(report).toContain(task.id);
      expect(report).toContain('执行步骤');
    });

    it('任务不存在返回提示', () => {
      const report = manager.generateReport('non-existent');
      expect(report).toBe('任务不存在');
    });
  });
});
