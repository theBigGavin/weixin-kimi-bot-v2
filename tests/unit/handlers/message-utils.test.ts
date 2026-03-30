/**
 * Message Utils Tests
 * 
 * TDD Red Phase: Define expected behavior for message utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  extractMentions,
  isCommandMessage,
  formatResponse,
  truncateMessage,
  sanitizeInput,
  MessageType,
} from '../../../src/handlers/message-utils';

describe('message-utils', () => {
  describe('parseCommand', () => {
    it('should parse simple command without args', () => {
      // Given
      const message = '/help';

      // When
      const result = parseCommand(message);

      // Then
      expect(result).toEqual({
        command: 'help',
        args: [],
        raw: '/help',
      });
    });

    it('should parse command with single arg', () => {
      // Given
      const message = '/template programmer';

      // When
      const result = parseCommand(message);

      // Then
      expect(result).toEqual({
        command: 'template',
        args: ['programmer'],
        raw: '/template programmer',
      });
    });

    it('should parse command with multiple args', () => {
      // Given
      const message = '/task create "My Task" high';

      // When
      const result = parseCommand(message);

      // Then
      expect(result).toEqual({
        command: 'task',
        args: ['create', 'My Task', 'high'],
        raw: '/task create "My Task" high',
      });
    });

    it('should handle quoted arguments', () => {
      // Given
      const message = '/echo "hello world" test';

      // When
      const result = parseCommand(message);

      // Then
      expect(result.args).toEqual(['hello world', 'test']);
    });

    it('should return null for non-command message', () => {
      // Given
      const message = 'Hello, how are you?';

      // When
      const result = parseCommand(message);

      // Then
      expect(result).toBeNull();
    });

    it('should handle command with extra spaces', () => {
      // Given
      const message = '/help   arg1   arg2';

      // When
      const result = parseCommand(message);

      // Then
      expect(result?.args).toEqual(['arg1', 'arg2']);
    });
  });

  describe('extractMentions', () => {
    it('should extract single mention', () => {
      // Given
      const message = 'Hello @alice how are you?';

      // When
      const result = extractMentions(message);

      // Then
      expect(result).toEqual(['alice']);
    });

    it('should extract multiple mentions', () => {
      // Given
      const message = '@alice @bob please review this';

      // When
      const result = extractMentions(message);

      // Then
      expect(result).toEqual(['alice', 'bob']);
    });

    it('should return empty array for no mentions', () => {
      // Given
      const message = 'Hello everyone';

      // When
      const result = extractMentions(message);

      // Then
      expect(result).toEqual([]);
    });

    it('should handle mentions with special characters', () => {
      // Given
      const message = '@user_123 @user-name';

      // When
      const result = extractMentions(message);

      // Then
      expect(result).toEqual(['user_123', 'user-name']);
    });
  });

  describe('isCommandMessage', () => {
    it('should return true for command message', () => {
      expect(isCommandMessage('/help')).toBe(true);
      expect(isCommandMessage('/start now')).toBe(true);
    });

    it('should return false for regular message', () => {
      expect(isCommandMessage('Hello')).toBe(false);
      expect(isCommandMessage('Can you help me?')).toBe(false);
    });

    it('should return false for slash in middle of text', () => {
      expect(isCommandMessage('Check /tmp folder')).toBe(false);
    });
  });

  describe('formatResponse', () => {
    it('should format simple text response', () => {
      // Given
      const content = 'Hello world';

      // When
      const result = formatResponse(content, MessageType.TEXT);

      // Then
      expect(result).toEqual({
        type: MessageType.TEXT,
        content: 'Hello world',
        metadata: {},
      });
    });

    it('should format markdown response', () => {
      // Given
      const content = '# Title\n\nContent';

      // When
      const result = formatResponse(content, MessageType.MARKDOWN);

      // Then
      expect(result).toEqual({
        type: MessageType.MARKDOWN,
        content: '# Title\n\nContent',
        metadata: {},
      });
    });

    it('should include metadata in response', () => {
      // Given
      const content = 'Task completed';
      const metadata = { taskId: 'task_123' };

      // When
      const result = formatResponse(content, MessageType.TEXT, metadata);

      // Then
      expect(result.metadata).toEqual({ taskId: 'task_123' });
    });
  });

  describe('truncateMessage', () => {
    it('should not truncate short message', () => {
      // Given
      const message = 'Short message';

      // When
      const result = truncateMessage(message, 100);

      // Then
      expect(result).toBe('Short message');
    });

    it('should truncate long message with ellipsis', () => {
      // Given
      const message = 'A'.repeat(200);

      // When
      const result = truncateMessage(message, 100);

      // Then
      expect(result).toHaveLength(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use custom suffix', () => {
      // Given
      const message = 'A'.repeat(200);

      // When
      const result = truncateMessage(message, 100, '[more]');

      // Then
      expect(result).toHaveLength(106); // 100 + '[more]'
      expect(result.endsWith('[more]')).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should remove control characters', () => {
      expect(sanitizeInput('hello\x00world')).toBe('helloworld');
    });

    it('should normalize multiple spaces', () => {
      expect(sanitizeInput('hello    world')).toBe('hello world');
    });

    it('should limit maximum length', () => {
      const longInput = 'a'.repeat(10000);
      const result = sanitizeInput(longInput, 1000);
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });
});
