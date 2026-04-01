/**
 * 流程任务管理器
 * 
 * 支持结构化多步骤执行，人机协作确认
 */

import { 
  FlowTask, 
  FlowTaskStatus, 
  FlowStep, 
  FlowStepResult, 
  createFlowTaskId 
} from './types.js';
import { TaskSubmission } from '../task-router/types.js';
import { Store } from '../store.js';
import { ACPManager } from '../acp/index.js';

/**
 * 流程任务回调
 */
export interface FlowTaskCallbacks {
  /** 等待确认回调 */
  onWaitingConfirm?: (taskId: string, step: FlowStep) => Promise<void>;
  /** 步骤完成回调 */
  onStepComplete?: (taskId: string, stepIndex: number, result: string) => Promise<void>;
  /** 任务完成回调 */
  onComplete?: (taskId: string, results: FlowStepResult[]) => Promise<void>;
  /** 任务失败回调 */
  onFail?: (taskId: string, error: string) => Promise<void>;
}

/**
 * 流程任务配置
 */
export interface FlowTaskManagerConfig {
  store?: Store;
  acpManager: ACPManager;
}

/**
 * 流程任务管理器
 */
export class FlowTaskManager {
  private tasks = new Map<string, FlowTask>();
  private callbacks: FlowTaskCallbacks = {};
  private store: Store | null = null;
  private acpManager: ACPManager;

