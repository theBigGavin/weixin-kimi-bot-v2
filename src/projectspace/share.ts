/**
 * 项目分享/导入
 * 
 * 支持将项目导出为可分享的格式，并通过分享码导入
 */

import { readFile, writeFile, mkdir, readdir, cp, rm, access } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { randomBytes } from 'crypto';

/**
 * 分享码
 */
export class ShareCode {
  private static readonly LENGTH = 8;
  private static readonly CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  /**
   * 生成分享码
   */
  static generate(): string {
    let code = '';
    const bytes = randomBytes(this.LENGTH);
    for (let i = 0; i < this.LENGTH; i++) {
      code += this.CHARS[bytes[i] % this.CHARS.length];
    }
    return code;
  }

  /**
   * 验证分享码格式
   */
  static isValid(code: string): boolean {
    if (code.length !== this.LENGTH) return false;
    return /^[A-Z0-9]+$/.test(code);
  }
}

/**
 * 分享选项
 */
export interface ShareOptions {
  /** 项目名 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
  /** 是否包含代码 */
  includeCode?: boolean;
  /** 排除的文件模式 */
  excludePatterns?: string[];
  /** 版本 */
  version?: string;
}

/**
 * 导入选项
 */
export interface ImportOptions {
  /** 新项目名 */
  newName?: string;
  /** 新版本 */
  newVersion?: string;
  /** 是否覆盖 */
  overwrite?: boolean;
}

/**
 * 分享的项目元数据
 */
export interface SharedProjectMetadata {
  /** 分享码 */
  shareCode: string;
  /** 项目名 */
  name: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author?: string;
  /** 版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 文件列表 */
  files: string[];
  /** 能力清单 */
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  /** 依赖 */
  dependencies: Array<{
    name: string;
    version: string;
    type: 'production' | 'development';
  }>;
  /** 标签 */
  tags: string[];
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean;
  shareCode: string;
  shareUrl: string;
  metadata: SharedProjectMetadata;
  warnings: string[];
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean;
  metadata: SharedProjectMetadata;
  targetPath: string;
  dependencies: Array<{
    name: string;
    version: string;
    installed: boolean;
  }>;
  errors: string[];
}

/**
 * 分享管理器配置
 */
export interface ShareManagerConfig {
  /** 分享存储路径 */
  storagePath: string;
  /** 分享码有效期（天） */
  expiryDays?: number;
}

/**
 * 项目分享管理器
 */
export class ProjectShareManager {
  private config: Required<ShareManagerConfig>;

  constructor(config: ShareManagerConfig) {
    this.config = {
      expiryDays: 30,
      ...config,
    };
  }

