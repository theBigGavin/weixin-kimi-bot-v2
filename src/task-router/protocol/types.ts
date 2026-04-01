/**
 * Capability Protocol v1.0 类型定义
 * 
 * 定义智能任务路由的协议类型，包括能力定义、任务请求、执行步骤等
 */

import { ExecutionMode, TaskComplexity } from '../types.js';

// ============================================
// 协议版本
// ============================================
export const CAPABILITY_PROTOCOL_VERSION = '1.0';

// ============================================
// JSON Schema 类型 (简化版)
// ============================================
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
}

// ============================================
// 能力定义 (Capability)
// ============================================

/**
 * 能力约束
 */
export interface CapabilityConstraints {
  /** 支持执行模式 */
  allowedModes: ExecutionMode[];
  /** 最大执行时间（毫秒） */
  maxDuration: number;
  /** 是否需要确认 */
  requireConfirmation: boolean | ConfirmationCondition;
  /** 资源需求 */
  resourceRequirements?: ResourceSpec;
}

/**
 * 确认条件
 */
export interface ConfirmationCondition {
  /** 条件表达式 */
  condition: string;
  /** 条件描述 */
  description: string;
}

/**
 * 资源规格
 */
export interface ResourceSpec {
  /** 所需工具 */
  tools?: string[];
  /** 文件系统访问 */
  fileAccess?: boolean;
  /** 网络访问 */
  networkAccess?: boolean;
  /** 命令执行 */
  shellExecution?: boolean;
}

/**
 * 能力定义
 * 类似 MCP Tool 的声明式能力定义
 */
export interface Capability {
  /** 能力ID */
  id: string;
  /** 版本 */
  version: string;
  /** 能力描述（LLM用于理解何时使用） */
  description: string;
  /** 输入参数Schema */
  inputSchema: JSONSchema;
  /** 输出结果Schema */
  outputSchema?: JSONSchema;
  /** 执行约束 */
  constraints: CapabilityConstraints;
  /** 示例用法 */
  examples?: CapabilityExample[];
  /** 元数据 */
  metadata?: {
    /** 能力分类 */
    category?: string;
    /** 标签 */
    tags?: string[];
    /** 作者 */
    author?: string;
    /** 创建时间 */
    createdAt?: number;
  };
}

/**
 * 能力使用示例
 */
export interface CapabilityExample {
  /** 示例描述 */
  description: string;
  /** 输入示例 */
  input: unknown;
  /** 输出示例 */
  output?: unknown;
}

// ============================================
// 任务请求 (TaskRequest)
// ============================================

/**
 * LLM输出的任务请求
 * 这是智能路由的核心协议类型
 */
export interface TaskRequest {
  /** 协议版本 */
  protocolVersion: typeof CAPABILITY_PROTOCOL_VERSION;
  
  /** 任务分析 */
  analysis: ProtocolTaskAnalysis;
  
  /** 执行计划 */
  plan: ExecutionPlan;
  
  /** 元数据 */
  metadata: TaskMetadata;
}

/**
 * 协议层任务分析 (重命名以避免与 task-router/types.ts 冲突)
 */
export interface ProtocolTaskAnalysis {
  /** 用户意图描述 */
  userIntent: string;
  /** 所需能力列表 */
  requiredCapabilities: string[];
  /** 复杂度评估 */
  complexity: ComplexityAssessment;
}

/**
 * 复杂度评估
 */
export interface ComplexityAssessment {
  /** 复杂度分数 0-100 */
  score: number;
  /** 复杂度等级 */
  level: TaskComplexity;
  /** 影响因素 */
  factors: string[];
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 执行策略 */
  strategy: ExecutionStrategy;
  /** 执行步骤 */
  steps: ExecutionStep[];
}

/** 执行策略 */
export type ExecutionStrategy = 
  | 'single'      // 单步执行
  | 'sequential'  // 顺序执行
  | 'parallel'    // 并行执行
  | 'conditional'; // 条件执行

/**
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤ID */
  stepId: string;
  /** 步骤名称 */
  name?: string;
  /** 步骤描述 */
  description?: string;
  /** 使用的能力 */
  capability: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 输入参数 */
  input: unknown;
  /** 依赖步骤 */
  dependencies?: string[];
  /** 执行条件 */
  condition?: StepCondition;
  /** 预估耗时（毫秒） */
  estimatedDuration?: number;
  /** 步骤类型 */
  type?: 'capability' | 'native-command';
}

/**
 * 步骤条件
 */
export interface StepCondition {
  /** 条件表达式 */
  if: string;
  /** 条件为真时执行的步骤 */
  then: string;
  /** 条件为假时执行的步骤 */
  else?: string;
}

/**
 * 命令步骤（嵌入原生命令）
 */
