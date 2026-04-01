/**
 * 任务路由类型定义
 * 
 * 定义任务提交、分析和决策相关的类型
 */

import { createTaskId } from '../types/index.js';

// ============================================
// 执行模式枚举
// ============================================
export enum ExecutionMode {
  DIRECT = 'direct',       // 直接执行，同步返回
  LONGTASK = 'longtask',   // 长任务，后台异步执行
  FLOWTASK = 'flowtask',   // 流程任务，结构化多步骤
}

// ============================================
// 任务优先级枚举
// ============================================
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ============================================
// 任务复杂度枚举
// ============================================
export enum TaskComplexity {
  SIMPLE = 0,           // 简单：< 5分钟
  MODERATE = 1,         // 中等：5-15分钟
  COMPLEX = 2,          // 复杂：15-60分钟
  VERY_COMPLEX = 3,     // 非常复杂：> 60分钟
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

export function createLongTaskId(): string {
  return `lt_${generateRandomString(12)}`;
}

export function createFlowTaskId(): string {
  return `ft_${generateRandomString(12)}`;
}

// ============================================
// 任务提交
// ============================================
export interface TaskSubmission {
  id: string;
  prompt: string;
  userId: string;
  contextId: string;
  agentId?: string;
  model?: string;
  systemPrompt?: string;
  cwd?: string;
  priority: TaskPriority;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskSubmissionParams {
  prompt: string;
  userId: string;
  contextId: string;
  agentId?: string;
  model?: string;
  systemPrompt?: string;
  cwd?: string;
  priority?: TaskPriority;
  metadata?: Record<string, unknown>;
}

export function createTaskSubmission(params: CreateTaskSubmissionParams): TaskSubmission {
  return {
    id: createTaskId(),
    prompt: params.prompt,
    userId: params.userId,
    contextId: params.contextId,
    agentId: params.agentId,
    model: params.model,
    systemPrompt: params.systemPrompt,
    cwd: params.cwd,
    priority: params.priority || TaskPriority.NORMAL,
    createdAt: Date.now(),
    metadata: params.metadata,
  };
}

// ============================================
// 任务分析
// ============================================
export interface TaskAnalysis {
  complexity: TaskComplexity;
  estimatedDuration: number;      // 预估耗时（毫秒）
  requiresConfirmation: boolean;  // 是否需要确认
  riskLevel: 'low' | 'medium' | 'high';
  keywords: string[];
  features: {
    hasFileOperations: boolean;
    hasCodeExecution: boolean;
    hasExternalCalls: boolean;
    isRefactoring: boolean;
    isBatchProcessing: boolean;
  };
}

export interface CreateTaskAnalysisParams {
  complexity?: TaskComplexity;
  estimatedDuration?: number;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  keywords?: string[];
  features?: Partial<TaskAnalysis['features']>;
}

export function createTaskAnalysis(params: CreateTaskAnalysisParams): TaskAnalysis {
  const complexity = params.complexity || TaskComplexity.SIMPLE;
  
  // 根据复杂度设置默认预估时长
  const defaultDuration: Record<TaskComplexity, number> = {
    [TaskComplexity.SIMPLE]: 60 * 1000,        // 1分钟
    [TaskComplexity.MODERATE]: 10 * 60 * 1000, // 10分钟
    [TaskComplexity.COMPLEX]: 30 * 60 * 1000,  // 30分钟
    [TaskComplexity.VERY_COMPLEX]: 60 * 60 * 1000, // 1小时
  };

  // 根据复杂度确定风险等级
  const defaultRiskLevel: Record<TaskComplexity, TaskAnalysis['riskLevel']> = {
    [TaskComplexity.SIMPLE]: 'low',
    [TaskComplexity.MODERATE]: 'low',
    [TaskComplexity.COMPLEX]: 'medium',
    [TaskComplexity.VERY_COMPLEX]: 'high',
  };

  return {
    complexity,
    estimatedDuration: params.estimatedDuration || defaultDuration[complexity],
    requiresConfirmation: params.requiresConfirmation || complexity === TaskComplexity.VERY_COMPLEX,
    riskLevel: params.riskLevel || defaultRiskLevel[complexity],
    keywords: params.keywords || [],
    features: {
      hasFileOperations: params.features?.hasFileOperations || false,
      hasCodeExecution: params.features?.hasCodeExecution || false,
      hasExternalCalls: params.features?.hasExternalCalls || false,
      isRefactoring: params.features?.isRefactoring || false,
      isBatchProcessing: params.features?.isBatchProcessing || false,
    },
  };
}

// ============================================
// 任务决策
// ============================================
export interface TaskDecision {
  mode: ExecutionMode;
  confidence: number;
  reason: string;
  analysis?: TaskAnalysis;
  suggestedModel?: string;
}

export interface CreateTaskDecisionParams {
  mode: ExecutionMode;
  confidence: number;
  reason?: string;
  analysis?: TaskAnalysis;
  suggestedModel?: string;
}

export function createTaskDecision(params: CreateTaskDecisionParams): TaskDecision {
  const reasons: Record<ExecutionMode, string> = {
    [ExecutionMode.DIRECT]: '任务简单，可以直接执行',
    [ExecutionMode.LONGTASK]: '任务耗时较长，需要后台执行',
    [ExecutionMode.FLOWTASK]: '任务复杂，需要分步骤确认执行',
  };

  return {
    mode: params.mode,
    confidence: params.confidence,
    reason: params.reason || reasons[params.mode],
    analysis: params.analysis,
    suggestedModel: params.suggestedModel,
  };
}

// ============================================
// 长任务
// ============================================
export interface LongTask {
  id: string;
  submissionId: string;
  status: LongTaskStatus;
  prompt: string;
  result?: string;
  error?: string;
  progress: number;
  progressLogs: ProgressInfo[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface ProgressInfo {
  timestamp: number;
  message: string;
  percent?: number;
}

// ============================================
// 流程任务
// ============================================
export interface FlowTask {
  id: string;
  submissionId: string;
  status: FlowTaskStatus;
  plan: FlowStep[];
  currentStep: number;
  results: FlowStepResult[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface FlowStep {
  id: string;
  order: number;
  description: string;
  requiresConfirmation: boolean;
  estimatedDuration: number;
}

export interface FlowStepResult {
  stepId: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  completedAt?: number;
}

// ============================================
// 任务路由器配置
// ============================================
export interface TaskRouterConfig {
  thresholds: {
    directMaxDuration: number;      // 直接执行的最大时长（毫秒）
    directMaxComplexity: TaskComplexity;
    longTaskMaxComplexity: TaskComplexity;
  };
  models: {
    direct: string;
    longtask: string;
    flowtask: string;
  };
}

export const DEFAULT_ROUTER_CONFIG: TaskRouterConfig = {
  thresholds: {
    directMaxDuration: 5 * 60 * 1000,  // 5分钟
    directMaxComplexity: TaskComplexity.MODERATE,
    longTaskMaxComplexity: TaskComplexity.COMPLEX,
  },
  models: {
    direct: 'kimi',
    longtask: 'kimi-code',
    flowtask: 'kimi-code',
  },
};