  constructor(config: FlowTaskManagerConfig) {
    this.store = config.store || null;
    this.acpManager = config.acpManager;
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: FlowTaskCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 创建流程任务
   * @param submission 任务提交
   * @param plan 执行计划
   * @param workspacePath Agent workspace path for isolation
   * @returns 创建的任务
   */
  create(submission: TaskSubmission, plan: FlowStep[], workspacePath: string): FlowTask {
    const task: FlowTask = {
      id: createFlowTaskId(),
      submissionId: submission.id,
      status: FlowTaskStatus.PENDING,
      plan,
      currentStep: 0,
      results: [],
      createdAt: Date.now(),
      workspacePath,
    };
    this.tasks.set(task.id, task);
    this.saveTask(task);
    return task;
  }

  /**
   * 创建执行计划
   * 通过分析任务描述自动生成步骤
   */
  createPlan(prompt: string): FlowStep[] {
    // 基于关键词解析生成计划
    const steps: FlowStep[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // 如果是部署相关
    if (lowerPrompt.includes('部署') || lowerPrompt.includes('发布')) {
      steps.push(
        this.createStep(1, '备份现有数据和环境', true, 5 * 60 * 1000),
        this.createStep(2, '执行测试确保代码质量', true, 10 * 60 * 1000),
        this.createStep(3, '构建生产环境代码', false, 5 * 60 * 1000),
        this.createStep(4, '上传到服务器', false, 3 * 60 * 1000),
        this.createStep(5, '执行数据库迁移', true, 5 * 60 * 1000),
        this.createStep(6, '重启服务并验证', true, 3 * 60 * 1000)
      );
    }
    // 如果是重构相关
    else if (lowerPrompt.includes('重构') || lowerPrompt.includes('优化')) {
      steps.push(
        this.createStep(1, '分析现有代码结构', false, 10 * 60 * 1000),
        this.createStep(2, '创建备份分支', true, 2 * 60 * 1000),
        this.createStep(3, '执行重构修改', true, 30 * 60 * 1000),
        this.createStep(4, '运行测试验证', true, 10 * 60 * 1000),
        this.createStep(5, '生成重构报告', false, 5 * 60 * 1000)
      );
    }
    // 如果是数据迁移
    else if (lowerPrompt.includes('迁移')) {
      steps.push(
        this.createStep(1, '备份源数据', true, 10 * 60 * 1000),
        this.createStep(2, '数据格式转换', false, 20 * 60 * 1000),
        this.createStep(3, '数据验证', true, 15 * 60 * 1000),
        this.createStep(4, '目标环境写入', true, 20 * 60 * 1000),
        this.createStep(5, '最终验证和清理', true, 10 * 60 * 1000)
      );
    }
    // 默认通用计划
    else {
      steps.push(
        this.createStep(1, '需求分析和方案设计', true, 15 * 60 * 1000),
        this.createStep(2, '执行主要任务', true, 30 * 60 * 1000),
        this.createStep(3, '验证和测试', true, 15 * 60 * 1000),
        this.createStep(4, '生成总结报告', false, 5 * 60 * 1000)
      );
    }

    return steps;
  }

  /**
   * 创建单个步骤
   */
  private createStep(
    order: number, 
    description: string, 
    requiresConfirmation: boolean,
    estimatedDuration: number
  ): FlowStep {
    return {
      id: `step_${order}_${Date.now()}`,
      order,
      description,
      requiresConfirmation,
      estimatedDuration,
    };
  }

  /**
   * 启动流程任务
   */
  async start(taskId: string, userId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== FlowTaskStatus.PENDING) {
      return false;
    }

    task.status = FlowTaskStatus.RUNNING;
    task.startedAt = Date.now();
    await this.saveTask(task);

    // 开始执行第一个步骤
    await this.executeCurrentStep(taskId, userId);
    return true;
  }

  /**
   * 执行当前步骤
   */
  private async executeCurrentStep(taskId: string, userId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== FlowTaskStatus.RUNNING) return;

    const step = task.plan[task.currentStep];
    if (!step) {
      // 所有步骤完成
      await this.complete(taskId);
      return;
    }

    // 如果需要确认，进入等待状态
    if (step.requiresConfirmation) {
      task.status = FlowTaskStatus.WAITING_CONFIRM;
      await this.saveTask(task);

      if (this.callbacks.onWaitingConfirm) {
        try {
          await this.callbacks.onWaitingConfirm(taskId, step);
        } catch (e) {
          console.error('等待确认回调失败:', e);
        }
      }
      return;
    }

    // 直接执行步骤
    try {
      const result = await this.executeStepWithACP(step, userId, task.workspacePath);
      
      const stepResult: FlowStepResult = {
        stepId: step.id,
        status: 'completed',
        output: result,
        completedAt: Date.now(),
      };
      
      task.results.push(stepResult);
      task.currentStep++;
      await this.saveTask(task);

      if (this.callbacks.onStepComplete) {
        try {
          await this.callbacks.onStepComplete(taskId, step.order, result);
        } catch (e) {
          console.error('步骤完成回调失败:', e);
        }
      }

      // 继续下一步
      if (task.currentStep < task.plan.length) {
        await this.executeCurrentStep(taskId, userId);
      } else {
        await this.complete(taskId);
      }
    } catch (error) {
      const stepResult: FlowStepResult = {
        stepId: step.id,
        status: 'failed',
        error: String(error),
        completedAt: Date.now(),
      };
      
      task.results.push(stepResult);
      task.status = FlowTaskStatus.FAILED;
      await this.saveTask(task);

      if (this.callbacks.onFail) {
        try {
          await this.callbacks.onFail(taskId, String(error));
        } catch (e) {
          console.error('失败回调失败:', e);
        }
      }
    }
  }

  /**
   * 通过 ACP 执行步骤
   */
  private async executeStepWithACP(
    step: FlowStep, 
    userId: string, 
    workspacePath: string
  ): Promise<string> {
    const prompt = `执行以下任务步骤：\n\n${step.description}\n\n请详细说明执行过程和结果。`;
    
    const response = await this.acpManager.prompt(userId, { text: prompt }, workspacePath);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.text;
  }

