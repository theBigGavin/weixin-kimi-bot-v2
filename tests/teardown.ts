/**
 * Vitest Global Teardown
 * 
 * 在测试完成后自动清理测试创建的 Agent 目录
 * 保留白名单中的真实 Agent
 */

import { readdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { getDefaultLogger } from '../src/logging/index.js';

// 真实 Agent 白名单（保留这些目录）
const PROTECTED_AGENTS = [
  '创始者_6265403e_i5dq',
  '股神_358e9eb3_q7ro',
];

// 测试 Agent 的特征模式
const TEST_AGENT_PATTERNS = [
  /Test/i,                     // 包含 Test 的目录 (TestAgent_, WorkspaceTest_等)
  /^Agent\d+_\d+_/i,           // Agent1_1_, Agent2_2_ 等
  /_test_/i,                   // 包含 _test_ 的目录
  /_spec_/i,                   // 包含 _spec_ 的目录
  /^AgentWithSubkeys_/i,       // AgentWithSubkeys_sub_* (子键测试)
  /^Agent_issue\d+_/i,         // Agent_issue3_t_*, Agent_issue6_n_* (issue测试)
  /^Agent_kimi_tes_/i,         // Agent_kimi_tes_* (kimi测试)
  /^Agent_new_user_/i,         // Agent_new_user_* (新用户测试)
  /^DevAgent_dev_/i,           // DevAgent_dev_* (开发测试)
  /^FullAgent_creator_/i,      // FullAgent_creator_* (完整测试)
  /^InviteOnlyAgent_/i,        // InviteOnlyAgent_* (邀请制测试)
  /^MyAgent_creator_/i,        // MyAgent_creator_* (我的Agent测试)
  /^OwnedAgent_creator_/i,     // OwnedAgent_creator_* (所有权测试)
  /^PersistedAgent_persist_/i, // PersistedAgent_persist_* (持久化测试)
  /^PrivateAgent_/i,           // PrivateAgent_* (私有测试)
  /^SharedAgent_/i,            // SharedAgent_* (共享测试)
  /^测试助手_/i,                // 测试助手_* (中文测试名)
  /^个人助手_owner_/i,          // 个人助手_owner_* (个人助手测试)
  /^共享助手_creator_/i,        // 共享助手_creator_* (共享助手测试)
  /^创世助手_founder_/i,        // 创世助手_founder_* (创始助手测试)
  /^助手_a1b2c3d4_/i,           // 助手_a1b2c3d4_* (助手测试)
];

/**
 * 检查是否为测试创建的 Agent 目录
 */
function isTestAgent(name: string): boolean {
  // 跳过白名单
  if (PROTECTED_AGENTS.includes(name)) {
    return false;
  }

  // 检查是否匹配测试模式
  return TEST_AGENT_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * 清理测试 Agent 目录
 */
async function cleanupTestAgents(): Promise<void> {
  const baseDir = join(process.env.HOME || '/tmp', '.weixin-kimi-bot');
  const agentsDir = join(baseDir, 'agents');

  try {
    // 检查目录是否存在
    await stat(agentsDir);
  } catch {
    // 目录不存在，无需清理
    return;
  }

  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const testAgents: string[] = [];

    for (const entry of entries) {
      const name = entry.name;
      
      // 处理 .json 文件（检查对应的目录是否也是测试 Agent）
      if (name.endsWith('.json')) {
        const agentName = name.slice(0, -5); // 去掉 .json
        if (isTestAgent(agentName)) {
          testAgents.push(name);
        }
        continue;
      }
      
      // 只处理目录
      if (!entry.isDirectory()) {
        continue;
      }

      if (isTestAgent(name)) {
        testAgents.push(name);
      }
    }

    if (testAgents.length === 0) {
      return;
    }

    console.log(`\n🧹 清理测试 Agent 目录 (${testAgents.length} 个)...`);

    for (const name of testAgents) {
      const fullPath = join(agentsDir, name);
      try {
        await rm(fullPath, { recursive: true, force: true });
        console.log(`   ✅ 已删除: ${name}`);
      } catch (error) {
        console.error(`   ❌ 删除失败: ${name}`, error);
      }
    }

    console.log('✨ 清理完成\n');
  } catch (error) {
    console.error('清理测试 Agent 目录时出错:', error);
  }
}

// Vitest globalTeardown 导出
export default async function teardown(): Promise<void> {
  await cleanupTestAgents();
}

// 也可以直接运行（用于手动清理）
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupTestAgents().then(() => process.exit(0));
}
