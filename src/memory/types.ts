/**
 * 长期记忆类型定义
 * 
 * 基于架构文档设计的完整记忆系统
 */

// ============================================
// 用户画像
// ============================================
export interface UserProfile {
  name?: string;
  preferences: string[];       // 偏好列表
  expertise: string[];         // 专业领域
  habits: string[];            // 习惯
}

// ============================================
// 重要事实（知识图谱风格）
// ============================================
export type FactCategory = 'personal' | 'work' | 'project' | 'tech' | 'preference';

export interface MemoryFact {
  id: string;
  content: string;             // 事实内容
  category: FactCategory;      // 类别
  importance: number;          // 重要度 1-5
  createdAt: number;
  updatedAt: number;
  source?: string;             // 来源对话ID
}

// ============================================
// 项目上下文
// ============================================
export type ProjectStatus = 'active' | 'paused' | 'completed';

export interface MemoryProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  techStack?: string[];
  keyFiles?: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================
// 学习记录
// ============================================
export type LearningLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LearningRecord {
  topic: string;
  level: LearningLevel;
  notes: string;
  date: number;
}

// ============================================
// 记忆提取结果
// ============================================
export interface MemoryExtractionResult {
  userProfile?: Partial<UserProfile>;
  facts: Array<{
    content: string;
    category: FactCategory;
    importance: number;
  }>;
  projects: Array<{
    name: string;
    description: string;
    techStack?: string[];
  }>;
  learnings: Array<{
    topic: string;
    level: LearningLevel;
    notes: string;
  }>;
}

// ============================================
// 完整记忆数据结构
// ============================================
export interface AgentMemory {
  version: number;
  updatedAt: number;
  
  // 元数据
  metadata: {
    agentId: string;
    agentName: string;
    createdAt: number;
    lastExtractionAt?: number;   // 上次自动提取时间
    extractionCount: number;      // 提取次数
  };
  
  // 配置
  config: {
    enabled: boolean;
    autoExtract: boolean;         // 是否自动提取
    maxFacts: number;             // 最大事实数
    maxProjects: number;          // 最大项目数
  };
  
  // 记忆内容
  userProfile: UserProfile;
  facts: MemoryFact[];
  projects: MemoryProject[];
  learning: LearningRecord[];
}

// ============================================
// 记忆配置
// ============================================
export interface MemoryConfig {
  enabled: boolean;
  autoExtract: boolean;
  maxFacts: number;
  maxProjects: number;
}

// ============================================
// 创建默认记忆
// ============================================
export function createDefaultMemory(agentId: string, agentName: string): AgentMemory {
  const now = Date.now();
  return {
    version: 1,
    updatedAt: now,
    metadata: {
      agentId,
      agentName,
      createdAt: now,
      extractionCount: 0,
    },
    config: {
      enabled: true,
      autoExtract: true,
      maxFacts: 100,
      maxProjects: 10,
    },
    userProfile: {
      preferences: [],
      expertise: [],
      habits: [],
    },
    facts: [],
    projects: [],
    learning: [],
  };
}

// ============================================
// 创建事实 ID
// ============================================
export function createFactId(): string {
  return `fact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// 创建项目 ID
// ============================================
export function createProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// 搜索记忆（按关键词）
// ============================================
export function searchMemory(memory: AgentMemory, keyword: string): {
  facts: MemoryFact[];
  projects: MemoryProject[];
} {
  const lowerKeyword = keyword.toLowerCase();
  
  const facts = memory.facts.filter(f => 
    f.content.toLowerCase().includes(lowerKeyword)
  );
  
  const projects = memory.projects.filter(p =>
    p.name.toLowerCase().includes(lowerKeyword) ||
    p.description.toLowerCase().includes(lowerKeyword)
  );
  
  return { facts, projects };
}

// ============================================
// 获取相关记忆（基于话题）
// ============================================
export function getRelevantMemories(
  memory: AgentMemory, 
  topics: string[],
  limit: number = 10
): MemoryFact[] {
  const scored = memory.facts.map(fact => {
    let score = 0;
    const content = fact.content.toLowerCase();
    
    // 根据话题匹配度评分
    for (const topic of topics) {
      if (content.includes(topic.toLowerCase())) {
        score += 2;
      }
    }
    
    // 重要度加权
    score += fact.importance * 0.5;
    
    // 时间衰减（越新的记忆分越高）
    const age = Date.now() - fact.updatedAt;
    const days = age / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - days * 0.1);  // 每天衰减0.1分
    
    return { fact, score };
  });
  
  // 按分数排序并返回前 N 个
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.fact);
}
