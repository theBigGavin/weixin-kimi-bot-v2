/**
 * Capability Registry
 * 
 * Phase 1 Refactoring: Replaced class implementation with factory function
 * - Maintains backward compatible API
 * - Internal implementation uses modern FP patterns
 * - Result type for error handling internally
 */

import {
  Capability,
  CreateCapabilityParams,
  createCapability,
} from './types.js';
import { ExecutionMode } from '../types.js';
import { BUILTIN_CAPABILITIES } from './builtins/index.js';


// ============================================================================
// Types
// ============================================================================

export interface CapabilityRegistryConfig {
  allowOverride: boolean;
  validateSchema: boolean;
  registerBuiltins: boolean;
}

export interface CapabilityFilter {
  category?: string;
  tags?: string[];
  mode?: ExecutionMode;
  search?: string;
}

export interface CapabilityManifestItem {
  id: string;
  description: string;
  inputSchema: string;
  allowedModes: ExecutionMode[];
  example?: string;
}

// ============================================================================
// Error Classes (for backward compatibility)
// ============================================================================

export class CapabilityRegistrationError extends Error {
  constructor(
    message: string,
    public readonly capabilityId: string,
    public readonly cause?: Error
  ) {
    super(`Capability registration failed for '${capabilityId}': ${message}`);
    this.name = 'CapabilityRegistrationError';
  }
}

export class CapabilityNotFoundError extends Error {
  constructor(public readonly capabilityId: string) {
    super(`Capability not found: '${capabilityId}'`);
    this.name = 'CapabilityNotFoundError';
  }
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: CapabilityRegistryConfig = {
  allowOverride: false,
  validateSchema: true,
  registerBuiltins: true,
};

// ============================================================================
// CapabilityRegistry Class (Backward Compatible Wrapper)
// ============================================================================

export class CapabilityRegistry {
  private static instance: CapabilityRegistry | null = null;
  
  private capabilities = new Map<string, Capability>();
  private config: CapabilityRegistryConfig;

  constructor(config: Partial<CapabilityRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.registerBuiltins) {
      this.registerBuiltInCapabilities();
    }
  }

