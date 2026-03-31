# Agent 配置备份与 GitHub 同步设计

## 1. 概述

### 1.1 设计目标

- **数据安全**：防止意外数据丢失
- **自动备份**：定期自动创建本地备份
- **云端同步**：支持同步到 GitHub 私有仓库
- **灵活恢复**：支持从备份恢复数据

### 1.2 备份范围

| 数据类型 | 是否备份 | 说明 |
|---------|---------|------|
| Agent 配置 | ✅ | config.json |
| Agent 记忆 | ✅ | memory.json |
| 会话上下文 | ⚠️ | 可选，默认不备份 |
| 工作空间文件 | ⚠️ | 可选，默认不备份 |
| 微信凭证 | ❌ | 敏感数据，不备份 |
| 系统配置 | ✅ | master-config.json (不含敏感信息) |

## 2. 备份架构

### 2.1 备份目录结构

```
~/.weixin-kimi-bot/
├── backups/
│   ├── auto/                       # 自动备份
│   │   ├── daily/                  # 每日备份
│   │   │   └── 2026-03-31_00-00-00.tar.gz
│   │   └── weekly/                 # 每周备份
│   │       └── 2026-W13.tar.gz
│   ├── manual/                     # 手动备份
│   │   └── pre-migration_2026-03-31.tar.gz
│   └── github-sync/                # GitHub 同步缓存
│       ├── .git/                   # Git 仓库
│       └── content/                # 实际备份内容
│           ├── agents/
│           ├── wechat-accounts/
│           └── master-config.json
```

### 2.2 备份内容结构

```
backup_2026-03-31_00-00-00/
├── manifest.json                   # 备份清单
├── master-config.json              # 系统主配置
├── founder.json                    # 创世 Agent 标识
├── agents/                         # Agent 配置
│   ├── 小助手_a1b2c3d4_x7k9/
│   │   ├── config.json
│   │   └── memory.json
│   └── 程序员_a1b2c3d4_m2n4/
│       ├── config.json
│       └── memory.json
└── wechat-bindings/                # 微信绑定关系 (不含凭证)
    └── a1b2c3d4/
        └── bindings.json
```

## 3. 备份管理器设计

### 3.1 备份管理器接口

```typescript
// src/backup/manager.ts

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
  /** GitHub 同步配置 */
  githubSync?: GitHubSyncConfig;
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
  /** 访问令牌 (加密存储) */
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
 * 备份管理器
 */
export class BackupManager {
  private config: BackupConfig;
  private backupDir: string;
  private githubSync?: GitHubSyncManager;

  constructor(config: BackupConfig) {
    this.config = config;
    this.backupDir = Paths.backups.base;
    
    if (config.githubSync?.enabled) {
      this.githubSync = new GitHubSyncManager(config.githubSync);
    }
  }

  /**
   * 创建手动备份
   */
  async createBackup(
    name?: string,
    options?: {
      includeWorkspace?: boolean;
      includeContext?: boolean;
    }
  ): Promise<BackupInfo>;

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<BackupInfo[]>;

  /**
   * 恢复备份
   */
  async restoreBackup(backupId: string): Promise<void>;

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<void>;

  /**
   * 启动自动备份调度
   */
  startAutoBackup(): void;

  /**
   * 停止自动备份调度
   */
  stopAutoBackup(): void;

  /**
   * 同步到 GitHub
   */
  async syncToGitHub(): Promise<void>;
}
```

### 3.2 备份实现

