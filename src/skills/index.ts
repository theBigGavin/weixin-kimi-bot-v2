/**
 * 全局技能系统
 * 
 * 导出技能系统的主要组件
 */

export {
  // 类型
  type Skill,
  type AgentSkill,
  type SkillExecution,
  type SkillCategory,
  type RegisterSkillParams,
  type InstallSkillParams,
  type ExecuteSkillParams,
  type SkillExecutionResult,
  type SkillFilter,
} from './types.js';

export {
  // 错误类
  SkillNotFoundError,
  SkillAlreadyExistsError,
  SkillExecutionError,
  SkillParseError,
  SkillValidationError,
} from './errors.js';

export {
  // 管理器
  type SkillManager,
  createSkillManager,
} from './manager.js';

export {
  // 解析器
  parseSkillManifest,
} from './parser.js';

export {
  // 执行器
  executeSkillScript,
} from './executor.js';

// 工厂函数
export { createSkill, createAgentSkill } from './types.js';
