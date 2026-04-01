/**
 * Workspace Manager
 * 
 * 管理 Agent Workspace 的初始化、清理和维护
 * 提供 PARA 目录结构和临时文件管理
 */

import { mkdir, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Workspace 配置
 */
export interface WorkspaceConfig {
  /** Agent ID */
  agentId: string;
  /** Workspace 根路径 */
  path: string;
  /** 是否启用 PARA 整理（默认 true） */
  paraEnabled?: boolean;
  /** 临时文件保留天数（默认 7） */
  tmpRetentionDays?: number;
}

/**
 * Workspace 目录结构
 */
export const WORKSPACE_DIRS: Record<string, string> = {
  // 功能目录
  TMP: 'tmp',
  CACHE: 'cache',
  LOGS: 'logs',
  
  // PARA 知识管理目录
  PARA: 'PARA',
  PARA_PROJECTS: 'PARA/Projects',
  PARA_AREAS: 'PARA/Areas',
  PARA_RESOURCES: 'PARA/Resources',
  PARA_ARCHIVES: 'PARA/Archives',
};

/**
 * Workspace README 内容
 */
const WORKSPACE_README = `# Agent Workspace

这是你（Agent）的专属工作空间，用于存放临时文件、缓存、日志和知识管理。

## 目录结构

### 功能目录
- **tmp/** - 临时文件、过程产出（会被自动清理）
- **cache/** - 缓存数据
- **logs/** - 执行日志

### PARA 知识管理
基于 PARA 方法组织的知识目录：
- **PARA/Projects/** - 进行中的项目相关文件
- **PARA/Areas/** - 持续维护的职责领域
- **PARA/Resources/** - 参考资料、学习笔记
- **PARA/Archives/** - 已完成或暂停的项目

## 使用规范

1. **临时文件**必须放在 tmp/ 目录，7天后自动清理
2. **有价值的产出**应整理到 PARA/Projects/ 或 PARA/Areas/
3. **参考资料**放在 PARA/Resources/
4. **不要在 workspace 根目录乱放文件**

## 提示

- 定期整理 PARA/Archives/，将已完成的项目归档
- 使用 PARA/ 目录保持知识结构清晰
- 重要的交付物应提交到版本控制，而非仅保存在 workspace
`;

/**
 * Workspace 管理器
 */
export class WorkspaceManager {
  private config: Required<WorkspaceConfig>;

  constructor(config: WorkspaceConfig) {
    this.config = {
      paraEnabled: true,
      tmpRetentionDays: 7,
      ...config,
    } as Required<WorkspaceConfig>;
  }

  /**
   * 初始化 Workspace 目录结构
   */
  async initialize(): Promise<void> {
    const dirsToCreate = [
      WORKSPACE_DIRS.TMP,
      WORKSPACE_DIRS.CACHE,
      WORKSPACE_DIRS.LOGS,
    ];

    // 如果启用 PARA，创建 PARA 目录
    if (this.config.paraEnabled) {
      dirsToCreate.push(
        WORKSPACE_DIRS.PARA_PROJECTS,
        WORKSPACE_DIRS.PARA_AREAS,
        WORKSPACE_DIRS.PARA_RESOURCES,
        WORKSPACE_DIRS.PARA_ARCHIVES
      );
    }

    // 创建所有目录
    for (const dir of dirsToCreate) {
      const fullPath = join(this.config.path, dir);
      await mkdir(fullPath, { recursive: true });
    }

    // 创建 README 文件
    await this.createReadme();

    console.log(`[Workspace] Initialized for agent ${this.config.agentId}`);
    console.log(`  Path: ${this.config.path}`);
    console.log(`  PARA: ${this.config.paraEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 清理临时文件
   * @param maxAgeDays 最大保留天数，默认使用配置值
   */
  async cleanupTmp(maxAgeDays?: number): Promise<number> {
    const retentionDays = maxAgeDays ?? this.config.tmpRetentionDays;
    const tmpPath = join(this.config.path, WORKSPACE_DIRS.TMP);
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    let deletedCount = 0;

    try {
      const entries = await readdir(tmpPath);
      
      for (const entry of entries) {
        const entryPath = join(tmpPath, entry);
        const stats = await stat(entryPath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
          await unlink(entryPath);
          deletedCount++;
        }
      }
    } catch (error) {
      // tmp 目录可能不存在或为空，忽略错误
    }

    if (deletedCount > 0) {
      console.log(`[Workspace] Cleaned up ${deletedCount} old tmp files for ${this.config.agentId}`);
    }

    return deletedCount;
  }

  /**
   * 获取 workspace 路径
   */
  getPath(subdir?: keyof typeof WORKSPACE_DIRS): string {
    if (!subdir) {
      return this.config.path;
    }
    return join(this.config.path, WORKSPACE_DIRS[subdir]);
  }

  /**
   * 检查 workspace 是否已初始化
   */
  async isInitialized(): Promise<boolean> {
    try {
      const readmePath = join(this.config.path, 'README.md');
      await stat(readmePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取 PARA 状态
   */
  isParaEnabled(): boolean {
    return this.config.paraEnabled;
  }

  /**
   * 创建 README 文件
   */
  private async createReadme(): Promise<void> {
    const readmePath = join(this.config.path, 'README.md');
    
    try {
      await stat(readmePath);
      // README 已存在，不覆盖
    } catch {
      // README 不存在，创建
      await writeFile(readmePath, WORKSPACE_README, 'utf-8');
    }
  }

  /**
   * 获取系统提示用的 workspace 说明
   */
  getPromptDescription(): string {
    const lines = [
      `路径: ${this.config.path}`,
      '',
      '目录结构:',
      `├── ${WORKSPACE_DIRS.TMP}/ - 临时文件（${this.config.tmpRetentionDays}天后自动清理）`,
      `├── ${WORKSPACE_DIRS.CACHE}/ - 缓存数据`,
      `├── ${WORKSPACE_DIRS.LOGS}/ - 执行日志`,
    ];

    if (this.config.paraEnabled) {
      lines.push(
        `└── ${WORKSPACE_DIRS.PARA}/`,
        `    ├── Projects/ - 进行中的项目`,
        `    ├── Areas/ - 持续维护的领域`,
        `    ├── Resources/ - 参考资料`,
        `    └── Archives/ - 已完成的项目`
      );
    }

    lines.push(
      '',
      '规则:',
      '1. 临时文件必须放在 tmp/',
      '2. 有价值的产出放 PARA/Projects/',
      '3. 不要在根目录乱放文件'
    );

    return lines.join('\n');
  }
}

/**
 * 创建 WorkspaceManager 的便捷函数
 */
export function createWorkspaceManager(
  agentId: string,
  workspacePath: string,
  options?: Partial<Omit<WorkspaceConfig, 'agentId' | 'path'>>
): WorkspaceManager {
  return new WorkspaceManager({
    agentId,
    path: workspacePath,
    paraEnabled: true,
    tmpRetentionDays: 7,
    ...options,
  });
}
