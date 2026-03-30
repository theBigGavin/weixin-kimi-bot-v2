import { describe, it, expect } from 'vitest';
import {
  KimiResponse,
  KimiError,
  isKimiError,
  createKimiResponse,
  createKimiError,
} from '../../../src/kimi/types.js';

describe('kimi/types', () => {
  describe('类型定义', () => {
    it('应该创建成功的响应', () => {
      const response = createKimiResponse('Hello World', 1500);
      expect(response.text).toBe('Hello World');
      expect(response.durationMs).toBe(1500);
      expect(response.error).toBeUndefined();
    });

    it('应该创建失败的响应', () => {
      const error: KimiError = {
        code: 'TIMEOUT',
        message: 'Request timeout',
        retryable: true,
      };
      const response = createKimiResponse('', 0, error);
      expect(response.text).toBe('');
      expect(response.error).toEqual(error);
    });

    it('应该识别错误类型', () => {
      const kimiError: KimiError = {
        code: 'ERROR',
        message: 'test',
        retryable: false,
      };
      expect(isKimiError(kimiError)).toBe(true);
    });

    it('应该排除非错误对象', () => {
      expect(isKimiError(null)).toBe(false);
      expect(isKimiError(undefined)).toBe(false);
      expect(isKimiError('string')).toBe(false);
      expect(isKimiError({})).toBe(false);
      expect(isKimiError({ code: 'ERROR' })).toBe(false); // 缺少message
    });

    it('应该创建标准错误', () => {
      const error = createKimiError('TIMEOUT', 'Request timeout', true);
      expect(error.code).toBe('TIMEOUT');
      expect(error.message).toBe('Request timeout');
      expect(error.retryable).toBe(true);
    });
  });
});
