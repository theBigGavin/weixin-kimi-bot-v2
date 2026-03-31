/**
 * Command Handler
 * 
 * Thin adapter that delegates to the command framework.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { registry, CommandResult, CommandType, type CommandContext } from '../commands/index.js';

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
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '无法解析命令',
        error: 'Parse error',
      };
    }

    const context: CommandContext = {
      agent,
      args: parsed.args,
      rawMessage: message,
      onProgress,
    };

    return registry.execute(parsed.command, context);
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
