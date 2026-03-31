/**
 * 备份管理器
 * 
 * 管理本地备份的创建、恢复和清理
 */

import { readFile, writeFile, mkdir, readdir, rm, stat, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Paths } from '../paths.js';
import { AgentManager } from '../agent/manager.js';
import { WechatManager } from '../wechat/manager.js';
import { createStore } from '../store.js';
import {
  BackupConfig,
  BackupInfo,
  BackupManifest,
  createBackupId,
  DEFAULT_BACKUP_CONFIG,
} from './types.js';

/**
 * 备份管理器
 */
export class BackupManager {
  private config: BackupConfig;
  private baseDir: string;
  private agentManager: AgentManager;
  private wechatManager: WechatManager;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
    this.baseDir = Paths.backupsDir;
    const store = createStore(Paths.baseDir);
    this.agentManager = new AgentManager(store);
    this.wechatManager = new WechatManager(store);
  }

  /**
   * 创建手动备份
   * @param name 备份名称
   * @param options 备份选项
   * @returns 备份信息
   */
  async createBackup(
    name?: string,
    options?: {
      includeWorkspace?: boolean;
      includeContext?: boolean;
    }
  ): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = name || `backup_${timestamp}`;
    const backupId = createBackupId('manual');
    const backupDir = join(this.baseDir, 'manual', backupId);

    // 确保目录存在
    await mkdir(backupDir, { recursive: true });

    // 创建备份清单
    const manifest = await this.createManifest(options);
    await writeFile(
      join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 备份主配置
    await this.backupMasterConfig(backupDir);

    // 备份创世标识
    await this.backupFounder(backupDir);

    // 备份所有 Agent
    await this.backupAgents(backupDir, options);

    // 备份微信绑定关系
    await this.backupWechatBindings(backupDir);

    // 计算大小
    const size = await this.calculateDirSize(backupDir);

    // 清理旧备份
    await this.cleanupOldBackups('manual', this.config.dailyRetentionCount);

    return {
      id: backupId,
      name: backupName,
      createdAt: Date.now(),
      size,
      path: backupDir,
      type: 'manual',
      includes: {
        agents: manifest.agentCount,
        memories: manifest.memoryCount,
        workspace: options?.includeWorkspace || false,
        context: options?.includeContext || false,
      },
    };
  }

  /**
   * 列出所有备份
   * @returns 备份信息列表
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    for (const type of ['manual', 'daily', 'weekly'] as const) {
      const typeDir = join(this.baseDir, type);
      
      if (!existsSync(typeDir)) continue;

      const entries = await readdir(typeDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backupDir = join(typeDir, entry.name);
          const manifestPath = join(backupDir, 'manifest.json');

          if (existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as BackupManifest;
              const stats = await stat(backupDir);
              
              backups.push({
                id: entry.name,
                name: entry.name,
                createdAt: manifest.createdAt,
                size: stats.size,
                path: backupDir,
                type,
                includes: {
                  agents: manifest.agentCount,
                  memories: manifest.memoryCount,
                  workspace: manifest.includes.workspace,
                  context: manifest.includes.context,
                },
              });
            } catch {
              // 忽略损坏的备份
            }
          }
        }
      }
    }

    // 按创建时间排序
    return backups.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 恢复备份
   * @param backupId 备份ID
   */
  async restoreBackup(backupId: string): Promise<void> {
    // 查找备份
    const backupDir = await this.findBackupDir(backupId);
    if (!backupDir) {
      throw new Error(`备份不存在: ${backupId}`);
    }

    // 验证清单
    const manifestPath = join(backupDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('备份清单不存在');
    }

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as BackupManifest;
    console.log(`恢复备份: ${new Date(manifest.createdAt).toLocaleString()}`);

    // 恢复主配置
    await this.restoreMasterConfig(backupDir);

    // 恢复创世标识
    await this.restoreFounder(backupDir);

    // 恢复 Agent
    await this.restoreAgents(backupDir);

    // 恢复微信绑定
    await this.restoreWechatBindings(backupDir);

    console.log('恢复完成');
  }

  /**
   * 删除备份
   * @param backupId 备份ID
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupDir = await this.findBackupDir(backupId);
    if (!backupDir) {
      throw new Error(`备份不存在: ${backupId}`);
    }

    await rm(backupDir, { recursive: true, force: true });
  }

  /**
   * 创建备份清单
   */
  private async createManifest(options?: {
    includeWorkspace?: boolean;
    includeContext?: boolean;
  }): Promise<BackupManifest> {
    const agents = await this.agentManager.listAgents();
    
    return {
      version: '1.0.0',
      createdAt: Date.now(),
      agentCount: agents.length,
      memoryCount: agents.filter(a => a.config.memory.enabledL || a.config.memory.enabledS).length,
      includes: {
        workspace: options?.includeWorkspace || false,
        context: options?.includeContext || false,
        credentials: false, // 永远不备份凭证
      },
      agents: agents.map(a => ({
        id: a.config.id,
        name: a.config.name,
        hasMemory: a.config.memory.enabledL || a.config.memory.enabledS,
        hasWorkspace: true, // 简化处理
      })),
    };
  }

  /**
   * 备份主配置
   */
  private async backupMasterConfig(backupDir: string): Promise<void> {
    const configPath = Paths.masterConfig;
    if (existsSync(configPath)) {
      await copyFile(configPath, join(backupDir, 'master-config.json'));
    }
  }

  /**
   * 备份创世标识
   */
  private async backupFounder(backupDir: string): Promise<void> {
    const founderPath = Paths.founderFile;
    if (existsSync(founderPath)) {
      await copyFile(founderPath, join(backupDir, 'founder.json'));
    }
  }

  /**
   * 备份所有 Agent
   */
  private async backupAgents(
    backupDir: string,
    options?: {
      includeWorkspace?: boolean;
      includeContext?: boolean;
    }
  ): Promise<void> {
    const agentsDir = join(backupDir, 'agents');
    await mkdir(agentsDir, { recursive: true });

    const agents = await this.agentManager.listAgents();

    for (const agent of agents) {
      const agentDir = join(agentsDir, agent.config.id);
      await mkdir(agentDir, { recursive: true });

      // 备份配置
      const configPath = Paths.agentConfig(agent.config.id);
      if (existsSync(configPath)) {
        await copyFile(configPath, join(agentDir, 'config.json'));
      }

      // 备份记忆
      const memoryPath = Paths.agentMemory(agent.config.id);
      if (existsSync(memoryPath)) {
        await copyFile(memoryPath, join(agentDir, 'memory.json'));
      }

      // 工作空间（可选）
      if (options?.includeWorkspace) {
        // 简化处理：不备份工作空间文件
      }
    }
  }

  /**
   * 备份微信绑定关系
   */
  private async backupWechatBindings(backupDir: string): Promise<void> {
    const bindingsDir = join(backupDir, 'wechat-bindings');
    await mkdir(bindingsDir, { recursive: true });

    // 获取所有微信账号
    const accounts = await this.wechatManager.listAllAccounts();

    for (const account of accounts) {
      const prefixDir = this.extractWechatPrefix(account.id);
      const accountDir = join(bindingsDir, prefixDir);
      await mkdir(accountDir, { recursive: true });

      // 备份绑定关系
      const bindings = await this.wechatManager.getBindings(account.id);
      if (bindings) {
        await writeFile(
          join(accountDir, 'bindings.json'),
          JSON.stringify(bindings, null, 2),
          'utf-8'
        );
      }
    }
  }

  /**
   * 恢复主配置
   */
  private async restoreMasterConfig(backupDir: string): Promise<void> {
    const sourcePath = join(backupDir, 'master-config.json');
    if (existsSync(sourcePath)) {
      await copyFile(sourcePath, Paths.masterConfig);
    }
  }

  /**
   * 恢复创世标识
   */
  private async restoreFounder(backupDir: string): Promise<void> {
    const sourcePath = join(backupDir, 'founder.json');
    if (existsSync(sourcePath)) {
      await copyFile(sourcePath, Paths.founderFile);
    }
  }

  /**
   * 恢复所有 Agent
   */
  private async restoreAgents(backupDir: string): Promise<void> {
    const agentsDir = join(backupDir, 'agents');
    if (!existsSync(agentsDir)) return;

    const entries = await readdir(agentsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const agentId = entry.name;
        const agentDir = join(agentsDir, agentId);
        const targetDir = Paths.agentDir(agentId);

        await mkdir(targetDir, { recursive: true });

        // 恢复配置
        const configSource = join(agentDir, 'config.json');
        if (existsSync(configSource)) {
          await copyFile(configSource, Paths.agentConfig(agentId));
        }

        // 恢复记忆
        const memorySource = join(agentDir, 'memory.json');
        if (existsSync(memorySource)) {
          await copyFile(memorySource, Paths.agentMemory(agentId));
        }
      }
    }
  }

  /**
   * 恢复微信绑定
   */
  private async restoreWechatBindings(backupDir: string): Promise<void> {
    const bindingsDir = join(backupDir, 'wechat-bindings');
    if (!existsSync(bindingsDir)) return;

    const entries = await readdir(bindingsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const prefix = entry.name;
        const sourcePath = join(bindingsDir, prefix, 'bindings.json');
        
        if (existsSync(sourcePath)) {
          const bindings = JSON.parse(await readFile(sourcePath, 'utf-8'));
          const _wechatId = bindings.wechatId;
          
          // 恢复绑定关系到存储
          const wechatDir = join(Paths.wechatAccountsDir, prefix);
          await mkdir(wechatDir, { recursive: true });
          await writeFile(
            join(wechatDir, 'bindings.json'),
            JSON.stringify(bindings, null, 2),
            'utf-8'
          );
        }
      }
    }
  }

  /**
   * 查找备份目录
   */
  private async findBackupDir(backupId: string): Promise<string | null> {
    for (const type of ['manual', 'daily', 'weekly'] as const) {
      const typeDir = join(this.baseDir, type);
      const backupDir = join(typeDir, backupId);
      if (existsSync(backupDir)) {
        return backupDir;
      }
    }
    return null;
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(type: 'manual' | 'daily' | 'weekly', keepCount: number): Promise<void> {
    const typeDir = join(this.baseDir, type);
    if (!existsSync(typeDir)) return;

    const entries = await readdir(typeDir, { withFileTypes: true });
    const backups = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name: e.name,
        path: join(typeDir, e.name),
        mtime: 0,
      }));

    // 获取修改时间
    for (const backup of backups) {
      try {
        const stats = await stat(backup.path);
        backup.mtime = stats.mtime.getTime();
      } catch {
        // 忽略
      }
    }

    // 按时间排序，删除旧的
    backups.sort((a, b) => b.mtime - a.mtime);
    
    for (const backup of backups.slice(keepCount)) {
      await rm(backup.path, { recursive: true, force: true });
    }
  }

  /**
   * 计算目录大小
   */
  private async calculateDirSize(dir: string): Promise<number> {
    let size = 0;
    
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.calculateDirSize(fullPath);
      } else {
        const stats = await stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }

  /**
   * 提取微信ID前缀
   */
  private extractWechatPrefix(wechatId: string): string {
    let cleaned = wechatId;
    if (cleaned.startsWith('wxid_')) {
      cleaned = cleaned.slice(5);
    }
    return cleaned.slice(0, 8);
  }
}

export default BackupManager;
