/**
 * Scheduler Manager - Functional Programming Version
 * 
 * Phase 1 Refactoring: Remove singleton, use factory function
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

// ============================================================================
// Factory Function
// ============================================================================

export interface SchedulerManager {
  registerHandler(name: string, handler: TaskHandler): void;
  schedule(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt' | 'runCount'>): ScheduledTask;
  cancel(taskId: string): boolean;
  getTask(taskId: string): ScheduledTask | undefined;
  list(status?: TaskStatus): ScheduledTask[];
  start(): void;
  stopAll(): void;
  isRunning(): boolean;
}

export function createSchedulerManager(): SchedulerManager {
  const tasks = new Map<string, ScheduledTask>();
  const handlers = new Map<string, TaskHandler>();
  const timers = new Map<string, TaskTimer>();
  let running = false;

  function registerHandler(name: string, handler: TaskHandler): void {
    handlers.set(name, handler);
  }

  function schedule(
    task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt' | 'runCount'>
  ): ScheduledTask {
    if (!handlers.has(task.handler)) {
      throw new Error(`Handler ${task.handler} not registered`);
    }

    const scheduled: ScheduledTask = {
      ...task,
      id: generateId(),
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      nextRunAt: calculateNextRun(task.type, task.schedule),
      runCount: 0,
    };

    tasks.set(scheduled.id, scheduled);

    if (running) {
      setupTimer(scheduled);
    }

    return scheduled;
  }

  function cancel(taskId: string): boolean {
    const task = tasks.get(taskId);
    if (!task) return false;

    const timer = timers.get(taskId);
    if (timer) {
      if (timer.type === 'interval') {
        clearInterval(timer.timerId as ReturnType<typeof setInterval>);
      } else {
        clearTimeout(timer.timerId as ReturnType<typeof setTimeout>);
      }
      timers.delete(taskId);
    }

    task.status = TaskStatus.CANCELLED;
    return true;
  }

  function getTask(taskId: string): ScheduledTask | undefined {
    return tasks.get(taskId);
  }

  function list(status?: TaskStatus): ScheduledTask[] {
    const allTasks = Array.from(tasks.values());
    if (status) {
      return allTasks.filter(t => t.status === status);
    }
    return allTasks;
  }

  function start(): void {
    if (running) return;
    running = true;

    for (const task of tasks.values()) {
      if (task.status === TaskStatus.PENDING) {
        setupTimer(task);
      }
    }
  }

  function stopAll(): void {
    running = false;

    for (const timer of timers.values()) {
      if (timer.type === 'interval') {
        clearInterval(timer.timerId as ReturnType<typeof setInterval>);
      } else {
        clearTimeout(timer.timerId as ReturnType<typeof setTimeout>);
      }
    }
    timers.clear();
  }

  function isRunning(): boolean {
    return running;
  }

  // Private helpers (closures)
  function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  function calculateNextRun(type: ScheduleType, schedule: ScheduleConfig): number {
    const now = Date.now();

    switch (type) {
      case ScheduleType.ONCE:
        return now + (schedule.delay || 0);
      case ScheduleType.INTERVAL:
        return now + (schedule.interval || 0);
      case ScheduleType.CRON:
        return parseCronNextRun(schedule.cron || '');
      default:
        return now;
    }
  }

  function parseCronNextRun(cron: string): number {
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
    
    return now.getTime() + 60000;
  }

  function setupTimer(task: ScheduledTask): void {
    const delay = Math.max(0, (task.nextRunAt || Date.now()) - Date.now());

    if (task.type === ScheduleType.INTERVAL) {
      const timerId = setInterval(() => {
        executeTask(task.id);
      }, task.schedule.interval || 60000);

      timers.set(task.id, { taskId: task.id, timerId, type: 'interval' });

      if (delay > 0) {
        setTimeout(() => {
          if (task.status === TaskStatus.PENDING) {
            executeTask(task.id);
          }
        }, delay);
      }
    } else {
      const timerId = setTimeout(() => {
        executeTask(task.id);
      }, delay);

      timers.set(task.id, { taskId: task.id, timerId, type: 'timeout' });
    }
  }

  async function executeTask(taskId: string): Promise<void> {
    const task = tasks.get(taskId);
    if (!task || task.status === TaskStatus.CANCELLED) return;

    const handler = handlers.get(task.handler);
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
        task.status = TaskStatus.PENDING;
        task.nextRunAt = Date.now() + (task.schedule.interval || 60000);
      }
      
      task.error = undefined;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if ((task.maxRetries || 0) > 0 && task.runCount <= (task.maxRetries || 0)) {
        task.status = TaskStatus.PENDING;
        task.error = `Retry ${task.runCount}/${task.maxRetries}: ${errorMessage}`;
        task.nextRunAt = Date.now() + 1000;
        
        setTimeout(() => {
          if (running) {
            executeTask(taskId);
          }
        }, 1000);
      } else {
        task.status = TaskStatus.FAILED;
        task.error = errorMessage;
      }
    }
  }

  return {
    registerHandler,
    schedule,
    cancel,
    getTask,
    list,
    start,
    stopAll,
    isRunning,
  } as unknown as SchedulerManager;
}

// ============================================================================
// Backward Compatibility - Singleton Class Wrapper
// ============================================================================

/**
 * @deprecated Use createSchedulerManager() for new code
 */
export class SchedulerManager {
  private static instance: SchedulerManager | null = null;
  private manager: ReturnType<typeof createSchedulerManager>;

  private constructor() {
    this.manager = createSchedulerManager();
  }

  /**
   * @deprecated Use createSchedulerManager() to create instances
   */
  static getInstance(): SchedulerManager {
    if (!SchedulerManager.instance) {
      SchedulerManager.instance = new SchedulerManager();
    }
    return SchedulerManager.instance;
  }

  registerHandler(name: string, handler: TaskHandler): void {
    return this.manager.registerHandler(name, handler);
  }

  schedule(
    task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'nextRunAt' | 'runCount'>
  ): ScheduledTask {
    return this.manager.schedule(task);
  }

  cancel(taskId: string): boolean {
    return this.manager.cancel(taskId);
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.manager.getTask(taskId);
  }

  list(status?: TaskStatus): ScheduledTask[] {
    return Array.from(this.manager.list(status));
  }

  start(): void {
    return this.manager.start();
  }

  stopAll(): void {
    return this.manager.stopAll();
  }

  isRunning(): boolean {
    return this.manager.isRunning();
  }
}
