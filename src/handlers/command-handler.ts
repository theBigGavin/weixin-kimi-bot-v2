/**
 * Command Handler
 * 
 * Processes command messages and returns appropriate responses.
 */

import { Agent } from '../agent/types';
import { parseCommand } from './message-utils';

export enum CommandType {
  HELP = 'help',
  START = 'start',
  TEMPLATE = 'template',
  STATUS = 'status',
  RESET = 'reset',
  MEMORY = 'memory',
  TASK = 'task',
  TEST = 'test',
  UNKNOWN = 'unknown',
}

export interface CommandResult {
  type: CommandType;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  adminOnly?: boolean;
}

const AVAILABLE_COMMANDS: CommandInfo[] = [
  {
    name: 'help',
    description: '显示可用命令列表',
    usage: '/help',
  },
  {
    name: 'start',
    description: '开始新会话',
    usage: '/start',
  },
  {
    name: 'template',
    description: '切换能力模板',
    usage: '/template <template-id>',
  },
  {
    name: 'status',
    description: '查看当前Agent状态',
    usage: '/status',
  },
  {
    name: 'reset',
    description: '重置当前会话',
    usage: '/reset',
  },
  {
    name: 'memory',
    description: '开关长期记忆',
    usage: '/memory <on|off>',
  },
  {
    name: 'task',
    description: '管理任务',
    usage: '/task <list|status>',
  },
  {
    name: 'test',
    description: '测试Bot连接',
    usage: '/test',
  },
];

export class CommandHandler {
  /**
   * Execute a command
   */
  async execute(message: string, agent: Agent): Promise<CommandResult> {
    const parsed = parseCommand(message);
    
    if (!parsed) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '无法解析命令',
        error: 'Invalid command format',
      };
    }

    const { command, args } = parsed;

    switch (command) {
      case 'help':
        return this.handleHelp();
      case 'start':
        return this.handleStart(agent);
      case 'template':
        return this.handleTemplate(args, agent);
      case 'status':
        return this.handleStatus(agent);
      case 'reset':
        return this.handleReset(agent);
      case 'memory':
        return this.handleMemory(args, agent);
      case 'task':
        return this.handleTask(args, agent);
      case 'test':
        return this.handleTest(agent);
      default:
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: `未知命令: ${command}。输入 /help 查看可用命令。`,
          error: `Unknown command: ${command}`,
        };
    }
  }

  /**
   * Check if message is a command
   */
  isCommand(message: string): boolean {
    const parsed = parseCommand(message);
    if (!parsed) return false;
    
    return AVAILABLE_COMMANDS.some(cmd => cmd.name === parsed.command);
  }

  /**
   * Get available commands list
   */
  getAvailableCommands(): CommandInfo[] {
    return [...AVAILABLE_COMMANDS];
  }

  private handleHelp(): CommandResult {
    const commandList = AVAILABLE_COMMANDS
      .map(cmd => `/${cmd.name} - ${cmd.description}\n  用法: ${cmd.usage}`)
      .join('\n\n');

    return {
      type: CommandType.HELP,
      success: true,
      response: `📋 可用命令列表:\n\n${commandList}`,
    };
  }

  private handleStart(agent: Agent): CommandResult {
    return {
      type: CommandType.START,
      success: true,
      response: `🚀 开始新会话！Agent "${agent.name}" 已准备就绪。`,
    };
  }

  private handleTemplate(args: string[], agent: Agent): CommandResult {
    if (args.length === 0) {
      return {
        type: CommandType.TEMPLATE,
        success: false,
        response: '❌ 请指定模板ID。用法: /template <template-id>',
        error: 'Missing template ID',
      };
    }

    const templateId = args[0];
    
    return {
      type: CommandType.TEMPLATE,
      success: true,
      response: `✅ 已切换到模板: ${templateId}`,
      data: { templateId },
    };
  }

  private handleStatus(agent: Agent): CommandResult {
    return {
      type: CommandType.STATUS,
      success: true,
      response: `📊 Agent 状态:\n名称: ${agent.name}\n模板: ${agent.ai.templateId}\n记忆: ${agent.memory.enabledL ? '开启' : '关闭'}`,
      data: {
        agentId: agent.id,
        name: agent.name,
        templateId: agent.ai.templateId,
        memoryEnabled: agent.memory.enabledL,
      },
    };
  }

  private handleReset(agent: Agent): CommandResult {
    return {
      type: CommandType.RESET,
      success: true,
      response: `🔄 会话已重置。Agent "${agent.name}" 的记忆已清除。`,
    };
  }

  private handleMemory(args: string[], agent: Agent): CommandResult {
    const action = args[0]?.toLowerCase();
    
    if (action !== 'on' && action !== 'off') {
      return {
        type: CommandType.MEMORY,
        success: false,
        response: '❌ 请指定 on 或 off。用法: /memory <on|off>',
        error: 'Invalid memory action',
      };
    }

    const enabled = action === 'on';
    
    return {
      type: CommandType.MEMORY,
      success: true,
      response: `💾 长期记忆已${enabled ? '开启' : '关闭'}`,
      data: { enabled },
    };
  }

  private handleTask(args: string[], agent: Agent): CommandResult {
    const action = args[0] || 'list';

    return {
      type: CommandType.TASK,
      success: true,
      response: `📋 任务管理 - 操作: ${action}`,
      data: { action },
    };
  }

  private handleTest(agent: Agent): CommandResult {
    return {
      type: CommandType.TEST,
      success: true,
      response: `✅ Bot 连接正常！\nAgent: ${agent.name}\n时间: ${new Date().toLocaleString()}`,
    };
  }
}
