/**
 * 微信账号管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WechatManager } from '../../../src/wechat/manager.js';
import { createStore } from '../../../src/store.js';
import { BindingStatus } from '../../../src/wechat/types.js';

describe('wechat/manager', () => {
  let testDir: string;
  let manager: WechatManager;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'wechat-manager-test-'));
    store = createStore(testDir);
    manager = new WechatManager(store);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('账号管理', () => {
    it('应该创建微信账号', async () => {
      const account = await manager.createAccount('wxid_a1b2c3d4', '测试用户');

      expect(account.id).toBe('wxid_a1b2c3d4');
      expect(account.nickname).toBe('测试用户');
      expect(account.createdAt).toBeGreaterThan(0);
    });

    it('应该获取已创建的账号', async () => {
      await manager.createAccount('wxid_a1b2c3d4', '测试用户');

      const account = await manager.getAccount('wxid_a1b2c3d4');

      expect(account).not.toBeNull();
      expect(account?.id).toBe('wxid_a1b2c3d4');
    });

    it('应该返回null当账号不存在', async () => {
      const account = await manager.getAccount('wxid_nonexistent');
      expect(account).toBeNull();
    });

    it('应该检查账号是否存在', async () => {
      await manager.createAccount('wxid_a1b2c3d4');

      expect(await manager.hasAccount('wxid_a1b2c3d4')).toBe(true);
      expect(await manager.hasAccount('wxid_nonexistent')).toBe(false);
    });

    it('应该更新最后登录时间', async () => {
      await manager.createAccount('wxid_a1b2c3d4');
      
      const before = Date.now();
      await manager.updateLastLogin('wxid_a1b2c3d4');
      const after = Date.now();

      const account = await manager.getAccount('wxid_a1b2c3d4');
      expect(account?.lastLoginAt).toBeGreaterThanOrEqual(before);
      expect(account?.lastLoginAt).toBeLessThanOrEqual(after);
    });
  });

  describe('凭证管理', () => {
    it('应该保存和获取凭证', async () => {
      await manager.saveCredentials('wxid_a1b2c3d4', {
        token: 'test-token-123',
        refreshToken: 'refresh-456',
      });

      const credentials = await manager.getCredentials('wxid_a1b2c3d4');

      expect(credentials).not.toBeNull();
      expect(credentials?.token).toBe('test-token-123');
      expect(credentials?.refreshToken).toBe('refresh-456');
      expect(credentials?.wechatId).toBe('wxid_a1b2c3d4');
    });

    it('应该更新凭证', async () => {
      await manager.saveCredentials('wxid_a1b2c3d4', { token: 'old-token' });
      await manager.saveCredentials('wxid_a1b2c3d4', { token: 'new-token' });

      const credentials = await manager.getCredentials('wxid_a1b2c3d4');
      expect(credentials?.token).toBe('new-token');
    });

    it('应该删除凭证', async () => {
      await manager.saveCredentials('wxid_a1b2c3d4', { token: 'test-token' });
      await manager.deleteCredentials('wxid_a1b2c3d4');

      const credentials = await manager.getCredentials('wxid_a1b2c3d4');
      expect(credentials).toBeNull();
    });
  });

  describe('Agent 绑定', () => {
    const wechatId = 'wxid_a1b2c3d4';
    const agentId = '小助手_a1b2c3d4_x7k9';

    beforeEach(async () => {
      await manager.createAccount(wechatId);
    });

    it('应该绑定 Agent', async () => {
      const result = await manager.bindAgent(wechatId, agentId);

      expect(result.success).toBe(true);
      expect(result.status).toBe(BindingStatus.SUCCESS);
    });

    it('应该设置默认 Agent', async () => {
      await manager.bindAgent(wechatId, agentId, true);

      const bindings = await manager.getBindings(wechatId);
      expect(bindings?.defaultAgentId).toBe(agentId);
    });

    it('第一个绑定的 Agent 应该自动成为默认', async () => {
      await manager.bindAgent(wechatId, agentId);

      const bindings = await manager.getBindings(wechatId);
      expect(bindings?.defaultAgentId).toBe(agentId);
    });

    it('应该拒绝重复绑定', async () => {
      await manager.bindAgent(wechatId, agentId);
      const result = await manager.bindAgent(wechatId, agentId);

      expect(result.success).toBe(false);
      expect(result.status).toBe(BindingStatus.ALREADY_BOUND);
    });

    it('应该解绑 Agent', async () => {
      await manager.bindAgent(wechatId, agentId);
      const result = await manager.unbindAgent(wechatId, agentId);

      expect(result).toBe(true);
      expect(await manager.isBound(wechatId, agentId)).toBe(false);
    });

    it('应该检查绑定状态', async () => {
      await manager.bindAgent(wechatId, agentId);

      expect(await manager.isBound(wechatId, agentId)).toBe(true);
      expect(await manager.isBound(wechatId, 'other_agent')).toBe(false);
    });

    it('应该获取绑定的 Agent ID 列表', async () => {
      await manager.bindAgent(wechatId, 'agent1');
      await manager.bindAgent(wechatId, 'agent2');
      await manager.bindAgent(wechatId, 'agent3');

      const agentIds = await manager.getBoundAgentIds(wechatId);
      expect(agentIds).toHaveLength(3);
      expect(agentIds).toContain('agent1');
      expect(agentIds).toContain('agent2');
      expect(agentIds).toContain('agent3');
    });

    it('应该切换默认 Agent', async () => {
      await manager.bindAgent(wechatId, 'agent1', true);
      await manager.bindAgent(wechatId, 'agent2', false);

      await manager.setDefaultAgent(wechatId, 'agent2');

      const defaultId = await manager.getDefaultAgentId(wechatId);
      expect(defaultId).toBe('agent2');
    });

    it('应该设置和获取当前 Agent', async () => {
      await manager.bindAgent(wechatId, 'agent1');
      await manager.bindAgent(wechatId, 'agent2');

      await manager.setCurrentAgent(wechatId, 'agent2');

      const currentId = await manager.getCurrentAgentId(wechatId);
      expect(currentId).toBe('agent2');
    });

    it('获取当前 Agent 时如果没有设置应该返回默认', async () => {
      await manager.bindAgent(wechatId, 'agent1', true);
      await manager.bindAgent(wechatId, 'agent2', false);

      const currentId = await manager.getCurrentAgentId(wechatId);
      expect(currentId).toBe('agent1'); // 返回默认
    });

    it('解绑默认 Agent 后应该更新默认', async () => {
      await manager.bindAgent(wechatId, 'agent1', true);
      await manager.bindAgent(wechatId, 'agent2', false);

      await manager.unbindAgent(wechatId, 'agent1');

      const defaultId = await manager.getDefaultAgentId(wechatId);
      expect(defaultId).toBe('agent2');
    });

    it('应该支持创建者和绑定者类型', async () => {
      await manager.bindAgent(wechatId, 'creator_agent', true, 'creator');
      await manager.bindAgent(wechatId, 'binder_agent', false, 'binder');

      const bindings = await manager.getBindings(wechatId);
      expect(bindings?.agents[0].bindingType).toBe('creator');
      expect(bindings?.agents[1].bindingType).toBe('binder');
    });
  });

  describe('多账号隔离', () => {
    it('不同微信账号的数据应该隔离', async () => {
      const wechat1 = 'wxid_user111';
      const wechat2 = 'wxid_user222';

      await manager.createAccount(wechat1, '用户1');
      await manager.createAccount(wechat2, '用户2');

      await manager.saveCredentials(wechat1, { token: 'token1' });
      await manager.saveCredentials(wechat2, { token: 'token2' });

      await manager.bindAgent(wechat1, 'agent1');
      await manager.bindAgent(wechat2, 'agent2');

      // 验证隔离
      const cred1 = await manager.getCredentials(wechat1);
      const cred2 = await manager.getCredentials(wechat2);
      expect(cred1?.token).toBe('token1');
      expect(cred2?.token).toBe('token2');

      const agents1 = await manager.getBoundAgentIds(wechat1);
      const agents2 = await manager.getBoundAgentIds(wechat2);
      expect(agents1).toContain('agent1');
      expect(agents1).not.toContain('agent2');
      expect(agents2).toContain('agent2');
      expect(agents2).not.toContain('agent1');
    });
  });

  describe('列表查询', () => {
    it('应该列出所有账号', async () => {
      await manager.createAccount('wxid_user1', '用户1');
      await manager.createAccount('wxid_user2', '用户2');
      await manager.createAccount('wxid_user3', '用户3');

      const accounts = await manager.listAllAccounts();
      expect(accounts).toHaveLength(3);
    });

    it('应该获取绑定了指定 Agent 的所有用户', async () => {
      await manager.createAccount('wxid_user1');
      await manager.createAccount('wxid_user2');
      await manager.createAccount('wxid_user3');

      await manager.bindAgent('wxid_user1', 'shared_agent');
      await manager.bindAgent('wxid_user2', 'shared_agent');
      await manager.bindAgent('wxid_user3', 'other_agent');

      const wechatIds = await manager.getWechatIdsByAgent('shared_agent');
      expect(wechatIds).toContain('wxid_user1');
      expect(wechatIds).toContain('wxid_user2');
      expect(wechatIds).not.toContain('wxid_user3');
    });
  });
});
