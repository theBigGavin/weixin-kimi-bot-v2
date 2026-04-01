/**
 * Agent 自举
 * 
 * 将项目能力注册到 Capability Registry
 * 实现项目 -> 能力的动态转换，让 Agent 能够使用自己开发的项目作为能力
 */

import { CapabilityRegistry } from '../task-router/protocol/capability-registry.js';
import {
  Capability,
  CapabilityConstraints,
  JSONSchema,
  createCapability,
} from '../task-router/protocol/types.js';
import { ExecutionMode } from '../task-router/types.js';
import {
  CapabilityDiscovery,
  DiscoveredCapability,
  DiscoverySource,
} from './capability-discovery.js';

/**
 * 自举选项
 */
export interface BootstrapOptions {
  /** 强制覆盖已存在的能力 */
  force?: boolean;
  /** 验证能力定义 */
  validate?: boolean;
  /** 设置能力的执行模式 */
  defaultModes?: ExecutionMode[];
  /** 最大执行时长（毫秒） */
  maxDuration?: number;
  /** 标签前缀 */
  tagPrefix?: string;
}

/**
 * 自举结果
 */
export interface BootstrapResult {
  success: boolean;
  projectId: string;
  registeredCapabilities: string[];
  warnings: string[];
  errors: string[];
}

/**
 * 注销结果
 */
export interface UnbootstrapResult {
  success: boolean;
  projectId: string;
  unregisteredCount: number;
}

/**
 * Agent 自举器
 */
export class AgentBootstrap {
  private discovery: CapabilityDiscovery;

  constructor(private registry: CapabilityRegistry) {
    this.discovery = new CapabilityDiscovery();
  }

