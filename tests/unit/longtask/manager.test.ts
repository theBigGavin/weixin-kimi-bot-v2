import { describe, it, expect, beforeEach } from 'vitest';
import { LongTaskManager } from '../../../src/longtask/manager.js';
import { LongTaskStatus, createLongTaskId } from '../../../src/longtask/types.js';
import { TaskSubmission, TaskPriority } from '../../../src/task-router/types.js';

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
    manager = new LongTaskManager();
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
    it('应该启动任务', () => {
      const task = manager.submit(createSubmission('测试'));
      const started = manager.start(task.id);
      
      expect(started?.status).toBe(LongTaskStatus.RUNNING);
      expect(started?.startedAt).toBeDefined();
      expect(manager.getActiveCount()).toBe(1);
    });

    it('不存在的任务返回null', () => {
      const result = manager.start('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('应该更新进度', () => {
      const task = manager.submit(createSubmission('测试'));
      manager.start(task.id);
      
      const updated = manager.updateProgress(task.id, 50, '处理中...');
      
      expect(updated?.progress).toBe(50);
      expect(updated?.progressLogs).toHaveLength(1);
      expect(updated?.progressLogs[0].message).toBe('处理中...');
    });
  });

  describe('complete', () => {
    it('应该完成任务', () => {
      const task = manager.submit(createSubmission('测试'));
      manager.start(task.id);
      
      const completed = manager.complete(task.id, '任务结果');
      
      expect(completed?.status).toBe(LongTaskStatus.COMPLETED);
      expect(completed?.result).toBe('任务结果');
      expect(completed?.progress).toBe(100);
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('fail', () => {
    it('应该标记任务失败', () => {
      const task = manager.submit(createSubmission('测试'));
      manager.start(task.id);
      
      const failed = manager.fail(task.id, '出错了');
      
      expect(failed?.status).toBe(LongTaskStatus.FAILED);
      expect(failed?.error).toBe('出错了');
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('cancel', () => {
    it('应该取消待处理任务', () => {
      const task = manager.submit(createSubmission('测试'));
      
      const cancelled = manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(LongTaskStatus.CANCELLED);
    });

    it('应该取消运行中任务', () => {
      const task = manager.submit(createSubmission('测试'));
      manager.start(task.id);
      
      const cancelled = manager.cancel(task.id);
      
      expect(cancelled?.status).toBe(LongTaskStatus.CANCELLED);
      expect(manager.getActiveCount()).toBe(0);
    });

    it('已完成任务不能取消', () => {
      const task = manager.submit(createSubmission('测试'));
      manager.start(task.id);
      manager.complete(task.id, '结果');
      
      const cancelled = manager.cancel(task.id);
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
    it('应该返回待处理任务', () => {
      const task1 = manager.submit(createSubmission('任务1'));
      const task2 = manager.submit(createSubmission('任务2'));
      manager.start(task2.id);
      
      const pending = manager.getPendingTasks();
      
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(task1.id);
    });
  });
});
