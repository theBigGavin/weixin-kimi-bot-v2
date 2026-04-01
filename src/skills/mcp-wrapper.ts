/**
 * Skill MCP Wrapper
 * 
 * 将本地技能包装为 MCP Server，供 Kimi 通过 ACP 调用
 */

import { spawn, type ChildProcess } from 'child_process';
import { resolve as resolvePath } from 'path';
import type { Skill } from './types.js';

/**
 * 为技能创建 MCP Server 配置
 */
export function createSkillMCPServer(skill: Skill): {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
} {
  const skillsDir = resolvePath(process.env.HOME || '', '.weixin-kimi-bot', 'skills');
  const skillDir = resolvePath(skillsDir, skill.id);

  switch (skill.execution.type) {
    case 'python':
      return {
        name: skill.id,
        command: 'python3',
        args: [resolvePath(skillDir, skill.execution.entry)],
        env: skill.execution.env,
      };

    case 'node':
      return {
        name: skill.id,
        command: 'node',
        args: [resolvePath(skillDir, skill.execution.entry)],
        env: skill.execution.env,
      };

    case 'shell':
      return {
        name: skill.id,
        command: 'sh',
        args: ['-c', resolvePath(skillDir, skill.execution.entry)],
        env: skill.execution.env,
      };

    default:
      throw new Error(`Unsupported execution type: ${skill.execution.type}`);
  }
}

/**
 * 执行技能并返回 MCP 格式结果
 * 
 * 注意：这是一个简化的 MCP 实现。
 * 完整的 MCP 需要实现 JSON-RPC 协议，包括：
 * - initialize
 * - tools/list
 * - tools/call
 * 
 * 这里我们提供一个简单的命令包装，Kimi 可以通过 shell 调用
 */
export async function executeSkillAsMCP(
  skill: Skill,
  input: Record<string, unknown>
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  return new Promise((resolve) => {
    const skillsDir = resolvePath(process.env.HOME || '', '.weixin-kimi-bot', 'skills');
    const skillDir = resolvePath(skillsDir, skill.id);

    // 构建命令
    const { command, args } = buildCommand(skill, input);

    const child: ChildProcess = spawn(command, args, {
      cwd: skill.execution.workingDir 
        ? resolvePath(skillDir, skill.execution.workingDir)
        : skillDir,
      env: { ...process.env, ...skill.execution.env },
      timeout: skill.execution.timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          content: [{ type: 'text', text: stdout.trim() }],
        });
      } else {
        resolve({
          content: [{ type: 'text', text: stderr.trim() || 'Execution failed' }],
          isError: true,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      });
    });
  });
}

/**
 * 构建命令行参数
 */
function buildCommand(
  skill: Skill,
  input: Record<string, unknown>
): { command: string; args: string[] } {
  const args: string[] = [];

  // 将输入转换为命令行参数
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;

    const argName = `--${kebabCase(key)}`;

    if (typeof value === 'boolean') {
      if (value) args.push(argName);
    } else {
      args.push(argName, String(value));
    }
  }

  switch (skill.execution.type) {
    case 'python':
      return {
        command: 'python3',
        args: [skill.execution.entry, ...args],
      };
    case 'node':
      return {
        command: 'node',
        args: [skill.execution.entry, ...args],
      };
    case 'shell':
      return {
        command: 'sh',
        args: ['-c', `${skill.execution.entry} ${args.join(' ')}`],
      };
    default:
      throw new Error(`Unsupported type: ${skill.execution.type}`);
  }
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
