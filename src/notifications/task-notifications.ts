/**
 * Task Notification Service
 * 
 * Specialized notification service for task-related notifications.
 * Handles long tasks, flow tasks, scheduled tasks, etc.
 */

import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
  type Notification,
} from './service.js';

export interface TaskNotificationConfig {
  service: NotificationService;
  agentId: string;
  userId: string;
  defaultChannel?: NotificationChannel;
}

/**
 * Task notification helper class
 * Provides convenient methods for sending task-related notifications
 */
export class TaskNotificationService {
  private service: NotificationService;
  private agentId: string;
  private userId: string;
  private defaultChannel: NotificationChannel;

  constructor(config: TaskNotificationConfig) {
    this.service = config.service;
    this.agentId = config.agentId;
    this.userId = config.userId;
    this.defaultChannel = config.defaultChannel || NotificationChannel.CONSOLE;
  }

  /**
   * Send task started notification
   */
  async taskStarted(taskId: string, taskName: string, details?: string): Promise<void> {
    await this.send({
      title: `任务已开始`,
      message: details || `任务 "${taskName}" 已开始执行`,
      priority: NotificationPriority.NORMAL,
      data: { taskId, taskName, agentId: this.agentId },
    });
  }

  /**
   * Send task progress notification
   */
  async taskProgress(
    taskId: string, 
    taskName: string, 
    progress: number, 
    message?: string
  ): Promise<void> {
    // Only notify at specific milestones to avoid spam
    const milestones = [0, 25, 50, 75, 100];
    const isMilestone = milestones.includes(Math.floor(progress / 10) * 10);
    
    if (!isMilestone && progress < 100) {
      return; // Skip non-milestone updates
    }

    await this.send({
      title: `任务进度: ${progress}%`,
      message: message || `任务 "${taskName}" 执行中...`,
      priority: NotificationPriority.LOW,
      data: { taskId, taskName, progress, agentId: this.agentId },
    });
  }

  /**
   * Send task completed notification
   */
  async taskCompleted(taskId: string, taskName: string, result?: string): Promise<void> {
    await this.send({
      title: `✅ 任务完成`,
      message: result || `任务 "${taskName}" 已成功完成`,
      priority: NotificationPriority.NORMAL,
      data: { taskId, taskName, agentId: this.agentId, status: 'completed' },
    });
  }

  /**
   * Send task failed notification
   */
  async taskFailed(taskId: string, taskName: string, error: string): Promise<void> {
    await this.send({
      title: `❌ 任务失败`,
      message: `任务 "${taskName}" 执行失败:\n${error}`,
      priority: NotificationPriority.HIGH,
      data: { taskId, taskName, error, agentId: this.agentId, status: 'failed' },
    });
  }

  /**
   * Send task waiting for confirmation notification
   */
  async taskWaitingConfirm(
    taskId: string, 
    taskName: string, 
    stepDescription: string
  ): Promise<void> {
    await this.send({
      title: `⏸️ 等待确认`,
      message: `任务 "${taskName}" 需要您的确认:\n${stepDescription}\n\n请回复 "确认" 继续，或 "取消" 中止任务。`,
      priority: NotificationPriority.HIGH,
      data: { taskId, taskName, stepDescription, agentId: this.userId, status: 'waiting_confirm' },
    });
  }

  /**
   * Send scheduled task reminder notification
   */
  async scheduledReminder(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.send({
      title: `⏰ 提醒`,
      message,
      priority: NotificationPriority.NORMAL,
      data: { ...data, agentId: this.agentId },
    });
  }

  /**
   * Send daily report notification
   */
  async dailyReport(report: string): Promise<void> {
    await this.send({
      title: `📊 日报`,
      message: report,
      priority: NotificationPriority.LOW,
      data: { agentId: this.agentId, type: 'daily_report' },
    });
  }

  /**
   * Send health check alert
   */
  async healthCheckAlert(message: string): Promise<void> {
    await this.send({
      title: `🔔 系统健康检查`,
      message,
      priority: NotificationPriority.CRITICAL,
      data: { agentId: this.agentId, type: 'health_check' },
    });
  }

  /**
   * Generic send method
   */
  private async send(notification: Omit<Notification, 'channel' | 'channels' | 'timestamp'>): Promise<void> {
    await this.service.send({
      ...notification,
      timestamp: Date.now(),
      channel: this.defaultChannel,
    });
  }
}

/**
 * Create a task notification service for a specific agent/user
 */
export function createTaskNotifier(
  notificationService: NotificationService,
  agentId: string,
  userId: string,
  channel?: NotificationChannel
): TaskNotificationService {
  return new TaskNotificationService({
    service: notificationService,
    agentId,
    userId,
    defaultChannel: channel,
  });
}
