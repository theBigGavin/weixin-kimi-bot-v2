/**
 * 记忆模块
 * 
 * 长期记忆管理 - 按架构文档完整实现
 */

// 类型定义
export type {
  AgentMemory,
  UserProfile,
  MemoryFact,
  MemoryProject,
  LearningRecord,
  MemoryExtractionResult,
  MemoryConfig,
  FactCategory,
  ProjectStatus,
  LearningLevel,
} from './types.js';

// 类型工具函数
export {
  createDefaultMemory,
  createFactId,
  createProjectId,
  searchMemory,
  getRelevantMemories,
} from './types.js';

// 记忆管理器
export { MemoryManager } from './manager.js';
export type { MemoryManagerOptions } from './manager.js';

// 记忆提取器
export { MemoryExtractor } from './extractor.js';
export type {
  MemoryExtractorConfig,
  DialogueMessage,
} from './extractor.js';
