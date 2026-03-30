import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ContextPersistence, ContextExporter } from '../../../src/context/persistence.js';
import { createStore } from '../../../src/store.js';
import { createSessionContext } from '../../../src/context/types.js';

describe('context/persistence', () => {
  let testDir: string;
  let store: ReturnType<typeof createStore>;
  let persistence: ContextPersistence;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'context-test-'));
    store = createStore(testDir);
    persistence = new ContextPersistence(store);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('ContextPersistence', () => {
    it('应该保存和加载会话', async () => {
      const context = createSessionContext('user1', 'agent1');
      await persistence.save(context);

      const loaded = await persistence.load('user1', 'agent1');
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(context.id);
    });

    it('应该删除会话', async () => {
      const context = createSessionContext('user1', 'agent1');
      await persistence.save(context);
      await persistence.delete('user1', 'agent1');

      const loaded = await persistence.load('user1', 'agent1');
      expect(loaded).toBeNull();
    });

    it('应该按用户列出会话', async () => {
      await persistence.save(createSessionContext('user1', 'agent1'));
      await persistence.save(createSessionContext('user1', 'agent2'));
      await persistence.save(createSessionContext('user2', 'agent1'));

      const user1Contexts = await persistence.listByUser('user1');
      expect(user1Contexts).toHaveLength(2);
    });

    it('应该归档会话', async () => {
      const context = createSessionContext('user1', 'agent1');
      await persistence.save(context);
      await persistence.archive(context);

      const active = await persistence.load('user1', 'agent1');
      expect(active).toBeNull();

      const archived = await persistence.getArchived('user1', 'agent1', context.id);
      expect(archived).toBeDefined();
      expect(archived?.archivedAt).toBeDefined();
    });
  });

  describe('ContextExporter', () => {
    it('应该导出为JSON', () => {
      const context = createSessionContext('user1', 'agent1');
      const json = ContextExporter.exportToJSON(context);
      expect(json).toContain(context.id);
    });

    it('应该从JSON导入', () => {
      const context = createSessionContext('user1', 'agent1');
      const json = ContextExporter.exportToJSON(context);
      const imported = ContextExporter.importFromJSON(json);
      expect(imported?.id).toBe(context.id);
    });

    it('无效JSON返回null', () => {
      expect(ContextExporter.importFromJSON('invalid')).toBeNull();
    });

    it('应该导出多个会话', () => {
      const contexts = [
        createSessionContext('user1', 'agent1'),
        createSessionContext('user1', 'agent2'),
      ];
      const json = ContextExporter.exportManyToJSON(contexts);
      expect(JSON.parse(json)).toHaveLength(2);
    });
  });
});
