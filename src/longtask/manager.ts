/**
 * 长任务管理器
 * 
 * 支持后台异步执行，进度追踪和通知
 */

import { LongTask, LongTaskStatus, createLongTaskId, ProgressInfo } from './types.js';
import { TaskSubmission } from '../task-router/types.js';
import { Store } from '../store.js';
import { ACPManager } from '../acp/index.js';

/**
 * 任务执行回调
 */
export interface TaskExecutionCallbacks {
  /** 进度更新回调 */
  onProgress?: (taskId: string, progress: number, message: string) => Promise<void>;
  /** 完成回调 */
  onComplete?: (taskId: string, result: string) => Promise<void>;
  /** 失败回调 */
  onFail?: (taskId: string, error: string) => Promise<void>;
}

/**
 * 长任务配置
 */
export interface LongTaskManagerConfig {
  /** 最大并发数 */
  maxConcurrent: number;
  /** 轮询间隔（毫秒） */
  pollInterval: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 存储 */
  store?: Store;
  /** ACP 管理器 */
  acpManager: ACPManager;
}

const DEFAULT_CONFIG: LongTaskManagerConfig = {
  maxConcurrent: 3,
  pollInterval: 5000,
  timeout: 30 * 60 * 1000, // 30分钟
  acpManager: null as unknown as ACPManager, // 占位，会被覆盖
};

/**
 * 长任务管理器
 */
export class LongTaskManager {
  private tasks = new Map<string, LongTask>();
  private runningCount = 0;
  private config: LongTaskManagerConfig;
  private callbacks: TaskExecutionCallbacks = {};
  private store: Store | null = null;
  private acpManager: ACPManager;

  constructor(config: Partial<LongTaskManagerConfig> & { acpManager: ACPManager }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as LongTaskManagerConfig;
    this.store = config.store || null;
    this.acpManager = config.acpManager;
  }

  /**
   * 设置执行回调
   */
  setCallbacks(callbacks: TaskExecutionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 提交任务
   * @param submission 任务提交
   * @param workspacePath Agent workspace path for isolation
   * @returns 创建的任务
   */
  submit(submission: TaskSubmission, workspacePath: string): LongTask {
    const task: LongTask = {
      id: createLongTaskId(),
      submissionId: submission.id,
      status: LongTaskStatus.PENDING,
      prompt: submission.prompt,
      progress: 0,
      progressLogs: [],
      createdAt: Date.now(),
      workspacePath,
    };
    this.tasks.set(task.id, task);
    this.saveTask(task);
    return task;
  }

  /**
   * 启动任务执行（异步）
   * @param taskId 任务ID
   * @param userId 用户ID（用于ACP调用）
   * @returns 是否成功启动
   */
  async start(taskId: string, userId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== LongTaskStatus.PENDING) {
      return false;
    }

    // 检查并发限制
    if (this.runningCount >= this.config.maxConcurrent) {
      return false;
    }

    // 更新状态
    task.status = LongTaskStatus.RUNNING;
    task.startedAt = Date.now();
    this.runningCount++;
    await this.saveTask(task);

    // 异步执行任务
    this.executeTask(task, userId).catch(console.error);

    return true;
  }

