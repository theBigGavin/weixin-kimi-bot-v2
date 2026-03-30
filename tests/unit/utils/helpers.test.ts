import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTimestamp,
  truncateString,
  sanitizeFilename,
  deepClone,
  deepMerge,
  isObject,
  sleep,
  retry,
  parseJsonSafe,
  hashString,
} from '../../../src/utils/helpers.js';

describe('utils/helpers', () => {
  describe('formatDate', () => {
    it('应该正确格式化日期', () => {
      const date = new Date('2024-03-15 14:30:00');
      expect(formatDate(date)).toBe('2024-03-15');
    });

    it('应该支持自定义格式', () => {
      const date = new Date('2024-03-15 14:30:00');
      expect(formatDate(date, 'YYYY/MM/DD')).toBe('2024/03/15');
      expect(formatDate(date, 'DD-MM-YYYY')).toBe('15-03-2024');
    });

    it('应该支持时间戳输入', () => {
      const timestamp = new Date('2024-03-15').getTime();
      expect(formatDate(timestamp)).toBe('2024-03-15');
    });
  });

  describe('formatTimestamp', () => {
    it('应该正确格式化时间戳', () => {
      const date = new Date('2024-03-15 14:30:45');
      expect(formatTimestamp(date)).toBe('2024-03-15 14:30:45');
    });

    it('应该支持时间戳输入', () => {
      const timestamp = new Date('2024-03-15 14:30:45').getTime();
      expect(formatTimestamp(timestamp)).toBe('2024-03-15 14:30:45');
    });
  });

  describe('truncateString', () => {
    it('应该在超过长度时截断', () => {
      const str = '这是一个很长的字符串';
      expect(truncateString(str, 5)).toBe('这是...');
    });

    it('应该在未超过长度时返回原字符串', () => {
      const str = '短字符串';
      expect(truncateString(str, 100)).toBe('短字符串');
    });

    it('应该支持自定义后缀', () => {
      const str = '这是一个很长的字符串';
      expect(truncateString(str, 5, '...更多')).toBe('这是...更多');
    });

    it('应该处理空字符串', () => {
      expect(truncateString('', 10)).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('应该移除非法字符', () => {
      expect(sanitizeFilename('file:name|test')).toBe('file_name_test');
      expect(sanitizeFilename('test<file>.txt')).toBe('test_file_.txt');
    });

    it('应该保留合法字符', () => {
      expect(sanitizeFilename('valid_file-name.123.txt')).toBe('valid_file-name.123.txt');
    });

    it('应该处理空字符串', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('deepClone', () => {
    it('应该深克隆对象', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('应该深克隆数组', () => {
      const arr = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[1]).not.toBe(arr[1]);
    });

    it('应该处理基本类型', () => {
      expect(deepClone(123)).toBe(123);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(null)).toBe(null);
    });
  });

  describe('deepMerge', () => {
    it('应该合并两个对象', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('应该递归合并嵌套对象', () => {
      const target = { a: { x: 1 }, b: 2 };
      const source = { a: { y: 3 }, c: 4 };
      expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 3 }, b: 2, c: 4 });
    });

    it('不应该修改源对象', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      deepMerge(target, source);
      expect(target).toEqual({ a: 1 });
      expect(source).toEqual({ b: 2 });
    });
  });

  describe('isObject', () => {
    it('应该正确识别对象', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('应该正确排除非对象', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });
  });

  describe('sleep', () => {
    it('应该等待指定时间', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('retry', () => {
    it('应该在成功时立即返回', async () => {
      const fn = () => Promise.resolve('success');
      const result = await retry(fn, { maxAttempts: 3 });
      expect(result).toBe('success');
    });

    it('应该在失败时重试', async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('fail'));
        }
        return Promise.resolve('success');
      };
      const result = await retry(fn, { maxAttempts: 3, delay: 10 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('应该在超过最大重试次数时抛出错误', async () => {
      const fn = () => Promise.reject(new Error('always fail'));
      await expect(retry(fn, { maxAttempts: 2, delay: 10 }))
        .rejects.toThrow('always fail');
    });
  });

  describe('parseJsonSafe', () => {
    it('应该成功解析有效JSON', () => {
      const json = '{"a": 1, "b": "test"}';
      expect(parseJsonSafe(json)).toEqual({ a: 1, b: 'test' });
    });

    it('应该在无效JSON时返回null', () => {
      const json = 'invalid json';
      expect(parseJsonSafe(json)).toBeNull();
    });

    it('应该解析数组JSON', () => {
      const json = '[1, 2, 3]';
      expect(parseJsonSafe(json)).toEqual([1, 2, 3]);
    });
  });

  describe('hashString', () => {
    it('应该为相同字符串生成相同哈希', () => {
      const str = 'test string';
      expect(hashString(str)).toBe(hashString(str));
    });

    it('应该为不同字符串生成不同哈希', () => {
      const hash1 = hashString('string1');
      const hash2 = hashString('string2');
      expect(hash1).not.toBe(hash2);
    });

    it('应该生成固定长度的哈希', () => {
      expect(hashString('a')).toHaveLength(16);
      expect(hashString('very long string')).toHaveLength(16);
    });
  });
});
