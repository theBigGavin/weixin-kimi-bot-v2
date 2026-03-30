/**
 * 流程任务管理器
 */

import { FlowTask, FlowTaskStatus, FlowStep, FlowStepResult, createFlowTaskId } from './types.js';
import { TaskSubmission } from '../task-router/types.js';

export class FlowTaskManager {
  private tasks = new Map<string, FlowTask>();

  create(submission: TaskSubmission, plan: FlowStep[]): FlowTask {
    const task: FlowTask = {
      id: createFlowTaskId(),
      submissionId: submission.id,
      status: FlowTaskStatus.PENDING,
      plan,
      currentStep: 0,
      results: [],
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  start(taskId: string): FlowTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = FlowTaskStatus.RUNNING;
    task.startedAt = Date.now();
    return task;
  }

  async executeStep(
    taskId: string,
    executeFn: (step: FlowStep) => Promise<string>
  ): Promise<FlowTask | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== FlowTaskStatus.RUNNING) return null;

    const step = task.plan[task.currentStep];
    if (!step) return null;

    // 如果需要确认，等待状态
    if (step.requiresConfirmation) {
      task.status = FlowTaskStatus.WAITING_CONFIRM;
      return task;
    }

    try {
      const output = await executeFn(step);
      
      const result: FlowStepResult = {
        stepId: step.id,
        status: 'completed',
        output,
        completedAt: Date.now(),
      };
      task.results.push(result);
      task.currentStep++;

      // 检查是否完成
      if (task.currentStep >= task.plan.length) {
        task.status = FlowTaskStatus.COMPLETED;
        task.completedAt = Date.now();
      }

      return task;
    } catch (error) {
      const result: FlowStepResult = {
        stepId: step.id,
        status: 'failed',
        error: String(error),
        completedAt: Date.now(),
      };
      task.results.push(result);
      task.status = FlowTaskStatus.FAILED;
      return task;
    }
  }

  confirmAndContinue(taskId: string): FlowTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== FlowTaskStatus.WAITING_CONFIRM) return null;

    task.status = FlowTaskStatus.RUNNING;
    return task;
  }

  skipStep(taskId: string): FlowTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const step = task.plan[task.currentStep];
    if (!step) return null;

    const result: FlowStepResult = {
      stepId: step.id,
      status: 'skipped',
      completedAt: Date.now(),
    };
    task.results.push(result);
    task.currentStep++;

    if (task.currentStep >= task.plan.length) {
      task.status = FlowTaskStatus.COMPLETED;
      task.completedAt = Date.now();
    }

    return task;
  }

  cancel(taskId: string): FlowTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status === FlowTaskStatus.COMPLETED) return null;

    task.status = FlowTaskStatus.CANCELLED;
    task.completedAt = Date.now();
    return task;
  }

  getTask(taskId: string): FlowTask | null {
    return this.tasks.get(taskId) || null;
  }

  getCurrentStep(taskId: string): FlowStep | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    return task.plan[task.currentStep] || null;
  }
}
