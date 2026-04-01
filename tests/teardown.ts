/**
 * Vitest Global Teardown
 * 
 * 在测试完成后自动清理测试创建的 Agent 目录
 * 保留白名单中的真实 Agent
 */

import { readdir, rm, stat } from 'fs/promises';
import { join } from 'path';

// 真实 Agent 白名单（保留这些目录）
const PROTECTED_AGENTS = [
  '创始者_6265403e_i5dq',
  '股神_358e9eb3_q7ro',
];

// 测试 Agent 的特征模式
const TEST_AGENT_PATTERNS = [
  /Test/i,
  /^Agent\d+_\d+_/i,
  /_test/i,
  /_spec_/i,
  /^AgentWithSubkeys_/i,
  /^Agent_issue\d+_/i,
  /^Agent_kimi_tes_/i,
  /^Agent_new_user_/i,
  /^DevAgent_dev_/i,
  /^FullAgent_creator_/i,
  /^InviteOnlyAgent_/i,
  /^MyAgent_creator_/i,
  /^OwnedAgent_creator_/i,
  /^PersistedAgent_persist_/i,
  /^PrivateAgent_/i,
  /^SharedAgent_/i,
  /^测试助手_/i,
  /^个人助手_/i,
  /^共享助手_/i,
  /^创世助手_/i,
  /^助手\d*_test_/i,
  /^助手_a1b2c3d4_/i,
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
      console.log('\n✨ 没有需要清理的测试 Agent 目录\n');
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
  console.log('\n[globalTeardown] 开始清理测试 Agent...');
  await cleanupTestAgents();
  console.log('[globalTeardown] 清理完成\n');
}

// 也可以直接运行（用于手动清理）
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupTestAgents().then(() => process.exit(0));
}