```typescript
// src/backup/manager.ts (实现)

import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createTar } from 'tar-stream';
import { glob } from 'glob';

export class BackupManager {
  // ... 构造函数

  /**
   * 创建备份
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
    const backupId = `manual_${Date.now()}`;
    const backupPath = `${Paths.backups.manual}/${backupName}.tar.gz`;

    // 确保目录存在
    await fs.mkdir(Paths.backups.manual, { recursive: true });

    // 创建备份清单
    const manifest = await this.createManifest(options);

    // 创建 tar.gz 归档
    await this.createArchive(backupPath, manifest, options);

    // 获取文件大小
    const stats = await fs.stat(backupPath);

    // 清理旧备份
    await this.cleanupOldBackups();

    return {
      id: backupId,
      name: backupName,
      createdAt: Date.now(),
      size: stats.size,
      path: backupPath,
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
   * 创建备份清单
   */
  private async createManifest(options?: {
    includeWorkspace?: boolean;
    includeContext?: boolean;
  }): Promise<BackupManifest> {
    const agents = await this.getAgentList();
    
    return {
      version: '1.0.0',
      createdAt: Date.now(),
      agentCount: agents.length,
      memoryCount: agents.filter(a => a.hasMemory).length,
      includes: {
        workspace: options?.includeWorkspace || false,
        context: options?.includeContext || false,
        credentials: false, // 永远不备份凭证
      },
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        hasMemory: a.hasMemory,
        hasWorkspace: a.hasWorkspace,
      })),
    };
  }

  /**
   * 创建 tar.gz 归档
   */
  private async createArchive(
    outputPath: string,
    manifest: BackupManifest,
    options?: {
      includeWorkspace?: boolean;
      includeContext?: boolean;
    }
  ): Promise<void> {
    const tar = createTar();
    const gzip = createGzip();
    const output = createWriteStream(outputPath);

    // 添加清单文件
    tar.entry({ name: 'manifest.json' }, JSON.stringify(manifest, null, 2));

    // 添加主配置
    const masterConfig = await fs.readFile(Paths.masterConfig(), 'utf-8');
    tar.entry({ name: 'master-config.json' }, masterConfig);

    // 添加创世 Agent 标识
    try {
      const founder = await fs.readFile(Paths.founder(), 'utf-8');
      tar.entry({ name: 'founder.json' }, founder);
    } catch {
      // 创世 Agent 可能不存在
    }

    // 添加所有 Agent 配置
    for (const agent of manifest.agents) {
      // Agent 配置
      const configPath = Paths.agentConfig(agent.id);
      const config = await fs.readFile(configPath, 'utf-8');
      tar.entry({ name: `agents/${agent.id}/config.json` }, config);

      // Agent 记忆
      if (agent.hasMemory) {
        const memoryPath = Paths.agentMemory(agent.id);
        const memory = await fs.readFile(memoryPath, 'utf-8');
        tar.entry({ name: `agents/${agent.id}/memory.json` }, memory);
      }

      // 工作空间 (可选)
      if (options?.includeWorkspace && agent.hasWorkspace) {
        const workspaceFiles = await glob(`${Paths.agentWorkspace(agent.id)}/**/*`, { nodir: true });
        for (const file of workspaceFiles) {
          const content = await fs.readFile(file);
          const relativePath = file.replace(Paths.agentWorkspace(agent.id), '');
          tar.entry({ name: `agents/${agent.id}/workspace${relativePath}` }, content);
        }
      }
    }

    // 添加微信绑定关系 (不含凭证)
    const wechatBindings = await this.getWechatBindings();
    for (const binding of wechatBindings) {
      tar.entry(
        { name: `wechat-bindings/${binding.wechatId}/bindings.json` },
        JSON.stringify(binding, null, 2)
      );
    }

    tar.finalize();
    await pipeline(tar, gzip, output);
  }
}
```

## 4. GitHub 同步

### 4.1 GitHub 同步管理器

