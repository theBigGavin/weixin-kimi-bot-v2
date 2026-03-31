/**
 * Command Handler
 * 
 * Processes command messages and returns appropriate responses.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

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
  UNKNOWN = 'unknown',
}

export interface CommandResult {
  type: CommandType;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * 进度回调函数类型
 * 用于长耗时命令的进度通知
 */
export type ProgressCallback = (message: string) => Promise<void>;

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
  {
    name: 'onboard',
    description: '创始者Agent初始化：读取项目文档了解代码库',
    usage: '/onboard',
  },
];

export class CommandHandler {
  /**
   * Execute a command
   */
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
      case 'onboard':
        return await this.handleOnboard(agent, onProgress);
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

  private handleTemplate(args: string[], _agent: Agent): CommandResult {
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

  private handleMemory(args: string[], _agent: Agent): CommandResult {
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

  private handleTask(args: string[], _agent: Agent): CommandResult {
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

  /**
   * 创始者Agent项目初始化：读取项目关键文件
   * 让Agent了解项目结构、架构和业务逻辑
   * 支持进度回调，实时反馈加载进度
   */
  private async handleOnboard(
    agent: Agent, 
    onProgress?: ProgressCallback
  ): Promise<CommandResult> {
    // 只建议创始者模板使用
    if (agent.ai.templateId !== 'founder') {
      return {
        type: CommandType.ONBOARD,
        success: false,
        response: '⚠️ /onboard 命令专为创始者Agent设计，用于初始化项目交接。当前Agent模板: ' + agent.ai.templateId,
      };
    }

    try {
      const cwd = process.cwd();
      
      // 定义要读取的关键文件
      const filesToRead = [
        { path: 'README.md', desc: '项目概览', priority: 'high' },
        { path: 'AGENTS.md', desc: '项目指南', priority: 'high' },
        { path: 'package.json', desc: '依赖配置', priority: 'medium' },
        { path: 'tsconfig.json', desc: 'TypeScript配置', priority: 'medium' },
        { path: 'docs/architecture/architecture-overview.md', desc: '架构文档', priority: 'high' },
        { path: 'docs/architecture/TDD_REDVELOPMENT_GUIDE.md', desc: '开发指南', priority: 'high' },
      ];

      // 发送初始进度通知
      if (onProgress) {
        await onProgress(
          `🚀 开始项目初始化\n` +
          `Agent: ${agent.name}\n` +
          `共需学习 ${filesToRead.length} 个文件...\n\n` +
          `开始学习：`
        );
      }

      let projectContext = `📋 项目交接文档\n================\n\n`;
      projectContext += `Agent: ${agent.name}\n`;
      projectContext += `工作目录: ${cwd}\n`;
      projectContext += `初始化时间: ${new Date().toLocaleString()}\n\n`;

      let loadedCount = 0;
      let failedCount = 0;

      // 读取每个文件
      for (let i = 0; i < filesToRead.length; i++) {
        const file = filesToRead[i];
        const progress = `[${i + 1}/${filesToRead.length}]`;
        
        try {
          // 发送开始读取的进度
          if (onProgress) {
            await onProgress(`${progress} 📖 正在学习: ${file.desc} (${file.path})...`);
          }

          const content = await readFile(join(cwd, file.path), 'utf-8');
          loadedCount++;
          
          // 截断过长内容，保留关键部分
          const truncated = content.length > 3000 
            ? content.substring(0, 3000) + '\n\n...[内容已截断，完整内容请查看文件]' 
            : content;
          
          projectContext += `\n---\n## ${file.desc} (${file.path})\n\n${truncated}\n`;

          // 发送完成进度
          const remaining = filesToRead.length - i - 1;
          if (onProgress) {
            const statusMsg = remaining > 0 
              ? `${progress} ✅ 已完成: ${file.desc}（还剩 ${remaining} 个文件）`
              : `${progress} ✅ 已完成: ${file.desc}`;
            await onProgress(statusMsg);
          }
        } catch (err) {
          failedCount++;
          projectContext += `\n---\n## ${file.desc} (${file.path})\n\n⚠️ 无法读取: ${(err as Error).message}\n`;
          
          if (onProgress) {
            await onProgress(`${progress} ⚠️ 跳过: ${file.desc}（读取失败）`);
          }
        }

        // 小延迟，让用户有时间阅读进度
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      projectContext += `\n---\n\n✅ 项目交接完成！\n\n作为创始者Agent，你的职责：\n`;
      projectContext += `1. 熟悉项目架构和技术栈\n`;
      projectContext += `2. 理解TDD开发流程\n`;
      projectContext += `3. 维护代码质量和文档\n`;
      projectContext += `4. 协助项目演进和重构\n\n`;
      projectContext += `可以使用 /status 查看状态，开始维护项目吧！`;

      // 发送完成通知
      if (onProgress) {
        await onProgress(
          `\n🎉 初始化完成！\n` +
          `成功加载: ${loadedCount} 个文件\n` +
          `${failedCount > 0 ? `加载失败: ${failedCount} 个文件\n` : ''}` +
          `正在生成完整交接文档...`
        );
      }

      return {
        type: CommandType.ONBOARD,
        success: true,
        response: projectContext,
        data: { 
          agentId: agent.id,
          workspace: cwd,
          filesLoaded: loadedCount,
          filesFailed: failedCount,
          totalFiles: filesToRead.length,
        },
      };
    } catch (error) {
      return {
        type: CommandType.ONBOARD,
        success: false,
        response: '❌ 项目初始化失败: ' + (error as Error).message,
        error: (error as Error).message,
      };
    }
  }
}
