/**
 * 备份模块类型定义
 */

/**
 * 备份配置
 */
export interface BackupConfig {
  /** 是否启用自动备份 */
  enabled: boolean;
  /** 每日备份时间 (HH:MM) */
  dailyBackupTime: string;
  /** 保留的每日备份数量 */
  dailyRetentionCount: number;
  /** 保留的每周备份数量 */
  weeklyRetentionCount: number;
  /** 是否包含工作空间文件 */
  includeWorkspace: boolean;
  /** 是否包含会话上下文 */
  includeContext: boolean;
}

/**
 * GitHub 同步配置
 */
export interface GitHubSyncConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 仓库地址 (格式: owner/repo) */
  repository: string;
  /** 分支 */
  branch: string;
  /** 访问令牌 */
  token: string;
  /** 同步间隔 (毫秒) */
  syncInterval: number;
  /** 最后同步时间 */
  lastSyncAt?: number;
}

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份ID */
  id: string;
  /** 备份名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  /** 大小 (字节) */
  size: number;
  /** 路径 */
  path: string;
  /** 类型 */
  type: 'daily' | 'weekly' | 'manual';
  /** 包含的内容 */
  includes: {
    agents: number;
    memories: number;
    workspace: boolean;
    context: boolean;
  };
}

/**
 * 备份清单
 */
export interface BackupManifest {
  /** 备份版本 */
  version: string;
  /** 创建时间 */
  createdAt: number;
  /** Agent 数量 */
  agentCount: number;
  /** 记忆数量 */
  memoryCount: number;
  /** 包含的内容 */
  includes: {
    workspace: boolean;
    context: boolean;
    credentials: boolean;
  };
  /** Agent 列表 */
  agents: Array<{
    id: string;
    name: string;
    hasMemory: boolean;
    hasWorkspace: boolean;
  }>;
}

/**
 * GitHub 同步结果
 */
export interface GitHubSyncResult {
  /** 是否成功 */
  success: boolean;
  /** 是否有变更 */
  changed: boolean;
  /** 消息 */
  message: string;
  /** 提交哈希 */
  commitHash?: string;
}

/**
 * 默认备份配置
 */
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  dailyBackupTime: '02:00',
  dailyRetentionCount: 7,
  weeklyRetentionCount: 4,
  includeWorkspace: false,
  includeContext: false,
};

/**
 * 创建备份ID
 * @param type 备份类型
 * @returns 备份ID
 */
export function createBackupId(type: 'daily' | 'weekly' | 'manual'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${type}_${timestamp}`;
}

/**
 * 格式化字节大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
