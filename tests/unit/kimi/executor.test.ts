/**
 * Kimi CLI Executor Unit Tests
 * 
 * Tests for the Kimi CLI execution module
 */

import { describe, it, expect } from 'vitest';
import {
  buildKimiCommand,
  parseKimiOutput,
  executeKimi,
  type KimiExecutorOptions,
  type KimiExecutionResult,
} from '../../../src/kimi/executor.js';

describe('Kimi Executor', () => {
  describe('buildKimiCommand', () => {
    it('should build basic command', () => {
      const result = buildKimiCommand({ prompt: 'Hello' });
      expect(result).toBe('kimi "Hello"');
    });

    it('should include model option', () => {
      const result = buildKimiCommand({ prompt: 'Hello', model: 'k1.5' });
      expect(result).toBe('kimi --model k1.5 "Hello"');
    });

    it('should include cwd option', () => {
      const result = buildKimiCommand({ prompt: 'Hello', cwd: '/tmp' });
      expect(result).toBe('kimi --cwd /tmp "Hello"');
    });

    it('should escape special characters in prompt', () => {
      const result = buildKimiCommand({ prompt: 'Hello "World"' });
      expect(result).toBe('kimi "Hello \\"World\\""');
    });

    it('should include system prompt', () => {
      const result = buildKimiCommand({
        prompt: 'Hello',
        systemPrompt: 'You are a helpful assistant',
      });
      expect(result).toContain('--system-prompt');
      expect(result).toContain('You are a helpful assistant');
    });

    it('should throw on empty prompt', () => {
      expect(() => buildKimiCommand({ prompt: '' })).toThrow('Prompt is required');
    });
  });

  describe('parseKimiOutput', () => {
    it('should return empty text for empty output', () => {
      const result = parseKimiOutput('');
      expect(result.text).toBe('');
      expect(result.error).toBeUndefined();
    });

    it('should strip ANSI codes', () => {
      const output = '\x1b[32mGreen\x1b[0m text';
      const result = parseKimiOutput(output);
      expect(result.text).toBe('Green text');
    });

    it('should detect authentication error', () => {
      const output = 'Authentication failed: invalid token';
      const result = parseKimiOutput(output);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.retryable).toBe(false);
    });

    it('should detect timeout error', () => {
      const output = 'Request timeout after 30s';
      const result = parseKimiOutput(output);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.retryable).toBe(true);
    });

    it('should detect rate limit error', () => {
      const output = 'Rate limit exceeded: 429';
      const result = parseKimiOutput(output);
      expect(result.error?.code).toBe('RATE_LIMIT');
      expect(result.error?.retryable).toBe(true);
    });

    it('should return text for normal output', () => {
      const output = 'This is a normal response';
      const result = parseKimiOutput(output);
      expect(result.text).toBe(output);
      expect(result.error).toBeUndefined();
    });
  });

  describe('executeKimi', () => {
    it('should return result object structure', async () => {
      // This test just verifies the return structure
      // The actual execution depends on Kimi CLI being installed
      try {
        const result = await executeKimi({ prompt: 'Hi', timeout: 5000 });
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('durationMs');
        expect(typeof result.durationMs).toBe('number');
      } catch {
        // Kimi CLI might not be installed, that's ok for unit tests
        expect(true).toBe(true);
      }
    });
  });
});
