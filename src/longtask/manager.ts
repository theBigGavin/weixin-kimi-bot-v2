/**
 * 长任务管理器
 */

import { LongTask, LongTaskStatus, createLongTaskId } from './types.js';
import { TaskSubmission } from '../task-router/types.js';

export class LongTaskManager {
  private tasks = new Map<string, LongTask>();
  private runningCount = 0;

  submit(submission: TaskSubmission): LongTask {
    const task: LongTask = {
      id: createLongTaskId(),
      submissionId: submission.id,
      status: LongTaskStatus.PENDING,
      prompt: submission.prompt,
      progress: 0,
      progressLogs: [],
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  start(taskId: string): LongTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = LongTaskStatus.RUNNING;
    task.startedAt = Date.now();
    this.runningCount++;
    return task;
  }

  updateProgress(taskId: string, percent: number, message: string): LongTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.progress = percent;
    task.progressLogs.push({
      timestamp: Date.now(),
      message,
      percent,
    });
    return task;
  }

  complete(taskId: string, result: string): LongTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = LongTaskStatus.COMPLETED;
    task.result = result;
    task.progress = 100;
    task.completedAt = Date.now();
    this.runningCount--;
    return task;
  }

  fail(taskId: string, error: string): LongTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = LongTaskStatus.FAILED;
    task.error = error;
    task.completedAt = Date.now();
    this.runningCount--;
    return task;
  }

  cancel(taskId: string): LongTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status === LongTaskStatus.COMPLETED) return null;

    const wasRunning = task.status === LongTaskStatus.RUNNING;
    task.status = LongTaskStatus.CANCELLED;
    task.completedAt = Date.now();
    if (wasRunning) {
      this.runningCount--;
    }
    return task;
  }

  getTask(taskId: string): LongTask | null {
    return this.tasks.get(taskId) || null;
  }

  getActiveCount(): number {
    return this.runningCount;
  }

  getPendingTasks(): LongTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === LongTaskStatus.PENDING);
  }
}
