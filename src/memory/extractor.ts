/**
 * 记忆提取器
 * 
 * 使用 LLM 从对话中自动提取长期记忆
 */

import type {
  AgentMemory,
  MemoryExtractionResult,
  MemoryFact,
  MemoryProject,
  LearningRecord,
  FactCategory,
  LearningLevel,
} from './types.js';
import {
  createFactId,
  createProjectId,
} from './types.js';

/**
 * 记忆提取器配置
 */
export interface MemoryExtractorConfig {
  enabled: boolean;
  minDialogLength: number;      // 最少对话轮次才提取
  extractOnTopics: string[];    // 特定话题触发提取
  maxFactsPerExtraction: number;
}

/**
 * 对话消息
 */
export interface DialogueMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 记忆提取器
 */
export class MemoryExtractor {
  private config: MemoryExtractorConfig;

  constructor(config?: Partial<MemoryExtractorConfig>) {
    this.config = {
      enabled: true,
      minDialogLength: 3,
      extractOnTopics: ['项目', '学习', '工作', '技术', '偏好'],
      maxFactsPerExtraction: 5,
      ...config,
    };
  }

  /**
   * 检查是否应该触发记忆提取
   */
  shouldExtract(dialogue: DialogueMessage[]): boolean {
    if (!this.config.enabled) return false;
    if (dialogue.length < this.config.minDialogLength) return false;
    
    // 检查是否包含提取关键词
    const content = dialogue.map(m => m.content).join(' ');
    return this.config.extractOnTopics.some(topic => 
      content.includes(topic)
    );
  }

  /**
   * 构建记忆提取提示词
   */
  buildExtractionPrompt(dialogue: DialogueMessage[]): string {
    const dialogueText = dialogue
      .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n\n');

    return `请分析以下对话，提取需要长期记忆的重要信息。

对话内容：
${'='.repeat(40)}
${dialogueText}
${'='.repeat(40)}

请提取以下类型的信息（如果没有则留空）：

1. **用户画像更新**
   - 用户名/称呼
   - 偏好（如"喜欢简洁回答"、"偏好Python"）
   - 专业领域/技能
   - 习惯

2. **重要事实**（知识图谱风格）
   - 用户的身份信息、职业
   - 明确表达的观点、决策
   - 正在进行的项目信息
   - 技术选型、架构决策
   - 重要的时间节点

3. **项目信息**
   - 项目名称
   - 项目描述
   - 使用的技术栈

4. **学习记录**
   - 正在学习的主题
   - 技能水平

请按以下 JSON 格式返回（只返回 JSON，不要其他内容）：

{\n  "userProfile": {\n    "preferences": ["偏好1", "偏好2"],\n    "expertise": ["技能1", "技能2"],\n    "habits": ["习惯1"]\n  },\n  "facts": [\n    {\n      "content": "事实内容",\n      "category": "personal|work|project|tech|preference",\n      "importance": 3\n    }\n  ],\n  "projects": [\n    {\n      "name": "项目名称",\n      "description": "项目描述",\n      "techStack": ["技术1", "技术2"]\n    }\n  ],\n  "learnings": [\n    {\n      "topic": "学习主题",\n      "level": "beginner|intermediate|advanced",\n      "notes": "学习笔记"\n    }\n  ]\n}`;
  }

  /**
   * 解析提取结果
   */
  parseExtractionResult(response: string): MemoryExtractionResult {
    try {
      // 尝试提取 JSON 部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { facts: [], projects: [], learnings: [] };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        userProfile: parsed.userProfile || {},
        facts: (parsed.facts || []).slice(0, this.config.maxFactsPerExtraction),
        projects: parsed.projects || [],
        learnings: parsed.learnings || [],
      };
    } catch (error) {
      console.error('[MemoryExtractor] Failed to parse extraction result:', error);
      return { facts: [], projects: [], learnings: [] };
    }
  }

  /**
   * 将提取结果合并到现有记忆
   */
  mergeIntoMemory(
    memory: AgentMemory,
    extraction: MemoryExtractionResult
  ): AgentMemory {
    const now = Date.now();
    const updated = { ...memory };
    
    // 更新用户画像
    if (extraction.userProfile) {
      if (extraction.userProfile.preferences) {
        updated.userProfile.preferences = this.mergeArrays(
          updated.userProfile.preferences,
          extraction.userProfile.preferences
        );
      }
      if (extraction.userProfile.expertise) {
        updated.userProfile.expertise = this.mergeArrays(
          updated.userProfile.expertise,
          extraction.userProfile.expertise
        );
      }
      if (extraction.userProfile.habits) {
        updated.userProfile.habits = this.mergeArrays(
          updated.userProfile.habits,
          extraction.userProfile.habits
        );
      }
    }
    
    // 添加新事实（去重）
    for (const fact of extraction.facts) {
      // 检查是否已存在相似事实
      const exists = updated.facts.some(f => 
        this.similarity(f.content, fact.content) > 0.8
      );
      
      if (!exists) {
        const newFact: MemoryFact = {
          id: createFactId(),
          content: fact.content,
          category: fact.category as FactCategory,
          importance: Math.min(5, Math.max(1, fact.importance)),
          createdAt: now,
          updatedAt: now,
        };
        updated.facts.push(newFact);
      }
    }
    
    // 限制事实数量
    if (updated.facts.length > updated.config.maxFacts) {
      // 按重要度和时间排序，保留最重要的
      updated.facts.sort((a, b) => {
        const scoreA = a.importance * 10 + (a.updatedAt / 1000000000);
        const scoreB = b.importance * 10 + (b.updatedAt / 1000000000);
        return scoreB - scoreA;
      });
      updated.facts = updated.facts.slice(0, updated.config.maxFacts);
    }
    
    // 添加新项目
    for (const proj of extraction.projects) {
      const exists = updated.projects.some(p =>
        this.similarity(p.name, proj.name) > 0.8
      );
      
      if (!exists) {
        const newProject: MemoryProject = {
          id: createProjectId(),
          name: proj.name,
          description: proj.description,
          status: 'active',
          techStack: proj.techStack || [],
          keyFiles: [],
          createdAt: now,
          updatedAt: now,
        };
        updated.projects.push(newProject);
      }
    }
    
    // 限制项目数量
    if (updated.projects.length > updated.config.maxProjects) {
      updated.projects = updated.projects.slice(0, updated.config.maxProjects);
    }
    
    // 添加学习记录
    for (const learning of extraction.learnings) {
      const newLearning: LearningRecord = {
        topic: learning.topic,
        level: learning.level as LearningLevel,
        notes: learning.notes,
        date: now,
      };
      updated.learning.push(newLearning);
    }
    
    // 更新元数据
    updated.updatedAt = now;
    updated.metadata.lastExtractionAt = now;
    updated.metadata.extractionCount++;
    
    return updated;
  }

  /**
   * 合并数组（去重）
   */
  private mergeArrays(existing: string[], newItems: string[]): string[] {
    const combined = [...existing];
    for (const item of newItems) {
      if (!combined.some(e => e.toLowerCase() === item.toLowerCase())) {
        combined.push(item);
      }
    }
    return combined;
  }

  /**
   * 简单字符串相似度计算
   */
  private similarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // 计算共同子串
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const common = words1.filter(w => words2.includes(w));
    
    return common.length / Math.max(words1.length, words2.length);
  }
}
