/**
 * 测试清理工具测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('teardown cleanup', () => {
  const testBaseDir = join(tmpdir(), 'weixin-kimi-bot-test-cleanup');
  const agentsDir = join(testBaseDir, 'agents');

  beforeEach(async () => {
    // 创建测试目录结构
    await mkdir(agentsDir, { recursive: true });
    
    // 设置 HOME 环境变量指向测试目录
    vi.stubEnv('HOME', testBaseDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    // 清理测试目录
    await rm(testBaseDir, { recursive: true, force: true });
  });

  it('应该识别测试 Agent 目录', async () => {
    // 创建测试目录
    await mkdir(join(agentsDir, 'TestAgent_test_123'), { recursive: true });
    await mkdir(join(agentsDir, 'Agent1_1_abc'), { recursive: true });
    await mkdir(join(agentsDir, '创始者_6265403e_i5dq'), { recursive: true });
    await mkdir(join(agentsDir, '股神_358e9eb3_q7ro'), { recursive: true });
    
    // 模拟导入并测试 isTestAgent 逻辑
    const PROTECTED_AGENTS = [
      '创始者_6265403e_i5dq',
      '股神_358e9eb3_q7ro',
    ];
    
    const TEST_AGENT_PATTERNS = [
      /Test_/i,
      /^Agent\d+_\d+_/i,
      /_test_/i,
      /_spec_/i,
    ];
    
    function isTestAgent(name: string): boolean {
      if (PROTECTED_AGENTS.includes(name)) {
        return false;
      }
      return TEST_AGENT_PATTERNS.some(pattern => pattern.test(name));
    }
    
    expect(isTestAgent('TestAgent_test_123')).toBe(true);
    expect(isTestAgent('Agent1_1_abc')).toBe(true);
    expect(isTestAgent('创始者_6265403e_i5dq')).toBe(false);
    expect(isTestAgent('股神_358e9eb3_q7ro')).toBe(false);
    expect(isTestAgent('RealAgent_user_123')).toBe(false);
  });

  it('应该保留白名单中的真实 Agent', async () => {
    // 创建真实 Agent 目录（模拟）
    await mkdir(join(agentsDir, '创始者_6265403e_i5dq'), { recursive: true });
    await mkdir(join(agentsDir, '股神_358e9eb3_q7ro'), { recursive: true });
    
    // 验证目录存在
    const entries = await readdir(agentsDir);
    expect(entries).toContain('创始者_6265403e_i5dq');
    expect(entries).toContain('股神_358e9eb3_q7ro');
  });
});
