/**
 * 项目分享/导入 - Functional Programming Version
 * 
 * Phase 1 Refactoring: Convert class to factory function + pure functions
 */

import { readFile, writeFile, mkdir, readdir, cp, rm, access } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { randomBytes } from 'crypto';

// ============================================================================
// Constants
// ============================================================================

const SHARE_CODE_LENGTH = 8;
const SHARE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ============================================================================
// Types
// ============================================================================

export interface ShareOptions {
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  includeCode?: boolean;
  excludePatterns?: string[];
  version?: string;
}

export interface ImportOptions {
  newName?: string;
  newVersion?: string;
  overwrite?: boolean;
}

export interface SharedProjectMetadata {
  shareCode: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  createdAt: string;
  files: string[];
  capabilities: Array<{ id: string; name: string; description: string }>;
  dependencies: Array<{ name: string; version: string; type: 'production' | 'development' }>;
  tags: string[];
}

export interface ExportResult {
  success: boolean;
  shareCode: string;
  shareUrl: string;
  metadata: SharedProjectMetadata;
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  metadata: SharedProjectMetadata;
  targetPath: string;
  dependencies: Array<{ name: string; version: string; installed: boolean }>;
  errors: string[];
}

export interface ShareManagerConfig {
  storagePath: string;
  expiryDays?: number;
}

// ============================================================================
// Pure Functions
// ============================================================================

export function generateShareCode(): string {
  let code = '';
  const bytes = randomBytes(SHARE_CODE_LENGTH);
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_CHARS[bytes[i] % SHARE_CODE_CHARS.length];
  }
  return code;
}

export function isValidShareCode(code: string): boolean {
  if (code.length !== SHARE_CODE_LENGTH) return false;
  return /^[A-Z0-9]+$/.test(code);
}

function matchesPattern(path: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(path);
  }
  return path === pattern || path.startsWith(pattern + '/');
}

async function scanProjectFiles(
  projectPath: string,
  excludePatterns?: string[]
): Promise<string[]> {
  const files: string[] = [];
  const excludes = excludePatterns || ['node_modules', '.git', 'dist', '.env', '*.log'];

  const scanDir = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(projectPath, fullPath);

      if (excludes.some(pattern => matchesPattern(relPath, pattern))) {
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

async function detectCapabilities(
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

async function extractDependencies(
  projectPath: string
): Promise<Array<{ name: string; version: string; type: 'production' | 'development' }>> {
  const dependencies: Array<{ name: string; version: string; type: 'production' | 'development' }> = [];

  try {
    const pkgPath = join(projectPath, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        dependencies.push({ name, version: version as string, type: 'production' });
      }
    }

    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        dependencies.push({ name, version: version as string, type: 'development' });
      }
    }
  } catch {
    // package.json 不存在
  }

  return dependencies;
}

async function saveMetadata(
  storagePath: string,
  shareCode: string,
  metadata: SharedProjectMetadata
): Promise<void> {
  const dir = join(storagePath, shareCode);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
}

