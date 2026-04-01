/**
 * 全局类型定义
 * 
 * 包含核心领域模型、枚举类型和工具函数
 */

// ============================================
// 对话状态枚举
// ============================================
export enum ConversationState {
  IDLE = 'idle',
  EXPLORING = 'exploring',
  CLARIFYING = 'clarifying',
  PROPOSING = 'proposing',
  COMPARING = 'comparing',
  CONFIRMING = 'confirming',
  REFINING = 'refining',
  PLANNING = 'planning',
  EXECUTINGT = 'executingt',
  EXECUTINGD = 'executingd',
  EXECUTINGI = 'executingi',
  EXECUTINGE = 'executinge',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

// ============================================
// 意图类型枚举
// ============================================
export enum IntentType {
  SELECT_OPTION = 'select_option',
  CONFIRM = 'confirm',
  REJECT = 'reject',
  MODIFY = 'modify',
  EXECUTE = 'execute',
  PAUSE = 'pause',
  RESUME = 'resume',
  CANCEL = 'cancel',
  ASK_INFO = 'ask_info',
  REFERENCE = 'reference',
}

// ============================================
// 执行模式枚举
// ============================================
export enum ExecutionMode {
  DIRECT = 'direct',
  LONGTASK = 'longtask',
  FLOWTASK = 'flowtask',
}

// ============================================
// 长任务状态枚举
// ============================================
export enum LongTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============================================
// 流程任务状态枚举
// ============================================
export enum FlowTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_CONFIRM = 'waiting_confirm',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============================================
// 消息类型枚举
// ============================================
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VOICE = 'voice',
  VIDEO = 'video',
}

// ============================================
// ID 生成工具函数
// ============================================

/**
 * 生成随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成日期字符串 (YYYYMMDD)
 * @returns 日期字符串
 */
function generateDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 清理名称中的特殊字符
 * @param name 原始名称
 * @returns 清理后的名称
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
}

/**
 * 创建 Agent ID
 * 格式: 名称_日期_8位随机码
 * @param name Agent 名称
 * @returns Agent ID
 */
export function createAgentId(name: string): string {
  const sanitizedName = sanitizeName(name);
  const dateStr = generateDateString();
  const randomStr = generateRandomString(8);
  return `${sanitizedName}_${dateStr}_${randomStr}`;
}

/**
 * 创建任务 ID
 * 格式: task_12位随机码
 * @returns 任务 ID
 */
export function createTaskId(): string {
  return `task_${generateRandomString(12)}`;
}

/**
 * 创建上下文 ID
 * 格式: ctx_12位随机码
 * @returns 上下文 ID
 */
export function createContextId(): string {
  return `ctx_${generateRandomString(12)}`;
}

/**
 * 创建记忆 ID
 * 格式: mem_12位随机码
 * @returns 记忆 ID
 */
export function createMemoryId(): string {
  return `mem_${generateRandomString(12)}`;
}

/**
 * 创建选项 ID
 * 格式: opt_12位随机码
 * @returns 选项 ID
 */
export function createOptionId(): string {
  return `opt_${generateRandomString(12)}`;
}

// ============================================
// 核心接口定义
// ============================================

/**
 * Agent 配置
 * @readonly - 创建后不应直接修改，使用 copy-on-write 模式更新
 */
export interface AgentConfig {
  /** Agent 唯一标识符 */
  readonly id: string;
  /** Agent 名称 */
  readonly name: string;
  /** 创建时间戳 */
  readonly createdAt: number;
  /** 微信账号信息 */
  readonly wechat: {
    readonly accountId: string;
    readonly nickname?: string;
  };
  /** 工作空间配置 */
  readonly workspace: {
    readonly path: string;
    readonly createdAt: number;
  };
  /** AI 配置 */
  readonly ai: {
    readonly model: string;
    readonly templateId: string;
    readonly customSystemPrompt?: string;
    readonly maxTurns: number;
    readonly temperature?: number;
  };
  /** 记忆配置 */
  readonly memory: {
    readonly enabledL: boolean;
    readonly enabledS: boolean;
    readonly maxItems: number;
    readonly autoExtract: boolean;
  };
  /** 功能开关 */
  readonly features: {
    readonly scheduledTasks: boolean;
    readonly notifications: boolean;
    readonly fileAccess: boolean;
    readonly shellExec: boolean;
    readonly webSearch: boolean;
  };
  // Phase III: 共享绑定相关字段
  /** 可见性: private(私有) | shared(共享) | invite_only(邀请制) */
  readonly visibility: 'private' | 'shared' | 'invite_only';
  /** 最大绑定用户数 */
  readonly maxBindings: number;
  /** 当前绑定用户数 */
  readonly currentBindingCount: number;
  /** 允许绑定的微信ID列表（invite_only模式） */
  readonly allowedWechatIds: ReadonlyArray<string>;
  /** 创建者微信ID */
  readonly primaryWechatId: string;
}

/**
 * 能力模板
 * @readonly - 预定义模板，创建后不可修改
 */
