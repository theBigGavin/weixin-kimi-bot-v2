/**
 * Command Handler
 * 
 * Thin adapter that delegates to the command framework.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { registry, CommandResult, CommandType, type CommandContext } from '../commands/index.js';
import { recordCommandExecuted } from '../init/state.js';
import { createAgentLogger } from '../logging/index.js';

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
    const logger = createAgentLogger(agent.id);
    const parsed = parseCommand(message);
    if (!parsed) {
      logger.warn(`无法解析命令: "${message}"`);
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '无法解析命令',
        error: 'Parse error',
      };
    }

    const { command, args } = parsed;
    const startTime = Date.now();
    
    logger.info(`┌─ 执行命令: /${command}${args.length > 0 ? ' ' + args.join(' ') : ''}`);
    logger.info(`│  Agent: ${agent.name} (${agent.id})`);

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
        logger.info(`└─ ✅ 成功 (${duration}ms)`);
        recordCommandExecuted();
      } else {
        logger.warn(`└─ ❌ 失败 (${duration}ms): ${result.error || '未知错误'}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`└─ 💥 异常 (${duration}ms):`, error);
      
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
