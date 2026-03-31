/**
 * Notifications Module
 * 
 * Exports notification service and WeChat channel integration.
 */

export {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
  type Notification,
  type NotificationSender,
} from './service.js';

export {
  TaskNotificationService,
  createTaskNotifier,
  type TaskNotificationConfig,
} from './task-notifications.js';

export {
  createWechatChannel,
  type WechatChannelConfig,
} from './channels/wechat.js';
