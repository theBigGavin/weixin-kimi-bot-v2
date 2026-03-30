/**
 * Scheduler Manager
 * 
 * Manages scheduled tasks with support for one-time, interval, and cron schedules.
 */

export enum ScheduleType {
  ONCE = 'ONCE',
  INTERVAL = 'INTERVAL',
  CRON = 'CRON',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ScheduleConfig {
  delay?: number;
  interval?: number;
  cron?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: ScheduleType;
  schedule: ScheduleConfig;
  handler: string;
  data?: Record<string, unknown>;
  maxRetries?: number;
  status: TaskStatus;
  createdAt: number;
  nextRunAt?: number;
  lastRunAt?: number;
  runCount: number;
  error?: string;
}

export type TaskHandler = (data?: Record<string, unknown>) => Promise<void> | void;

interface TaskTimer {
  taskId: string;
  timerId: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>;
  type: 'interval' | 'timeout';
}

export class SchedulerManager {
  private tasks = new Map<string, ScheduledTask>();
  private handlers = new Map<string, TaskHandler>();
  private timers = new Map<string, TaskTimer>();
  private running = false;

  /**
   * Register a task handler
   */
  registerHandler(name: string, handler: TaskHandler): void {
    this.handlers.set(name, handler);
  }

  /**
   * Schedule a new task
   */
  schedule(
    task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt' | 'runCount'>
  ): ScheduledTask {
    // Validate handler exists
    if (!this.handlers.has(task.handler)) {
      throw new Error(`Handler ${task.handler} not registered`);
    }

    const scheduled: ScheduledTask = {
      ...task,
      id: this.generateId(),
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      nextRunAt: this.calculateNextRun(task.type, task.schedule),
      runCount: 0,
    };

    this.tasks.set(scheduled.id, scheduled);

    // If scheduler is running, schedule the task immediately
    if (this.running) {
      this.setupTimer(scheduled);
    }

    return scheduled;
  }

  /**
   * Cancel a scheduled task
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Clear timer
    const timer = this.timers.get(taskId);
    if (timer) {
      if (timer.type === 'interval') {
        clearInterval(timer.timerId);
      } else {
        clearTimeout(timer.timerId);
      }
      this.timers.delete(taskId);
    }

    task.status = TaskStatus.CANCELLED;
    return true;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * List all tasks or filter by status
   */
  list(status?: TaskStatus): ScheduledTask[] {
    const tasks = Array.from(this.tasks.values());
    if (status) {
      return tasks.filter(t => t.status === status);
    }
    return tasks;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Setup timers for all pending tasks
    for (const task of this.tasks.values()) {
      if (task.status === TaskStatus.PENDING) {
        this.setupTimer(task);
      }
    }
  }

  /**
   * Stop all tasks
   */
  stopAll(): void {
    this.running = false;

    // Clear all timers
    for (const timer of this.timers.values()) {
      if (timer.type === 'interval') {
        clearInterval(timer.timerId);
      } else {
        clearTimeout(timer.timerId);
      }
    }
    this.timers.clear();
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateNextRun(type: ScheduleType, schedule: ScheduleConfig): number {
    const now = Date.now();

    switch (type) {
      case ScheduleType.ONCE:
        return now + (schedule.delay || 0);
      case ScheduleType.INTERVAL:
        return now + (schedule.interval || 0);
      case ScheduleType.CRON:
        // Simple implementation: parse basic cron (only supports "M H * * *" format)
        return this.parseCronNextRun(schedule.cron || '');
      default:
        return now;
    }
  }

  private parseCronNextRun(cron: string): number {
    const now = new Date();
    const parts = cron.split(' ');
    
    if (parts.length >= 2) {
      const minute = parseInt(parts[0], 10);
      const hour = parseInt(parts[1], 10);
      
      if (!isNaN(minute) && !isNaN(hour)) {
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        
        return next.getTime();
      }
    }
    
    return now.getTime() + 60000; // Default to 1 minute
  }

  private setupTimer(task: ScheduledTask): void {
    const delay = Math.max(0, (task.nextRunAt || Date.now()) - Date.now());

    if (task.type === ScheduleType.INTERVAL) {
      // For interval tasks, run immediately after delay, then repeat
      const timerId = setInterval(() => {
        this.executeTask(task.id);
      }, task.schedule.interval || 60000);

      this.timers.set(task.id, { taskId: task.id, timerId, type: 'interval' });

      // Initial delay
      if (delay > 0) {
        setTimeout(() => {
          if (task.status === TaskStatus.PENDING) {
            this.executeTask(task.id);
          }
        }, delay);
      }
    } else {
      // One-time or cron task
      const timerId = setTimeout(() => {
        this.executeTask(task.id);
      }, delay);

      this.timers.set(task.id, { taskId: task.id, timerId, type: 'timeout' });
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === TaskStatus.CANCELLED) return;

    const handler = this.handlers.get(task.handler);
    if (!handler) {
      task.status = TaskStatus.FAILED;
      task.error = `Handler ${task.handler} not found`;
      return;
    }

    task.status = TaskStatus.RUNNING;
    task.lastRunAt = Date.now();
    task.runCount++;

    try {
      await handler(task.data);
      
      if (task.type === ScheduleType.ONCE || task.type === ScheduleType.CRON) {
        task.status = TaskStatus.COMPLETED;
      } else {
        // Interval tasks go back to pending
        task.status = TaskStatus.PENDING;
        task.nextRunAt = Date.now() + (task.schedule.interval || 60000);
      }
      
      task.error = undefined;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if ((task.maxRetries || 0) > 0 && task.runCount <= (task.maxRetries || 0)) {
        // Retry
        task.status = TaskStatus.PENDING;
        task.error = `Retry ${task.runCount}/${task.maxRetries}: ${errorMessage}`;
        task.nextRunAt = Date.now() + 1000; // Retry after 1 second
        
        // Setup retry timer
        setTimeout(() => {
          if (this.running) {
            this.executeTask(taskId);
          }
        }, 1000);
      } else {
        task.status = TaskStatus.FAILED;
        task.error = errorMessage;
      }
    }
  }
}