  /**
   * 确认并继续执行
   * @param taskId 任务ID
   * @param userId 用户ID
   */
  async confirmAndContinue(taskId: string, userId: string): Promise<FlowTask | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== FlowTaskStatus.WAITING_CONFIRM) return null;

    const step = task.plan[task.currentStep];
    if (!step) return null;

    // 执行当前步骤
    try {
      task.status = FlowTaskStatus.RUNNING;
      await this.saveTask(task);

      const result = await this.executeStepWithACP(step, userId, task.workspacePath);
      
      const stepResult: FlowStepResult = {
        stepId: step.id,
        status: 'completed',
        output: result,
        completedAt: Date.now(),
      };
      
      task.results.push(stepResult);
      task.currentStep++;
      await this.saveTask(task);

      if (this.callbacks.onStepComplete) {
        try {
          await this.callbacks.onStepComplete(taskId, step.order, result);
        } catch (e) {
          console.error('步骤完成回调失败:', e);
        }
      }

      // 继续下一步
      await this.executeCurrentStep(taskId, userId);

      return task;
    } catch (error) {
      const stepResult: FlowStepResult = {
        stepId: step.id,
        status: 'failed',
        error: String(error),
        completedAt: Date.now(),
      };
      
      task.results.push(stepResult);
      task.status = FlowTaskStatus.FAILED;
      await this.saveTask(task);

      if (this.callbacks.onFail) {
        try {
          await this.callbacks.onFail(taskId, String(error));
        } catch (e) {
          console.error('失败回调失败:', e);
        }
      }

      return task;
    }
  }

  /**
   * 跳过当前步骤
   */
  async skipStep(taskId: string, userId: string): Promise<FlowTask | null> {
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
    task.status = FlowTaskStatus.RUNNING;
    await this.saveTask(task);

    // 继续下一步
    await this.executeCurrentStep(taskId, userId);

    return task;
  }

  /**
   * 完成任务
   */
  private async complete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = FlowTaskStatus.COMPLETED;
    task.completedAt = Date.now();
    await this.saveTask(task);

    if (this.callbacks.onComplete) {
      try {
        await this.callbacks.onComplete(taskId, task.results);
      } catch (e) {
        console.error('完成回调失败:', e);
      }
    }
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<FlowTask | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === FlowTaskStatus.COMPLETED) return null;

    task.status = FlowTaskStatus.CANCELLED;
    task.completedAt = Date.now();
    await this.saveTask(task);
    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): FlowTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): FlowTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取当前步骤
   */
  getCurrentStep(taskId: string): FlowStep | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    return task.plan[task.currentStep] || null;
  }

  /**
   * 获取任务进度描述
   */
  getProgressDescription(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) return '任务不存在';

    const total = task.plan.length;
    const current = task.currentStep;
    const percent = Math.round((current / total) * 100);

    return `进度: ${current}/${total} (${percent}%) - ${task.status}`;
  }

  /**
   * 保存任务
   */
  private async saveTask(task: FlowTask): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.set(`flowtasks/${task.id}`, task);
    } catch (e) {
      console.error('保存流程任务失败:', e);
    }
  }

  /**
   * 加载任务
   */
  async loadTasks(): Promise<void> {
    if (!this.store) return;
    try {
      const keys = await this.store.keys();
      const taskKeys = keys.filter(k => k.startsWith('flowtasks/'));
      
      for (const key of taskKeys) {
        const task = await this.store.get<FlowTask>(key);
        if (task && task.status !== FlowTaskStatus.COMPLETED && 
            task.status !== FlowTaskStatus.CANCELLED) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (e) {
      console.error('加载流程任务失败:', e);
    }
  }

  /**
   * 生成任务报告
   */
  generateReport(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) return '任务不存在';

    let report = `📋 流程任务报告\n`;
    report += `================\n\n`;
    report += `任务ID: ${task.id}\n`;
    report += `状态: ${task.status}\n`;
    report += `进度: ${task.currentStep}/${task.plan.length}\n`;
    report += `创建时间: ${new Date(task.createdAt).toLocaleString()}\n\n`;

    report += `执行步骤:\n`;
    for (let i = 0; i < task.plan.length; i++) {
      const step = task.plan[i];
      const result = task.results.find(r => r.stepId === step.id);
      const status = result ? result.status : 'pending';
      const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : 
                   status === 'skipped' ? '⏭️' : '⏳';
      report += `${icon} ${step.order}. ${step.description}\n`;
      if (result?.output) {
        report += `   ${result.output.substring(0, 100)}...\n`;
      }
    }

    return report;
  }
}