```typescript
// src/backup/github-sync.ts

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GitHubSyncConfig } from './manager.js';

/**
 * GitHub 同步管理器
 * 将备份同步到 GitHub 私有仓库
 */
export class GitHubSyncManager {
  private config: GitHubSyncConfig;
  private syncDir: string;

  constructor(config: GitHubSyncConfig) {
    this.config = config;
    this.syncDir = Paths.backups.githubSync;
  }

  /**
   * 初始化 Git 仓库
   */
  async initialize(): Promise<void> {
    // 创建同步目录
    await mkdir(this.syncDir, { recursive: true });

    // 初始化 Git 仓库
    if (!existsSync(path.join(this.syncDir, '.git'))) {
      this.execGit('init');
      this.execGit('config user.email "weixin-kimi-bot@local"');
      this.execGit('config user.name "Weixin Kimi Bot"');
      
      // 配置远程仓库
      const remoteUrl = `https://${this.config.token}@github.com/${this.config.repository}.git`;
      this.execGit(`remote add origin ${remoteUrl}`);
    }

    // 切换到指定分支
    try {
      this.execGit(`checkout ${this.config.branch}`);
    } catch {
      this.execGit(`checkout -b ${this.config.branch}`);
    }
  }

  /**
   * 同步当前数据到 GitHub
   */
  async sync(): Promise<GitHubSyncResult> {
    await this.initialize();

    // 准备同步内容
    await this.prepareContent();

    // 检查是否有变更
    const status = this.execGit('status --porcelain');
    if (!status.trim()) {
      return {
        success: true,
        changed: false,
        message: 'No changes to sync',
      };
    }

    // 提交变更
    const timestamp = new Date().toISOString();
    this.execGit('add -A');
    this.execGit(`commit -m "Auto sync: ${timestamp}"`);

    // 推送到远程
    this.execGit(`push origin ${this.config.branch}`);

    // 更新最后同步时间
    this.config.lastSyncAt = Date.now();
    await this.saveConfig();

    return {
      success: true,
      changed: true,
      message: `Synced at ${timestamp}`,
      commitHash: this.execGit('rev-parse HEAD').trim(),
    };
  }

  /**
   * 从 GitHub 恢复数据
   */
  async restore(): Promise<void> {
    await this.initialize();

    // 拉取最新数据
    this.execGit('fetch origin');
    this.execGit(`reset --hard origin/${this.config.branch}`);

    // 恢复数据到主目录
    await this.restoreFromSyncDir();
  }

  /**
   * 准备同步内容
   */
  private async prepareContent(): Promise<void> {
    const contentDir = path.join(this.syncDir, 'content');
    await mkdir(contentDir, { recursive: true });

    // 复制 Agent 配置 (不含工作空间)
    const agentsDir = path.join(contentDir, 'agents');
    await mkdir(agentsDir, { recursive: true });

    const agentManager = new AgentManager();
    const agents = await agentManager.listAgents();

    for (const agent of agents) {
      const agentDir = path.join(agentsDir, agent.id);
      await mkdir(agentDir, { recursive: true });

      // 复制配置
      const config = await readFile(Paths.agentConfig(agent.id), 'utf-8');
      await writeFile(path.join(agentDir, 'config.json'), config);

      // 复制记忆
      try {
        const memory = await readFile(Paths.agentMemory(agent.id), 'utf-8');
        await writeFile(path.join(agentDir, 'memory.json'), memory);
      } catch {
        // 记忆可能不存在
      }
    }

    // 复制主配置
    const masterConfig = await readFile(Paths.masterConfig(), 'utf-8');
    await writeFile(path.join(contentDir, 'master-config.json'), masterConfig);

    // 复制创世标识
    try {
      const founder = await readFile(Paths.founder(), 'utf-8');
      await writeFile(path.join(contentDir, 'founder.json'), founder);
    } catch {
      // 创世标识可能不存在
    }

    // 复制绑定关系 (不含凭证)
    const bindingsDir = path.join(contentDir, 'wechat-bindings');
    await mkdir(bindingsDir, { recursive: true });
    // ... 复制绑定关系

    // 创建 README
    const readme = `# Weixin Kimi Bot Backup

Last synced: ${new Date().toISOString()}
Agents: ${agents.length}

**注意**: 此仓库包含敏感配置数据，请保持私有！
`;
    await writeFile(path.join(contentDir, 'README.md'), readme);
  }

  /**
   * 执行 Git 命令
   */
  private execGit(command: string): string {
    return execSync(`git ${command}`, {
      cwd: this.syncDir,
      encoding: 'utf-8',
    });
  }
}
```

### 4.2 GitHub 同步 CLI

```typescript
// src/cli/backup.ts

import { Command } from 'commander';
import { BackupManager } from '../backup/manager.js';
import { MasterConfigManager } from '../config/master-config.js';

const program = new Command();

program
  .name('backup')
  .description('Backup management commands');

// 手动创建备份
program
  .command('create [name]')
  .description('Create a manual backup')
  .option('-w, --workspace', 'Include workspace files')
  .option('-c, --context', 'Include session context')
  .action(async (name, options) => {
    const config = await loadBackupConfig();
    const manager = new BackupManager(config);
    
    const backup = await manager.createBackup(name, {
      includeWorkspace: options.workspace,
      includeContext: options.context,
    });

    console.log('Backup created:');
    console.log(`  ID: ${backup.id}`);
    console.log(`  Name: ${backup.name}`);
    console.log(`  Size: ${formatBytes(backup.size)}`);
    console.log(`  Path: ${backup.path}`);
  });

