import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Store, createStore } from '../../src/store.js';

describe('store', () => {
  let testDir: string;
  let store: Store;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'weixin-kimi-bot-test-'));
    store = createStore(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('基本CRUD操作', () => {
    it('应该保存数据到文件', async () => {
      const data = { name: 'test', value: 123 };
      await store.set('test-key', data);

      const filePath = join(testDir, 'test-key.json');
      expect(existsSync(filePath)).toBe(true);
    });

    it('应该读取保存的数据', async () => {
      const data = { name: 'test', value: 123 };
      await store.set('test-key', data);

      const result = await store.get('test-key');
      expect(result).toEqual(data);
    });

    it('应该返回null当键不存在时', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('应该删除数据', async () => {
      await store.set('test-key', { data: 'value' });
      await store.delete('test-key');

      const result = await store.get('test-key');
      expect(result).toBeNull();
    });

    it('应该检查键是否存在', async () => {
      await store.set('exists-key', { data: 'value' });
      
      expect(await store.has('exists-key')).toBe(true);
      expect(await store.has('not-exists')).toBe(false);
    });
  });

  describe('批量操作', () => {
    it('应该获取所有键', async () => {
      await store.set('key1', { a: 1 });
      await store.set('key2', { b: 2 });
      await store.set('key3', { c: 3 });

      const keys = await store.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('应该清空所有数据', async () => {
      await store.set('key1', { a: 1 });
      await store.set('key2', { b: 2 });

      await store.clear();

      const keys = await store.keys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('复杂数据类型', () => {
    it('应该正确保存嵌套对象', async () => {
      const data = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        },
        array: [1, 2, { nested: 'item' }]
      };
      await store.set('nested', data);

      const result = await store.get('nested');
      expect(result).toEqual(data);
    });

    it('应该正确处理特殊字符', async () => {
      const data = {
        text: '包含中文和特殊字符!@#$%^&*()'
      };
      await store.set('special', data);

      const result = await store.get('special');
      expect(result).toEqual(data);
    });
  });

  describe('命名空间支持', () => {
    it('应该在不同命名空间隔离数据', async () => {
      const ns1Store = store.namespace('ns1');
      const ns2Store = store.namespace('ns2');

      await ns1Store.set('key', { value: 'ns1' });
      await ns2Store.set('key', { value: 'ns2' });

      const ns1Result = await ns1Store.get('key');
      const ns2Result = await ns2Store.get('key');

      expect(ns1Result).toEqual({ value: 'ns1' });
      expect(ns2Result).toEqual({ value: 'ns2' });
    });

    it('应该支持嵌套命名空间', async () => {
      const nestedStore = store.namespace('a').namespace('b');
      await nestedStore.set('key', { value: 'nested' });

      const result = await nestedStore.get('key');
      expect(result).toEqual({ value: 'nested' });
    });
  });

  describe('错误处理', () => {
    it('应该在写入失败时抛出错误', async () => {
      // 使用无效的文件名
      await expect(store.set('', { data: 'value' })).rejects.toThrow();
    });

    it('应该在读取损坏的JSON时返回null', async () => {
      const filePath = join(testDir, 'corrupted.json');
      // 手动写入无效的JSON
      require('fs').writeFileSync(filePath, 'invalid json content');

      const result = await store.get('corrupted');
      expect(result).toBeNull();
    });
  });

  describe('元数据操作', () => {
    it('应该获取存储统计信息', async () => {
      await store.set('key1', { data: 'a'.repeat(100) });
      await store.set('key2', { data: 'b'.repeat(200) });

      const stats = await store.stats();
      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});
