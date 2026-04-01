/**
 * 能力自动发现 - Functional Programming Version
 * 
 * Phase 1 Refactoring: Class → Factory Function
 * - Pure functions only
 * - No internal state
 * - Immutable data flow
 */

import { readFile, readdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { JSONSchema } from '../task-router/protocol/types.js';

// ============================================================================
// Types
// ============================================================================

export enum DiscoverySource {
  PACKAGE_JSON = 'package.json',
  BIN = 'bin',
  CAPABILITY_JSON = 'capability.json',
  API = 'api',
  MAIN_ENTRY = 'main',
}

export interface EntryPoint {
  type: 'cli' | 'api' | 'function' | 'workflow';
  command?: string;
  path?: string;
  method?: string;
}

export interface DiscoveredCapability {
  id: string;
  name: string;
  description: string;
  entryPoint: EntryPoint;
  inputSchema?: JSONSchema;
  source: DiscoverySource;
  projectPath: string;
  raw?: unknown;
}

export interface DiscoveryOptions {
  detectApi?: boolean;
  includeSources?: DiscoverySource[];
  excludeSources?: DiscoverySource[];
  maxDepth?: number;
  filePatterns?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: DiscoveryOptions = {
  detectApi: true,
  maxDepth: 3,
};

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * 扫描项目目录发现能力
 */
export async function scanProject(
  projectPath: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveredCapability[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const capabilities: DiscoveredCapability[] = [];

  const shouldInclude = (source: DiscoverySource): boolean => {
    if (opts.includeSources && !opts.includeSources.includes(source)) return false;
    if (opts.excludeSources?.includes(source)) return false;
    return true;
  };

  if (shouldInclude(DiscoverySource.PACKAGE_JSON)) {
    capabilities.push(...await scanPackageJson(projectPath));
  }

  if (shouldInclude(DiscoverySource.BIN)) {
    capabilities.push(...await scanBinDirectory(projectPath));
  }

  if (shouldInclude(DiscoverySource.CAPABILITY_JSON)) {
    capabilities.push(...await scanCapabilityJson(projectPath));
  }

  if (shouldInclude(DiscoverySource.API) && opts.detectApi) {
    capabilities.push(...await scanApiEndpoints(projectPath));
  }

  return capabilities;
}

/**
 * 从 package.json 扫描
 */
async function scanPackageJson(projectPath: string): Promise<DiscoveredCapability[]> {
  const capabilities: DiscoveredCapability[] = [];

  try {
    const pkgPath = join(projectPath, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    if (pkg.scripts && typeof pkg.scripts === 'object') {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        if (typeof command !== 'string') continue;

        capabilities.push({
          id: `script-${name}`,
          name,
          description: generateDescription(name, command),
          entryPoint: { type: 'cli', command: `npm run ${name}` },
          inputSchema: generateInputSchema(command),
          source: DiscoverySource.PACKAGE_JSON,
          projectPath,
          raw: { script: command },
        });
      }
    }

    if (pkg.bin) {
      if (typeof pkg.bin === 'string') {
        capabilities.push({
          id: `bin-${pkg.name}`,
          name: pkg.name,
          description: `CLI tool: ${pkg.name}`,
          entryPoint: { type: 'cli', command: pkg.name, path: pkg.bin },
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
            entryPoint: { type: 'cli', command: name, path },
            source: DiscoverySource.PACKAGE_JSON,
            projectPath,
          });
        }
      }
    }

    if (pkg.main && typeof pkg.main === 'string') {
      capabilities.push({
        id: `main-${pkg.name}`,
        name: pkg.name,
        description: `Main module: ${pkg.description || pkg.name}`,
        entryPoint: { type: 'function', path: pkg.main },
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
async function scanBinDirectory(projectPath: string): Promise<DiscoveredCapability[]> {
  const capabilities: DiscoveredCapability[] = [];
  const binPath = join(projectPath, 'bin');

  try {
    const entries = await readdir(binPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      
      const ext = extname(entry.name);
      const name = basename(entry.name, ext);
      
      if (ext && !['.js', '.ts', '.sh', '.py'].includes(ext)) continue;

      capabilities.push({
        id: `bin-file-${name}`,
        name,
        description: `Executable: ${name}`,
        entryPoint: { type: 'cli', command: `./bin/${entry.name}`, path: `bin/${entry.name}` },
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
async function scanCapabilityJson(projectPath: string): Promise<DiscoveredCapability[]> {
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
async function scanApiEndpoints(projectPath: string): Promise<DiscoveredCapability[]> {
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
          entryPoint: { type: 'api', path: entry.name },
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

// ============================================================================
// Utility Functions
// ============================================================================

export function generateCapabilityId(discovered: DiscoveredCapability, projectId: string): string {
  const idPart = discovered.id || discovered.name.toLowerCase().replace(/\s+/g, '-');
  return `project-${projectId}-${idPart}`;
}

export function validateDiscoveredCapability(capability: DiscoveredCapability): ValidationResult {
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

  return { valid: errors.length === 0, errors, warnings };
}

function generateDescription(name: string, command: string): string {
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

export function generateInputSchema(command: string): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  
  const argPattern = /--([a-zA-Z0-9-]+)(?:\s+<([a-zA-Z]+)>)?/g;
  let match: RegExpExecArray | null;
  
  while ((match = argPattern.exec(command)) !== null) {
    const [, flag, typeHint] = match;
    const argType: 'string' | 'number' = typeHint === 'number' ? 'number' : 'string';
    properties[flag] = { type: argType, description: `Parameter: ${flag}` };
  }

  return {
    type: 'object',
    properties,
    description: `Input for command: ${command}`,
  };
}

// ============================================================================
// Factory Function (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use pure functions directly: scanProject(), generateCapabilityId(), etc.
 */
export function createCapabilityDiscovery() {
  return {
    scanProject,
    generateCapabilityId,
    validateDiscoveredCapability,
    generateInputSchema,
  };
}

/**
 * @deprecated Use pure functions directly
 */
export class CapabilityDiscovery {
  async scanProject(projectPath: string, options?: DiscoveryOptions) {
    return scanProject(projectPath, options);
  }
  generateCapabilityId(discovered: DiscoveredCapability, projectId: string) {
    return generateCapabilityId(discovered, projectId);
  }
  validateDiscoveredCapability(capability: DiscoveredCapability) {
    return validateDiscoveredCapability(capability);
  }
  generateInputSchema(command: string) {
    return generateInputSchema(command);
  }
}

/**
 * @deprecated Use scanProject() directly
 */
export const capabilityDiscovery = createCapabilityDiscovery();
