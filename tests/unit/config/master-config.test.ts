/**
 * 主配置管理测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  MasterConfig,
  SystemSettings,
  BackupConfig,
  GitHubSyncConfig,
  CONFIG_VERSION,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_BACKUP_CONFIG,
  createDefaultMasterConfig,
  loadMasterConfig,
  saveMasterConfig,
  updateSystemSettings,
  updateBackupConfig,
  updateGitHubSyncConfig,
} from '../../../src/config/master-config.js';
import { setBaseDir, resetBaseDir } from '../../../src/paths.js';

describe('config/master-config', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'weixin-kimi-bot-test-'));
    setBaseDir(testDir);
  });

  afterEach(() => {
    resetBaseDir();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('createDefaultMasterConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultMasterConfig();

      expect(config.version).toBe(CONFIG_VERSION);
      expect(config.createdAt).toBeGreaterThan(0);
      expect(config.updatedAt).toBeGreaterThan(0);
      expect(config.settings).toEqual(DEFAULT_SYSTEM_SETTINGS);
      expect(config.backup).toEqual(DEFAULT_BACKUP_CONFIG);
      expect(config.githubSync).toBeUndefined();
    });
  });

  describe('loadMasterConfig', () => {
    it('应该加载现有配置', async () => {
      // 先保存一个配置
      const original = createDefaultMasterConfig();
      original.settings.logLevel = 'debug';
      await saveMasterConfig(original);

      // 重新加载
      const loaded = await loadMasterConfig();

      expect(loaded.version).toBe(original.version);
      expect(loaded.settings.logLevel).toBe('debug');
    });

    it('配置不存在时应该创建默认配置', async () => {
      const config = await loadMasterConfig();

      expect(config.version).toBe(CONFIG_VERSION);
      expect(config.settings).toBeDefined();
    });
  });

  describe('saveMasterConfig', () => {
    it('应该保存配置到文件', async () => {
      const config = createDefaultMasterConfig();
      config.settings.defaultTemplateId = 'programmer';

      await saveMasterConfig(config);
      const loaded = await loadMasterConfig();

      expect(loaded.settings.defaultTemplateId).toBe('programmer');
    });

    it('应该更新updatedAt时间', async () => {
      const config = createDefaultMasterConfig();
      const beforeSave = Date.now();
      
      await saveMasterConfig(config);

      expect(config.updatedAt).toBeGreaterThanOrEqual(beforeSave);
    });
  });

  describe('updateSystemSettings', () => {
    it('应该更新系统设置', async () => {
      const config = await updateSystemSettings({
        logLevel: 'debug',
        messagePollInterval: 10000,
      });

      expect(config.settings.logLevel).toBe('debug');
      expect(config.settings.messagePollInterval).toBe(10000);
      // 其他设置应保持不变
      expect(config.settings.autoBackup).toBe(DEFAULT_SYSTEM_SETTINGS.autoBackup);
    });
  });

  describe('updateBackupConfig', () => {
    it('应该更新备份配置', async () => {
      const config = await updateBackupConfig({
        enabled: false,
        keepCount: 30,
      });

      expect(config.backup.enabled).toBe(false);
      expect(config.backup.keepCount).toBe(30);
    });
  });

  describe('updateGitHubSyncConfig', () => {
    it('应该更新GitHub同步配置', async () => {
      const config = await updateGitHubSyncConfig({
        enabled: true,
        repository: 'user/repo',
        branch: 'main',
      });

      expect(config.githubSync).toBeDefined();
      expect(config.githubSync!.enabled).toBe(true);
      expect(config.githubSync!.repository).toBe('user/repo');
      expect(config.githubSync!.branch).toBe('main');
    });
  });
});
