/**
 * Agent 自举 - Functional Programming Version
 * 
 * Phase 1 Refactoring: Class → Factory Function
 * - Pure functions where possible
 * - Immutable state
 * - Dependency injection via registry parameter
 */

import { CapabilityRegistry } from '../task-router/protocol/capability-registry.js';
import {
  Capability,
  createCapability,
} from '../task-router/protocol/types.js';
import { ExecutionMode } from '../task-router/types.js';
import {
  scanProject,
  generateCapabilityId,
  validateDiscoveredCapability,
  DiscoveredCapability,
  DiscoverySource,
} from './capability-discovery.js';

// ============================================================================
// Types
// ============================================================================

export interface BootstrapOptions {
  force?: boolean;
  validate?: boolean;
  defaultModes?: ExecutionMode[];
  maxDuration?: number;
  tagPrefix?: string;
}

export interface BootstrapResult {
  success: boolean;
  projectId: string;
  registeredCapabilities: string[];
  warnings: string[];
  errors: string[];
}

export interface UnbootstrapResult {
  success: boolean;
  projectId: string;
  unregisteredCount: number;
}

const DEFAULT_OPTIONS: Required<BootstrapOptions> = {
  force: false,
  validate: true,
  defaultModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
  maxDuration: 300000, // 5分钟
  tagPrefix: 'project-capability',
};

// ============================================================================
// Pure Functions
// ============================================================================

