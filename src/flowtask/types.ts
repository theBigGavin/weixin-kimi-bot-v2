/**
 * 流程任务类型定义
 */

// ============================================
// 流程任务状态
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
// 流程步骤
// ============================================
export interface FlowStep {
  id: string;
  order: number;
  description: string;
  requiresConfirmation: boolean;
  estimatedDuration: number;
}

// ============================================
// 步骤执行结果
// ============================================
export interface FlowStepResult {
  stepId: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  completedAt?: number;
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

// ============================================
// ID 生成
// ============================================
export function createFlowTaskId(): string {
  return `ft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// 创建流程步骤
// ============================================
export function createFlowStep(
  order: number,
  description: string,
  requiresConfirmation: boolean = false,
  estimatedDuration: number = 60000
): FlowStep {
  return {
    id: `step_${Date.now()}_${order}`,
    order,
    description,
    requiresConfirmation,
    estimatedDuration,
  };
}

// ============================================
// 创建流程任务
// ============================================
export function createFlowTask(submissionId: string, plan: FlowStep[]): FlowTask {
  const now = Date.now();
  return {
    id: createFlowTaskId(),
    submissionId,
    status: FlowTaskStatus.PENDING,
    plan,
    currentStep: 0,
    results: [],
    createdAt: now,
  };
}
