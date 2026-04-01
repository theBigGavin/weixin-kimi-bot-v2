/**
 * 主配置管理模块
 * 
 * 管理系统级别的配置，存储在 ~/.weixin-kimi-bot/master-config.json
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Paths } from '../paths.js';
import { getDefaultLogger } from '../logging/index.js';

/**
 * 系统主配置
 */
export interface MasterConfig {
  /** 配置版本 */
  version: string;
  /** 系统创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 系统设置 */
  settings: SystemSettings;
  /** 备份配置 */
  backup: BackupConfig;
  /** GitHub同步配置 */
  githubSync?: GitHubSyncConfig;
}

/**
 * 系统设置
 */
export interface SystemSettings {
  /** 默认Agent模板 */
  defaultTemplateId: string;
  /** 自动备份 */
  autoBackup: boolean;
  /** 备份间隔（天） */
  backupIntervalDays: number;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** 消息轮询间隔（毫秒） */
  messagePollInterval: number;
}

/**
 * 备份配置
 */
export interface BackupConfig {
  /** 是否启用本地备份 */
  enabled: boolean;
  /** 保留备份数量 */
  keepCount: number;
  /** 备份路径 */
  backupPath?: string;
  /** 最后备份时间 */
  lastBackupAt?: number;
}

/**
 * GitHub同步配置
 */
export interface GitHubSyncConfig {
  /** 是否启用 */
  enabled: boolean;
  /** GitHub Token */
  token?: string;
  /** 仓库名（格式：owner/repo） */
  repository?: string;
  /** 分支 */
  branch: string;
  /** 最后同步时间 */
  lastSyncAt?: number;
}

/** 当前配置版本 */
export const CONFIG_VERSION = '1.0.0';

/** 默认系统设置 */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultTemplateId: 'general',
  autoBackup: true,
  backupIntervalDays: 1,
  logLevel: 'info',
  messagePollInterval: 5000,
};

/** 默认备份配置 */
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  keepCount: 7,
};

/**
 * 创建默认主配置
 * @returns MasterConfig
 */
export function createDefaultMasterConfig(): MasterConfig {
  const now = Date.now();
  return {
    version: CONFIG_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SYSTEM_SETTINGS },
    backup: { ...DEFAULT_BACKUP_CONFIG },
  };
}

/**
 * 加载主配置
 * 如果文件不存在，创建默认配置
 * @returns MasterConfig
 */
export async function loadMasterConfig(): Promise<MasterConfig> {
  const configPath = Paths.masterConfig;
  
  if (!existsSync(configPath)) {
    const defaultConfig = createDefaultMasterConfig();
    await saveMasterConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as MasterConfig;
    
    // 合并默认配置（处理新增字段）
    return mergeWithDefaults(config);
  } catch (error) {
    // 如果配置文件损坏，返回默认配置
    getDefaultLogger().warn('配置文件损坏，使用默认配置:', error);
    return createDefaultMasterConfig();
  }
}

/**
 * 保存主配置
 * @param config 配置对象
 */
export async function saveMasterConfig(config: MasterConfig): Promise<void> {
  const configPath = Paths.masterConfig;
  config.updatedAt = Date.now();
  
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 更新系统设置
 * @param updates 部分设置更新
 */
export async function updateSystemSettings(
  updates: Partial<SystemSettings>
): Promise<MasterConfig> {
  const config = await loadMasterConfig();
  config.settings = { ...config.settings, ...updates };
  await saveMasterConfig(config);
  return config;
}

/**
 * 更新备份配置
 * @param updates 部分备份配置更新
 */
export async function updateBackupConfig(
  updates: Partial<BackupConfig>
): Promise<MasterConfig> {
  const config = await loadMasterConfig();
  config.backup = { ...config.backup, ...updates };
  await saveMasterConfig(config);
  return config;
}

/**
 * 更新GitHub同步配置
 * @param updates 部分GitHub配置更新
 */
export async function updateGitHubSyncConfig(
  updates: Partial<GitHubSyncConfig>
): Promise<MasterConfig> {
  const config = await loadMasterConfig();
  config.githubSync = { ...config.githubSync, ...updates } as GitHubSyncConfig;
  await saveMasterConfig(config);
  return config;
}

/**
 * 将现有配置与默认配置合并
 * @param config 现有配置
 * @returns 合并后的配置
 */
function mergeWithDefaults(config: Partial<MasterConfig>): MasterConfig {
  const defaults = createDefaultMasterConfig();
  
  return {
    version: config.version || defaults.version,
    createdAt: config.createdAt || defaults.createdAt,
    updatedAt: config.updatedAt || defaults.updatedAt,
    settings: { ...defaults.settings, ...config.settings },
    backup: { ...defaults.backup, ...config.backup },
    githubSync: config.githubSync,
  };
}