  /**
   * 导出项目
   */
  async exportProject(
    projectPath: string,
    options: ShareOptions
  ): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      shareCode: '',
      shareUrl: '',
      metadata: {
        shareCode: '',
        name: options.name,
        description: options.description || '',
        author: options.author,
        version: options.version || '1.0.0',
        createdAt: new Date().toISOString(),
        files: [],
        capabilities: [],
        dependencies: [],
        tags: options.tags || [],
      },
      warnings: [],
    };

    try {
      // 生成分享码
      const shareCode = ShareCode.generate();
      result.shareCode = shareCode;
      result.shareUrl = `weixin-kimi://project/${shareCode}`;
      result.metadata.shareCode = shareCode;

      // 扫描项目文件
      const files = await this.scanProjectFiles(projectPath, options.excludePatterns);
      result.metadata.files = files.map(f => relative(projectPath, f));

      // 检测能力
      const capabilities = await this.detectCapabilities(projectPath);
      result.metadata.capabilities = capabilities;

      // 提取依赖
      const dependencies = await this.extractDependencies(projectPath);
      result.metadata.dependencies = dependencies;

      // 保存元数据
      await this.saveMetadata(shareCode, result.metadata);

      // 如果需要，复制代码
      if (options.includeCode) {
        await this.copyProjectFiles(projectPath, shareCode, options.excludePatterns);
      }

    } catch (error) {
      result.success = false;
      result.warnings.push(
        `导出失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * 导入项目
   */
  async importProject(
    shareCode: string,
    targetPath: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      metadata: {} as SharedProjectMetadata,
      targetPath,
      dependencies: [],
      errors: [],
    };

    try {
      // 验证分享码
      if (!ShareCode.isValid(shareCode)) {
        result.errors.push('无效的分享码格式');
        return result;
      }

      // 获取元数据
      const metadata = await this.loadMetadata(shareCode);
      if (!metadata) {
        result.errors.push('分享码不存在或已过期');
        return result;
      }

      result.metadata = metadata;

      // 应用重命名
      if (options.newName) {
        result.metadata.name = options.newName;
      }
      if (options.newVersion) {
        result.metadata.version = options.newVersion;
      }

      // 检查目标路径
      try {
        await access(targetPath);
        if (!options.overwrite) {
          result.errors.push('目标路径已存在，使用 overwrite 选项覆盖');
          return result;
        }
      } catch {
        // 路径不存在，可以创建
      }

      // 创建目标目录
      await mkdir(targetPath, { recursive: true });

      // 复制项目文件
      const sourcePath = join(this.config.storagePath, shareCode, 'code');
      try {
        await cp(sourcePath, targetPath, { recursive: true, force: true });
      } catch {
        // 代码可能未包含，创建基本结构
        await this.createBasicStructure(targetPath, metadata);
      }

      // 处理依赖
      for (const dep of metadata.dependencies) {
        result.dependencies.push({
          name: dep.name,
          version: dep.version,
          installed: false, // 实际安装需要在环境中执行
        });
      }

      // 更新导入后的元数据
      await writeFile(
        join(targetPath, 'project-share.json'),
        JSON.stringify({
          importedFrom: shareCode,
          importedAt: new Date().toISOString(),
          originalMetadata: metadata,
        }, null, 2)
      );

      result.success = true;

    } catch (error) {
      result.errors.push(
        `导入失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * 获取分享项目信息
   */
  async getSharedProjectInfo(shareCode: string): Promise<SharedProjectMetadata | null> {
    if (!ShareCode.isValid(shareCode)) {
      return null;
    }
    return this.loadMetadata(shareCode);
  }

  /**
   * 列出所有分享的项目
   */
  async listSharedProjects(): Promise<SharedProjectMetadata[]> {
    try {
      const entries = await readdir(this.config.storagePath, { withFileTypes: true });
      const projects: SharedProjectMetadata[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadata = await this.loadMetadata(entry.name);
          if (metadata) {
            projects.push(metadata);
          }
        }
      }

      return projects;
    } catch {
      return [];
    }
  }

  /**
   * 删除分享的项目
   */
  async deleteSharedProject(shareCode: string): Promise<boolean> {
    try {
      const path = join(this.config.storagePath, shareCode);
      await rm(path, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 扫描项目文件
   */
  private async scanProjectFiles(
    projectPath: string,
    excludePatterns?: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    const excludes = excludePatterns || [
      'node_modules',
      '.git',
      'dist',
      '.env',
      '*.log',
    ];

    const scanDir = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(projectPath, fullPath);

        // 检查排除模式
        if (excludes.some(pattern => this.matchesPattern(relPath, pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    await scanDir(projectPath);
    return files;
  }

  /**
   * 匹配排除模式
   */
  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    }
    return path === pattern || path.startsWith(pattern + '/');
  }

  /**
   * 检测能力
   */
  private async detectCapabilities(
    projectPath: string
  ): Promise<Array<{ id: string; name: string; description: string }>> {
    const capabilities: Array<{ id: string; name: string; description: string }> = [];

    try {
      const capPath = join(projectPath, 'capability.json');
      const content = await readFile(capPath, 'utf-8');
      const capDef = JSON.parse(content);

      if (Array.isArray(capDef.capabilities)) {
        for (const cap of capDef.capabilities) {
          if (cap.id && cap.name) {
            capabilities.push({
              id: cap.id,
              name: cap.name,
              description: cap.description || '',
            });
          }
        }
      }
    } catch {
      // capability.json 不存在
    }

    return capabilities;
  }

  /**
   * 提取依赖
   */
  private async extractDependencies(
    projectPath: string
  ): Promise<Array<{ name: string; version: string; type: 'production' | 'development' }>> {
    const dependencies: Array<{ name: string; version: string; type: 'production' | 'development' }> = [];

    try {
      const pkgPath = join(projectPath, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      // 生产依赖
      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'production',
          });
        }
      }

      // 开发依赖
      if (pkg.devDependencies) {
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'development',
          });
        }
      }
    } catch {
      // package.json 不存在
    }

    return dependencies;
  }

  /**
   * 保存元数据
   */
  private async saveMetadata(
    shareCode: string,
    metadata: SharedProjectMetadata
  ): Promise<void> {
    const dir = join(this.config.storagePath, shareCode);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * 加载元数据
   */
  private async loadMetadata(shareCode: string): Promise<SharedProjectMetadata | null> {
    try {
      const path = join(this.config.storagePath, shareCode, 'metadata.json');
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 复制项目文件
   */
  private async copyProjectFiles(
    projectPath: string,
    shareCode: string,
    excludePatterns?: string[]
  ): Promise<void> {
    const targetPath = join(this.config.storagePath, shareCode, 'code');
    await mkdir(targetPath, { recursive: true });

    const files = await this.scanProjectFiles(projectPath, excludePatterns);

    for (const file of files) {
      const relPath = relative(projectPath, file);
      const targetFile = join(targetPath, relPath);
      const targetDir = dirname(targetFile);
      await mkdir(targetDir, { recursive: true });
      await cp(file, targetFile, { force: true });
    }
  }

  /**
   * 创建基本结构
   */
  private async createBasicStructure(
    targetPath: string,
    metadata: SharedProjectMetadata
  ): Promise<void> {
    // 创建 README
    await writeFile(
      join(targetPath, 'README.md'),
      `# ${metadata.name}\n\n${metadata.description}\n\n` +
      `## Capabilities\n\n` +
      metadata.capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n') +
      `\n\n## Dependencies\n\n` +
      metadata.dependencies.map(d => `- ${d.name}@${d.version}`).join('\n') +
      '\n'
    );

    // 创建 package.json（如果有依赖）
    if (metadata.dependencies.length > 0) {
      const pkg = {
        name: metadata.name.toLowerCase().replace(/\s+/g, '-'),
        version: metadata.version,
        description: metadata.description,
        dependencies: {} as Record<string, string>,
        devDependencies: {} as Record<string, string>,
      };

      for (const dep of metadata.dependencies) {
        if (dep.type === 'production') {
          pkg.dependencies[dep.name] = dep.version;
        } else {
          pkg.devDependencies[dep.name] = dep.version;
        }
      }

      await writeFile(
        join(targetPath, 'package.json'),
        JSON.stringify(pkg, null, 2)
      );
    }
  }
}

// 导出工厂函数
export function createProjectShareManager(config: ShareManagerConfig): ProjectShareManager {
  return new ProjectShareManager(config);
}