export interface CommandStep extends ExecutionStep {
  type: 'native-command';
  /** 完整命令字符串 */
  command: string;
  /** 结构化参数 */
  args: Record<string, unknown>;
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
  /** 预估Token消耗 */
  estimatedTokens?: number;
  /** 预估总耗时（毫秒） */
  estimatedDuration: number;
  /** 优先级 1-10 */
  priority: number;
  /** LLM决策置信度 0-1 */
  confidence: number;
  /** 备选执行模式 */
  alternatives?: ExecutionMode[];
}

// ============================================
// 意图签名 (用于缓存)
// ============================================

/**
 * 意图签名
 * 用于意图缓存的相似性匹配
 */
export interface IntentSignature {
  /** 意图哈希 */
  intentHash: string;
  /** 所需能力集合（排序后） */
  capabilitySet: string;
  /** 复杂度指纹 */
  complexityFingerprint: string;
  /** 用户ID */
  userId?: string;
  /** 上下文类型 */
  contextType?: string;
}

/**
 * 缓存的决策结果
 */
export interface CachedDecision {
  /** 签名 */
  signature: IntentSignature;
  /** 任务请求 */
  taskRequest: TaskRequest;
  /** 缓存时间 */
  cachedAt: number;
  /** 命中次数 */
  hitCount: number;
  /** 最后命中时间 */
  lastHitAt: number;
}

// ============================================
// 协议验证结果
// ============================================

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误路径 */
  path: string;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告路径 */
  path: string;
  /** 警告消息 */
  message: string;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建复杂度评估
 */
export function createComplexityAssessment(
  score: number,
  factors: string[] = []
): ComplexityAssessment {
  let level: TaskComplexity;
  if (score >= 80) {
    level = TaskComplexity.VERY_COMPLEX;
  } else if (score >= 60) {
    level = TaskComplexity.COMPLEX;
  } else if (score >= 30) {
    level = TaskComplexity.MODERATE;
  } else {
    level = TaskComplexity.SIMPLE;
  }

  return {
    score,
    level,
    factors,
  };
}

/**
 * 创建任务请求
 */
export interface CreateTaskRequestParams {
  userIntent: string;
  requiredCapabilities: string[];
  complexity: ComplexityAssessment;
  strategy?: ExecutionStrategy;
  steps: ExecutionStep[];
  estimatedDuration?: number;
  priority?: number;
  confidence?: number;
}

export function createTaskRequest(params: CreateTaskRequestParams): TaskRequest {
  const totalDuration = params.steps.reduce(
    (sum, step) => sum + (step.estimatedDuration || 60000),
    0
  );

  return {
    protocolVersion: CAPABILITY_PROTOCOL_VERSION,
    analysis: {
      userIntent: params.userIntent,
      requiredCapabilities: params.requiredCapabilities,
      complexity: params.complexity,
    },
    plan: {
      strategy: params.strategy || 'single',
      steps: params.steps,
    },
    metadata: {
      estimatedDuration: params.estimatedDuration || totalDuration,
      priority: params.priority || 5,
      confidence: params.confidence || 0.8,
    },
  };
}

/**
 * 创建能力定义
 */
export interface CreateCapabilityParams {
  id: string;
  description: string;
  inputSchema: JSONSchema;
  allowedModes: ExecutionMode[];
  maxDuration?: number;
  requireConfirmation?: boolean;
  version?: string;
}

export function createCapability(params: CreateCapabilityParams): Capability {
  return {
    id: params.id,
    version: params.version || '1.0',
    description: params.description,
    inputSchema: params.inputSchema,
    constraints: {
      allowedModes: params.allowedModes,
      maxDuration: params.maxDuration || 300000, // 默认5分钟
      requireConfirmation: params.requireConfirmation || false,
    },
  };
}

/**
 * 创建执行步骤
 */
export interface CreateExecutionStepParams {
  stepId: string;
  capability: string;
  mode: ExecutionMode;
  input: unknown;
  name?: string;
  description?: string;
  dependencies?: string[];
  condition?: StepCondition;
  estimatedDuration?: number;
}

export function createExecutionStep(params: CreateExecutionStepParams): ExecutionStep {
  return {
    stepId: params.stepId,
    name: params.name,
    description: params.description,
    capability: params.capability,
    mode: params.mode,
    input: params.input,
    dependencies: params.dependencies,
    condition: params.condition,
    estimatedDuration: params.estimatedDuration,
  };
}

/**
 * 创建命令步骤
 */
export interface CreateCommandStepParams extends CreateExecutionStepParams {
  command: string;
  args: Record<string, unknown>;
}

export function createCommandStep(params: CreateCommandStepParams): CommandStep {
  return {
    ...createExecutionStep(params),
    type: 'native-command',
    command: params.command,
    args: params.args,
  };
}