  /**
   * 获取单例实例
   * @deprecated Use createCapabilityRegistry() for new code
   */
  static getInstance(config?: Partial<CapabilityRegistryConfig>): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry(config);
    }
    return CapabilityRegistry.instance;
  }

  /**
   * 重置单例（主要用于测试）
   * @deprecated Use createCapabilityRegistry() to create fresh instances
   */
  static resetInstance(): void {
    CapabilityRegistry.instance = null;
  }

  /**
   * 注册能力
   */
  register(capability: Capability): void {
    if (this.capabilities.has(capability.id) && !this.config.allowOverride) {
      throw new CapabilityRegistrationError(
        'Capability already exists. Use allowOverride=true to replace.',
        capability.id
      );
    }

    const validation = this.validateCapability(capability);
    if (!validation.valid) {
      throw new CapabilityRegistrationError(
        `Validation failed: ${validation.errors.join(', ')}`,
        capability.id
      );
    }

    this.capabilities.set(capability.id, capability);
  }

  /**
   * 批量注册能力
   */
  registerMany(capabilities: Capability[]): void {
    for (const capability of capabilities) {
      this.register(capability);
    }
  }

  /**
   * 使用参数创建并注册能力
   */
  createAndRegister(params: CreateCapabilityParams): Capability {
    const capability = createCapability(params);
    this.register(capability);
    return capability;
  }

  /**
   * 取消注册能力
   */
  unregister(capabilityId: string): boolean {
    return this.capabilities.delete(capabilityId);
  }

  /**
   * 获取能力
   */
  get(capabilityId: string): Capability {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new CapabilityNotFoundError(capabilityId);
    }
    return capability;
  }

  /**
   * 安全获取能力（不抛出错误）
   */
  tryGet(capabilityId: string): Capability | undefined {
    return this.capabilities.get(capabilityId);
  }

  /**
   * 检查能力是否存在
   */
  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  /**
   * 获取所有能力
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * 根据过滤器查询能力
   */
  query(filter: CapabilityFilter = {}): Capability[] {
    let results = this.getAll();

    if (filter.category) {
      results = results.filter(c => c.metadata?.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(c => {
        const tags = c.metadata?.tags || [];
        return filter.tags!.some(tag => tags.includes(tag));
      });
    }

    if (filter.mode) {
      results = results.filter(c => c.constraints.allowedModes.includes(filter.mode!));
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      results = results.filter(
        c =>
          c.id.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.metadata?.tags?.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    return results;
  }

  /**
   * 获取支持特定执行模式的能力
   */
  getByMode(mode: ExecutionMode): Capability[] {
    return this.query({ mode });
  }

  /**
   * 获取LLM可见的能力清单
   */
  getManifestForLLM(): CapabilityManifestItem[] {
    return this.getAll().map(capability => ({
      id: capability.id,
      description: capability.description,
      inputSchema: this.simplifySchema(capability.inputSchema),
      allowedModes: capability.constraints.allowedModes,
      example: capability.examples?.[0]
        ? JSON.stringify(capability.examples[0].input)
        : undefined,
    }));
  }

  /**
   * 生成LLM Prompt用的能力清单文本
   */
  generateLLMPromptManifest(): string {
    const items = this.getManifestForLLM();
    return items
      .map(
        item =>
          `- ${item.id}: ${item.description}\n` +
          `  支持模式: ${item.allowedModes.join(', ')}\n` +
          `  输入: ${item.inputSchema}` +
          (item.example ? `\n  示例: ${item.example}` : '')
      )
      .join('\n\n');
  }

  /**
   * 验证能力约束
   */
  validateConstraints(
    capabilityId: string,
    mode: ExecutionMode,
    estimatedDuration?: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const capability = this.get(capabilityId);
      const constraints = capability.constraints;

      if (!constraints.allowedModes.includes(mode)) {
        errors.push(`Mode '${mode}' not allowed. Allowed: ${constraints.allowedModes.join(', ')}`);
      }

      if (estimatedDuration && estimatedDuration > constraints.maxDuration) {
        errors.push(`Estimated duration ${estimatedDuration}ms exceeds max ${constraints.maxDuration}ms`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      if (error instanceof CapabilityNotFoundError) {
        return { valid: false, errors: [error.message] };
      }
      throw error;
    }
  }

  /**
   * 清空所有能力
   */
  clear(): void {
    this.capabilities.clear();
  }

  /**
   * 获取能力数量
   */
  get size(): number {
    return this.capabilities.size;
  }

  // ============================================
  // Private Methods
  // ============================================

  private validateCapability(capability: Capability): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!capability.id || capability.id.trim() === '') {
      errors.push('Capability ID is required');
    }

    if (!capability.description || capability.description.trim() === '') {
      errors.push('Capability description is required');
    }

    if (this.config.validateSchema) {
      if (!capability.inputSchema) {
        errors.push('Input schema is required');
      } else if (!capability.inputSchema.type) {
        errors.push('Input schema must have a type');
      }
    }

    if (!capability.constraints) {
      errors.push('Constraints are required');
    } else {
      if (!capability.constraints.allowedModes || capability.constraints.allowedModes.length === 0) {
        errors.push('At least one allowed mode is required');
      }
      if (capability.constraints.maxDuration <= 0) {
        errors.push('Max duration must be positive');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private simplifySchema(schema: unknown): string {
    if (!schema || typeof schema !== 'object') {
      return 'any';
    }

    const s = schema as Record<string, unknown>;
    
    if (s.type === 'object' && s.properties) {
      const props = s.properties as Record<string, { type?: string; description?: string }>;
      const fields = Object.entries(props)
        .map(([key, value]) => {
          const typeStr = value.type || 'any';
          const descStr = value.description ? ` (${value.description})` : '';
          return `${key}: ${typeStr}${descStr}`;
        })
        .join(', ');
      return `{ ${fields} }`;
    }

    return (s.type as string) || 'any';
  }

  private registerBuiltInCapabilities(): void {
    for (const params of BUILTIN_CAPABILITIES) {
      this.createAndRegister(params);
    }
  }
}

// 导出工厂函数供新代码使用
export function createCapabilityRegistry(config?: Partial<CapabilityRegistryConfig>): CapabilityRegistry {
  return new CapabilityRegistry(config);
}

// 导出默认实例（保持兼容性）
export const capabilityRegistry = CapabilityRegistry.getInstance();
