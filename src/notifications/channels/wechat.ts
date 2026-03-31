/**
 * WeChat Notification Channel
 * 
 * Sends notifications via WeChat (ILinkClient).
 */

import type { ILinkClient } from 'weixin-ilink';
import type { NotificationSender } from '../service.js';

export interface WechatChannelConfig {
  client: ILinkClient;
  contextToken: string;
  defaultTargetUser?: string;
}

/**
 * Create a WeChat notification channel sender
 * 
 * Usage:
 * ```typescript
 * const wechatSender = createWechatChannel({
 *   client: iLinkClient,
 *   contextToken: getContextToken(agentId),
 * });
 * 
 * notificationService.registerChannel(NotificationChannel.WECHAT, wechatSender);
 * ```
 */
export function createWechatChannel(config: WechatChannelConfig): NotificationSender {
  return async (notification) => {
    const targetUser = notification.data?.targetUser as string | undefined;
    
    if (!targetUser && !config.defaultTargetUser) {
      throw new Error('No target user specified for WeChat notification');
    }
    
    const userId = targetUser || config.defaultTargetUser;
    const message = formatNotification(notification);
    
    await config.client.sendText(
      userId!,
      message,
      config.contextToken
    );
  };
}

/**
 * Format a notification for WeChat
 */
function formatNotification(notification: {
  title: string;
  message: string;
  priority: number;
  data?: Record<string, unknown>;
}): string {
  const priorityEmoji = getPriorityEmoji(notification.priority);
  
  let result = `${priorityEmoji} ${notification.title}`;
  
  if (notification.message) {
    result += `\n\n${notification.message}`;
  }
  
  // Add task-specific info if present
  if (notification.data?.taskId) {
    result += `\n\n任务ID: ${notification.data.taskId}`;
  }
  
  if (notification.data?.progress !== undefined) {
    result += `\n进度: ${notification.data.progress}%`;
  }
  
  return result;
}

function getPriorityEmoji(priority: number): string {
  switch (priority) {
    case 3: return '🔴'; // CRITICAL
    case 2: return '🟠'; // HIGH
    case 1: return '🟡'; // NORMAL
    default: return '🟢'; // LOW
  }
}
