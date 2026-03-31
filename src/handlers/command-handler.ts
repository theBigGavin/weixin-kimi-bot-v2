/**
 * Command Handler
 * 
 * Processes command messages and returns appropriate responses.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { handleMemory } from './commands/memory.js';
import { handleOnboard } from './commands/onboard.js';
import { handleSchedule } from './commands/schedule.js';

export enum CommandType {
  HELP = 'help',
  START = 'start',
  TEMPLATE = 'template',
  STATUS = 'status',
  RESET = 'reset',
  MEMORY = 'memory',
  TASK = 'task',
  TEST = 'test',
  ONBOARD = 'onboard',
  SCHEDULE = 'schedule',
  UNKNOWN = 'unknown',
}

export interface CommandResult {
  type: CommandType;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  error?: string;
}

export type ProgressCallback = (message: string) => Promise<void>;

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  adminOnly?: boolean;
}

const AVAILABLE_COMMANDS: CommandInfo[] = [
  { name: 'help', description: '显示可用命令列表', usage: '/help' },
  { name: 'start', description: '开始新会话', usage: '/start' },
  { name: 'template', description: '切换能力模板', usage: '/template <template-id>' },
  { name: 'status', description: '查看当前Agent状态', usage: '/status' },
  { name: 'reset', description: '重置当前会话', usage: '/reset' },
  { name: 'memory', description: '查看或编辑Agent记忆（支持自动提取）', usage: '/memory [update <内容> | search <关键词> | stats | toggle | clear]' },
  { name: 'task', description: '管理长任务和流程任务', usage: '/task <list|status <id>|cancel <id>>' },
  { name: 'test', description: '测试Bot连接', usage: '/test' },
  { name: 'onboard', description: '创始者Agent初始化：读取项目文档了解代码库', usage: '/onboard' },
  { name: 'schedule', description: '管理定时任务（创建、查看、取消）', usage: '/schedule <list|create|cancel|help>' },
];

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
        return await handleMemory(args, agent);
      case 'task':
        return this.handleTask(args, agent);
      case 'test':
        return this.handleTest(agent);
      case 'onboard':
        return await handleOnboard(agent, onProgress);
      case 'schedule':
        return await handleSchedule(args, agent);
      default:
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: `未知命令: ${command}。输入 /help 查看可用命令。`,
          error: `Unknown command: ${command}`,
        };
    }
  }

  isCommand(message: string): boolean {
    const parsed = parseCommand(message);
    if (!parsed) return false;
    return AVAILABLE_COMMANDS.some(cmd => cmd.name === parsed.command);
  }

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

  private handleTemplate(args: string[], _agent: Agent): CommandResult {
    if (args.length === 0) {
      return {
        type: CommandType.TEMPLATE,
        success: false,
        response: '❌ 请指定模板ID。用法: /template <template-id>',
        error: 'Missing template ID',
      };
    }

    return {
      type: CommandType.TEMPLATE,
      success: true,
      response: `✅ 已切换到模板: ${args[0]}`,
      data: { templateId: args[0] },
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
      },
    };
  }

  private handleReset(agent: Agent): CommandResult {
    return {
      type: CommandType.RESET,
      success: true,
      response: `🔄 会话已重置。Agent "${agent.name}" 准备就绪。`,
    };
  }

  private handleTask(args: string[], _agent: Agent): CommandResult {
    return {
      type: CommandType.TASK,
      success: true,
      response: `📋 任务管理 - 操作: ${args[0] || 'list'}`,
      data: { action: args[0] || 'list' },
    };
  }

  private handleTest(agent: Agent): CommandResult {
    return {
      type: CommandType.TEST,
      success: true,
      response: `🤖 Agent "${agent.name}" 连接正常！\n模板: ${agent.ai.templateId}\n记忆: ${agent.memory.enabledL ? '开启' : '关闭'}`,
    };
  }
}