// 列出备份
program
  .command('list')
  .description('List all backups')
  .action(async () => {
    const config = await loadBackupConfig();
    const manager = new BackupManager(config);
    
    const backups = await manager.listBackups();
    
    console.log('Backups:');
    for (const backup of backups) {
      console.log(`\n  ${backup.name}`);
      console.log(`    Type: ${backup.type}`);
      console.log(`    Created: ${new Date(backup.createdAt).toLocaleString()}`);
      console.log(`    Size: ${formatBytes(backup.size)}`);
    }
  });

// 恢复备份
program
  .command('restore <backupId>')
  .description('Restore from backup')
  .action(async (backupId) => {
    const config = await loadBackupConfig();
    const manager = new BackupManager(config);
    
    console.log('Restoring backup...');
    await manager.restoreBackup(backupId);
    console.log('Restore complete!');
  });

// 配置 GitHub 同步
program
  .command('github-config')
  .description('Configure GitHub sync')
  .requiredOption('-r, --repo <repo>', 'GitHub repository (owner/repo)')
  .requiredOption('-t, --token <token>', 'GitHub personal access token')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .action(async (options) => {
    const masterConfig = new MasterConfigManager();
    
    await masterConfig.setBackupConfig({
      githubSync: {
        enabled: true,
        repository: options.repo,
        token: options.token,
        branch: options.branch,
        syncInterval: 24 * 60 * 60 * 1000, // 24 hours
      },
    });

    console.log('GitHub sync configured:');
    console.log(`  Repository: ${options.repo}`);
    console.log(`  Branch: ${options.branch}`);
    console.log('  Token: ****' + options.token.slice(-4));
  });

// 手动同步到 GitHub
program
  .command('github-sync')
  .description('Sync to GitHub now')
  .action(async () => {
    const config = await loadBackupConfig();
    const manager = new BackupManager(config);
    
    console.log('Syncing to GitHub...');
    const result = await manager.syncToGitHub();
    
    if (result.success) {
      console.log('Sync complete!');
      console.log(`  ${result.message}`);
      if (result.commitHash) {
        console.log(`  Commit: ${result.commitHash}`);
      }
    } else {
      console.error('Sync failed:', result.message);
    }
  });

program.parse();

// 辅助函数
async function loadBackupConfig(): Promise<BackupConfig> {
  const masterConfig = new MasterConfigManager();
  return masterConfig.getBackupConfig();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

## 5. 恢复流程

### 5.1 从本地备份恢复

```typescript
async function restoreFromLocal(backupPath: string): Promise<void> {
  // 1. 解压备份
  const extractDir = `${Paths.backups.base}/temp_restore`;
  await extractTarGz(backupPath, extractDir);

  // 2. 验证备份清单
  const manifest = JSON.parse(await readFile(`${extractDir}/manifest.json`, 'utf-8'));
  console.log(`Restoring backup from ${new Date(manifest.createdAt).toLocaleString()}`);

  // 3. 恢复主配置
  await copyFile(`${extractDir}/master-config.json`, Paths.masterConfig());

  // 4. 恢复创世标识
  if (existsSync(`${extractDir}/founder.json`)) {
    await copyFile(`${extractDir}/founder.json`, Paths.founder());
  }

  // 5. 恢复 Agent 配置
  const agentsDir = `${extractDir}/agents`;
  const agentIds = await readdir(agentsDir);

  for (const agentId of agentIds) {
    const agentDir = `${agentsDir}/${agentId}`;
    const targetDir = Paths.agentDir(agentId);

    await mkdir(targetDir, { recursive: true });
    await copyFile(`${agentDir}/config.json`, Paths.agentConfig(agentId));

    if (existsSync(`${agentDir}/memory.json`)) {
      await copyFile(`${agentDir}/memory.json`, Paths.agentMemory(agentId));
    }
  }

  // 6. 恢复绑定关系
  // ...

  // 7. 清理临时文件
  await rm(extractDir, { recursive: true });

  console.log('Restore complete!');
}
```

## 6. 命令汇总

```bash
# 手动创建备份
npm run backup:create [name] [--workspace] [--context]

# 列出备份
npm run backup:list

# 恢复备份
npm run backup:restore <backupId>

# 配置 GitHub 同步
npm run backup:github-config --repo owner/repo --token ghp_xxx

# 手动同步到 GitHub
npm run backup:github-sync

# 微信端命令 (仅创世 Agent)
/system backup        # 创建备份
/system backups       # 查看备份列表
/system sync          # 同步到 GitHub
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
