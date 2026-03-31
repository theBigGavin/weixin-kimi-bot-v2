/**
 * Command Handler
 * 
 * Thin adapter that delegates to the command framework.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { registry, CommandResult, CommandType, type CommandContext } from '../commands/index.js';
import { recordCommandExecuted } from '../init/state.js';

export { type CommandResult, type CommandContext, CommandType };

export type ProgressCallback = (message: string) => Promise<void>;

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  adminOnly?: boolean;
}

export class CommandHandler {
  async execute(
    message: string,
    agent: Agent,
    onProgress?: ProgressCallback
  ): Promise<CommandResult> {
    const parsed = parseCommand(message);
    if (!parsed) {
      console.log(`[Command] 无法解析命令: "${message}"`);
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '无法解析命令',
        error: 'Parse error',
      };
    }

    const { command, args } = parsed;
    const startTime = Date.now();
    
    console.log(`[Command] ┌─ 执行命令: /${command}${args.length > 0 ? ' ' + args.join(' ') : ''}`);
    console.log(`[Command] │  Agent: ${agent.name} (${agent.id})`);

    const context: CommandContext = {
      agent,
      args,
      rawMessage: message,
      onProgress,
    };

    try {
      const result = await registry.execute(command, context);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`[Command] └─ ✅ 成功 (${duration}ms)`);
        recordCommandExecuted();
      } else {
        console.log(`[Command] └─ ❌ 失败 (${duration}ms): ${result.error || '未知错误'}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Command] └─ 💥 异常 (${duration}ms):`, error);
      
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '命令执行出错: ' + (error instanceof Error ? error.message : String(error)),
        error: 'ExecutionError',
      };
    }
  }

  isCommand(message: string): boolean {
    const parsed = parseCommand(message);
    if (!parsed) return false;
    return registry.has(parsed.command);
  }

  getAvailableCommands(): CommandInfo[] {
    return registry.getAllMetadata().map(meta => ({
      name: meta.name,
      description: meta.description,
      usage: meta.usage,
      adminOnly: meta.adminOnly,
    }));
  }
}
