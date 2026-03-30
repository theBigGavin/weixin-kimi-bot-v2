/**
 * 长任务类型定义
 */

import { LongTask, LongTaskStatus, ProgressInfo, createLongTaskId } from '../task-router/types.js';

export {
  LongTask,
  LongTaskStatus,
  ProgressInfo,
  createLongTaskId,
};

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
