/**
 * 上下文类型定义
 * 
 * 定义对话状态、意图、引用等上下文相关的类型
 */

import { Entity, Reference } from '../types/index.js';

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
  GREETING = 'greeting',
  UNKNOWN = 'unknown',
}

// ============================================
// 引用类型枚举
// ============================================
export enum ReferenceType {
  OPTION_INDEX = 'option_index',
  OPTION_LABEL = 'option_label',
  OPTION_ANAPHORA = 'option_anaphora',
  TEMPORAL_ANAPHORA = 'temporal_anaphora',
  TASK_REFERENCE = 'task_reference',
  TOPIC_REFERENCE = 'topic_reference',
}

// ============================================
// ID 生成函数
// ============================================

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createContextId(): string {
  return `ctx_${generateRandomString(12)}`;
}

export function createOptionId(): string {
  return `opt_${generateRandomString(12)}`;
}

export function createMessageId(): string {
  return `msg_${generateRandomString(12)}`;
}

// ============================================
// 接口定义
// ============================================

/**
 * 状态上下文
 */
export interface StateContext {
  current: ConversationState;
  previous: ConversationState | null;
  topic: string;
  pendingDecision: {
    type: string;
    options: string[];
    prompt: string;
  } | null;
}

/**
 * 意图
 */
export interface Intent {
  type: IntentType;
  confidence: number;
  entities: Entity[];
  references: Reference[];
  rawText: string;
  resolvedText?: string;
}

/**
 * 解析的引用
 */
export interface ResolvedReference {
  type: ReferenceType;
  target: string;
  confidence: number;
  originalText: string;
}

/**
 * 上下文消息
 */
export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  intent?: Intent;
  state?: ConversationState;
}

/**
 * 选项
 */
export interface Option {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 会话上下文
 */
export interface SessionContext {
  id: string;
  userId: string;
  agentId: string;
  state: StateContext;
  messages: ContextMessage[];
  activeOptions: Record<string, Option>;
  topicStack: string[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建状态上下文
 * @param initialState 初始状态
 * @param topic 主题
 * @returns StateContext
 */
export function createStateContext(
  initialState: ConversationState = ConversationState.IDLE,
  topic: string = ''
): StateContext {
  return {
    current: initialState,
    previous: null,
    topic,
    pendingDecision: null,
  };
}

/**
 * 创建意图
 * @param type 意图类型
 * @param confidence 置信度
 * @param entities 实体
 * @param references 引用
 * @param rawText 原始文本
 * @returns Intent
 */
export function createIntent(
  type: IntentType,
  confidence: number = 1.0,
  entities: Entity[] = [],
  references: Reference[] = [],
  rawText: string = ''
): Intent {
  return {
    type,
    confidence,
    entities,
    references,
    rawText,
  };
}

/**
 * 创建会话上下文
 * @param userId 用户ID
 * @param agentId Agent ID
 * @param contextId 上下文ID（可选）
 * @returns SessionContext
 */
export function createSessionContext(
  userId: string,
  agentId: string,
  contextId?: string
): SessionContext {
  const now = Date.now();
  return {
    id: contextId || createContextId(),
    userId,
    agentId,
    state: createStateContext(),
    messages: [],
    activeOptions: {},
    topicStack: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建选项
 * @param label 标签
 * @param description 描述
 * @param metadata 元数据
 * @returns Option
 */
export function createOption(
  label: string,
  description?: string,
  metadata?: Record<string, unknown>
): Option {
  return {
    id: createOptionId(),
    label,
    description,
    metadata,
  };
}

/**
 * 创建上下文消息
 * @param role 角色
 * @param content 内容
 * @param intent 意图
 * @returns ContextMessage
 */
export function createContextMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  intent?: Intent
): ContextMessage {
  return {
    id: createMessageId(),
    role,
    content,
    timestamp: Date.now(),
    intent,
  };
}

// ============================================
// 类型守卫
// ============================================

/**
 * 检查是否为有效的对话状态
 * @param state 状态值
 * @returns 是否有效
 */
export function isValidConversationState(state: string): state is ConversationState {
  return Object.values(ConversationState).includes(state as ConversationState);
}

/**
 * 检查是否为有效的意图类型
 * @param type 类型值
 * @returns 是否有效
 */
export function isValidIntentType(type: string): type is IntentType {
  return Object.values(IntentType).includes(type as IntentType);
}
