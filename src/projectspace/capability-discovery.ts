/**
 * 能力自动发现
 * 
 * 扫描项目目录结构，自动识别可执行的能力
 * 支持多种入口点：package.json scripts、bin目录、capability.json、API端点
 */

import { readFile, readdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { JSONSchema } from '../task-router/protocol/types.js';

/**
 * 发现来源类型
 */
export enum DiscoverySource {
  PACKAGE_JSON = 'package.json',
  BIN = 'bin',
  CAPABILITY_JSON = 'capability.json',
  API = 'api',
  MAIN_ENTRY = 'main',
}

/**
 * 入口点定义
 */
export interface EntryPoint {
  type: 'cli' | 'api' | 'function' | 'workflow';
  command?: string;
  path?: string;
  method?: string;
}

/**
 * 发现的能力
 */
export interface DiscoveredCapability {
  /** 能力ID */
  id: string;
  /** 能力名称 */
  name: string;
  /** 能力描述 */
  description: string;
  /** 入口点 */
  entryPoint: EntryPoint;
  /** 输入Schema */
  inputSchema?: JSONSchema;
  /** 发现来源 */
  source: DiscoverySource;
  /** 项目路径 */
  projectPath: string;
  /** 原始定义（可选） */
  raw?: unknown;
}

/**
 * 发现选项
 */
export interface DiscoveryOptions {
  /** 是否检测API端点 */
  detectApi?: boolean;
  /** 包含的来源类型 */
  includeSources?: DiscoverySource[];
  /** 排除的来源类型 */
  excludeSources?: DiscoverySource[];
  /** 最大发现深度 */
  maxDepth?: number;
  /** 自定义文件匹配模式 */
  filePatterns?: string[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 能力发现器
 */
export class CapabilityDiscovery {
  private defaultOptions: DiscoveryOptions = {
    detectApi: true,
    maxDepth: 3,
  };

  /**
   * 扫描项目目录发现能力
   */
  async scanProject(
    projectPath: string,
    options: DiscoveryOptions = {}
  ): Promise<DiscoveredCapability[]> {
    const opts = { ...this.defaultOptions, ...options };
    const capabilities: DiscoveredCapability[] = [];

    // 检查是否应该包含某个来源
    const shouldInclude = (source: DiscoverySource): boolean => {
      if (opts.includeSources && !opts.includeSources.includes(source)) {
        return false;
      }
      if (opts.excludeSources?.includes(source)) {
        return false;
      }
      return true;
    };

    // 1. 从 package.json 发现
    if (shouldInclude(DiscoverySource.PACKAGE_JSON)) {
      const pkgCaps = await this.scanPackageJson(projectPath);
      capabilities.push(...pkgCaps);
    }

    // 2. 从 bin 目录发现
    if (shouldInclude(DiscoverySource.BIN)) {
      const binCaps = await this.scanBinDirectory(projectPath);
      capabilities.push(...binCaps);
    }

    // 3. 从 capability.json 发现
    if (shouldInclude(DiscoverySource.CAPABILITY_JSON)) {
      const jsonCaps = await this.scanCapabilityJson(projectPath);
      capabilities.push(...jsonCaps);
    }

    // 4. 从 API 目录发现
    if (shouldInclude(DiscoverySource.API) && opts.detectApi) {
      const apiCaps = await this.scanApiEndpoints(projectPath);
      capabilities.push(...apiCaps);
    }

    return capabilities;
  }

  /**
   * 从 package.json 扫描
   */
  private async scanPackageJson(projectPath: string): Promise<DiscoveredCapability[]> {
    const capabilities: DiscoveredCapability[] = [];

    try {
      const pkgPath = join(projectPath, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      // 扫描 scripts
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        for (const [name, command] of Object.entries(pkg.scripts)) {
          if (typeof command !== 'string') continue;

          capabilities.push({
            id: `script-${name}`,
            name,
            description: this.generateDescription(name, command),
            entryPoint: {
              type: 'cli',
              command: `npm run ${name}`,
            },
            inputSchema: this.generateInputSchema(command),
            source: DiscoverySource.PACKAGE_JSON,
            projectPath,
            raw: { script: command },
          });
        }
      }

      // 扫描 bin 字段
      if (pkg.bin) {
        if (typeof pkg.bin === 'string') {
          capabilities.push({
            id: `bin-${pkg.name}`,
            name: pkg.name,
            description: `CLI tool: ${pkg.name}`,
            entryPoint: {
              type: 'cli',
              command: pkg.name,
              path: pkg.bin,
            },
            source: DiscoverySource.PACKAGE_JSON,
            projectPath,
          });
        } else if (typeof pkg.bin === 'object') {
          for (const [name, path] of Object.entries(pkg.bin)) {
            if (typeof path !== 'string') continue;
            capabilities.push({
              id: `bin-${name}`,
              name,
              description: `CLI command: ${name}`,
              entryPoint: {
                type: 'cli',
                command: name,
                path,
              },
              source: DiscoverySource.PACKAGE_JSON,
              projectPath,
            });
          }
        }
      }

      // 扫描 main 入口
      if (pkg.main && typeof pkg.main === 'string') {
        capabilities.push({
          id: `main-${pkg.name}`,
          name: pkg.name,
          description: `Main module: ${pkg.description || pkg.name}`,
          entryPoint: {
            type: 'function',
            path: pkg.main,
          },
          source: DiscoverySource.MAIN_ENTRY,
          projectPath,
        });
      }
    } catch {
      // package.json 不存在或解析失败
    }

    return capabilities;
  }

  /**
   * 从 bin 目录扫描
   */
  private async scanBinDirectory(projectPath: string): Promise<DiscoveredCapability[]> {
    const capabilities: DiscoveredCapability[] = [];
    const binPath = join(projectPath, 'bin');

    try {
      const entries = await readdir(binPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        
        const ext = extname(entry.name);
        const name = basename(entry.name, ext);
        
        // 跳过非可执行文件（简单判断：无扩展名或特定扩展名）
        if (ext && !['.js', '.ts', '.sh', '.py'].includes(ext)) continue;

        capabilities.push({
          id: `bin-file-${name}`,
          name,
          description: `Executable: ${name}`,
          entryPoint: {
            type: 'cli',
            command: `./bin/${entry.name}`,
            path: `bin/${entry.name}`,
          },
          source: DiscoverySource.BIN,
          projectPath,
        });
      }
    } catch {
      // bin 目录不存在
    }

    return capabilities;
  }

  /**
   * 从 capability.json 扫描
   */
  private async scanCapabilityJson(projectPath: string): Promise<DiscoveredCapability[]> {
    const capabilities: DiscoveredCapability[] = [];

    try {
      const capPath = join(projectPath, 'capability.json');
      const content = await readFile(capPath, 'utf-8');
      const capDef = JSON.parse(content);

      if (Array.isArray(capDef.capabilities)) {
        for (const cap of capDef.capabilities) {
          if (!cap.id || !cap.name) continue;

          capabilities.push({
            id: cap.id,
            name: cap.name,
            description: cap.description || `${cap.name} capability`,
            entryPoint: cap.entryPoint || { type: 'cli', command: cap.id },
            inputSchema: cap.inputSchema || { type: 'object', properties: {} },
            source: DiscoverySource.CAPABILITY_JSON,
            projectPath,
            raw: cap,
          });
        }
      }
    } catch {
      // capability.json 不存在或解析失败
    }

    return capabilities;
  }

  /**
   * 扫描 API 端点
   */
  private async scanApiEndpoints(projectPath: string): Promise<DiscoveredCapability[]> {
    const capabilities: DiscoveredCapability[] = [];
    const apiPaths = [
      join(projectPath, 'api'),
      join(projectPath, 'src', 'api'),
      join(projectPath, 'routes'),
    ];

    for (const apiPath of apiPaths) {
      try {
        const entries = await readdir(apiPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          
          const ext = extname(entry.name);
          if (!['.ts', '.js', '.json'].includes(ext)) continue;

          const name = basename(entry.name, ext);
          
          capabilities.push({
            id: `api-${name}`,
            name: `api-${name}`,
            description: `API endpoint: ${name}`,
            entryPoint: {
              type: 'api',
              path: entry.name,
            },
            source: DiscoverySource.API,
            projectPath,
          });
        }
      } catch {
        // 目录不存在
      }
    }

    return capabilities;
  }

  /**
   * 生成能力ID
   */
  generateCapabilityId(discovered: DiscoveredCapability, projectId: string): string {
    // 使用 discovered.id 或从 name 生成有效的 ID
    const idPart = discovered.id || discovered.name.toLowerCase().replace(/\s+/g, '-');
    return `project-${projectId}-${idPart}`;
  }

  /**
   * 验证发现的能力
   */
  validateDiscoveredCapability(capability: DiscoveredCapability): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!capability.id || capability.id.trim() === '') {
      errors.push('Capability ID is required');
    }

    if (!capability.name || capability.name.trim() === '') {
      errors.push('Capability name is required');
    }

    if (!capability.description || capability.description.trim() === '') {
      errors.push('Capability description is required');
    }

    if (!capability.entryPoint) {
      errors.push('Entry point is required');
    } else {
      if (!capability.entryPoint.type) {
        errors.push('Entry point type is required');
      }
      if (!capability.entryPoint.command && !capability.entryPoint.path) {
        warnings.push('Entry point should have either command or path');
      }
    }

    if (!capability.inputSchema) {
      warnings.push('Input schema is recommended');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 生成描述
   */
  private generateDescription(name: string, command: string): string {
    const descriptions: Record<string, string> = {
      build: 'Build the project',
      test: 'Run tests',
      start: 'Start the application',
      dev: 'Start development server',
      lint: 'Run linter',
      format: 'Format code',
      clean: 'Clean build artifacts',
    };

    return descriptions[name] || `Execute: ${command}`;
  }

  /**
   * 从命令生成输入Schema
   */
  generateInputSchema(command: string): JSONSchema {
    // 简单的命令行参数解析
    const properties: Record<string, JSONSchema> = {};
    
    // 匹配 --flag <type> 或 --flag 模式
    const argPattern = /--([a-zA-Z0-9-]+)(?:\s+<([a-zA-Z]+)>)?/g;
    let match: RegExpExecArray | null;
    
    while ((match = argPattern.exec(command)) !== null) {
      const [, flag, typeHint] = match;
      const argType: 'string' | 'number' = typeHint === 'number' ? 'number' : 'string';
      properties[flag] = {
        type: argType,
        description: `Parameter: ${flag}`,
      };
    }

    return {
      type: 'object',
      properties,
      description: `Input for command: ${command}`,
    };
  }
}

// 导出默认实例
export const capabilityDiscovery = new CapabilityDiscovery();
