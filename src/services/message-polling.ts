/**
 * Message Polling Service
 * 
 * Polls for new WeChat messages and dispatches them to handlers.
 */

import { WeChatMessage } from '../ilink/types.js';

export interface PollingConfig {
  interval: number;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

export interface PollingStats {
  pollCount: number;
  messagesReceived: number;
  messagesProcessed: number;
  errors: number;
  lastPollAt?: number;
}

export type MessageHandler = (message: WeChatMessage) => Promise<void> | void;
export type FetchMessagesFunction = () => Promise<WeChatMessage[]>;

export class MessagePollingService {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private messageHandler: MessageHandler | null = null;
  private lastMessageId: string | null = null;
  private processedIds = new Set<string>();
  private errorCount = 0;
  private stats: PollingStats = {
    pollCount: 0,
    messagesReceived: 0,
    messagesProcessed: 0,
    errors: 0,
  };

  constructor(
    private fetchMessages: FetchMessagesFunction,
    private config: PollingConfig
  ) {}

  /**
   * Start polling
   */
  start(handler: MessageHandler): void {
    if (this.running) {
      throw new Error('Polling service is already running');
    }

    this.running = true;
    this.messageHandler = handler;
    this.errorCount = 0;

    // Schedule regular polling - first poll after interval
    this.timer = setInterval(() => {
      this.poll();
    }, this.config.interval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.messageHandler = null;
  }

  /**
   * Check if polling is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the last processed message ID
   */
  getLastMessageId(): string | null {
    return this.lastMessageId;
  }

  /**
   * Get current error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Get polling statistics
   */
  getStats(): PollingStats {
    return { ...this.stats };
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.messageHandler) return;

    try {
      this.stats.pollCount++;
      this.stats.lastPollAt = Date.now();
      
      const messages = await this.fetchMessages();
      this.errorCount = 0;

      // Filter out already processed messages
      const newMessages = messages.filter(msg => !this.processedIds.has(msg.msgId));
      
      this.stats.messagesReceived += newMessages.length;

      // Process new messages
      for (const message of newMessages) {
        try {
          await this.messageHandler(message);
          this.stats.messagesProcessed++;
        } catch (error) {
          // Log but don't stop polling
          this.stats.errors++;
          console.error('Message handler error:', error);
        }

        // Track processed ID
        this.processedIds.add(message.msgId);
        this.lastMessageId = message.msgId;
      }

      // Limit processed IDs set size
      if (this.processedIds.size > 1000) {
        const ids = Array.from(this.processedIds);
        this.processedIds = new Set(ids.slice(-500));
      }
    } catch (error) {
      this.errorCount++;
      this.stats.errors++;
      console.error('Poll error:', error);

      // Check if max retries reached
      if (this.errorCount >= this.config.maxRetries) {
        console.error(`Max retries (${this.config.maxRetries}) reached, stopping polling`);
        this.stop();
        return;
      }

      // Wait before retry (using timeout, next interval will continue)
      await this.delay(this.config.retryDelay);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
