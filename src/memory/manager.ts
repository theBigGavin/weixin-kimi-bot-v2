/**
 * 记忆管理器
 * 
 * 负责记忆的加载、保存和管理
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { AgentMemory } from './types.js';
import { createDefaultMemory } from './types.js';

/**
 * 记忆管理器选项
 */
export interface MemoryManagerOptions {
  baseDir: string;
}

/**
 * 记忆管理器
 */
export class MemoryManager {
  private options: MemoryManagerOptions;

  constructor(options: MemoryManagerOptions) {
    this.options = options;
  }

  /**
   * 获取记忆文件路径
   */
  private getMemoryPath(agentId: string): string {
    return join(this.options.baseDir, 'agents', agentId, 'memory.json');
  }

  /**
   * 加载 Agent 记忆
   */
  async loadMemory(agentId: string, agentName: string): Promise<AgentMemory> {
    const memoryPath = this.getMemoryPath(agentId);
    
    try {
      if (existsSync(memoryPath)) {
        const content = await readFile(memoryPath, 'utf-8');
        const memory = JSON.parse(content) as AgentMemory;
        
        // 验证版本，必要时迁移
        if (memory.version !== 1) {
          return this.migrateMemory(memory, agentId, agentName);
        }
        
        return memory;
      }
    } catch (error) {
      console.error(`[MemoryManager] Failed to load memory for ${agentId}:`, error);
    }
    
    // 返回默认记忆
    return createDefaultMemory(agentId, agentName);
  }

  /**
   * 保存 Agent 记忆
   */
  async saveMemory(memory: AgentMemory): Promise<void> {
    const memoryPath = this.getMemoryPath(memory.metadata.agentId);
    
    try {
      // 确保目录存在
      await mkdir(dirname(memoryPath), { recursive: true });
      
      // 更新更新时间
      memory.updatedAt = Date.now();
      
      // 写入文件
      await writeFile(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[MemoryManager] Failed to save memory:`, error);
      throw error;
    }
  }

  /**
   * 检查记忆是否存在
   */
  async hasMemory(agentId: string): Promise<boolean> {
    const memoryPath = this.getMemoryPath(agentId);
    return existsSync(memoryPath);
  }

  /**
   * 删除记忆
   */
  async deleteMemory(agentId: string): Promise<void> {
    const memoryPath = this.getMemoryPath(agentId);
    
    try {
      if (existsSync(memoryPath)) {
        await writeFile(memoryPath, '', 'utf-8');
      }
    } catch (error) {
      console.error(`[MemoryManager] Failed to delete memory:`, error);
    }
  }

  /**
   * 记忆版本迁移
   */
  private migrateMemory(
    oldMemory: any,
    agentId: string,
    agentName: string
  ): AgentMemory {
    // 如果是旧版格式（只有 items 数组）
    if (oldMemory.items && Array.isArray(oldMemory.items)) {
      const now = Date.now();
      const newMemory = createDefaultMemory(agentId, agentName);
      
      // 将旧记忆项转换为 facts
      newMemory.facts = oldMemory.items.map((item: string, index: number) => ({
        id: `migrated_${now}_${index}`,
        content: item,
        category: 'personal' as const,
        importance: 3,
        createdAt: now,
        updatedAt: now,
      }));
      
      return newMemory;
    }
    
    // 无法识别，返回默认
    return createDefaultMemory(agentId, agentName);
  }

  /**
   * 获取记忆统计
   */
  getMemoryStats(memory: AgentMemory): {
    factCount: number;
    projectCount: number;
    learningCount: number;
    lastUpdate: number;
  } {
    return {
      factCount: memory.facts.length,
      projectCount: memory.projects.length,
      learningCount: memory.learning.length,
      lastUpdate: memory.updatedAt,
    };
  }

  /**
   * 格式化记忆为文本（用于显示）
   */
  formatMemoryForDisplay(memory: AgentMemory): string {
    const stats = this.getMemoryStats(memory);
    
    let output = `🧠 Agent 记忆概览\n`;
    output += `${'='.repeat(30)}\n\n`;
    
    // 用户画像
    output += `👤 用户画像\n`;
    if (memory.userProfile.name) {
      output += `  名称: ${memory.userProfile.name}\n`;
    }
    if (memory.userProfile.preferences.length > 0) {
      output += `  偏好: ${memory.userProfile.preferences.join(', ')}\n`;
    }
    if (memory.userProfile.expertise.length > 0) {
      output += `  专长: ${memory.userProfile.expertise.join(', ')}\n`;
    }
    if (memory.userProfile.habits.length > 0) {
      output += `  习惯: ${memory.userProfile.habits.join(', ')}\n`;
    }
    output += '\n';
    
    // 重要事实
    output += `📌 重要事实 (${stats.factCount})\n`;
    if (memory.facts.length > 0) {
      memory.facts
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .forEach((fact, i) => {
          const stars = '★'.repeat(fact.importance) + '☆'.repeat(5 - fact.importance);
          output += `  ${i + 1}. [${stars}] ${fact.content}\n`;
        });
      if (memory.facts.length > 10) {
        output += `  ... 还有 ${memory.facts.length - 10} 条\n`;
      }
    } else {
      output += `  暂无重要事实\n`;
    }
    output += '\n';
    
    // 项目
    output += `📁 项目 (${stats.projectCount})\n`;
    if (memory.projects.length > 0) {
      memory.projects.forEach((proj, i) => {
        const statusEmoji = proj.status === 'active' ? '🟢' : proj.status === 'paused' ? '⏸️' : '✅';
        output += `  ${i + 1}. ${statusEmoji} ${proj.name}\n`;
        output += `     ${proj.description}\n`;
        if (proj.techStack?.length) {
          output += `     技术栈: ${proj.techStack.join(', ')}\n`;
        }
      });
    } else {
      output += `  暂无项目记录\n`;
    }
    output += '\n';
    
    // 学习记录
    output += `📚 学习记录 (${stats.learningCount})\n`;
    if (memory.learning.length > 0) {
      memory.learning.slice(-5).forEach((rec, i) => {
        const levelEmoji = rec.level === 'beginner' ? '🌱' : rec.level === 'intermediate' ? '🌿' : '🌳';
        output += `  ${i + 1}. ${levelEmoji} ${rec.topic}\n`;
      });
    } else {
      output += `  暂无学习记录\n`;
    }
    output += '\n';
    
    // 元数据
    output += `📊 统计\n`;
    output += `  自动提取: ${memory.config.autoExtract ? '开启' : '关闭'}\n`;
    output += `  提取次数: ${memory.metadata.extractionCount}\n`;
    if (memory.metadata.lastExtractionAt) {
      const date = new Date(memory.metadata.lastExtractionAt).toLocaleString();
      output += `  上次提取: ${date}\n`;
    }
    
    return output;
  }
}
