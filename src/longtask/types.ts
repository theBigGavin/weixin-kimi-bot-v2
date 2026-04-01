/**
 * 长任务类型定义
 */

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
// 进度信息
// ============================================
export interface ProgressInfo {
  timestamp: number;
  message: string;
  percent?: number;
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
  /** Agent workspace path for isolation */
  workspacePath: string;
  /** User context for notification */
  userId: string;
  agentId: string;
  contextToken: string;
}

// ============================================
// ID 生成
// ============================================
export function createLongTaskId(): string {
  return `lt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// 配置
// ============================================
export interface LongTaskConfig {
  maxConcurrent: number;
  pollInterval: number;
  timeout: number;
}

export const DEFAULT_LONGTASK_CONFIG: LongTaskConfig = {
  maxConcurrent: 3,
  pollInterval: 5000,
  timeout: 30 * 60 * 1000, // 30分钟
};
