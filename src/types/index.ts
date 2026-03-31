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
 */
export interface AgentConfig {
  id: string;
  name: string;
  createdAt: number;
  wechat: {
    accountId: string;
    nickname?: string;
  };
  workspace: {
    path: string;
    createdAt: number;
  };
  ai: {
    model: string;
    templateId: string;
    customSystemPrompt?: string;
    maxTurns: number;
    temperature?: number;
  };
  memory: {
    enabledL: boolean;
    enabledS: boolean;
    maxItems: number;
    autoExtract: boolean;
  };
  features: {
    scheduledTasks: boolean;
    notifications: boolean;
    fileAccess: boolean;
    shellExec: boolean;
    webSearch: boolean;
  };
  // Phase III: 共享绑定相关字段
  /** 可见性: private(私有) | shared(共享) | invite_only(邀请制) */
  visibility: 'private' | 'shared' | 'invite_only';
  /** 最大绑定用户数 */
  maxBindings: number;
  /** 当前绑定用户数 */
  currentBindingCount: number;
  /** 允许绑定的微信ID列表（invite_only模式） */
  allowedWechatIds: string[];
  /** 创建者微信ID */
  primaryWechatId: string;
}

/**
 * 能力模板
 */
export interface CapabilityTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  welcomeMessage?: string;
  suggestions?: string[];
  defaults: {
    model: string;
    maxTurns: number;
    temperature: number;
  };
  tools: {
    fileOperations: boolean;
    codeExecution: boolean;
    webSearch: boolean;
    gitOperations: boolean;
  };
  behavior: {
    proactive: boolean;
    verbose: boolean;
    confirmDestructive: boolean;
  };
}

/**
 * 微信消息
 */
export interface WeixinMessage {
  id: string;
  type: MessageType;
  fromUser: string;
  content: string;
  timestamp: number;
  isGroup: boolean;
  groupId?: string;
  mentions?: string[];
}

/**
 * 意图识别结果
 */
export interface Intent {
  type: IntentType;
  confidence: number;
  entities: Entity[];
  references: Reference[];
  resolvedText?: string;
}

/**
 * 实体
 */
export interface Entity {
  type: string;
  value: string;
  start: number;
  end: number;
}

/**
 * 引用
 */
export interface Reference {
  type: string;
  target: string;
  confidence: number;
}

// TaskSubmission 统一从 task-router/types 导出
export type { TaskSubmission } from '../task-router/types.js';

/**
 * 任务决策
 */
export interface TaskDecision {
  mode: ExecutionMode;
  confidence: number;
  reason: string;
  analysis: TaskAnalysis;
}

/**
 * 任务分析
 */
export interface TaskAnalysis {
  complexity: number;
  estimatedTime: number;
  requiresConfirmation: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  keywords: string[];
}

/**
 * 长任务
 */
export interface LongTask {
  id: string;
  status: LongTaskStatus;
  prompt: string;
  progressLogs: ProgressInfo[];
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  timestamp: number;
  message: string;
  percent?: number;
}

/**
 * 结果类型
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/**
 * 记忆
 */
export interface Memory {
  facts: Array<{
    id: string;
    content: string;
    importance: number;
    createdAt: number;
    category?: string;
  }>;
}