async function loadMetadata(
  storagePath: string,
  shareCode: string
): Promise<SharedProjectMetadata | null> {
  try {
    const path = join(storagePath, shareCode, 'metadata.json');
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function copyProjectFiles(
  storagePath: string,
  projectPath: string,
  shareCode: string,
  excludePatterns?: string[]
): Promise<void> {
  const targetPath = join(storagePath, shareCode, 'code');
  await mkdir(targetPath, { recursive: true });

  const files = await scanProjectFiles(projectPath, excludePatterns);

  for (const file of files) {
    const relPath = relative(projectPath, file);
    const targetFile = join(targetPath, relPath);
    await mkdir(dirname(targetFile), { recursive: true });
    await cp(file, targetFile, { force: true });
  }
}

async function createBasicStructure(
  targetPath: string,
  metadata: SharedProjectMetadata
): Promise<void> {
  await writeFile(
    join(targetPath, 'README.md'),
    `# ${metadata.name}\n\n${metadata.description}\n\n` +
    `## Capabilities\n\n` +
    metadata.capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n') +
    `\n\n## Dependencies\n\n` +
    metadata.dependencies.map(d => `- ${d.name}@${d.version}`).join('\n') +
    '\n'
  );

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

    await writeFile(join(targetPath, 'package.json'), JSON.stringify(pkg, null, 2));
  }
}

// ============================================================================
// Main Operations
// ============================================================================

export async function exportProject(
  storagePath: string,
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
    const shareCode = generateShareCode();
    result.shareCode = shareCode;
    result.shareUrl = `weixin-kimi://project/${shareCode}`;
    result.metadata.shareCode = shareCode;

    const files = await scanProjectFiles(projectPath, options.excludePatterns);
    result.metadata.files = files.map(f => relative(projectPath, f));

    result.metadata.capabilities = await detectCapabilities(projectPath);
    result.metadata.dependencies = await extractDependencies(projectPath);

    await saveMetadata(storagePath, shareCode, result.metadata);

    if (options.includeCode) {
      await copyProjectFiles(storagePath, projectPath, shareCode, options.excludePatterns);
    }
  } catch (error) {
    result.success = false;
    result.warnings.push(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function importProject(
  storagePath: string,
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
    if (!isValidShareCode(shareCode)) {
      result.errors.push('无效的分享码格式');
      return result;
    }

    const metadata = await loadMetadata(storagePath, shareCode);
    if (!metadata) {
      result.errors.push('分享码不存在或已过期');
      return result;
    }

    result.metadata = metadata;

    if (options.newName) {
      result.metadata.name = options.newName;
    }
    if (options.newVersion) {
      result.metadata.version = options.newVersion;
    }

    try {
      await access(targetPath);
      if (!options.overwrite) {
        result.errors.push('目标路径已存在，使用 overwrite 选项覆盖');
        return result;
      }
    } catch {
      // 路径不存在，可以创建
    }

    await mkdir(targetPath, { recursive: true });

    const sourcePath = join(storagePath, shareCode, 'code');
    try {
      await cp(sourcePath, targetPath, { recursive: true, force: true });
    } catch {
      await createBasicStructure(targetPath, metadata);
    }

    for (const dep of metadata.dependencies) {
      result.dependencies.push({ name: dep.name, version: dep.version, installed: false });
    }

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
    result.errors.push(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function getSharedProjectInfo(
  storagePath: string,
  shareCode: string
): Promise<SharedProjectMetadata | null> {
  if (!isValidShareCode(shareCode)) {
    return null;
  }
  return loadMetadata(storagePath, shareCode);
}

export async function listSharedProjects(storagePath: string): Promise<SharedProjectMetadata[]> {
  try {
    const entries = await readdir(storagePath, { withFileTypes: true });
    const projects: SharedProjectMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadata = await loadMetadata(storagePath, entry.name);
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

export async function deleteSharedProject(storagePath: string, shareCode: string): Promise<boolean> {
  try {
    const path = join(storagePath, shareCode);
    await rm(path, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export interface ProjectShareManager {
  exportProject(projectPath: string, options: ShareOptions): Promise<ExportResult>;
  importProject(shareCode: string, targetPath: string, options?: ImportOptions): Promise<ImportResult>;
  getSharedProjectInfo(shareCode: string): Promise<SharedProjectMetadata | null>;
  listSharedProjects(): Promise<SharedProjectMetadata[]>;
  deleteSharedProject(shareCode: string): Promise<boolean>;
}

export function createProjectShareManager(config: ShareManagerConfig): ProjectShareManager {
  const storagePath = config.storagePath;
  
  return {
    exportProject: (projectPath: string, options: ShareOptions) => exportProject(storagePath, projectPath, options),
    importProject: (shareCode: string, targetPath: string, options?: ImportOptions) => importProject(storagePath, shareCode, targetPath, options),
    getSharedProjectInfo: (shareCode: string) => getSharedProjectInfo(storagePath, shareCode),
    listSharedProjects: () => listSharedProjects(storagePath),
    deleteSharedProject: (shareCode: string) => deleteSharedProject(storagePath, shareCode),
  } as unknown as ProjectShareManager;
}

// ============================================================================
// Backward Compatibility
// ============================================================================

/**
 * @deprecated Use createProjectShareManager() for new code
 */
export class ShareCode {
  static generate(): string {
    return generateShareCode();
  }

  static isValid(code: string): boolean {
    return isValidShareCode(code);
  }
}

/**
 * @deprecated Use createProjectShareManager() for new code
 */
export class ProjectShareManager {
  private storagePath: string;

  constructor(config: ShareManagerConfig) {
    this.storagePath = config.storagePath;
  }

  async exportProject(projectPath: string, options: ShareOptions): Promise<ExportResult> {
    return exportProject(this.storagePath, projectPath, options);
  }

  async importProject(shareCode: string, targetPath: string, options?: ImportOptions): Promise<ImportResult> {
    return importProject(this.storagePath, shareCode, targetPath, options);
  }

  async getSharedProjectInfo(shareCode: string): Promise<SharedProjectMetadata | null> {
    return getSharedProjectInfo(this.storagePath, shareCode);
  }

  async listSharedProjects(): Promise<SharedProjectMetadata[]> {
    return listSharedProjects(this.storagePath);
  }

  async deleteSharedProject(shareCode: string): Promise<boolean> {
    return deleteSharedProject(this.storagePath, shareCode);
  }
}
