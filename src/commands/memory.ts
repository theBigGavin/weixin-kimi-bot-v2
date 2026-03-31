/**
 * Memory Command
 * 
 * Manages agent memory with sub-commands:
 * - (none): view memory
 * - update <content>: add a fact
 * - search <keyword>: search memory
 * - stats: show statistics
 * - toggle: toggle auto-extraction
 * - clear: clear all memory
 */

import { homedir } from 'os';
import { 
  Command, 
  SubCommand, 
  CommandContext, 
  CommandResult, 
  CommandType,
  ResponseBuilder 
} from './framework.js';
import { MemoryManager, createFactId, searchMemory } from '../memory/index.js';
import type { MemoryFact } from '../memory/index.js';

export class MemoryCommand extends Command {
  private memManager: MemoryManager;

  constructor() {
    super({
      name: 'memory',
      description: '查看或编辑Agent记忆（支持自动提取）',
      usage: '/memory [子命令]',
      examples: [
        '/memory',
        '/memory update 喜欢吃辣',
        '/memory search 工作',
        '/memory stats',
        '/memory toggle',
        '/memory clear',
      ],
    });

    this.memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });

    // Register sub-commands
    this.registerSubCommand(new MemoryUpdateSubCommand());
    this.registerSubCommand(new MemorySearchSubCommand());
    this.registerSubCommand(new MemoryStatsSubCommand());
    this.registerSubCommand(new MemoryToggleSubCommand());
    this.registerSubCommand(new MemoryClearSubCommand());
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const action = args[0]?.toLowerCase();

    try {
      const memory = await this.memManager.loadMemory(agent.id, agent.name);

      // No sub-command: display memory
      if (!action) {
        return {
          type: CommandType.MEMORY,
          success: true,
          response: this.memManager.formatMemoryForDisplay(memory),
        };
      }

      // Handle legacy on/off
      if (action === 'on' || action === 'off') {
        return this.legacyHelp();
      }

      // Delegate to sub-command
      const result = await this.executeSubCommand(action, { ...context, args: args.slice(1) });
      // Ensure type is set
      if (!result.type) result.type = CommandType.MEMORY;
      return result;
    } catch (error) {
      return ResponseBuilder.error('记忆操作失败: ' + (error as Error).message, undefined, CommandType.MEMORY);
    }
  }

  private legacyHelp(): CommandResult {
    return {
      type: CommandType.MEMORY,
      success: true,
      response: ResponseBuilder.create()
        .line('💡 新用法：')
        .list([
          '/memory - 查看完整记忆',
          '/memory update <内容> - 添加事实',
          '/memory search <关键词> - 搜索',
          '/memory stats - 统计信息',
          '/memory toggle - 开关自动提取',
          '/memory clear - 清空记忆',
        ])
        .build(),
    };
  }

  getMemoryManager(): MemoryManager {
    return this.memManager;
  }
}

// ============================================================================
// Sub Commands
// ============================================================================

class MemoryUpdateSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'update',
      description: '添加新的事实记忆',
      usage: '<内容>',
      examples: ['/memory update 喜欢吃辣'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const content = args.join(' ').trim();

    if (!content) {
      return ResponseBuilder.error('请提供记忆内容。用法: /memory update <内容>', undefined, CommandType.MEMORY);
    }

    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    const memory = await memManager.loadMemory(agent.id, agent.name);
    
    const now = Date.now();
    const newFact: MemoryFact = {
      id: createFactId(),
      content,
      category: 'personal',
      importance: 3,
      createdAt: now,
      updatedAt: now,
    };

    memory.facts.push(newFact);
    await memManager.saveMemory(memory);

    return {
      type: CommandType.MEMORY,
      success: true,
      response: ResponseBuilder.create()
        .line('✅ 记忆已添加')
        .line()
        .line(`📝 ${content}`)
        .line()
        .line(`当前共有 ${memory.facts.length} 条重要事实`)
        .build(),
      data: { fact: newFact, total: memory.facts.length },
    };
  }
}

class MemorySearchSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'search',
      description: '搜索记忆内容',
      usage: '<关键词>',
      examples: ['/memory search 工作'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const keyword = args.join(' ').trim();

    if (!keyword) {
      return ResponseBuilder.error('请提供搜索关键词。用法: /memory search <关键词>', undefined, CommandType.MEMORY);
    }

    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    const memory = await memManager.loadMemory(agent.id, agent.name);
    const { facts, projects } = searchMemory(memory, keyword);

    const rb = ResponseBuilder.create()
      .title(`🔍 搜索结果 "${keyword}"`);

    if (facts.length > 0) {
      rb.section(`相关事实 (${facts.length})`);
      facts.forEach((f, i) => rb.line(`  ${i + 1}. ${f.content}`));
    }

    if (projects.length > 0) {
      rb.section(`相关项目 (${projects.length})`);
      projects.forEach((p, i) => rb.line(`  ${i + 1}. ${p.name}`));
    }

    if (facts.length === 0 && projects.length === 0) {
      rb.line('未找到相关记忆');
    }

    return {
      type: CommandType.MEMORY,
      success: true,
      response: rb.build(),
      data: { facts, projects },
    };
  }
}

class MemoryStatsSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'stats',
      description: '显示记忆统计信息',
      usage: '',
      examples: ['/memory stats'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { agent } = context;

    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    const memory = await memManager.loadMemory(agent.id, agent.name);
    const stats = memManager.getMemoryStats(memory);

    return {
      type: CommandType.MEMORY,
      success: true,
      response: ResponseBuilder.create()
        .title('📊 记忆统计')
        .line(`📌 重要事实: ${stats.factCount}`)
        .line(`📁 项目: ${stats.projectCount}`)
        .line(`📚 学习记录: ${stats.learningCount}`)
        .line(`🔄 自动提取: ${memory.config.autoExtract ? '开启' : '关闭'}`)
        .line(`📝 提取次数: ${memory.metadata.extractionCount}`)
        .line(`⏰ 上次更新: ${new Date(stats.lastUpdate).toLocaleString()}`)
        .build(),
      data: stats,
    };
  }
}

class MemoryToggleSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'toggle',
      description: '开关自动记忆提取',
      usage: '',
      examples: ['/memory toggle'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { agent } = context;

    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    const memory = await memManager.loadMemory(agent.id, agent.name);
    memory.config.autoExtract = !memory.config.autoExtract;
    await memManager.saveMemory(memory);

    return {
      type: CommandType.MEMORY,
      success: true,
      response: `💡 自动记忆提取已${memory.config.autoExtract ? '开启' : '关闭'}`,
      data: { autoExtract: memory.config.autoExtract },
    };
  }
}

class MemoryClearSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'clear',
      description: '清空所有记忆',
      usage: '',
      examples: ['/memory clear'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { agent } = context;

    const memManager = new MemoryManager({
      baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
    });
    
    const memory = await memManager.loadMemory(agent.id, agent.name);
    memory.facts = [];
    memory.projects = [];
    memory.learning = [];
    memory.userProfile = { preferences: [], expertise: [], habits: [] };
    await memManager.saveMemory(memory);

    return ResponseBuilder.success('所有记忆已清空 🗑️', CommandType.MEMORY);
  }
}