export interface CapabilityTemplate {
  /** 模板唯一标识符 */
  readonly id: string;
  /** 模板名称 */
  readonly name: string;
  /** 模板描述 */
  readonly description: string;
  /** 图标标识 */
  readonly icon: string;
  /** 系统提示词 */
  readonly systemPrompt: string;
  /** 欢迎消息 */
  readonly welcomeMessage?: string;
  /** 建议消息列表 */
  readonly suggestions?: ReadonlyArray<string>;
  /** 默认配置 */
  readonly defaults: {
    readonly model: string;
    readonly maxTurns: number;
    readonly temperature: number;
  };
  /** 工具开关 */
  readonly tools: {
    readonly fileOperations: boolean;
    readonly codeExecution: boolean;
    readonly webSearch: boolean;
    readonly gitOperations: boolean;
  };
  /** 行为配置 */
  readonly behavior: {
    readonly proactive: boolean;
    readonly verbose: boolean;
    readonly confirmDestructive: boolean;
  };
}

/**
 * 微信消息
 * @readonly - 消息一旦创建不可修改
 */
export interface WeixinMessage {
  /** 消息唯一标识符 */
  readonly id: string;
  /** 消息类型 */
  readonly type: MessageType;
  /** 发送者 */
  readonly fromUser: string;
  /** 消息内容 */
  readonly content: string;
  /** 时间戳 */
  readonly timestamp: number;
  /** 是否群消息 */
  readonly isGroup: boolean;
  /** 群ID（仅群消息） */
  readonly groupId?: string;
  /** @提及的用户列表 */
  readonly mentions?: ReadonlyArray<string>;
}

/**
 * 意图识别结果
 * @readonly - 识别结果不可变
 */
export interface Intent {
  /** 意图类型 */
  readonly type: IntentType;
  /** 置信度 0-1 */
  readonly confidence: number;
  /** 提取的实体 */
  readonly entities: ReadonlyArray<Entity>;
  /** 引用解析结果 */
  readonly references: ReadonlyArray<Reference>;
  /** 解析后的文本 */
  readonly resolvedText?: string;
}

/**
 * 实体
 * @readonly - 提取的实体信息
 */
export interface Entity {
  /** 实体类型 */
  readonly type: string;
  /** 实体值 */
  readonly value: string;
  /** 在原文中的起始位置 */
  readonly start: number;
  /** 在原文中的结束位置 */
  readonly end: number;
}

/**
 * 引用
 * @readonly - 解析的引用信息
 */
export interface Reference {
  /** 引用类型 */
  readonly type: string;
  /** 引用目标 */
  readonly target: string;
  /** 解析置信度 */
  readonly confidence: number;
}

// TaskSubmission 统一从 task-router/types 导出
export type { TaskSubmission } from '../task-router/types.js';

/**
 * 任务决策
 * @readonly - 决策结果不可变
 */
export interface TaskDecision {
  /** 执行模式 */
  readonly mode: ExecutionMode;
  /** 决策置信度 */
  readonly confidence: number;
  /** 决策原因 */
  readonly reason: string;
  /** 任务分析详情 */
  readonly analysis: TaskAnalysis;
}

/**
 * 任务分析
 * @readonly - 分析结果不可变
 */
export interface TaskAnalysis {
  /** 复杂度评分 0-100 */
  readonly complexity: number;
  /** 预估执行时间（分钟） */
  readonly estimatedTime: number;
  /** 是否需要用户确认 */
  readonly requiresConfirmation: boolean;
  /** 风险等级 */
  readonly riskLevel: 'low' | 'medium' | 'high';
  /** 关键词列表 */
  readonly keywords: ReadonlyArray<string>;
}

/**
 * 长任务
 * @readonly - 任务状态通过更新函数管理，接口保持不可变
 */
export interface LongTask {
  /** 任务唯一标识符 */
  readonly id: string;
  /** 当前状态 */
  readonly status: LongTaskStatus;
  /** 任务提示词 */
  readonly prompt: string;
  /** 进度日志 */
  readonly progressLogs: ReadonlyArray<ProgressInfo>;
  /** 执行结果 */
  readonly result?: string;
  /** 错误信息 */
  readonly error?: string;
  /** 创建时间戳 */
  readonly createdAt: number;
  /** 开始时间戳 */
  readonly startedAt?: number;
  /** 完成时间戳 */
  readonly completedAt?: number;
}

/**
 * 进度信息
 * @readonly - 进度记录不可变
 */
export interface ProgressInfo {
  /** 时间戳 */
  readonly timestamp: number;
  /** 进度消息 */
  readonly message: string;
  /** 完成百分比 0-100 */
  readonly percent?: number;
}

/**
 * 结果类型（传统版本）
 * @deprecated 请使用 ModernResult<T,E> 替代
 */
export interface Result<T, E = Error> {
  /** 是否成功 */
  success: boolean;
  /** 成功时返回的数据 */
  data?: T;
  /** 失败时的错误 */
  error?: E;
}

/**
 * 记忆
 * @readonly - 事实列表通过专用函数更新
 */
export interface Memory {
  /** 事实列表 */
  readonly facts: ReadonlyArray<{
    readonly id: string;
    readonly content: string;
    readonly importance: number;
    readonly createdAt: number;
    readonly category?: string;
  }>;
}


// ============================================
// Modern Result Type (Phase 1 Refactoring)
// ============================================
export {
  type Result as ModernResult,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  unwrapOr,
  unwrapOrElse,
  tryCatch,
  all,
  partition,
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from './result.js';
