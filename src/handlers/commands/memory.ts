/**
 * Memory Command Handler
 * 
 * Handles /memory command for viewing and editing agent memory.
 */

import { homedir } from 'os';
import { MemoryManager, createFactId } from '../../memory/index.js';
import type { MemoryFact } from '../../memory/index.js';
import type { Agent } from '../../agent/types.js';
import { CommandType, type CommandResult } from '../command-handler.js';

export async function handleMemory(args: string[], agent: Agent): Promise<CommandResult> {
  const action = args[0]?.toLowerCase();
  
  const memManager = new MemoryManager({
    baseDir: process.env.WEIXIN_KIMI_BOT_HOME || homedir() + '/.weixin-kimi-bot'
  });
  
  try {
    let memory = await memManager.loadMemory(agent.id, agent.name);
    
    if (!action) {
      const display = memManager.formatMemoryForDisplay(memory);
      return {
        type: CommandType.MEMORY,
        success: true,
        response: display,
      };
    }
    
    if (action === 'update' || action === 'add') {
      return await handleMemoryUpdate(args, memory, memManager);
    }
    
    if (action === 'clear') {
      return await handleMemoryClear(memory, memManager);
    }
    
    if (action === 'search') {
      return await handleMemorySearch(args, memory);
    }
    
    if (action === 'toggle') {
      return await handleMemoryToggle(memory, memManager);
    }
    
    if (action === 'stats') {
      return handleMemoryStats(memory, memManager);
    }
    
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

async function handleMemoryUpdate(
  args: string[],
  memory: Awaited<ReturnType<MemoryManager['loadMemory']>>,
  memManager: MemoryManager
): Promise<CommandResult> {
  const content = args.slice(1).join(' ').trim();
  
  if (!content) {
    return {
      type: CommandType.MEMORY,
      success: false,
      response: '❌ 请提供记忆内容。用法: /memory update <内容>',
      error: 'Missing memory content',
    };
  }
  
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
    response: `✅ 记忆已添加\n\n📝 ${content}\n\n当前共有 ${memory.facts.length} 条重要事实`,
    data: { 
      fact: newFact,
      total: memory.facts.length 
    },
  };
}

async function handleMemoryClear(
  memory: Awaited<ReturnType<MemoryManager['loadMemory']>>,
  memManager: MemoryManager
): Promise<CommandResult> {
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

async function handleMemorySearch(
  args: string[],
  memory: Awaited<ReturnType<MemoryManager['loadMemory']>>
): Promise<CommandResult> {
  const keyword = args.slice(1).join(' ').trim();
  
  if (!keyword) {
    return {
      type: CommandType.MEMORY,
      success: false,
      response: '❌ 请提供搜索关键词。用法: /memory search <关键词>',
      error: 'Missing keyword',
    };
  }
  
  const { searchMemory } = await import('../../memory/index.js');
  const { facts, projects } = searchMemory(memory, keyword);
  
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

async function handleMemoryToggle(
  memory: Awaited<ReturnType<MemoryManager['loadMemory']>>,
  memManager: MemoryManager
): Promise<CommandResult> {
  memory.config.autoExtract = !memory.config.autoExtract;
  await memManager.saveMemory(memory);
  
  return {
    type: CommandType.MEMORY,
    success: true,
    response: `💡 自动记忆提取已${memory.config.autoExtract ? '开启' : '关闭'}`,
    data: { autoExtract: memory.config.autoExtract },
  };
}

function handleMemoryStats(
  memory: Awaited<ReturnType<MemoryManager['loadMemory']>>,
  memManager: MemoryManager
): CommandResult {
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