export async function bootstrapFromProject(
  registry: CapabilityRegistry,
  projectId: string,
  projectPath: string,
  options: BootstrapOptions = {}
): Promise<BootstrapResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const result: BootstrapResult = {
    success: true,
    projectId,
    registeredCapabilities: [],
    warnings: [],
    errors: [],
  };

  try {
    const discovered = await scanProject(projectPath);

    if (discovered.length === 0) {
      result.warnings.push('未发现可注册的能力');
      return result;
    }

    for (const disc of discovered) {
      try {
        if (opts.validate) {
          const validation = validateDiscoveredCapability(disc);
          if (!validation.valid) {
            result.errors.push(`能力 "${disc.name}" 验证失败: ${validation.errors.join(', ')}`);
            continue;
          }
        }

        const capabilityId = generateCapabilityId(disc, projectId);
        if (registry.has(capabilityId)) {
          if (!opts.force) {
            result.warnings.push(`能力 "${capabilityId}" 已存在，跳过`);
            continue;
          }
          registry.unregister(capabilityId);
        }

        const capability = convertToCapability(disc, projectId, opts);
        registry.register(capability);
        result.registeredCapabilities.push(capabilityId);
      } catch (error) {
        result.errors.push(
          `注册能力 "${disc.name}" 失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.success = false;
    result.errors.push(`扫描项目失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export function convertToCapability(
  discovered: DiscoveredCapability,
  projectId: string,
  options: BootstrapOptions = {}
): Capability {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const id = generateCapabilityId(discovered, projectId);
  const allowedModes = inferExecutionModes(discovered, opts.defaultModes!);
  const maxDuration = opts.maxDuration || inferMaxDuration(discovered);

  const capability = createCapability({
    id,
    description: `[${projectId}] ${discovered.description}`,
    inputSchema: discovered.inputSchema || { type: 'object', properties: {}, description: `Input for ${discovered.name}` },
    allowedModes,
    maxDuration,
    requireConfirmation: discovered.entryPoint.type === 'workflow',
    version: '1.0',
  });

  capability.metadata = {
    category: 'project',
    tags: [opts.tagPrefix!, `project-${projectId}`],
    author: 'agent-bootstrap',
    createdAt: Date.now(),
  };

  return capability;
}

export function unbootstrapProject(
  registry: CapabilityRegistry,
  projectId: string
): UnbootstrapResult {
  const result: UnbootstrapResult = {
    success: true,
    projectId,
    unregisteredCount: 0,
  };

  const projectCapabilities = getProjectCapabilities(registry, projectId);

  for (const cap of projectCapabilities) {
    if (registry.unregister(cap.id)) {
      result.unregisteredCount++;
    }
  }

  return result;
}

export function getProjectCapabilities(
  registry: CapabilityRegistry,
  projectId: string
): readonly Capability[] {
  const prefix = `project-${projectId}-`;
  return registry.getAll().filter(cap => cap.id.startsWith(prefix));
}

export function getProjectCapabilityCount(registry: CapabilityRegistry, projectId: string): number {
  return getProjectCapabilities(registry, projectId).length;
}

export function isProjectBootstrapped(registry: CapabilityRegistry, projectId: string): boolean {
  return getProjectCapabilityCount(registry, projectId) > 0;
}

export async function executeProjectCapability(
  registry: CapabilityRegistry,
  projectId: string,
  capabilityName: string,
  input: unknown
): Promise<unknown> {
  const capabilityId = `project-${projectId}-${capabilityName}`;
  const capability = registry.tryGet(capabilityId);

  if (!capability) {
    throw new Error(`能力未找到: ${capabilityId}`);
  }

  return {
    capability: capability.id,
    input,
    status: 'ready',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function inferExecutionModes(
  discovered: DiscoveredCapability,
  defaults: ExecutionMode[]
): ExecutionMode[] {
  switch (discovered.entryPoint.type) {
    case 'cli':
      return [ExecutionMode.DIRECT, ExecutionMode.LONGTASK];
    case 'function':
      return [ExecutionMode.DIRECT, ExecutionMode.LONGTASK];
    case 'workflow':
      return [ExecutionMode.FLOWTASK, ExecutionMode.LONGTASK];
    case 'api':
      return [ExecutionMode.DIRECT];
    default:
      return defaults;
  }
}

function inferMaxDuration(discovered: DiscoveredCapability): number {
  switch (discovered.source) {
    case DiscoverySource.BIN:
      return 600000; // 10分钟
    case DiscoverySource.API:
      return 30000; // 30秒
    case DiscoverySource.CAPABILITY_JSON:
      return 300000; // 5分钟
    default:
      return 300000; // 5分钟
  }
}

// ============================================================================
// Factory Function (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use pure functions directly with injected registry
 */
export function createAgentBootstrap(registry: CapabilityRegistry) {
  return {
    bootstrapFromProject: (projectId: string, projectPath: string, options?: BootstrapOptions) =>
      bootstrapFromProject(registry, projectId, projectPath, options),
    convertToCapability: (disc: DiscoveredCapability, projectId: string, options?: BootstrapOptions) =>
      convertToCapability(disc, projectId, options),
    unbootstrapProject: (projectId: string) => unbootstrapProject(registry, projectId),
    getProjectCapabilities: (projectId: string) => getProjectCapabilities(registry, projectId),
    getProjectCapabilityCount: (projectId: string) => getProjectCapabilityCount(registry, projectId),
    isProjectBootstrapped: (projectId: string) => isProjectBootstrapped(registry, projectId),
    executeProjectCapability: (projectId: string, name: string, input: unknown) =>
      executeProjectCapability(registry, projectId, name, input),
  };
}

/**
 * @deprecated Use pure functions directly
 */
export class AgentBootstrap {
  constructor(private registry: CapabilityRegistry) {}
  
  async bootstrapFromProject(projectId: string, projectPath: string, options?: BootstrapOptions) {
    return bootstrapFromProject(this.registry, projectId, projectPath, options);
  }
  
  convertToCapability(discovered: DiscoveredCapability, projectId: string, options?: BootstrapOptions) {
    return convertToCapability(discovered, projectId, options);
  }
  
  async unbootstrapProject(projectId: string) {
    return unbootstrapProject(this.registry, projectId);
  }
  
  getProjectCapabilities(projectId: string) {
    return getProjectCapabilities(this.registry, projectId);
  }
  
  getProjectCapabilityCount(projectId: string) {
    return getProjectCapabilityCount(this.registry, projectId);
  }
  
  isProjectBootstrapped(projectId: string) {
    return isProjectBootstrapped(this.registry, projectId);
  }
  
  async executeProjectCapability(projectId: string, name: string, input: unknown) {
    return executeProjectCapability(this.registry, projectId, name, input);
  }
}
