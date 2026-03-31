/**
 * Command Handler
 * 
 * Processes command messages and returns appropriate responses.
 */

import { Agent } from '../agent/types.js';
import { parseCommand } from './message-utils.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { MemoryManager, createFactId } from '../memory/index.js';
import type { MemoryFact } from '../memory/index.js';

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
    description: '查看或编辑Agent记忆（支持自动提取）',
    usage: '/memory [update <内容> | search <关键词> | stats | toggle | clear]',
  },
  {
    name: 'task',
    description: '管理长任务和流程任务',
    usage: '/task <list|status <id>|cancel <id>>',
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
        return await this.handleMemory(args, agent);
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

  private async handleMemory(args: string[], agent: Agent): Promise<CommandResult> {
    const action = args[0]?.toLowerCase();
    
    // 初始化记忆管理器
    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    try {
      // 加载当前记忆
      let memory = await memManager.loadMemory(agent.id, agent.name);
      
      // 不带参数：显示当前记忆
      if (!action) {
        const display = memManager.formatMemoryForDisplay(memory);
        return {
          type: CommandType.MEMORY,
          success: true,
          response: display,
        };
      }
      
      // update 操作：添加事实记忆
      if (action === 'update' || action === 'add') {
        const content = args.slice(1).join(' ').trim();
        
        if (!content) {
          return {
            type: CommandType.MEMORY,
            success: false,
            response: '❌ 请提供记忆内容。用法: /memory update <内容>',
            error: 'Missing memory content',
          };
        }
        
        // 创建新事实
        const now = Date.now();
        const newFact: MemoryFact = {
          id: createFactId(),
          content,
          category: 'personal',
          importance: 3,
          createdAt: now,
          updatedAt: now,
        };
        
        // 添加到记忆
        memory.facts.push(newFact);
        
        // 保存
        await memManager.saveMemory(memory);
        
        return {
          type: CommandType.MEMORY,
          success: true,
          response: `✅ 记忆已添加\n\n📝 ${content}\n\n当前共有 ${memory.facts.length} 条重要事实`,
          data: { 
            fact: newFact,
            total: memory.facts.length 
          },
        };
      }
      
      // clear 操作：清空记忆
      if (action === 'clear') {
        memory.facts = [];
        memory.projects = [];
        memory.learning = [];
        memory.userProfile = { preferences: [], expertise: [], habits: [] };
        
        await memManager.saveMemory(memory);
        
        return {
          type: CommandType.MEMORY,
          success: true,
          response: '🗑️ 所有记忆已清空',
        };
      }
      
      // search 操作：搜索记忆
      if (action === 'search') {
        const keyword = args.slice(1).join(' ').trim();
        
        if (!keyword) {
          return {
            type: CommandType.MEMORY,
            success: false,
            response: '❌ 请提供搜索关键词。用法: /memory search <关键词>',
            error: 'Missing keyword',
          };
        }
        
        const { facts, projects } = await import('../memory/index.js').then(m => 
          m.searchMemory(memory, keyword)
        );
        
        let response = `🔍 搜索结果 "${keyword}"\n==================\n\n`;
        
        if (facts.length > 0) {
          response += `📌 相关事实 (${facts.length}):\n`;
          facts.forEach((f, i) => {
            response += `  ${i + 1}. ${f.content}\n`;
          });
          response += '\n';
        }
        
        if (projects.length > 0) {
          response += `📁 相关项目 (${projects.length}):\n`;
          projects.forEach((p, i) => {
            response += `  ${i + 1}. ${p.name}\n`;
          });
        }
        
        if (facts.length === 0 && projects.length === 0) {
          response += '未找到相关记忆';
        }
        
        return {
          type: CommandType.MEMORY,
          success: true,
          response,
          data: { facts, projects },
        };
      }
      
      // toggle 操作：开关自动提取
      if (action === 'toggle') {
        memory.config.autoExtract = !memory.config.autoExtract;
        await memManager.saveMemory(memory);
        
        return {
          type: CommandType.MEMORY,
          success: true,
          response: `💡 自动记忆提取已${memory.config.autoExtract ? '开启' : '关闭'}`,
          data: { autoExtract: memory.config.autoExtract },
        };
      }
      
      // stats 操作：显示统计
      if (action === 'stats') {
        const stats = memManager.getMemoryStats(memory);
        
        return {
          type: CommandType.MEMORY,
          success: true,
          response: `📊 记忆统计\n==================\n\n` +
            `📌 重要事实: ${stats.factCount}\n` +
            `📁 项目: ${stats.projectCount}\n` +
            `📚 学习记录: ${stats.learningCount}\n` +
            `🔄 自动提取: ${memory.config.autoExtract ? '开启' : '关闭'}\n` +
            `📝 提取次数: ${memory.metadata.extractionCount}\n` +
            `⏰ 上次更新: ${new Date(stats.lastUpdate).toLocaleString()}`,
          data: stats,
        };
      }
      
      // 旧版 on/off 支持
      if (action === 'on' || action === 'off') {
        return {
          type: CommandType.MEMORY,
          success: true,
          response: `💡 新用法：\n• /memory - 查看完整记忆\n• /memory update <内容> - 添加事实\n• /memory search <关键词> - 搜索\n• /memory stats - 统计信息\n• /memory toggle - 开关自动提取\n• /memory clear - 清空记忆`,
        };
      }
      
      return {
        type: CommandType.MEMORY,
        success: false,
        response: '❌ 未知操作。用法:\n' +
          '• /memory - 查看记忆\n' +
          '• /memory update <内容> - 添加事实\n' +
          '• /memory search <关键词> - 搜索\n' +
          '• /memory stats - 统计\n' +
          '• /memory toggle - 开关自动提取\n' +
          '• /memory clear - 清空',
        error: 'Invalid action',
      };
    } catch (error) {
      return {
        type: CommandType.MEMORY,
        success: false,
        response: '❌ 记忆操作失败: ' + (error as Error).message,
        error: (error as Error).message,
      };
    }
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
      
      // 定义要读取的关键文件（避免过大的文件）
      const filesToRead = [
        { path: 'README.md', desc: '项目概览', priority: 'high', maxLength: 2000 },
        { path: 'AGENTS.md', desc: '项目指南', priority: 'high', maxLength: 2000 },
        { path: 'package.json', desc: '依赖配置', priority: 'medium', maxLength: 1000 },
        { path: 'docs/architecture/architecture-overview.md', desc: '架构文档', priority: 'high', maxLength: 1500 },
      ];

      // 发送初始进度通知
      if (onProgress) {
        await onProgress(
          `🚀 开始项目初始化\n` +
          `Agent: ${agent.name}\n` +
          `共 ${filesToRead.length} 个文件（精简版）\n\n` +
          `开始学习...`
        );
        // 初始延迟，确保消息顺序
        await new Promise(resolve => setTimeout(resolve, 500));
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
          
          // 根据文件类型截断，避免消息过长
          const maxLen = (file as {maxLength?: number}).maxLength || 1500;
          const truncated = content.length > maxLen 
            ? content.substring(0, maxLen) + '\n\n...[内容已截断，完整内容请查看文件]' 
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

        // 增加延迟，避免微信消息限流
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      projectContext += `\n---\n\n✅ 项目交接完成！\n\n作为创始者Agent，你的职责：\n`;
      projectContext += `1. 熟悉项目架构和技术栈\n`;
      projectContext += `2. 理解TDD开发流程\n`;
      projectContext += `3. 维护代码质量和文档\n`;
      projectContext += `4. 协助项目演进和重构\n\n`;
      projectContext += `可以使用 /status 查看状态，开始维护项目吧！`;

      // 发送完成通知前等待，确保前面的消息都发送完毕
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onProgress) {
        await onProgress(
          `🎉 初始化完成！\n` +
          `成功: ${loadedCount} | 失败: ${failedCount}\n` +
          `正在发送完整文档...`
        );
        // 等待最终消息发送
        await new Promise(resolve => setTimeout(resolve, 500));
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
