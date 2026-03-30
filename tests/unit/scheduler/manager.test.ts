/**
 * Scheduler Manager Tests
 * 
 * TDD Red Phase: Define expected behavior for scheduled task management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SchedulerManager,
  ScheduledTask,
  ScheduleType,
  TaskStatus,
} from '../../../src/scheduler/manager';

describe('scheduler-manager', () => {
  let scheduler: SchedulerManager;

  beforeEach(() => {
    scheduler = new SchedulerManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    scheduler.stopAll();
  });

  describe('schedule', () => {
    it('should schedule one-time task', () => {
      // Given
      const handler = vi.fn();
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Test Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'testHandler',
      };
      scheduler.registerHandler('testHandler', handler);

      // When
      const scheduled = scheduler.schedule(task);

      // Then
      expect(scheduled.id).toBeDefined();
      expect(scheduled.status).toBe(TaskStatus.PENDING);
      expect(scheduled.nextRunAt).toBeGreaterThan(Date.now());
    });

    it('should schedule recurring task', () => {
      // Given
      const handler = vi.fn();
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Recurring Task',
        type: ScheduleType.INTERVAL,
        schedule: { interval: 60000 },
        handler: 'testHandler',
      };
      scheduler.registerHandler('testHandler', handler);

      // When
      const scheduled = scheduler.schedule(task);

      // Then
      expect(scheduled.type).toBe(ScheduleType.INTERVAL);
      expect(scheduled.nextRunAt).toBeDefined();
    });

    it('should schedule cron task', () => {
      // Given
      const handler = vi.fn();
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Cron Task',
        type: ScheduleType.CRON,
        schedule: { cron: '0 9 * * *' },  // 9 AM daily
        handler: 'testHandler',
      };
      scheduler.registerHandler('testHandler', handler);

      // When
      const scheduled = scheduler.schedule(task);

      // Then
      expect(scheduled.type).toBe(ScheduleType.CRON);
      expect(scheduled.nextRunAt).toBeDefined();
    });

    it('should throw error for unregistered handler', () => {
      // Given
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Test Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'unknownHandler',
      };

      // When/Then
      expect(() => scheduler.schedule(task)).toThrow('Handler unknownHandler not registered');
    });
  });

  describe('execution', () => {
    it('should execute one-time task after delay', async () => {
      // Given
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.registerHandler('testHandler', handler);
      
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Delayed Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'testHandler',
        data: { key: 'value' },
      };

      // When
      scheduler.schedule(task);
      scheduler.start();

      // Fast-forward time
      vi.advanceTimersByTime(5000);
      await Promise.resolve(); // Let async handler execute

      // Then
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ key: 'value' });
    });

    it('should execute interval task repeatedly', async () => {
      // Given
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.registerHandler('testHandler', handler);
      
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Interval Task',
        type: ScheduleType.INTERVAL,
        schedule: { interval: 1000 },
        handler: 'testHandler',
      };

      // When
      scheduler.schedule(task);
      scheduler.start();

      // Fast-forward time
      vi.advanceTimersByTime(3500);
      await Promise.resolve();

      // Then - should have executed 3 times (at 1s, 2s, 3s)
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should update task status during execution', async () => {
      // Given
      let executionStartTime: number | null = null;
      const handler = vi.fn().mockImplementation(async () => {
        executionStartTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      scheduler.registerHandler('testHandler', handler);
      
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Status Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 1000 },
        handler: 'testHandler',
      };

      // When
      const scheduled = scheduler.schedule(task);
      scheduler.start();
      
      vi.advanceTimersByTime(1000);
      // Wait for async handler to complete
      await vi.advanceTimersByTimeAsync(100);

      // Then
      const taskStatus = scheduler.getTask(scheduled.id);
      expect(taskStatus?.status).toBe(TaskStatus.COMPLETED);
      expect(taskStatus?.lastRunAt).toBe(executionStartTime);
    });

    it('should handle task execution error', async () => {
      // Given
      const handler = vi.fn().mockRejectedValue(new Error('Task failed'));
      scheduler.registerHandler('failingHandler', handler);
      
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Failing Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 1000 },
        handler: 'failingHandler',
      };

      // When
      const scheduled = scheduler.schedule(task);
      scheduler.start();
      
      vi.advanceTimersByTime(1000);
      // Wait for async rejection to be handled
      await vi.advanceTimersByTimeAsync(0);

      // Then
      const taskStatus = scheduler.getTask(scheduled.id);
      expect(taskStatus?.status).toBe(TaskStatus.FAILED);
      expect(taskStatus?.error).toContain('Task failed');
    });

    it('should respect maxRetries on failure', async () => {
      // Given
      const handler = vi.fn().mockRejectedValue(new Error('Always fails'));
      scheduler.registerHandler('retryHandler', handler);
      
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'Retry Task',
        type: ScheduleType.ONCE,
        schedule: { delay: 1000 },
        handler: 'retryHandler',
        maxRetries: 2,
      };

      // When
      scheduler.schedule(task);
      scheduler.start();
      
      // First attempt
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      
      // Retry 1 (after 1 second delay)
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      
      // Retry 2
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then - should have been called 3 times (initial + 2 retries)
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancel', () => {
    it('should cancel pending task', () => {
      // Given
      scheduler.registerHandler('testHandler', vi.fn());
      const task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt'> = {
        name: 'To Cancel',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'testHandler',
      };
      const scheduled = scheduler.schedule(task);

      // When
      const cancelled = scheduler.cancel(scheduled.id);

      // Then
      expect(cancelled).toBe(true);
      expect(scheduler.getTask(scheduled.id)?.status).toBe(TaskStatus.CANCELLED);
    });

    it('should return false for unknown task', () => {
      // When
      const result = scheduler.cancel('unknown-id');

      // Then
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all tasks', () => {
      // Given
      scheduler.registerHandler('testHandler', vi.fn());
      scheduler.schedule({
        name: 'Task 1',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'testHandler',
      });
      scheduler.schedule({
        name: 'Task 2',
        type: ScheduleType.INTERVAL,
        schedule: { interval: 60000 },
        handler: 'testHandler',
      });

      // When
      const tasks = scheduler.list();

      // Then
      expect(tasks).toHaveLength(2);
    });

    it('should filter by status', () => {
      // Given
      scheduler.registerHandler('testHandler', vi.fn());
      scheduler.schedule({
        name: 'Task 1',
        type: ScheduleType.ONCE,
        schedule: { delay: 5000 },
        handler: 'testHandler',
      });
      const t2 = scheduler.schedule({
        name: 'Task 2',
        type: ScheduleType.ONCE,
        schedule: { delay: 6000 },
        handler: 'testHandler',
      });
      scheduler.cancel(t2.id);

      // When
      const pendingTasks = scheduler.list(TaskStatus.PENDING);
      const cancelledTasks = scheduler.list(TaskStatus.CANCELLED);

      // Then
      expect(pendingTasks).toHaveLength(1);
      expect(cancelledTasks).toHaveLength(1);
    });
  });

  describe('stop', () => {
    it('should stop all tasks', () => {
      // Given
      scheduler.registerHandler('testHandler', vi.fn());
      scheduler.schedule({
        name: 'Task 1',
        type: ScheduleType.INTERVAL,
        schedule: { interval: 1000 },
        handler: 'testHandler',
      });
      scheduler.start();

      // When
      scheduler.stopAll();

      // Then
      expect(scheduler.isRunning()).toBe(false);
    });
  });
});