  /**
   * 内部执行任务（后台异步）
   */
  private async executeTask(task: LongTask, userId: string): Promise<void> {
    // Track execution start time
    const timeoutId = setTimeout(() => {
      this.fail(task.id, '任务执行超时');
    }, this.config.timeout);

    try {
      // 发送初始进度
      await this.updateProgress(task.id, 10, '任务开始执行，正在分析需求...');

      // 通过 ACP 调用 Kimi (使用 task 的 workspace 路径)
      const response = await this.acpManager.prompt(userId, {
        text: task.prompt,
      }, task.workspacePath);

      if (response.error) {
        throw new Error(response.error);
      }

      clearTimeout(timeoutId);

      // 完成任务
      await this.complete(task.id, response.text);

      // 记录工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolInfo = response.toolCalls.map(t => `${t.title}(${t.status})`).join(', ');
        await this.updateProgress(task.id, 100, `任务完成，使用了: ${toolInfo}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      await this.fail(task.id, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 更新进度
   */
  async updateProgress(taskId: string, percent: number, message: string): Promise<LongTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.progress = percent;
    const progressInfo: ProgressInfo = {
      timestamp: Date.now(),
      message,
      percent,
    };
    task.progressLogs.push(progressInfo);
    await this.saveTask(task);

    // 触发回调
    if (this.callbacks.onProgress) {
      try {
        await this.callbacks.onProgress(taskId, percent, message);
      } catch (e) {
        console.error('进度回调失败:', e);
      }
    }

    return task;
  }

  /**
   * 完成任务
   */
  async complete(taskId: string, result: string): Promise<LongTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = LongTaskStatus.COMPLETED;
    task.result = result;
    task.progress = 100;
    task.completedAt = Date.now();
    this.runningCount--;
    await this.saveTask(task);

    // 触发回调
    if (this.callbacks.onComplete) {
      try {
        await this.callbacks.onComplete(taskId, result);
      } catch (e) {
        console.error('完成回调失败:', e);
      }
    }

    // 启动下一个待处理任务
    this.processNextPending();

    return task;
  }

  /**
   * 标记任务失败
   */
  async fail(taskId: string, error: string): Promise<LongTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = LongTaskStatus.FAILED;
    task.error = error;
    task.completedAt = Date.now();
    this.runningCount--;
    await this.saveTask(task);

    // 触发回调
    if (this.callbacks.onFail) {
      try {
        await this.callbacks.onFail(taskId, error);
      } catch (e) {
        console.error('失败回调失败:', e);
      }
    }

    // 启动下一个待处理任务
    this.processNextPending();

    return task;
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<LongTask | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === LongTaskStatus.COMPLETED) return null;

    const wasRunning = task.status === LongTaskStatus.RUNNING;
    task.status = LongTaskStatus.CANCELLED;
    task.completedAt = Date.now();
    if (wasRunning) {
      this.runningCount--;
    }
    await this.saveTask(task);

    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): LongTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): LongTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取用户的所有任务
   */
  getUserTasks(_userId: string): LongTask[] {
    // 这里需要通过 submissionId 关联到 userId
    // 简化处理：返回所有任务（实际项目中应该建立索引）
    return this.getAllTasks();
  }

  /**
   * 获取活跃任务数
   */
  getActiveCount(): number {
    return this.runningCount;
  }

  /**
   * 获取待处理任务
   */
  getPendingTasks(): LongTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === LongTaskStatus.PENDING);
  }

  /**
   * 获取运行中任务
   */
  getRunningTasks(): LongTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === LongTaskStatus.RUNNING);
  }

  /**
   * 处理下一个待处理任务
   */
  private processNextPending(): void {
    if (this.runningCount >= this.config.maxConcurrent) {
      return;
    }

    const pending = this.getPendingTasks();
    if (pending.length > 0) {
      // 这里需要知道 userId，简化处理使用第一个任务的 submissionId 作为标识
      // 实际应该通过 submissionId 查询到 userId
      this.start(pending[0].id, 'unknown').catch(console.error);
    }
  }

  /**
   * 保存任务到存储
   */
  private async saveTask(task: LongTask): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.set(`longtasks/${task.id}`, task);
    } catch (e) {
      console.error('保存长任务失败:', e);
    }
  }

  /**
   * 从存储加载任务
   */
  async loadTasks(): Promise<void> {
    if (!this.store) return;
    try {
      const keys = await this.store.keys();
      const taskKeys = keys.filter(k => k.startsWith('longtasks/'));
      
      for (const key of taskKeys) {
        const task = await this.store.get<LongTask>(key);
        if (task && task.status !== LongTaskStatus.COMPLETED && 
            task.status !== LongTaskStatus.CANCELLED) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (e) {
      console.error('加载长任务失败:', e);
    }
  }

  /**
   * 清理已完成的任务
   */
  async cleanupCompleted(keepDays: number = 7): Promise<number> {
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [id, task] of this.tasks) {
      if ((task.status === LongTaskStatus.COMPLETED || 
           task.status === LongTaskStatus.CANCELLED) &&
          task.completedAt && task.completedAt < cutoff) {
        this.tasks.delete(id);
        if (this.store) {
          await this.store.delete(`longtasks/${id}`);
        }
        cleaned++;
      }
    }

    return cleaned;
  }
}
