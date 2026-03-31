/**
 * Notification Service
 * 
 * Multi-channel notification system with priority filtering and rate limiting.
 */

export enum NotificationChannel {
  CONSOLE = 'console',
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface Notification {
  title: string;
  message: string;
  priority: NotificationPriority;
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  timestamp: number;
  data?: Record<string, unknown>;
  excludeChannels?: NotificationChannel[];
}

export type NotificationSender = (notification: Notification) => Promise<void> | void;

interface ChannelConfig {
  sender: NotificationSender;
  minPriority: NotificationPriority;
  rateLimit?: {
    maxCount: number;
    windowMs: number;
  };
  sentCount: number;
  windowStart: number;
}

interface NotificationStats {
  sent: number;
  failed: number;
  throttled: number;
  byChannel: Record<string, number>;
  byPriority: Record<string, number>;
}

export class NotificationService {
  private channels = new Map<NotificationChannel, ChannelConfig>();
  private defaultChannel: NotificationChannel | null = null;
  private stats: NotificationStats = {
    sent: 0,
    failed: 0,
    throttled: 0,
    byChannel: {},
    byPriority: {},
  };

  /**
   * Register a notification channel
   */
  registerChannel(channel: NotificationChannel, sender: NotificationSender): void {
    if (this.channels.has(channel)) {
      throw new Error(`Channel ${channel} is already registered`);
    }

    this.channels.set(channel, {
      sender,
      minPriority: NotificationPriority.LOW,
      sentCount: 0,
      windowStart: Date.now(),
    });
  }

  /**
   * Set default channel
   */
  setDefaultChannel(channel: NotificationChannel): void {
    if (!this.channels.has(channel)) {
      throw new Error(`Channel ${channel} is not registered`);
    }
    this.defaultChannel = channel;
  }

  /**
   * Set minimum priority for a channel
   */
  setMinPriority(channel: NotificationChannel, priority: NotificationPriority): void {
    const config = this.channels.get(channel);
    if (!config) {
      throw new Error(`Channel ${channel} is not registered`);
    }
    config.minPriority = priority;
  }

  /**
   * Set rate limit for a channel
   */
  setRateLimit(channel: NotificationChannel, maxCount: number, windowMs: number): void {
    const config = this.channels.get(channel);
    if (!config) {
      throw new Error(`Channel ${channel} is not registered`);
    }
    config.rateLimit = { maxCount, windowMs };
  }

  /**
   * Send a notification
   */
  async send(notification: Notification): Promise<void> {
    const channelsToUse = notification.channels || [notification.channel || this.defaultChannel];

    if (!channelsToUse || channelsToUse.length === 0) {
      throw new Error('No channel specified and no default channel set');
    }

    for (const channel of channelsToUse) {
      if (!channel || notification.excludeChannels?.includes(channel)) {
        continue;
      }

      await this.sendToChannel(channel, notification);
    }
  }

  /**
   * Broadcast to all registered channels
   */
  async broadcast(notification: Omit<Notification, 'channel' | 'channels'>): Promise<void> {
    for (const [channel] of this.channels) {
      if (notification.excludeChannels?.includes(channel)) {
        continue;
      }

      await this.sendToChannel(channel, { ...notification, channel });
    }
  }

  /**
   * Get registered channels
   */
  getRegisteredChannels(): NotificationChannel[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return {
      ...this.stats,
      byChannel: { ...this.stats.byChannel },
      byPriority: { ...this.stats.byPriority },
    };
  }

  private async sendToChannel(channel: NotificationChannel, notification: Notification): Promise<void> {
    const config = this.channels.get(channel);
    if (!config) {
      throw new Error(`Channel ${channel} is not registered`);
    }

    // Check priority filter
    if (notification.priority < config.minPriority) {
      return;
    }

    // Check rate limit
    if (config.rateLimit) {
      const now = Date.now();
      if (now - config.windowStart > config.rateLimit.windowMs) {
        // Reset window
        config.windowStart = now;
        config.sentCount = 0;
      }

      if (config.sentCount >= config.rateLimit.maxCount) {
        this.stats.throttled++;
        console.warn(`Rate limit exceeded for channel ${channel}`);
        return;
      }
    }

    try {
      await config.sender(notification);

      // Update stats
      this.stats.sent++;
      this.stats.byChannel[channel] = (this.stats.byChannel[channel] || 0) + 1;
      const priorityKey = String(notification.priority);
      this.stats.byPriority[priorityKey] = (this.stats.byPriority[priorityKey] || 0) + 1;

      // Update rate limit counter
      if (config.rateLimit) {
        config.sentCount++;
      }
    } catch (error) {
      this.stats.failed++;
      console.error(`Failed to send notification to ${channel}:`, error);
    }
  }
}
