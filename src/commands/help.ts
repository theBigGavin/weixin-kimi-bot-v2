/**
 * Help Command
 */

import { Command, CommandContext, CommandResult, CommandType, registry, ResponseBuilder } from './framework.js';

export class HelpCommand extends Command {
  constructor() {
    super({
      name: 'help',
      description: '显示可用命令列表',
      usage: '/help [命令名]',
      examples: ['/help', '/help memory'],
    });
  }

  execute(context: CommandContext): CommandResult {
    const { args } = context;
    
    // If specific command requested, show its help
    if (args.length > 0) {
      const commandName = args[0];
      const command = registry.get(commandName);
      
      if (command) {
        return {
          type: CommandType.HELP,
          success: true,
          response: command.generateHelp(),
        };
      }
      
      return ResponseBuilder.error(`未知命令: ${commandName}`, 'UnknownCommand', CommandType.HELP);
    }

    // Show global help
    return {
      type: CommandType.HELP,
      success: true,
      response: registry.generateHelp(),
    };
  }
}
