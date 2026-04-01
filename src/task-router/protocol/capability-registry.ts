/**
 * Capability Registry
 * 
 * 能力注册中心，管理系统中所有可用的能力
 * 支持能力的注册、查询、验证
 */

import {
  Capability,
  CreateCapabilityParams,
  createCapability,
} from './types.js';
import { ExecutionMode } from '../types.js';
import { BUILTIN_CAPABILITIES } from './builtins/index.js';

/**
 * 能力注册错误
 */
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

/**
 * 能力未找到错误
 */
export class CapabilityNotFoundError extends Error {
  constructor(public readonly capabilityId: string) {
    super(`Capability not found: '${capabilityId}'`);
    this.name = 'CapabilityNotFoundError';
  }
}

/**
 * 能力注册表配置
 */
export interface CapabilityRegistryConfig {
  /** 是否允许覆盖已注册的能力 */
  allowOverride: boolean;
  /** 是否验证Schema */
  validateSchema: boolean;
  /** 内置能力自动注册 */
  registerBuiltins: boolean;
}

/**
 * 能力查询过滤器
 */
export interface CapabilityFilter {
  /** 分类过滤 */
  category?: string;
  /** 标签过滤 */
  tags?: string[];
  /** 执行模式过滤 */
  mode?: ExecutionMode;
  /** 文本搜索 */
  search?: string;
}

/**
 * LLM可见的能力清单项
 */
export interface CapabilityManifestItem {
  id: string;
  description: string;
  inputSchema: string; // 简化后的Schema描述
  allowedModes: ExecutionMode[];
  example?: string;
}

/**
 * 能力注册中心
 * 
 * 单例模式，管理系统中所有能力
 */
export class CapabilityRegistry {
  private static instance: CapabilityRegistry | null = null;
  
  private capabilities = new Map<string, Capability>();
  private config: CapabilityRegistryConfig;

  private constructor(config: Partial<CapabilityRegistryConfig> = {}) {
    this.config = {
      allowOverride: false,
      validateSchema: true,
      registerBuiltins: true,
      ...config,
    };

    if (this.config.registerBuiltins) {
      this.registerBuiltInCapabilities();
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<CapabilityRegistryConfig>): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry(config);
    }
    return CapabilityRegistry.instance;
  }

  /**
   * 重置单例（主要用于测试）
   */
  static resetInstance(): void {
    CapabilityRegistry.instance = null;
  }

  /**
   * 注册能力
   */
  register(capability: Capability): void {
    // 检查是否已存在
    if (this.capabilities.has(capability.id) && !this.config.allowOverride) {
      throw new CapabilityRegistrationError(
        'Capability already exists. Use allowOverride=true to replace.',
        capability.id
      );
    }

    // 验证能力定义
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

    // 分类过滤
    if (filter.category) {
      results = results.filter(
        c => c.metadata?.category === filter.category
      );
    }

    // 标签过滤
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(c => {
        const tags = c.metadata?.tags || [];
        return filter.tags!.some(tag => tags.includes(tag));
      });
    }

    // 执行模式过滤
    if (filter.mode) {
      results = results.filter(c =>
        c.constraints.allowedModes.includes(filter.mode!)
      );
    }

    // 文本搜索
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
   * 
   * 返回简化版的能力描述，用于LLM Prompt
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

      // 验证执行模式
      if (!constraints.allowedModes.includes(mode)) {
        errors.push(
          `Mode '${mode}' not allowed. Allowed: ${constraints.allowedModes.join(', ')}`
        );
      }

      // 验证执行时长
      if (estimatedDuration && estimatedDuration > constraints.maxDuration) {
        errors.push(
          `Estimated duration ${estimatedDuration}ms exceeds max ${constraints.maxDuration}ms`
        );
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
  // 私有方法
  // ============================================

  /**
   * 验证能力定义
   */
  private validateCapability(capability: Capability): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证ID
    if (!capability.id || capability.id.trim() === '') {
      errors.push('Capability ID is required');
    }

    // 验证描述
    if (!capability.description || capability.description.trim() === '') {
      errors.push('Capability description is required');
    }

    // 验证Schema
    if (this.config.validateSchema) {
      if (!capability.inputSchema) {
        errors.push('Input schema is required');
      } else if (!capability.inputSchema.type) {
        errors.push('Input schema must have a type');
      }
    }

    // 验证约束
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

  /**
   * 简化Schema用于LLM展示
   */
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

  /**
   * 注册内置能力
   */
  private registerBuiltInCapabilities(): void {
    for (const params of BUILTIN_CAPABILITIES) {
      this.createAndRegister(params);
    }
  }
}

// 导出默认实例
export const capabilityRegistry = CapabilityRegistry.getInstance();
