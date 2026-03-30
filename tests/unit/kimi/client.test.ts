import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildKimiCommand,
  parseKimiOutput,
  estimateTokens,
  formatSystemPrompt,
  truncateContext,
  sanitizePrompt,
} from '../../../src/kimi/client.js';

describe('kimi/client', () => {
  describe('buildKimiCommand', () => {
    it('应该构建基本命令', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello' });
      expect(cmd).toContain('kimi');
      expect(cmd).toContain('Hello');
    });

    it('应该支持自定义模型', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello', model: 'kimi-code' });
      expect(cmd).toContain('--model');
      expect(cmd).toContain('kimi-code');
    });

    it('应该支持工作目录', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello', cwd: '/tmp/test' });
      expect(cmd).toContain('--cwd');
      expect(cmd).toContain('/tmp/test');
    });

    it('应该支持系统提示词', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello', systemPrompt: 'You are helpful' });
      expect(cmd).toContain('--system-prompt');
      expect(cmd).toContain('You are helpful');
    });

    it('应该支持交互模式', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello', interactive: true });
      expect(cmd).toContain('--interactive');
    });

    it('应该转义特殊字符', () => {
      const cmd = buildKimiCommand({ prompt: 'Hello "World"' });
      expect(cmd).toContain('\\"');
    });

    it('应该在prompt为空时抛出错误', () => {
      expect(() => buildKimiCommand({ prompt: '' })).toThrow();
    });
  });

  describe('parseKimiOutput', () => {
    it('应该解析标准输出', () => {
      const output = 'This is the AI response';
      const result = parseKimiOutput(output);
      expect(result.text).toBe('This is the AI response');
      expect(result.error).toBeUndefined();
    });

    it('应该去除ANSI转义码', () => {
      const output = '\x1b[32mGreen text\x1b[0m';
      const result = parseKimiOutput(output);
      expect(result.text).toBe('Green text');
    });

    it('应该解析错误输出', () => {
      const output = 'Error: Authentication failed';
      const result = parseKimiOutput(output);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('AUTH_ERROR');
    });

    it('应该处理空输出', () => {
      const result = parseKimiOutput('');
      expect(result.text).toBe('');
    });
  });

  describe('estimateTokens', () => {
    it('应该估算英文token数', () => {
      // 英文大约每4个字符1个token
      const text = 'Hello World Test';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(text.length);
    });

    it('应该估算中文token数', () => {
      // 中文每个字符约1-2个token
      const text = '你好世界';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThanOrEqual(text.length);
    });

    it('应该处理空字符串', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('formatSystemPrompt', () => {
    it('应该格式化基本提示词', () => {
      const prompt = 'You are helpful';
      const formatted = formatSystemPrompt(prompt);
      expect(formatted).toContain('You are helpful');
    });

    it('应该添加上下文信息', () => {
      const prompt = 'You are helpful';
      const context = {
        workDir: '/tmp/project',
        template: 'programmer',
      };
      const formatted = formatSystemPrompt(prompt, context);
      expect(formatted).toContain('/tmp/project');
      expect(formatted).toContain('programmer');
    });

    it('应该处理空提示词', () => {
      const formatted = formatSystemPrompt('');
      expect(formatted).toBe('');
    });
  });

  describe('truncateContext', () => {
    it('应该在超过最大token时截断', () => {
      const messages = [
        { role: 'user', content: 'a'.repeat(1000) },
        { role: 'assistant', content: 'b'.repeat(1000) },
        { role: 'user', content: 'c'.repeat(1000) },
      ];
      const result = truncateContext(messages, 100);
      expect(result.length).toBeLessThan(messages.length);
    });

    it('应该保留最新消息', () => {
      const messages = [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'last' },
      ];
      const result = truncateContext(messages, 1);
      expect(result[result.length - 1].content).toBe('last');
    });

    it('应该处理空数组', () => {
      const result = truncateContext([], 100);
      expect(result).toEqual([]);
    });
  });

  describe('sanitizePrompt', () => {
    it('应该去除危险字符', () => {
      const prompt = 'test; rm -rf /';
      const sanitized = sanitizePrompt(prompt);
      expect(sanitized).not.toContain(';');
    });

    it('应该保留正常字符', () => {
      const prompt = 'Hello World! 你好世界 123';
      const sanitized = sanitizePrompt(prompt);
      expect(sanitized).toBe(prompt);
    });

    it('应该限制最大长度', () => {
      const longPrompt = 'a'.repeat(2000000); // 超过1MB限制
      const sanitized = sanitizePrompt(longPrompt);
      expect(sanitized.length).toBeLessThan(longPrompt.length);
    });
  });
});
