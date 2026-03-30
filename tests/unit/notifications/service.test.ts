/**
 * Notification Service Tests
 * 
 * TDD Red Phase: Define expected behavior for multi-channel notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
  Notification,
} from '../../../src/notifications/service';

describe('notification-service', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  describe('channel registration', () => {
    it('should register a notification channel', () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);

      // When
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);

      // Then
      const channels = service.getRegisteredChannels();
      expect(channels).toContain(NotificationChannel.CONSOLE);
    });

    it('should register multiple channels', () => {
      // Given
      const consoleSender = vi.fn().mockResolvedValue(undefined);
      const webhookSender = vi.fn().mockResolvedValue(undefined);

      // When
      service.registerChannel(NotificationChannel.CONSOLE, consoleSender);
      service.registerChannel(NotificationChannel.WEBHOOK, webhookSender);

      // Then
      expect(service.getRegisteredChannels()).toHaveLength(2);
    });

    it('should throw when registering duplicate channel', () => {
      // Given
      const sender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, sender);

      // When/Then
      expect(() => service.registerChannel(NotificationChannel.CONSOLE, sender))
        .toThrow('already registered');
    });
  });

  describe('send', () => {
    it('should send notification to specified channel', async () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);

      const notification: Notification = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      };

      // When
      await service.send(notification);

      // Then
      expect(mockSender).toHaveBeenCalledWith(notification);
    });

    it('should send to default channel when not specified', async () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);
      service.setDefaultChannel(NotificationChannel.CONSOLE);

      const notification: Omit<Notification, 'channel'> = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        timestamp: Date.now(),
      };

      // When
      await service.send(notification as Notification);

      // Then
      expect(mockSender).toHaveBeenCalledOnce();
    });

    it('should throw for unregistered channel', async () => {
      // Given
      const notification: Notification = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.WEBHOOK,
        timestamp: Date.now(),
      };

      // When/Then
      await expect(service.send(notification)).rejects.toThrow('not registered');
    });

    it('should send to multiple channels when specified', async () => {
      // Given
      const consoleSender = vi.fn().mockResolvedValue(undefined);
      const webhookSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, consoleSender);
      service.registerChannel(NotificationChannel.WEBHOOK, webhookSender);

      const notification: Notification = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.CONSOLE, NotificationChannel.WEBHOOK],
        timestamp: Date.now(),
      };

      // When
      await service.send(notification);

      // Then
      expect(consoleSender).toHaveBeenCalledOnce();
      expect(webhookSender).toHaveBeenCalledOnce();
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all registered channels', async () => {
      // Given
      const consoleSender = vi.fn().mockResolvedValue(undefined);
      const webhookSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, consoleSender);
      service.registerChannel(NotificationChannel.WEBHOOK, webhookSender);

      // When
      await service.broadcast({
        title: 'Broadcast',
        message: 'Broadcast message',
        priority: NotificationPriority.HIGH,
        timestamp: Date.now(),
      });

      // Then
      expect(consoleSender).toHaveBeenCalledOnce();
      expect(webhookSender).toHaveBeenCalledOnce();
    });

    it('should exclude specified channels from broadcast', async () => {
      // Given
      const consoleSender = vi.fn().mockResolvedValue(undefined);
      const webhookSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, consoleSender);
      service.registerChannel(NotificationChannel.WEBHOOK, webhookSender);

      // When
      await service.broadcast({
        title: 'Broadcast',
        message: 'Broadcast message',
        priority: NotificationPriority.NORMAL,
        timestamp: Date.now(),
        excludeChannels: [NotificationChannel.WEBHOOK],
      });

      // Then
      expect(consoleSender).toHaveBeenCalledOnce();
      expect(webhookSender).not.toHaveBeenCalled();
    });
  });

  describe('priority filtering', () => {
    it('should filter by minimum priority', async () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);
      service.setMinPriority(NotificationChannel.CONSOLE, NotificationPriority.HIGH);

      // When - send low priority
      await service.send({
        title: 'Low',
        message: 'Low priority',
        priority: NotificationPriority.LOW,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      });

      // Then - should not be sent
      expect(mockSender).not.toHaveBeenCalled();

      // When - send high priority
      await service.send({
        title: 'High',
        message: 'High priority',
        priority: NotificationPriority.HIGH,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      });

      // Then - should be sent
      expect(mockSender).toHaveBeenCalledOnce();
    });
  });

  describe('error handling', () => {
    it('should handle sender error gracefully', async () => {
      // Given
      const errorSender = vi.fn().mockRejectedValue(new Error('Send failed'));
      service.registerChannel(NotificationChannel.CONSOLE, errorSender);

      const notification: Notification = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      };

      // When/Then - should not throw
      await expect(service.send(notification)).resolves.not.toThrow();
    });

    it('should track failed notifications', async () => {
      // Given
      const errorSender = vi.fn().mockRejectedValue(new Error('Send failed'));
      service.registerChannel(NotificationChannel.CONSOLE, errorSender);

      // When
      await service.send({
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      });

      // Then
      const stats = service.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(0);
    });
  });

  describe('rate limiting', () => {
    it('should throttle high-frequency notifications', async () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);
      service.setRateLimit(NotificationChannel.CONSOLE, 2, 1000); // 2 per second

      const notification: Notification = {
        title: 'Test',
        message: 'Test message',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      };

      // When - send 5 notifications rapidly
      for (let i = 0; i < 5; i++) {
        await service.send({ ...notification, title: `Test ${i}` });
      }

      // Then - only 2 should be sent (rate limit)
      expect(mockSender).toHaveBeenCalledTimes(2);
    });
  });

  describe('statistics', () => {
    it('should track notification statistics', async () => {
      // Given
      const mockSender = vi.fn().mockResolvedValue(undefined);
      service.registerChannel(NotificationChannel.CONSOLE, mockSender);

      // When
      await service.send({
        title: 'Test 1',
        message: 'Message 1',
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      });

      await service.send({
        title: 'Test 2',
        message: 'Message 2',
        priority: NotificationPriority.HIGH,
        channel: NotificationChannel.CONSOLE,
        timestamp: Date.now(),
      });

      // Then
      const stats = service.getStats();
      expect(stats.sent).toBe(2);
      expect(stats.byPriority[NotificationPriority.NORMAL]).toBe(1);
      expect(stats.byPriority[NotificationPriority.HIGH]).toBe(1);
    });
  });
});