  /**
   * 从项目自举能力
   * 
   * 扫描项目目录，发现能力，注册到 CapabilityRegistry
   */
  async bootstrapFromProject(
    projectId: string,
    projectPath: string,
    options: BootstrapOptions = {}
  ): Promise<BootstrapResult> {
    const opts = {
      validate: true,
      defaultModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
      maxDuration: 300000, // 5分钟
      tagPrefix: 'project-capability',
      ...options,
    };

    const result: BootstrapResult = {
      success: true,
      projectId,
      registeredCapabilities: [],
      warnings: [],
      errors: [],
    };

    try {
      // 1. 发现项目能力
      const discovered = await this.discovery.scanProject(projectPath);

      if (discovered.length === 0) {
        result.warnings.push('未发现可注册的能力');
        return result;
      }

      // 2. 转换为标准 Capability 并注册
      for (const disc of discovered) {
        try {
          // 验证
          if (opts.validate) {
            const validation = this.discovery.validateDiscoveredCapability(disc);
            if (!validation.valid) {
              result.errors.push(
                `能力 "${disc.name}" 验证失败: ${validation.errors.join(', ')}`
              );
              continue;
            }
          }

          // 检查是否已存在
          const capabilityId = this.discovery.generateCapabilityId(disc, projectId);
          if (this.registry.has(capabilityId)) {
            if (!opts.force) {
              result.warnings.push(`能力 "${capabilityId}" 已存在，跳过`);
              continue;
            }
            // 强制模式：先注销
            this.registry.unregister(capabilityId);
          }

          // 转换为标准 Capability
          const capability = this.convertToCapability(disc, projectId, opts);

          // 注册
          this.registry.register(capability);
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
      result.errors.push(
        `扫描项目失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  /**
   * 将发现的能力转换为标准 Capability
   */
  convertToCapability(
    discovered: DiscoveredCapability,
    projectId: string,
    options: BootstrapOptions = {}
  ): Capability {
    const opts = {
      defaultModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
      maxDuration: 300000,
      tagPrefix: 'project-capability',
      ...options,
    };

    // 生成唯一ID
    const id = this.discovery.generateCapabilityId(discovered, projectId);

    // 确定执行模式
    const allowedModes = this.inferExecutionModes(discovered, opts.defaultModes);

    // 确定最大执行时长
    const maxDuration = opts.maxDuration || this.inferMaxDuration(discovered);

    // 构建约束
    const constraints: CapabilityConstraints = {
      allowedModes,
      maxDuration,
      requireConfirmation: discovered.entryPoint.type === 'workflow',
    };

    // 构建输入Schema（如果没有）
    const inputSchema: JSONSchema = discovered.inputSchema || {
      type: 'object',
      properties: {},
      description: `Input for ${discovered.name}`,
    };

    const capability = createCapability({
      id,
      description: `[${projectId}] ${discovered.description}`,
      inputSchema,
      allowedModes,
      maxDuration,
      requireConfirmation: typeof constraints.requireConfirmation === 'boolean' 
        ? constraints.requireConfirmation 
        : false,
      version: '1.0',
    });

    // 添加项目能力元数据
    capability.metadata = {
      category: 'project',
      tags: [opts.tagPrefix || 'project-capability', `project-${projectId}`],
      author: 'agent-bootstrap',
      createdAt: Date.now(),
    };

    return capability;
  }

  /**
   * 注销项目的所有能力
   */
  async unbootstrapProject(projectId: string): Promise<UnbootstrapResult> {
    const result: UnbootstrapResult = {
      success: true,
      projectId,
      unregisteredCount: 0,
    };

    // 获取所有属于该项目的能力
    const projectCapabilities = this.getProjectCapabilities(projectId);

    for (const cap of projectCapabilities) {
      if (this.registry.unregister(cap.id)) {
        result.unregisteredCount++;
      }
    }

    return result;
  }

  /**
   * 获取项目的所有能力
   */
  getProjectCapabilities(projectId: string): Capability[] {
    const prefix = `project-${projectId}-`;
    return this.registry.getAll().filter(cap => cap.id.startsWith(prefix));
  }

  /**
   * 获取项目能力数量
   */
  getProjectCapabilityCount(projectId: string): number {
    return this.getProjectCapabilities(projectId).length;
  }

  /**
   * 检查项目是否已自举
   */
  isProjectBootstrapped(projectId: string): boolean {
    return this.getProjectCapabilityCount(projectId) > 0;
  }

  /**
   * 执行项目能力
   * 
   * 通过注册表获取能力定义并执行
   */
  async executeProjectCapability(
    projectId: string,
    capabilityName: string,
    input: unknown
  ): Promise<unknown> {
    const capabilityId = `project-${projectId}-${capabilityName}`;
    const capability = this.registry.tryGet(capabilityId);

    if (!capability) {
      throw new Error(`能力未找到: ${capabilityId}`);
    }

    // 这里应该调用实际的执行器
    // 目前返回能力定义作为演示
    return {
      capability: capability.id,
      input,
      status: 'ready',
    };
  }

  /**
   * 推断执行模式
   */
  private inferExecutionModes(
    discovered: DiscoveredCapability,
    defaults: ExecutionMode[]
  ): ExecutionMode[] {
    // 根据入口点类型推断
    switch (discovered.entryPoint.type) {
      case 'cli':
        // CLI 命令通常支持 DIRECT 和 LONGTASK
        return [ExecutionMode.DIRECT, ExecutionMode.LONGTASK];
      case 'function':
        // 函数调用支持 DIRECT 和 LONGTASK
        return [ExecutionMode.DIRECT, ExecutionMode.LONGTASK];
      case 'workflow':
        // 工作流需要 FLOWTASK
        return [ExecutionMode.FLOWTASK, ExecutionMode.LONGTASK];
      case 'api':
        // API 通常 DIRECT
        return [ExecutionMode.DIRECT];
      default:
        return defaults;
    }
  }

  /**
   * 推断最大执行时长
   */
  private inferMaxDuration(discovered: DiscoveredCapability): number {
    // 根据来源推断
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
}

// 导出工厂函数
export function createAgentBootstrap(registry?: CapabilityRegistry): AgentBootstrap {
  return new AgentBootstrap(registry || CapabilityRegistry.getInstance());
}
