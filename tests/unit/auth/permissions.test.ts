/**
 * 权限管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PermissionManager, Permission, UserRole, PermissionDeniedError } from '../../../src/auth/permissions.js';
import { FounderManager } from '../../../src/founder/manager.js';
import { AgentManager } from '../../../src/agent/manager.js';
import { WechatManager } from '../../../src/wechat/manager.js';
import { createStore } from '../../../src/store.js';
import { setBaseDir, resetBaseDir } from '../../../src/paths.js';
import { AgentVisibility } from '../../../src/agent/types.js';

describe('auth/permissions', () => {
  let testDir: string;
  let store: ReturnType<typeof createStore>;
  let permManager: PermissionManager;
  let founderManager: FounderManager;
  let agentManager: AgentManager;
  let wechatManager: WechatManager;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'permissions-test-'));
    setBaseDir(testDir);
    store = createStore(testDir);
    permManager = new PermissionManager(store);
    founderManager = new FounderManager();
    agentManager = new AgentManager(store);
    wechatManager = new WechatManager(store);
  });

  afterEach(() => {
    resetBaseDir();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('UserRole', () => {
    it('应该定义所有角色', () => {
      expect(UserRole.FOUNDER).toBe('founder');
      expect(UserRole.OWNER).toBe('owner');
      expect(UserRole.USER).toBe('user');
      expect(UserRole.GUEST).toBe('guest');
    });
  });

  describe('Permission', () => {
    it('应该定义所有权限', () => {
      expect(Permission.AGENT_USE).toBe('agent:use');
      expect(Permission.AGENT_CONFIG).toBe('agent:config');
      expect(Permission.FOUNDER_SYSTEM_CONFIG).toBe('founder:system:config');
    });
  });

  describe('getRole', () => {
    it('创世 Agent 持有者应该是 FOUNDER', async () => {
      const wechatId = 'wxid_founder';
      
      // 创建创世 Agent
      const agent = await agentManager.createAgent({
        name: '创世助手',
        wechatAccountId: wechatId,
      });
      await founderManager.setFounder(agent.config.id, wechatId);
      await wechatManager.createAccount(wechatId);
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      const role = await permManager.getRole(wechatId, agent.config.id);
      expect(role).toBe(UserRole.FOUNDER);
    });

    it('Agent 创建者应该是 OWNER', async () => {
      const wechatId = 'wxid_owner';
      
      await wechatManager.createAccount(wechatId);
      const agent = await agentManager.createAgent({
        name: '个人助手',
        wechatAccountId: wechatId,
      });
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      const role = await permManager.getRole(wechatId, agent.config.id);
      expect(role).toBe(UserRole.OWNER);
    });

    it('绑定者应该是 USER', async () => {
      const creatorId = 'wxid_creator';
      const binderId = 'wxid_binder';
      
      // 创建者创建 Agent
      await wechatManager.createAccount(creatorId);
      const agent = await agentManager.createAgent({
        name: '共享助手',
        wechatAccountId: creatorId,
        visibility: AgentVisibility.SHARED,
        maxBindings: 5,
      });
      await wechatManager.bindAgent(creatorId, agent.config.id, true);

      // 绑定者绑定
      await wechatManager.createAccount(binderId);
      await wechatManager.bindAgent(binderId, agent.config.id, false, 'binder');

      const role = await permManager.getRole(binderId, agent.config.id);
      expect(role).toBe(UserRole.USER);
    });

    it('未绑定者应该是 GUEST', async () => {
      const wechatId = 'wxid_guest';
      const agentId = 'agent_123';

      const role = await permManager.getRole(wechatId, agentId);
      expect(role).toBe(UserRole.GUEST);
    });
  });

  describe('hasPermission', () => {
    it('FOUNDER 应该有所有权限', async () => {
      const wechatId = 'wxid_founder';
      
      const agent = await agentManager.createAgent({
        name: '创世助手',
        wechatAccountId: wechatId,
      });
      await founderManager.setFounder(agent.config.id, wechatId);
      await wechatManager.createAccount(wechatId);
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      // 检查各种权限
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.AGENT_USE)).toBe(true);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.AGENT_CONFIG)).toBe(true);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.FOUNDER_SYSTEM_CONFIG)).toBe(true);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.FOUNDER_AGENT_MANAGE_ALL)).toBe(true);
    });

    it('OWNER 应该有 OWNER 权限', async () => {
      const wechatId = 'wxid_owner';
      
      await wechatManager.createAccount(wechatId);
      const agent = await agentManager.createAgent({
        name: '个人助手',
        wechatAccountId: wechatId,
      });
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.AGENT_USE)).toBe(true);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.AGENT_CONFIG)).toBe(true);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.AGENT_DELETE_OWN)).toBe(true);
    });

    it('OWNER 不应该有 FOUNDER 权限', async () => {
      const wechatId = 'wxid_owner';
      
      await wechatManager.createAccount(wechatId);
      const agent = await agentManager.createAgent({
        name: '个人助手',
        wechatAccountId: wechatId,
      });
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.FOUNDER_SYSTEM_CONFIG)).toBe(false);
      expect(await permManager.hasPermission(wechatId, agent.config.id, Permission.FOUNDER_AGENT_MANAGE_ALL)).toBe(false);
    });

    it('USER 应该有基础使用权限', async () => {
      const creatorId = 'wxid_creator';
      const binderId = 'wxid_binder';
      
      await wechatManager.createAccount(creatorId);
      const agent = await agentManager.createAgent({
        name: '共享助手',
        wechatAccountId: creatorId,
        visibility: AgentVisibility.SHARED,
        maxBindings: 5,
      });
      await wechatManager.bindAgent(creatorId, agent.config.id, true);

      await wechatManager.createAccount(binderId);
      await wechatManager.bindAgent(binderId, agent.config.id, false, 'binder');

      expect(await permManager.hasPermission(binderId, agent.config.id, Permission.AGENT_USE)).toBe(true);
      expect(await permManager.hasPermission(binderId, agent.config.id, Permission.AGENT_SWITCH)).toBe(true);
    });

    it('USER 不应该有管理权限', async () => {
      const creatorId = 'wxid_creator';
      const binderId = 'wxid_binder';
      
      await wechatManager.createAccount(creatorId);
      const agent = await agentManager.createAgent({
        name: '共享助手',
        wechatAccountId: creatorId,
        visibility: AgentVisibility.SHARED,
        maxBindings: 5,
      });
      await wechatManager.bindAgent(creatorId, agent.config.id, true);

      await wechatManager.createAccount(binderId);
      await wechatManager.bindAgent(binderId, agent.config.id, false, 'binder');

      expect(await permManager.hasPermission(binderId, agent.config.id, Permission.AGENT_CONFIG)).toBe(false);
      expect(await permManager.hasPermission(binderId, agent.config.id, Permission.AGENT_DELETE_OWN)).toBe(false);
    });

    it('GUEST 不应该有任何权限', async () => {
      const wechatId = 'wxid_guest';
      const agentId = 'agent_123';

      expect(await permManager.hasPermission(wechatId, agentId, Permission.AGENT_USE)).toBe(false);
      expect(await permManager.hasPermission(wechatId, agentId, Permission.AGENT_CONFIG)).toBe(false);
    });
  });

  describe('hasFounderPermission', () => {
    it('创世者应该有创世权限', async () => {
      const wechatId = 'wxid_founder';
      
      const agent = await agentManager.createAgent({
        name: '创世助手',
        wechatAccountId: wechatId,
      });
      await founderManager.setFounder(agent.config.id, wechatId);
      await wechatManager.createAccount(wechatId);
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      expect(await permManager.hasFounderPermission(wechatId, agent.config.id)).toBe(true);
    });

    it('普通用户不应该有创世权限', async () => {
      const wechatId = 'wxid_owner';
      
      await wechatManager.createAccount(wechatId);
      const agent = await agentManager.createAgent({
        name: '个人助手',
        wechatAccountId: wechatId,
      });
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      expect(await permManager.hasFounderPermission(wechatId, agent.config.id)).toBe(false);
    });
  });

  describe('isFounderHolder', () => {
    it('应该正确识别创世持有者', async () => {
      const founderId = 'wxid_founder';
      const otherId = 'wxid_other';
      
      const agent = await agentManager.createAgent({
        name: '创世助手',
        wechatAccountId: founderId,
      });
      await founderManager.setFounder(agent.config.id, founderId);

      expect(await permManager.isFounderHolder(founderId)).toBe(true);
      expect(await permManager.isFounderHolder(otherId)).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('应该返回用户的所有权限', async () => {
      const wechatId = 'wxid_owner';
      
      await wechatManager.createAccount(wechatId);
      const agent = await agentManager.createAgent({
        name: '个人助手',
        wechatAccountId: wechatId,
      });
      await wechatManager.bindAgent(wechatId, agent.config.id, true);

      const perms = await permManager.getPermissions(wechatId, agent.config.id);
      expect(perms).toContain(Permission.AGENT_USE);
      expect(perms).toContain(Permission.AGENT_CONFIG);
      expect(perms).not.toContain(Permission.FOUNDER_SYSTEM_CONFIG);
    });
  });

  describe('辅助方法', () => {
    it('应该返回角色名称', () => {
      expect(permManager.getRoleName(UserRole.FOUNDER)).toBe('创世者');
      expect(permManager.getRoleName(UserRole.OWNER)).toBe('所有者');
      expect(permManager.getRoleName(UserRole.USER)).toBe('用户');
      expect(permManager.getRoleName(UserRole.GUEST)).toBe('访客');
    });

    it('应该返回权限名称', () => {
      expect(permManager.getPermissionName(Permission.AGENT_USE)).toBe('使用 Agent');
      expect(permManager.getPermissionName(Permission.FOUNDER_SYSTEM_CONFIG)).toBe('系统配置');
    });
  });

  describe('PermissionDeniedError', () => {
    it('应该创建正确的错误信息', () => {
      const error = new PermissionDeniedError(Permission.AGENT_CONFIG, 'wxid_user', 'agent_123');
      
      expect(error.name).toBe('PermissionDeniedError');
      expect(error.permission).toBe(Permission.AGENT_CONFIG);
      expect(error.wechatId).toBe('wxid_user');
      expect(error.agentId).toBe('agent_123');
      expect(error.message).toContain('权限被拒绝');
      expect(error.message).toContain('agent:config');
    });
  });
});
