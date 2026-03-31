import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LongTaskManager } from '../../../src/longtask/manager.js';
import { LongTaskStatus, createLongTaskId } from '../../../src/longtask/types.js';
import { TaskSubmission, TaskPriority } from '../../../src/task-router/types.js';
import { ACPManager } from '../../../src/acp/index.js';

// Mock ACPManager
const mockAcpManager = {
  prompt: vi.fn().mockResolvedValue({ text: 'mock result' }),
} as unknown as ACPManager;

describe('longtask/manager', () => {
  let manager: LongTaskManager;
  
  const createSubmission = (prompt: string): TaskSubmission => ({
    id: 'task_test',
    prompt,
    userId: 'user_test',
    contextId: 'ctx_test',
    priority: TaskPriority.NORMAL,
    createdAt: Date.now(),
  });

  beforeEach(() => {
    manager = new LongTaskManager({ acpManager: mockAcpManager });
  });

  describe('submit', () => {
    it('应该提交任务', () => {
      const task = manager.submit(createSubmission('测试任务'));
      
      expect(task.id).toMatch(/^lt_/);
      expect(task.status).toBe(LongTaskStatus.PENDING);
      expect(task.progress).toBe(0);
    });
  });

  describe('start', () => {
    it('应该启动任务', async () => {
      const task = manager.submit(createSubmission('测试'));
      const started = await manager.start(task.id, 'user_test');
      
      expect(started).toBe(true);
      
      // 获取任务检查状态
      const updatedTask = manager.getTask(task.id);
      expect(updatedTask?.status).toBe(LongTaskStatus.RUNNING);
      expect(updatedTask?.startedAt).toBeDefined();
      expect(manager.getActiveCount()).toBe(1);
    });

    it('不存在的任务返回false', async () => {
      const result = await manager.start('non-existent', 'user_test');
      expect(result).toBe(false);
    });
  });

  describe('updateProgress', () => {
    it('应该更新进度', async () => {
      const task = manager.submit(createSubmission('测试'));
      await manager.start(task.id, 'user_test');
      
      const updated = await manager.updateProgress(task.id, 50, '处理中...');
      
      expect(updated?.progress).toBe(50);
      expect(updated?.progressLogs.length).toBeGreaterThanOrEqual(1);
      expect(updated?.progressLogs[updated.progressLogs.length - 1].message).toBe('处理中...');
    });
  });

  describe('complete', () => {
    it('应该完成任务', async () => {
      const task = manager.submit(createSubmission('测试'));
      await manager.start(task.id, 'user_test');
      
      const completed = await manager.complete(task.id, '任务结果');
      
      expect(completed?.status).toBe(LongTaskStatus.COMPLETED);
      expect(completed?.result).toBe('任务结果');
      expect(completed?.progress).toBe(100);
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('fail', () => {
    it('应该标记任务失败', async () => {
      const task = manager.submit(createSubmission('测试'));
      await manager.start(task.id, 'user_test');
      
      const failed = await manager.fail(task.id, '出错了');
      
      expect(failed?.status).toBe(LongTaskStatus.FAILED);
      expect(failed?.error).toBe('出错了');
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('cancel', () => {
    it('应该取消待处理任务', async () => {
      const task = manager.submit(createSubmission('测试'));
      
      const cancelled = await manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(LongTaskStatus.CANCELLED);
    });

    it('应该取消运行中任务', async () => {
      const task = manager.submit(createSubmission('测试'));
      await manager.start(task.id, 'user_test');
      
      const cancelled = await manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(LongTaskStatus.CANCELLED);
      expect(manager.getActiveCount()).toBe(0);
    });

    it('已完成任务不能取消', async () => {
      const task = manager.submit(createSubmission('测试'));
      await manager.start(task.id, 'user_test');
      await manager.complete(task.id, '结果');
      
      const cancelled = await manager.cancel(task.id);
      expect(cancelled).toBeNull();
    });
  });

  describe('getTask', () => {
    it('应该获取任务', () => {
      const task = manager.submit(createSubmission('测试'));
      const retrieved = manager.getTask(task.id);
      
      expect(retrieved?.id).toBe(task.id);
    });

    it('不存在返回null', () => {
      const result = manager.getTask('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getPendingTasks', () => {
    it('应该返回待处理任务', async () => {
      const task1 = manager.submit(createSubmission('任务1'));
      const task2 = manager.submit(createSubmission('任务2'));
      await manager.start(task2.id, 'user_test');
      
      const pending = manager.getPendingTasks();
      
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(task1.id);
    });
  });
});
