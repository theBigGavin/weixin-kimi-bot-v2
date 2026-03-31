/**
 * 创世 Agent 管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FounderManager } from '../../../src/founder/manager.js';
import { setBaseDir, resetBaseDir } from '../../../src/paths.js';
import { SYSTEM_VERSION } from '../../../src/founder/types.js';

describe('founder/manager', () => {
  let testDir: string;
  let manager: FounderManager;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'founder-test-'));
    setBaseDir(testDir);
    manager = new FounderManager();
  });

  afterEach(() => {
    resetBaseDir();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('hasFounder', () => {
    it('初始状态应该返回 false', async () => {
      expect(await manager.hasFounder()).toBe(false);
    });

    it('设置后应该返回 true', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');
      expect(await manager.hasFounder()).toBe(true);
    });
  });

  describe('setFounder', () => {
    it('应该设置创世 Agent', async () => {
      await manager.setFounder('创世助手_a1b2c3d4_x7k9', 'wxid_a1b2c3d4');

      const founderId = await manager.getFounderAgentId();
      expect(founderId).toBe('创世助手_a1b2c3d4_x7k9');
    });

    it('应该保存创建者微信ID', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');

      const creatorId = await manager.getFounderWechatId();
      expect(creatorId).toBe('wxid_creator');
    });

    it('应该保存系统版本', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');

      const info = await manager.getFounderInfo();
      expect(info?.systemVersion).toBe(SYSTEM_VERSION);
    });

    it('应该保存创建时间', async () => {
      const before = Date.now();
      await manager.setFounder('agent_123', 'wxid_creator');
      const after = Date.now();

      const info = await manager.getFounderInfo();
      expect(info?.createdAt).toBeGreaterThanOrEqual(before);
      expect(info?.createdAt).toBeLessThanOrEqual(after);
    });

    it('不应该允许重复设置', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');

      await expect(
        manager.setFounder('agent_456', 'wxid_other')
      ).rejects.toThrow('创世 Agent 已存在');
    });
  });

  describe('isFounderAgent', () => {
    it('应该正确识别创世 Agent', async () => {
      await manager.setFounder('创世助手_a1b2c3d4_x7k9', 'wxid_creator');

      expect(await manager.isFounderAgent('创世助手_a1b2c3d4_x7k9')).toBe(true);
      expect(await manager.isFounderAgent('其他助手_x1y2z3w4_a1b2')).toBe(false);
    });

    it('未设置时应该返回 false', async () => {
      expect(await manager.isFounderAgent('any_agent')).toBe(false);
    });
  });

  describe('isFounderCreator', () => {
    it('应该正确识别创世者', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');

      expect(await manager.isFounderCreator('wxid_creator')).toBe(true);
      expect(await manager.isFounderCreator('wxid_other')).toBe(false);
    });
  });

  describe('getFounderInfo', () => {
    it('应该返回完整的创世信息', async () => {
      await manager.setFounder('创世助手_a1b2c3d4_x7k9', 'wxid_creator');

      const info = await manager.getFounderInfo();
      expect(info).not.toBeNull();
      expect(info?.agentId).toBe('创世助手_a1b2c3d4_x7k9');
      expect(info?.creatorWechatId).toBe('wxid_creator');
    });

    it('未设置时应该返回 null', async () => {
      const info = await manager.getFounderInfo();
      expect(info).toBeNull();
    });
  });

  describe('forceUpdateFounder', () => {
    it('应该强制更新创世 Agent', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');
      await manager.forceUpdateFounder('agent_456', 'wxid_new_creator');

      const agentId = await manager.getFounderAgentId();
      const creatorId = await manager.getFounderWechatId();

      expect(agentId).toBe('agent_456');
      expect(creatorId).toBe('wxid_new_creator');
    });

    it('应该更新创建时间', async () => {
      await manager.setFounder('agent_123', 'wxid_creator');
      
      const before = Date.now();
      await manager.forceUpdateFounder('agent_456', 'wxid_new_creator');
      
      const info = await manager.getFounderInfo();
      expect(info?.createdAt).toBeGreaterThanOrEqual(before);
    });
  });
});
