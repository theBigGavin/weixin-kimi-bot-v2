/**
 * 技能执行器
 * 
 * 执行技能脚本并处理结果
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { Skill, AgentSkill, SkillExecutionResult } from './types.js';
import { Result, ok, err } from '../types/result.js';
import { SkillExecutionError } from './errors.js';

/**
 * 执行技能脚本
 */
export async function executeSkillScript(
  skill: Skill,
  agentSkill: AgentSkill,
  input: Record<string, unknown>,
  timeout?: number
): Promise<Result<SkillExecutionResult, SkillExecutionError>> {
  const execConfig = skill.execution;
  const effectiveTimeout = timeout ?? execConfig.timeout;

  // 构建命令
  const { command, args } = buildCommand(execConfig, input, agentSkill.config);

  // 确定工作目录
  const skillDir = resolve(process.env.HOME || '', '.weixin-kimi-bot', 'skills', skill.id);
  const workingDir = execConfig.workingDir
    ? resolve(skillDir, execConfig.workingDir)
    : skillDir;

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const child = spawn(command, args, {
      cwd: workingDir,
      env: { ...process.env, ...execConfig.env },
      timeout: effectiveTimeout,
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      resolve(err(new SkillExecutionError(skill.id, error.message)));
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve(ok({
          success: true,
          output: stdout.trim(),
          exitCode: code,
          duration,
        }));
      } else {
        resolve(ok({
          success: false,
          output: stdout.trim(),
          error: stderr.trim() || `Process exited with code ${code}`,
          exitCode: code ?? -1,
          duration,
        }));
      }
    });

    // 超时处理
    setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, effectiveTimeout);
  });
}

/**
 * 构建执行命令
 */
function buildCommand(
  execConfig: Skill['execution'],
  input: Record<string, unknown>,
  agentConfig: Record<string, unknown>
): { command: string; args: string[] } {
  const mergedConfig = { ...agentConfig, ...input };

  switch (execConfig.type) {
    case 'python':
      return {
        command: 'python3',
        args: [execConfig.entry, ...buildArgs(mergedConfig)],
      };

    case 'shell':
      return {
        command: 'sh',
        args: ['-c', `${execConfig.entry} ${buildArgs(mergedConfig).join(' ')}`],
      };

    case 'node':
      return {
        command: 'node',
        args: [execConfig.entry, ...buildArgs(mergedConfig)],
      };

    case 'http':
      // HTTP 类型的技能通过 HTTP 请求执行
      throw new Error('HTTP skill execution not yet implemented');

    default:
      throw new Error(`Unsupported execution type: ${execConfig.type}`);
  }
}

/**
 * 将配置转换为命令行参数
 */
function buildArgs(config: Record<string, unknown>): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === null) continue;

    const argName = `--${kebabCase(key)}`;

    if (typeof value === 'boolean') {
      if (value) {
        args.push(argName);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push(argName, String(item));
      }
    } else {
      args.push(argName, String(value));
    }
  }

  return args;
}

/**
 * 驼峰命名转 kebab-case
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
