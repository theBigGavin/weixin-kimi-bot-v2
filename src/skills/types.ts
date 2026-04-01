/**
 * 全局技能系统类型定义
 * 
 * 定义技能的元数据、状态和操作
 */

// ============================================================================
// 技能元数据
// ============================================================================

/**
 * 技能定义
 */
export interface Skill {
  /** 技能唯一标识符 */
  readonly id: string;
  /** 技能名称 */
  readonly name: string;
  /** 技能描述 */
  readonly description: string;
  /** 版本 */
  readonly version: string;
  /** 作者 */
  readonly author?: string;
  /** 标签 */
  readonly tags: readonly string[];
  /** 技能类别 */
  readonly category: SkillCategory;
  /** 执行配置 */
  readonly execution: SkillExecution;
  /** 创建时间 */
  readonly createdAt: number;
  /** 更新时间 */
  readonly updatedAt: number;
}

/**
 * 技能类别
 */
export type SkillCategory =
  | 'search'      // 搜索类
  | 'analysis'    // 分析类
  | 'generation'  // 生成类
  | 'utility'     // 工具类
  | 'integration' // 集成类
  | 'custom';     // 自定义

/**
 * 技能执行配置
 */
export interface SkillExecution {
  /** 执行类型 */
  type: 'python' | 'shell' | 'node' | 'http';
  /** 入口文件（相对于技能目录） */
  entry: string;
  /** 执行参数 */
  args?: readonly string[];
  /** 环境变量 */
  env?: Readonly<Record<string, string>>;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 工作目录 */
  workingDir?: string;
}

// ============================================================================
// 技能实例（Agent 层面的技能）
// ============================================================================

/**
 * Agent 技能实例
 */
export interface AgentSkill {
  /** 技能ID（引用全局技能） */
  readonly skillId: string;
  /** 实例ID */
  readonly instanceId: string;
  /** Agent ID */
  readonly agentId: string;
  /** 是否启用 */
  readonly enabled: boolean;
  /** 自定义配置 */
  readonly config: Readonly<Record<string, unknown>>;
  /** 安装时间 */
  readonly installedAt: number;
  /** 最后使用时间 */
  readonly lastUsedAt?: number;
  /** 使用次数 */
  readonly usageCount: number;
}

// ============================================================================
// 技能注册信息
// ============================================================================

/**
 * 注册技能参数
 */
export interface RegisterSkillParams {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  category?: SkillCategory;
  execution: SkillExecution;
}

/**
 * 安装技能到 Agent 参数
 */
export interface InstallSkillParams {
  skillId: string;
  agentId: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

// ============================================================================
// 技能执行
// ============================================================================

/**
 * 执行技能参数
 */
export interface ExecuteSkillParams {
  /** 技能ID */
  skillId: string;
  /** Agent ID */
  agentId: string;
  /** 输入参数 */
  input: Record<string, unknown>;
  /** 超时时间（覆盖默认） */
  timeout?: number;
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  /** 是否成功 */
  readonly success: boolean;
  /** 输出数据 */
  readonly output?: string;
  /** 错误信息 */
  readonly error?: string;
  /** 退出码 */
  readonly exitCode?: number;
  /** 执行时长（毫秒） */
  readonly duration: number;
}

// ============================================================================
// 过滤和查询
// ============================================================================

/**
 * 技能过滤器
 */
export interface SkillFilter {
  /** 按类别过滤 */
  category?: SkillCategory;
  /** 按标签过滤 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
  /** 仅显示系统技能 */
  systemOnly?: boolean;
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建技能定义
 */
export function createSkill(params: RegisterSkillParams): Skill {
  const now = Date.now();
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    version: params.version || '1.0.0',
    author: params.author,
    tags: params.tags ?? [],
    category: params.category ?? 'custom',
    execution: params.execution,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建 Agent 技能实例
 */
export function createAgentSkill(
  skillId: string,
  agentId: string,
  config: Record<string, unknown> = {},
  enabled = true
): AgentSkill {
  return {
    skillId,
    instanceId: `skill_${skillId}_${agentId}_${Date.now()}`,
    agentId,
    enabled,
    config,
    installedAt: Date.now(),
    usageCount: 0,
  };
}
