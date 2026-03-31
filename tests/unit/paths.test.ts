/**
 * 路径常量测试
 * 
 * 测试路径管理系统，确保数据目录结构正确
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 导入被测试模块
import { Paths, setBaseDir, resetBaseDir } from '../../src/paths.js';

describe('Paths 路径系统', () => {
  let testBaseDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testBaseDir = join(tmpdir(), `weixin-kimi-bot-test-${Date.now()}`);
    await mkdir(testBaseDir, { recursive: true });
    // 设置测试目录
    setBaseDir(testBaseDir);
  });

  afterEach(async () => {
    // 重置基础目录
    resetBaseDir();
    // 清理测试目录
    try {
      await rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('基础路径', () => {
    it('应该返回正确的基础目录', () => {
      expect(Paths.baseDir).toBe(testBaseDir);
    });

    it('应该返回正确的agents目录', () => {
      expect(Paths.agentsDir).toBe(join(testBaseDir, 'agents'));
    });

    it('应该返回正确的wechat-accounts目录', () => {
      expect(Paths.wechatAccountsDir).toBe(join(testBaseDir, 'wechat-accounts'));
    });

    it('应该返回正确的backups目录', () => {
      expect(Paths.backupsDir).toBe(join(testBaseDir, 'backups'));
    });
  });

  describe('Agent 路径', () => {
    it('应该返回Agent配置路径', () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const configPath = Paths.agentConfig(agentId);
      expect(configPath).toBe(join(testBaseDir, 'agents', agentId, 'config.json'));
    });

    it('应该返回Agent记忆路径', () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const memoryPath = Paths.agentMemory(agentId);
      expect(memoryPath).toBe(join(testBaseDir, 'agents', agentId, 'memory.json'));
    });

    it('应该返回Agent上下文目录', () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const contextDir = Paths.agentContextDir(agentId);
      expect(contextDir).toBe(join(testBaseDir, 'agents', agentId, 'context'));
    });

    it('应该返回Agent工作空间路径', () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const workspacePath = Paths.agentWorkspace(agentId);
      expect(workspacePath).toBe(join(testBaseDir, 'agents', agentId, 'workspace'));
    });

    it('应该返回Agent目录', () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const agentDir = Paths.agentDir(agentId);
      expect(agentDir).toBe(join(testBaseDir, 'agents', agentId));
    });
  });

  describe('微信账号路径', () => {
    it('应该返回微信账号目录', () => {
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';
      const accountDir = Paths.wechatAccountDir(wechatId);
      expect(accountDir).toBe(join(testBaseDir, 'wechat-accounts', 'a1b2c3d4'));
    });

    it('应该返回微信凭证路径', () => {
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';
      const credentialsPath = Paths.wechatCredentials(wechatId);
      expect(credentialsPath).toBe(join(testBaseDir, 'wechat-accounts', 'a1b2c3d4', 'credentials.json'));
    });

    it('应该返回微信绑定配置路径', () => {
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';
      const bindingsPath = Paths.wechatBindings(wechatId);
      expect(bindingsPath).toBe(join(testBaseDir, 'wechat-accounts', 'a1b2c3d4', 'bindings.json'));
    });

    it('短微信ID应该正确处理', () => {
      const wechatId = 'wxid_abc';
      const accountDir = Paths.wechatAccountDir(wechatId);
      expect(accountDir).toBe(join(testBaseDir, 'wechat-accounts', 'abc'));
    });

    it('没有wxid前缀应该正确处理', () => {
      const wechatId = 'abcdefghij';
      const accountDir = Paths.wechatAccountDir(wechatId);
      expect(accountDir).toBe(join(testBaseDir, 'wechat-accounts', 'abcdefgh'));
    });
  });

  describe('系统文件路径', () => {
    it('应该返回主配置文件路径', () => {
      const masterConfigPath = Paths.masterConfig;
      expect(masterConfigPath).toBe(join(testBaseDir, 'master-config.json'));
    });

    it('应该返回创世Agent标识文件路径', () => {
      const founderPath = Paths.founderFile;
      expect(founderPath).toBe(join(testBaseDir, 'founder.json'));
    });
  });

  describe('备份路径', () => {
    it('应该返回备份目录', () => {
      const timestamp = '20260331_120000';
      const backupDir = Paths.backupDir(timestamp);
      expect(backupDir).toBe(join(testBaseDir, 'backups', timestamp));
    });

    it('应该返回GitHub同步配置路径', () => {
      const githubConfigPath = Paths.githubSyncConfig;
      expect(githubConfigPath).toBe(join(testBaseDir, 'github-sync.json'));
    });
  });

  describe('目录创建', () => {
    it('应该能创建Agent目录结构', async () => {
      const agentId = '小助手_a1b2c3d4_x7k9';
      const dir = Paths.agentDir(agentId);
      await mkdir(dir, { recursive: true });
      expect(existsSync(dir)).toBe(true);
    });

    it('应该能创建微信账号目录结构', async () => {
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';
      const dir = Paths.wechatAccountDir(wechatId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'test.txt'), 'test');
      expect(existsSync(dir)).toBe(true);
      expect(existsSync(join(dir, 'test.txt'))).toBe(true);
    });
  });

  describe('resetBaseDir', () => {
    it('应该能重置到默认目录', () => {
      // 先设置测试目录
      setBaseDir(testBaseDir);
      expect(Paths.baseDir).toBe(testBaseDir);
      
      // 重置
      resetBaseDir();
      
      // 应该回到默认目录（用户主目录下的 .weixin-kimi-bot）
      const { homedir } = require('os');
      expect(Paths.baseDir).toBe(join(homedir(), '.weixin-kimi-bot'));
    });
  });
});
