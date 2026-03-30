import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentManager } from '../../../src/agent/manager.js';
import { AgentStatus, createAgentConfig } from '../../../src/agent/types.js';
import { createStore } from '../../../src/store.js';

describe('agent/manager', () => {
  let testDir: string;
  let manager: AgentManager;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'agent-manager-test-'));
    store = createStore(testDir);
    manager = new AgentManager(store);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('createAgent', () => {
    it('应该使用默认配置创建Agent', async () => {
      const agent = await manager.createAgent({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test123',
      });

      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('TestAgent');
      expect(agent.config.wechat.accountId).toBe('wxid_test123');
      expect(agent.runtime.status).toBe(AgentStatus.INITIALIZING);
    });

    it('应该应用指定的模板', async () => {
      const agent = await manager.createAgent({
        name: 'DevAgent',
        wechatAccountId: 'wxid_dev',
        templateId: 'programmer',
      });

      expect(agent.config.ai.templateId).toBe('programmer');
      expect(agent.config.features.shellExec).toBe(true);
      expect(agent.config.ai.model).toBe('kimi-code');
    });

    it('应该保存Agent到存储', async () => {
      const agent = await manager.createAgent({
        name: 'PersistedAgent',
        wechatAccountId: 'wxid_persist',
      });

      const saved = await store.get(`agents/${agent.config.id}`);
      expect(saved).toBeDefined();
      expect(saved.config.name).toBe('PersistedAgent');
    });

    it('应该在名称无效时抛出错误', async () => {
      await expect(
        manager.createAgent({
          name: '',
          wechatAccountId: 'wxid_test',
        })
      ).rejects.toThrow();
    });

    it('应该在微信ID无效时抛出错误', async () => {
      await expect(
        manager.createAgent({
          name: 'Test',
          wechatAccountId: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('getAgent', () => {
    it('应该获取已创建的Agent', async () => {
      const created = await manager.createAgent({
        name: 'GetTest',
        wechatAccountId: 'wxid_get',
      });

      const retrieved = await manager.getAgent(created.config.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.config.id).toBe(created.config.id);
    });

    it('应该对不存在的Agent返回null', async () => {
      const agent = await manager.getAgent('non-existent-id');
      expect(agent).toBeNull();
    });
  });

  describe('listAgents', () => {
    it('应该列出所有Agent', async () => {
      await manager.createAgent({ name: 'Agent1', wechatAccountId: 'wxid_1' });
      await manager.createAgent({ name: 'Agent2', wechatAccountId: 'wxid_2' });
      await manager.createAgent({ name: 'Agent3', wechatAccountId: 'wxid_3' });

      const agents = await manager.listAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.config.name)).toContain('Agent1');
      expect(agents.map(a => a.config.name)).toContain('Agent2');
      expect(agents.map(a => a.config.name)).toContain('Agent3');
    });

    it('应该返回空数组当没有Agent时', async () => {
      const agents = await manager.listAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('updateAgent', () => {
    it('应该更新Agent配置', async () => {
      const agent = await manager.createAgent({
        name: 'UpdateTest',
        wechatAccountId: 'wxid_update',
      });

      const updated = await manager.updateAgent(agent.config.id, {
        name: 'UpdatedName',
        customSystemPrompt: '新的系统提示词',
      });

      expect(updated.config.name).toBe('UpdatedName');
      expect(updated.config.ai.customSystemPrompt).toBe('新的系统提示词');
    });

    it('应该保存更新后的配置', async () => {
      const agent = await manager.createAgent({
        name: 'SaveTest',
        wechatAccountId: 'wxid_save',
      });

      await manager.updateAgent(agent.config.id, { name: 'SavedName' });

      const saved = await store.get(`agents/${agent.config.id}`);
      expect(saved.config.name).toBe('SavedName');
    });

    it('应该对不存在的Agent抛出错误', async () => {
      await expect(
        manager.updateAgent('non-existent', { name: 'NewName' })
      ).rejects.toThrow('Agent not found');
    });
  });

  describe('deleteAgent', () => {
    it('应该删除Agent', async () => {
      const agent = await manager.createAgent({
        name: 'DeleteTest',
        wechatAccountId: 'wxid_delete',
      });

      await manager.deleteAgent(agent.config.id);

      const retrieved = await manager.getAgent(agent.config.id);
      expect(retrieved).toBeNull();
    });

    it('应该从存储中移除', async () => {
      const agent = await manager.createAgent({
        name: 'RemoveTest',
        wechatAccountId: 'wxid_remove',
      });

      await manager.deleteAgent(agent.config.id);

      const saved = await store.get(`agents/${agent.config.id}`);
      expect(saved).toBeNull();
    });

    it('应该更新运行时状态', async () => {
      const agent = await manager.createAgent({
        name: 'StatusTest',
        wechatAccountId: 'wxid_status',
      });

      await manager.activateAgent(agent.config.id);
      await manager.deleteAgent(agent.config.id);

      // 运行时应该被清理
      const runtime = manager.getRuntime(agent.config.id);
      expect(runtime).toBeNull();
    });
  });

  describe('activateAgent / pauseAgent', () => {
    it('应该激活Agent', async () => {
      const agent = await manager.createAgent({
        name: 'ActivateTest',
        wechatAccountId: 'wxid_activate',
      });

      const activated = await manager.activateAgent(agent.config.id);
      expect(activated.runtime.status).toBe(AgentStatus.ACTIVE);
    });

    it('应该暂停Agent', async () => {
      const agent = await manager.createAgent({
        name: 'PauseTest',
        wechatAccountId: 'wxid_pause',
      });

      await manager.activateAgent(agent.config.id);
      const paused = await manager.pauseAgent(agent.config.id);
      expect(paused.runtime.status).toBe(AgentStatus.PAUSED);
    });

    it('应该更新活动时间', async () => {
      const agent = await manager.createAgent({
        name: 'ActivityTest',
        wechatAccountId: 'wxid_activity',
      });

      const before = Date.now();
      await manager.activateAgent(agent.config.id);
      const after = Date.now();

      const runtime = manager.getRuntime(agent.config.id);
      expect(runtime?.lastActivityAt).toBeGreaterThanOrEqual(before);
      expect(runtime?.lastActivityAt).toBeLessThanOrEqual(after);
    });
  });

  describe('buildRuntime', () => {
    it('应该构建新的运行时', async () => {
      const config = createAgentConfig({
        name: 'RuntimeTest',
        wechatAccountId: 'wxid_runtime',
      });

      const runtime = manager.buildRuntime(config.id);
      expect(runtime.agentId).toBe(config.id);
      expect(runtime.status).toBe(AgentStatus.INITIALIZING);
    });

    it('应该缓存运行时', async () => {
      const config = createAgentConfig({
        name: 'CacheTest',
        wechatAccountId: 'wxid_cache',
      });

      const runtime1 = manager.buildRuntime(config.id);
      const runtime2 = manager.buildRuntime(config.id);

      expect(runtime1).toBe(runtime2);
    });
  });

  describe('getRuntime', () => {
    it('应该获取运行时', async () => {
      const agent = await manager.createAgent({
        name: 'GetRuntimeTest',
        wechatAccountId: 'wxid_getrt',
      });

      const runtime = manager.getRuntime(agent.config.id);
      expect(runtime).toBeDefined();
      expect(runtime?.agentId).toBe(agent.config.id);
    });

    it('应该对不存在的Agent返回null', () => {
      const runtime = manager.getRuntime('non-existent');
      expect(runtime).toBeNull();
    });
  });

  describe('recordActivity', () => {
    it('应该记录消息活动', async () => {
      const agent = await manager.createAgent({
        name: 'ActivityRecordTest',
        wechatAccountId: 'wxid_activity_rec',
      });

      await manager.recordMessageActivity(agent.config.id);

      const runtime = manager.getRuntime(agent.config.id);
      expect(runtime?.messageCount).toBe(1);
      expect(runtime?.lastActivityAt).toBeDefined();
    });

    it('应该记录错误', async () => {
      const agent = await manager.createAgent({
        name: 'ErrorRecordTest',
        wechatAccountId: 'wxid_error_rec',
      });

      await manager.recordError(agent.config.id, new Error('测试错误'));

      const runtime = manager.getRuntime(agent.config.id);
      expect(runtime?.errorCount).toBe(1);
    });
  });
});
