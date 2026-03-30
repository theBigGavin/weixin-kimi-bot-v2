/**
 * Message Polling Service Tests
 * 
 * TDD Red Phase: Define expected behavior for message polling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MessagePollingService,
  PollingConfig,
  MessageHandler,
} from '../../../src/services/message-polling';
import { WeChatMessage } from '../../../src/ilink/types';

describe('message-polling-service', () => {
  let service: MessagePollingService;
  let mockFetchMessages: () => Promise<WeChatMessage[]>;
  let mockMessageHandler: MessageHandler;
  let config: PollingConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockFetchMessages = vi.fn().mockResolvedValue([]);
    mockMessageHandler = vi.fn().mockResolvedValue(undefined);
    
    config = {
      interval: 1000,
      batchSize: 10,
      maxRetries: 3,
      retryDelay: 1000,
    };

    service = new MessagePollingService(mockFetchMessages, config);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('start/stop', () => {
    it('should start polling', () => {
      // When
      service.start(mockMessageHandler);

      // Then
      expect(service.isRunning()).toBe(true);
    });

    it('should stop polling', () => {
      // Given
      service.start(mockMessageHandler);

      // When
      service.stop();

      // Then
      expect(service.isRunning()).toBe(false);
    });

    it('should not start if already running', () => {
      // Given
      service.start(mockMessageHandler);

      // When/Then
      expect(() => service.start(mockMessageHandler)).toThrow('already running');
    });
  });

  describe('polling', () => {
    it('should poll for messages at interval', async () => {
      // Given
      service.start(mockMessageHandler);

      // When - advance 3 intervals (first poll after interval)
      vi.advanceTimersByTime(3000);
      await vi.advanceTimersByTimeAsync(0);

      // Then
      expect(mockFetchMessages).toHaveBeenCalledTimes(3);
    });

    it('should process received messages', async () => {
      // Given
      const messages: WeChatMessage[] = [
        {
          msgId: 'msg_1',
          fromUser: 'user1',
          content: 'Hello',
          type: 1,
          createTime: Date.now(),
        },
        {
          msgId: 'msg_2',
          fromUser: 'user2',
          content: 'World',
          type: 1,
          createTime: Date.now(),
        },
      ];
      mockFetchMessages.mockResolvedValue(messages);
      service.start(mockMessageHandler);

      // When
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then
      expect(mockMessageHandler).toHaveBeenCalledTimes(2);
      expect(mockMessageHandler).toHaveBeenNthCalledWith(1, messages[0]);
      expect(mockMessageHandler).toHaveBeenNthCalledWith(2, messages[1]);
    });

    it('should track last message ID', async () => {
      // Given
      const messages1: WeChatMessage[] = [
        { msgId: 'msg_1', fromUser: 'user1', content: 'Hello', type: 1, createTime: Date.now() },
      ];
      const messages2: WeChatMessage[] = [
        { msgId: 'msg_2', fromUser: 'user2', content: 'World', type: 1, createTime: Date.now() },
      ];
      
      mockFetchMessages
        .mockResolvedValueOnce(messages1)
        .mockResolvedValueOnce(messages2);
      
      service.start(mockMessageHandler);

      // When - two polling cycles
      vi.advanceTimersByTime(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Then
      expect(service.getLastMessageId()).toBe('msg_2');
    });

    it('should deduplicate messages by ID', async () => {
      // Given - same message returned in consecutive polls
      const message: WeChatMessage = { 
        msgId: 'msg_1', 
        fromUser: 'user1', 
        content: 'Hello', 
        type: 1, 
        createTime: Date.now() 
      };
      
      mockFetchMessages
        .mockResolvedValueOnce([message])
        .mockResolvedValueOnce([message]);
      
      service.start(mockMessageHandler);

      // When - first polling cycle
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then - handler should be called once
      expect(mockMessageHandler).toHaveBeenCalledTimes(1);

      // When - second polling cycle with same message
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then - handler should still be called only once
      expect(mockMessageHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should retry on fetch error', async () => {
      // Given
      mockFetchMessages
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);
      
      service.start(mockMessageHandler);

      // When - wait for retry delay
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      
      // After first error, should wait for retryDelay
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      
      // After second error, should wait again
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then
      expect(mockFetchMessages).toHaveBeenCalledTimes(3);
      expect(service.getErrorCount()).toBe(0); // Reset after success
    });

    it('should pause polling after max retries', async () => {
      // Given
      mockFetchMessages.mockRejectedValue(new Error('Persistent error'));
      service.start(mockMessageHandler);

      // When - trigger 3 retries (maxRetries=3, so 3 consecutive errors stop polling)
      // First poll triggers at 1000ms
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0); // let async handler complete + delay
      // Error 1, errorCount=1, delay 1000ms
      
      await vi.advanceTimersByTimeAsync(1000); // wait for retry delay
      // Second poll
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      // Error 2, errorCount=2, delay 1000ms
      
      await vi.advanceTimersByTimeAsync(1000); // wait for retry delay
      // Third poll
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);
      // Error 3, errorCount=3, STOP

      // Then
      expect(service.isRunning()).toBe(false);
      expect(service.getErrorCount()).toBe(3);
    });

    it('should continue on handler error', async () => {
      // Given
      mockMessageHandler.mockRejectedValue(new Error('Handler error'));
      mockFetchMessages.mockResolvedValue([
        { msgId: 'msg_1', fromUser: 'user1', content: 'Hello', type: 1, createTime: Date.now() },
      ]);
      
      service.start(mockMessageHandler);

      // When
      vi.advanceTimersByTime(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Then - should continue polling
      expect(mockFetchMessages).toHaveBeenCalledTimes(2);
    });
  });

  describe('statistics', () => {
    it('should track message statistics', async () => {
      // Given
      mockFetchMessages.mockResolvedValue([
        { msgId: 'msg_1', fromUser: 'user1', content: 'Hello', type: 1, createTime: Date.now() },
        { msgId: 'msg_2', fromUser: 'user2', content: 'World', type: 1, createTime: Date.now() },
      ]);
      
      service.start(mockMessageHandler);

      // When
      vi.advanceTimersByTime(1000);
      await vi.advanceTimersByTimeAsync(0);

      // Then
      const stats = service.getStats();
      expect(stats.messagesReceived).toBe(2);
      expect(stats.messagesProcessed).toBe(2);
      expect(stats.pollCount).toBe(1);
    });
  });
});
