/**
 * 路径常量模块
 * 
 * 统一管理所有数据目录路径，确保数据隔离和一致性
 * 
 * 目录结构：
 * ~/.weixin-kimi-bot/
 * ├── master-config.json              # 主配置
 * ├── founder.json                    # 创世Agent标识
 * ├── github-sync.json                # GitHub同步配置
 * ├── agents/{agent_id}/              # Agent数据 (M)
 * │   ├── config.json
 * │   ├── memory.json
 * │   ├── context/
 * │   └── workspace/
 * ├── wechat-accounts/{prefix}/       # 微信账号 (N)
 * │   ├── credentials.json
 * │   └── bindings.json
 * ├── backups/{timestamp}/            # 备份
 * └── logs/                           # 日志文件
 *     ├── app-YYYY-MM-DD.log          # 应用日志（按日期滚动）
 *     └── app-YYYY-MM-DD.error.log    # 错误日志
 */

import { join } from 'path';
import { homedir } from 'os';

// 默认基础目录
const DEFAULT_BASE_DIR = join(homedir(), '.weixin-kimi-bot');

// 当前基础目录（可修改）
let currentBaseDir = DEFAULT_BASE_DIR;

/**
 * 设置基础目录（主要用于测试）
 * @param dir 新的基础目录
 */
export function setBaseDir(dir: string): void {
  currentBaseDir = dir;
}

/**
 * 获取当前基础目录
 * @returns 基础目录路径
 */
export function getBaseDir(): string {
  return currentBaseDir;
}

/**
 * 重置为基础目录（主要用于测试清理）
 */
export function resetBaseDir(): void {
  currentBaseDir = DEFAULT_BASE_DIR;
}

/**
 * 提取微信ID前缀（用于目录名）
 * @param wechatId 微信ID
 * @returns 前8位（不含wxid_前缀）
 */
function extractWechatDirPrefix(wechatId: string): string {
  let cleaned = wechatId;
  if (cleaned.startsWith('wxid_')) {
    cleaned = cleaned.slice(5);
  }
  return cleaned.slice(0, 8);
}

/**
 * 路径常量对象
 */
export const Paths = {
  // ===== 基础目录 =====
  
  /** 基础数据目录 */
  get baseDir(): string {
    return currentBaseDir;
  },

  /** Agent 数据目录 */
  get agentsDir(): string {
    return join(currentBaseDir, 'agents');
  },

  /** 微信账号目录 */
  get wechatAccountsDir(): string {
    return join(currentBaseDir, 'wechat-accounts');
  },

  /** 备份目录 */
  get backupsDir(): string {
    return join(currentBaseDir, 'backups');
  },

  /** 日志目录 */
  get logsDir(): string {
    return join(currentBaseDir, 'logs');
  },

  // ===== 系统文件 =====

  /** 主配置文件 */
  get masterConfig(): string {
    return join(currentBaseDir, 'master-config.json');
  },

  /** 创世Agent标识文件 */
  get founderFile(): string {
    return join(currentBaseDir, 'founder.json');
  },

  /** GitHub同步配置 */
  get githubSyncConfig(): string {
    return join(currentBaseDir, 'github-sync.json');
  },

  // ===== Agent 路径方法 =====

  /**
   * Agent 目录
   * @param agentId Agent ID
   * @returns Agent 目录路径
   */
  agentDir(agentId: string): string {
    return join(currentBaseDir, 'agents', agentId);
  },

  /**
   * Agent 配置文件
   * @param agentId Agent ID
   * @returns 配置文件路径
   */
  agentConfig(agentId: string): string {
    return join(currentBaseDir, 'agents', agentId, 'config.json');
  },

  /**
   * Agent 记忆文件
   * @param agentId Agent ID
   * @returns 记忆文件路径
   */
  agentMemory(agentId: string): string {
    return join(currentBaseDir, 'agents', agentId, 'memory.json');
  },

  /**
   * Agent 上下文目录
   * @param agentId Agent ID
   * @returns 上下文目录路径
   */
  agentContextDir(agentId: string): string {
    return join(currentBaseDir, 'agents', agentId, 'context');
  },

  /**
   * Agent 工作空间
   * @param agentId Agent ID
   * @returns 工作空间路径
   */
  agentWorkspace(agentId: string): string {
    return join(currentBaseDir, 'agents', agentId, 'workspace');
  },

  // ===== 微信账号路径方法 =====

  /**
   * 微信账号目录
   * @param wechatId 微信ID
   * @returns 账号目录路径
   */
  wechatAccountDir(wechatId: string): string {
    const prefix = extractWechatDirPrefix(wechatId);
    return join(currentBaseDir, 'wechat-accounts', prefix);
  },

  /**
   * 微信凭证文件
   * @param wechatId 微信ID
   * @returns 凭证文件路径
   */
  wechatCredentials(wechatId: string): string {
    const prefix = extractWechatDirPrefix(wechatId);
    return join(currentBaseDir, 'wechat-accounts', prefix, 'credentials.json');
  },

  /**
   * 微信绑定配置文件
   * @param wechatId 微信ID
   * @returns 绑定配置文件路径
   */
  wechatBindings(wechatId: string): string {
    const prefix = extractWechatDirPrefix(wechatId);
    return join(currentBaseDir, 'wechat-accounts', prefix, 'bindings.json');
  },

  // ===== 备份路径方法 =====

  /**
   * 备份目录
   * @param timestamp 时间戳（格式：YYYYMMDD_HHMMSS）
   * @returns 备份目录路径
   */
  backupDir(timestamp: string): string {
    return join(currentBaseDir, 'backups', timestamp);
  },
};

// 默认导出
export default Paths;
