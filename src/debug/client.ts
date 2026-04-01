#!/usr/bin/env tsx
/**
 * Debug Client - 调试客户端
 * 
 * Kimi Code 使用这个脚本与运行中的系统交互。
 * 
 * 使用方式：
 *   npx tsx src/debug/client.ts "你的消息"
 * 
 * 示例：
 *   npx tsx src/debug/client.ts "Hello"
 *   npx tsx src/debug/client.ts "/help"
 *   npx tsx src/debug/client.ts "你能做什么？"
 */

const DEBUG_URL = process.env.DEBUG_URL || 'http://localhost:3456';
const USER_ID = process.env.DEBUG_USER || 'kimi_test_user';

interface DebugResponse {
  success: boolean;
  response?: string;
  type?: string;
  agentId?: string;
  agentName?: string;
  duration?: number;
  error?: string;
}

/**
 * 发送消息到运行中的系统
 */
export async function sendMessage(content: string): Promise<DebugResponse> {
  const response = await fetch(`${DEBUG_URL}/debug/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      content,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json() as Promise<DebugResponse>;
}

/**
 * 检查系统是否在线
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${DEBUG_URL}/debug/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取 Agent 列表
 */
export async function listAgents(): Promise<Array<{ id: string; name: string; userId: string }>> {
  const response = await fetch(`${DEBUG_URL}/debug/agents`);
  if (!response.ok) {
    throw new Error('Failed to list agents');
  }
  const data = await response.json() as { agents: Array<{ id: string; name: string; userId: string }> };
  return data.agents;
}

// CLI 模式
async function main() {
  const message = process.argv.slice(2).join(' ');
  
  if (!message) {
    console.log('用法: npx tsx src/debug/client.ts "你的消息"');
    console.log('');
    console.log('示例:');
    console.log('  npx tsx src/debug/client.ts "Hello"');
    console.log('  npx tsx src/debug/client.ts "/help"');
    console.log('');
    console.log('环境变量:');
    console.log('  DEBUG_URL=http://localhost:3456  # 调试接口地址');
    console.log('  DEBUG_USER=kimi_test_user        # 用户ID');
    process.exit(1);
  }

  // 检查系统是否在线
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.error('❌ 无法连接到调试接口');
    console.error('请确保系统已启动: DEBUG_ENABLED=true npm run dev');
    process.exit(1);
  }

  // 发送消息
  try {
    const result = await sendMessage(message);
    
    if (result.success && result.response) {
      console.log(result.response);
    } else {
      console.error('❌ 错误:', result.error || '无响应');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
