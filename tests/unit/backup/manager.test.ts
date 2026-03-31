/**
 * 备份管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BackupManager } from '../../../src/backup/manager.js';
import { setBaseDir, resetBaseDir } from '../../../src/paths.js';
import { AgentManager } from '../../../src/agent/manager.js';
import { WechatManager } from '../../../src/wechat/manager.js';
import { createStore } from '../../../src/store.js';
import { FounderManager } from '../../../src/founder/manager.js';

describe('backup/manager', () => {
  let testDir: string;
  let backupManager: BackupManager;
  let agentManager: AgentManager;
  let wechatManager: WechatManager;
  let founderManager: FounderManager;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'backup-test-'));
    setBaseDir(testDir);
    store = createStore(testDir);
    backupManager = new BackupManager();
    agentManager = new AgentManager(store);
    wechatManager = new WechatManager(store);
    founderManager = new FounderManager();
  });

  afterEach(() => {
    resetBaseDir();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('createBackup', () => {
    it('应该创建备份', async () => {
      // 准备一些数据
      await wechatManager.createAccount('wxid_a1b2c3d4', '测试用户');
      await agentManager.createAgent({
        name: '测试助手',
        wechatAccountId: 'wxid_a1b2c3d4',
      });

      const backup = await backupManager.createBackup('test-backup');

      expect(backup.id).toBeDefined();
      expect(backup.name).toBe('test-backup');
      expect(backup.type).toBe('manual');
      expect(backup.createdAt).toBeGreaterThan(0);
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.includes.agents).toBe(1);
    });

    it('应该创建默认名称的备份', async () => {
      const backup = await backupManager.createBackup();

      expect(backup.name).toContain('backup_');
    });

    it('备份目录应该存在', async () => {
      const backup = await backupManager.createBackup('test');

      expect(existsSync(backup.path)).toBe(true);
      expect(existsSync(join(backup.path, 'manifest.json'))).toBe(true);
    });

    it('应该备份主配置', async () => {
      // 先创建主配置
      const { loadMasterConfig } = await import('../../../src/config/master-config.js');
      await loadMasterConfig();

      const backup = await backupManager.createBackup('test');

      expect(existsSync(join(backup.path, 'master-config.json'))).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('应该列出所有备份', async () => {
      await wechatManager.createAccount('wxid_test');
      await agentManager.createAgent({
        name: '助手1',
        wechatAccountId: 'wxid_test',
      });

      const backup1 = await backupManager.createBackup('backup-1');
      const backup2 = await backupManager.createBackup('backup-2');

      const backups = await backupManager.listBackups();

      expect(backups).toHaveLength(2);
      // 备份按时间排序，最新的在前
      expect(backups[0].id).toBe(backup2.id);
      expect(backups[1].id).toBe(backup1.id);
    });

    it('空备份列表应该返回空数组', async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toEqual([]);
    });
  });

  describe('restoreBackup', () => {
    it('应该恢复备份', async () => {
      // 创建原始数据
      await wechatManager.createAccount('wxid_a1b2c3d4', '测试用户');
      const agent = await agentManager.createAgent({
        name: '测试助手',
        wechatAccountId: 'wxid_a1b2c3d4',
      });

      // 创建备份
      const backup = await backupManager.createBackup('restore-test');

      // 验证备份文件存在
      expect(existsSync(backup.path)).toBe(true);
      expect(existsSync(join(backup.path, 'manifest.json'))).toBe(true);
      expect(existsSync(join(backup.path, 'agents'))).toBe(true);
    });

    it('不存在的备份应该抛出错误', async () => {
      await expect(
        backupManager.restoreBackup('non-existent-backup')
      ).rejects.toThrow('备份不存在');
    });
  });

  describe('deleteBackup', () => {
    it('应该删除备份', async () => {
      const backup = await backupManager.createBackup('to-delete');

      await backupManager.deleteBackup(backup.id);

      expect(existsSync(backup.path)).toBe(false);
    });

    it('不存在的备份应该抛出错误', async () => {
      await expect(
        backupManager.deleteBackup('non-existent')
      ).rejects.toThrow('备份不存在');
    });
  });

  describe('备份内容', () => {
    it('应该备份 Agent 配置', async () => {
      await wechatManager.createAccount('wxid_test');
      const agent = await agentManager.createAgent({
        name: '测试助手',
        wechatAccountId: 'wxid_test',
      });

      const backup = await backupManager.createBackup('content-test');

      // 检查备份目录是否存在 Agent 文件夹
      const agentsDir = join(backup.path, 'agents');
      expect(existsSync(agentsDir)).toBe(true);
      
      // 检查清单中包含了 Agent
      const manifestPath = join(backup.path, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      expect(manifest.agentCount).toBe(1);
      expect(manifest.agents[0].id).toBe(agent.config.id);
    });

    it('应该备份微信绑定关系', async () => {
      await wechatManager.createAccount('wxid_a1b2c3d4');
      const agent = await agentManager.createAgent({
        name: '助手',
        wechatAccountId: 'wxid_a1b2c3d4',
      });
      await wechatManager.bindAgent('wxid_a1b2c3d4', agent.config.id, true);

      const backup = await backupManager.createBackup('bindings-test');

      const bindingsDir = join(backup.path, 'wechat-bindings', 'a1b2c3d4');
      expect(existsSync(join(bindingsDir, 'bindings.json'))).toBe(true);
    });

    it('应该备份创世标识', async () => {
      await wechatManager.createAccount('wxid_founder');
      const agent = await agentManager.createAgent({
        name: '创世助手',
        wechatAccountId: 'wxid_founder',
      });
      await founderManager.setFounder(agent.config.id, 'wxid_founder');

      const backup = await backupManager.createBackup('founder-test');

      expect(existsSync(join(backup.path, 'founder.json'))).toBe(true);
    });
  });
});
