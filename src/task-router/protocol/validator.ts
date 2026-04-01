/**
 * Protocol Validator
 * 
 * 验证 TaskRequest 的完整性和有效性
 * 确保LLM输出的任务请求符合协议规范且可执行
 */

import {
  TaskRequest,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExecutionStep,
  CAPABILITY_PROTOCOL_VERSION,
} from './types.js';
import { ExecutionMode, TaskComplexity } from '../types.js';
import { CapabilityRegistry } from './capability-registry.js';

/**
 * 验证错误代码
 */
export enum ValidationErrorCode {
  // 结构错误
  INVALID_VERSION = 'INVALID_VERSION',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  
  // 分析错误
  EMPTY_INTENT = 'EMPTY_INTENT',
  NO_CAPABILITIES = 'NO_CAPABILITIES',
  INVALID_COMPLEXITY = 'INVALID_COMPLEXITY',
  
  // 计划错误
  NO_STEPS = 'NO_STEPS',
  INVALID_STRATEGY = 'INVALID_STRATEGY',
  CYCLIC_DEPENDENCIES = 'CYCLIC_DEPENDENCIES',
  INVALID_STEP_REFERENCE = 'INVALID_STEP_REFERENCE',
  
  // 步骤错误
  UNKNOWN_CAPABILITY = 'UNKNOWN_CAPABILITY',
  UNSUPPORTED_MODE = 'UNSUPPORTED_MODE',
  DURATION_EXCEEDED = 'DURATION_EXCEEDED',
  INVALID_CONDITION = 'INVALID_CONDITION',
  
  // 元数据错误
  INVALID_CONFIDENCE = 'INVALID_CONFIDENCE',
  INVALID_PRIORITY = 'INVALID_PRIORITY',
}

/**
 * 协议验证器配置
 */
export interface ProtocolValidatorConfig {
  /** 是否严格模式（警告视为错误） */
  strictMode: boolean;
  /** 是否验证能力存在性 */
  validateCapabilities: boolean;
  /** 是否验证依赖关系 */
  validateDependencies: boolean;
  /** 最大步骤数 */
  maxSteps: number;
  /** 最大预估时长（毫秒） */
  maxEstimatedDuration: number;
}

/**
 * 默认配置
 */
export const DEFAULT_VALIDATOR_CONFIG: ProtocolValidatorConfig = {
  strictMode: false,
  validateCapabilities: true,
  validateDependencies: true,
  maxSteps: 20,
  maxEstimatedDuration: 24 * 60 * 60 * 1000, // 24小时
};

/**
 * 协议验证器
 */
export class ProtocolValidator {
  private config: ProtocolValidatorConfig;
  private capabilityRegistry: CapabilityRegistry;

  constructor(
    config: Partial<ProtocolValidatorConfig> = {},
    registry?: CapabilityRegistry
  ) {
    this.config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
    this.capabilityRegistry = registry || CapabilityRegistry.getInstance();
  }

  /**
   * 验证 TaskRequest
   */
  validate(request: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. 基础结构验证
    if (!this.validateStructure(request, errors)) {
      return { valid: false, errors, warnings };
    }

    const taskRequest = request as TaskRequest;

    // 2. 版本验证
    this.validateVersion(taskRequest, errors);

    // 3. 分析部分验证
    this.validateAnalysis(taskRequest, errors, warnings);

    // 4. 计划部分验证
    this.validatePlan(taskRequest, errors, warnings);

    // 5. 元数据验证
    this.validateMetadata(taskRequest, errors, warnings);

    // 6. 严格模式：警告视为错误
    if (this.config.strictMode && warnings.length > 0) {
      errors.push(
        ...warnings.map(w => ({
          path: w.path,
          message: `[STRICT] ${w.message}`,
          code: ValidationErrorCode.INVALID_TYPE,
        }))
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.config.strictMode ? [] : warnings,
    };
  }

  /**
   * 快速验证（仅检查关键错误）
   */
  validateQuick(request: unknown): { valid: boolean; error?: string } {
    const result = this.validate(request);
    if (result.valid) {
      return { valid: true };
    }
    const criticalError = result.errors.find(
      e =>
        e.code === ValidationErrorCode.INVALID_VERSION ||
        e.code === ValidationErrorCode.MISSING_FIELD ||
        e.code === ValidationErrorCode.NO_STEPS
    );
    return {
      valid: false,
      error: criticalError?.message || result.errors[0]?.message || 'Validation failed',
    };
  }

  // ============================================
  // 私有验证方法
  // ============================================

  /**
   * 验证基础结构
   */
  private validateStructure(
    request: unknown,
    errors: ValidationError[]
  ): request is TaskRequest {
    if (!request || typeof request !== 'object') {
      errors.push({
        path: '',
        message: 'TaskRequest must be an object',
        code: ValidationErrorCode.INVALID_TYPE,
      });
      return false;
    }

    const requiredFields = ['protocolVersion', 'analysis', 'plan', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in (request as Record<string, unknown>))) {
        errors.push({
          path: '',
          message: `Missing required field: ${field}`,
          code: ValidationErrorCode.MISSING_FIELD,
        });
      }
    }

    return errors.length === 0;
  }

  /**
   * 验证协议版本
   */
  private validateVersion(request: TaskRequest, errors: ValidationError[]): void {
    if (request.protocolVersion !== CAPABILITY_PROTOCOL_VERSION) {
      errors.push({
        path: 'protocolVersion',
        message: `Invalid protocol version. Expected: ${CAPABILITY_PROTOCOL_VERSION}, Got: ${request.protocolVersion}`,
        code: ValidationErrorCode.INVALID_VERSION,
      });
    }
  }

  /**
   * 验证分析部分
   */
  private validateAnalysis(
    request: TaskRequest,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { analysis } = request;

    // 验证意图
    if (!analysis.userIntent || analysis.userIntent.trim() === '') {
      errors.push({
        path: 'analysis.userIntent',
        message: 'User intent cannot be empty',
        code: ValidationErrorCode.EMPTY_INTENT,
      });
    }

    // 验证能力列表
    if (!analysis.requiredCapabilities || analysis.requiredCapabilities.length === 0) {
      errors.push({
        path: 'analysis.requiredCapabilities',
        message: 'At least one capability is required',
        code: ValidationErrorCode.NO_CAPABILITIES,
      });
    } else {
      // 验证能力存在性
      if (this.config.validateCapabilities) {
        for (const capId of analysis.requiredCapabilities) {
          if (!this.capabilityRegistry.has(capId)) {
            errors.push({
              path: `analysis.requiredCapabilities`,
              message: `Unknown capability: ${capId}`,
              code: ValidationErrorCode.UNKNOWN_CAPABILITY,
            });
          }
        }
      }
    }

    // 验证复杂度
    if (analysis.complexity) {
      const { score, level } = analysis.complexity;
      
      if (typeof score !== 'number' || score < 0 || score > 100) {
        errors.push({
          path: 'analysis.complexity.score',
          message: 'Complexity score must be between 0 and 100',
          code: ValidationErrorCode.INVALID_COMPLEXITY,
        });
      }

      const validLevels = [TaskComplexity.SIMPLE, TaskComplexity.MODERATE, TaskComplexity.COMPLEX, TaskComplexity.VERY_COMPLEX];
      const levelNum = typeof level === 'string' ? parseInt(level, 10) : level;
      if (!validLevels.includes(levelNum)) {
        errors.push({
          path: 'analysis.complexity.level',
          message: `Invalid complexity level: ${level}`,
          code: ValidationErrorCode.INVALID_COMPLEXITY,
        });
      }

      // 警告：分数和等级不匹配
      if (score !== undefined && level !== undefined) {
        const expectedLevel = this.inferComplexityLevel(score);
        if (levelNum !== expectedLevel) {
          warnings.push({
            path: 'analysis.complexity',
            message: `Complexity score ${score} suggests level '${expectedLevel}', but got '${levelNum}'`,
          });
        }
      }
    }
  }

  /**
   * 验证计划部分
   */
  private validatePlan(
    request: TaskRequest,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { plan } = request;

    // 验证策略
    const validStrategies = ['single', 'sequential', 'parallel', 'conditional'];
    if (!validStrategies.includes(plan.strategy)) {
      errors.push({
        path: 'plan.strategy',
        message: `Invalid strategy: ${plan.strategy}. Valid: ${validStrategies.join(', ')}`,
        code: ValidationErrorCode.INVALID_STRATEGY,
      });
    }

    // 验证步骤
    if (!plan.steps || plan.steps.length === 0) {
      errors.push({
        path: 'plan.steps',
        message: 'At least one step is required',
        code: ValidationErrorCode.NO_STEPS,
      });
      return;
    }

    // 验证步骤数量
    if (plan.steps.length > this.config.maxSteps) {
      errors.push({
        path: 'plan.steps',
        message: `Too many steps: ${plan.steps.length} (max: ${this.config.maxSteps})`,
        code: ValidationErrorCode.NO_STEPS,
      });
    }

    // 收集所有步骤ID
    const stepIds = new Set<string>();
    for (const step of plan.steps) {
      if (stepIds.has(step.stepId)) {
        errors.push({
          path: `plan.steps`,
          message: `Duplicate step ID: ${step.stepId}`,
          code: ValidationErrorCode.INVALID_STEP_REFERENCE,
        });
      }
      stepIds.add(step.stepId);
    }

    // 验证每个步骤
    for (let i = 0; i < plan.steps.length; i++) {
      this.validateStep(plan.steps[i], i, stepIds, errors, warnings, this.config.validateDependencies);
    }

    // 验证循环依赖
    if (this.config.validateDependencies) {
      this.validateDependenciesGraph(plan.steps, errors);
    }
  }

  /**
   * 验证单个步骤
   */
  private validateStep(
    step: ExecutionStep,
    index: number,
    allStepIds: Set<string>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    validateStepRefs: boolean = true
  ): void {
    const path = `plan.steps[${index}]`;

    // 验证步骤ID
    if (!step.stepId) {
      errors.push({
        path: `${path}.stepId`,
        message: 'Step ID is required',
        code: ValidationErrorCode.MISSING_FIELD,
      });
    }

    // 验证能力
    if (!step.capability) {
      errors.push({
        path: `${path}.capability`,
        message: 'Capability is required',
        code: ValidationErrorCode.MISSING_FIELD,
      });
    } else if (this.config.validateCapabilities) {
      if (!this.capabilityRegistry.has(step.capability)) {
        errors.push({
          path: `${path}.capability`,
          message: `Unknown capability: ${step.capability}`,
          code: ValidationErrorCode.UNKNOWN_CAPABILITY,
        });
      } else {
        // 验证执行模式是否被能力支持
        const capability = this.capabilityRegistry.tryGet(step.capability);
        if (capability && !capability.constraints.allowedModes.includes(step.mode)) {
          errors.push({
            path: `${path}.mode`,
            message: `Mode '${step.mode}' not supported by capability '${step.capability}'. Allowed: ${capability.constraints.allowedModes.join(', ')}`,
            code: ValidationErrorCode.UNSUPPORTED_MODE,
          });
        }

        // 验证执行时长
        if (step.estimatedDuration && capability) {
          if (step.estimatedDuration > capability.constraints.maxDuration) {
            errors.push({
              path: `${path}.estimatedDuration`,
              message: `Estimated duration ${step.estimatedDuration}ms exceeds capability max ${capability.constraints.maxDuration}ms`,
              code: ValidationErrorCode.DURATION_EXCEEDED,
            });
          }
        }
      }
    }

    // 验证执行模式
    const validModes: ExecutionMode[] = [
      ExecutionMode.DIRECT, 
      ExecutionMode.LONGTASK, 
      ExecutionMode.FLOWTASK
    ];
    if (!validModes.includes(step.mode)) {
      errors.push({
        path: `${path}.mode`,
        message: `Invalid execution mode: ${step.mode}`,
        code: ValidationErrorCode.INVALID_TYPE,
      });
    }

    // 验证依赖和条件引用（仅在 validateStepRefs=true 时）
    if (validateStepRefs) {
      // 验证依赖
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!allStepIds.has(dep)) {
            errors.push({
              path: `${path}.dependencies`,
              message: `Unknown dependency: ${dep}`,
              code: ValidationErrorCode.INVALID_STEP_REFERENCE,
            });
          }
        }
      }

      // 验证条件
      if (step.condition) {
        if (!step.condition.if) {
          errors.push({
            path: `${path}.condition.if`,
            message: 'Condition expression is required',
            code: ValidationErrorCode.INVALID_CONDITION,
          });
        }
        if (!step.condition.then) {
          errors.push({
            path: `${path}.condition.then`,
            message: 'Then branch is required',
            code: ValidationErrorCode.INVALID_CONDITION,
          });
        }
        if (step.condition.then && !allStepIds.has(step.condition.then)) {
          errors.push({
            path: `${path}.condition.then`,
            message: `Unknown then step: ${step.condition.then}`,
            code: ValidationErrorCode.INVALID_STEP_REFERENCE,
          });
        }
        if (step.condition.else && !allStepIds.has(step.condition.else)) {
          errors.push({
            path: `${path}.condition.else`,
            message: `Unknown else step: ${step.condition.else}`,
            code: ValidationErrorCode.INVALID_STEP_REFERENCE,
          });
        }
      }
    } else {
      // 非严格模式：仅验证条件的结构，不验证引用
      if (step.condition) {
        if (!step.condition.if) {
          errors.push({
            path: `${path}.condition.if`,
            message: 'Condition expression is required',
            code: ValidationErrorCode.INVALID_CONDITION,
          });
        }
        if (!step.condition.then) {
          errors.push({
            path: `${path}.condition.then`,
            message: 'Then branch is required',
            code: ValidationErrorCode.INVALID_CONDITION,
          });
        }
      }
    }

    // 警告：缺少预估时长
    if (!step.estimatedDuration) {
      warnings.push({
        path,
        message: `Step '${step.stepId}' is missing estimatedDuration`,
      });
    }
  }

  /**
   * 验证依赖图（检测循环依赖）
   */
  private validateDependenciesGraph(
    steps: ExecutionStep[],
    errors: ValidationError[]
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const stepMap = new Map(steps.map(s => [s.stepId, s]));

    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = stepMap.get(stepId);
      if (step?.dependencies) {
        for (const dep of step.dependencies) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) {
              return true;
            }
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.stepId)) {
        if (hasCycle(step.stepId)) {
          errors.push({
            path: 'plan.steps',
            message: `Circular dependency detected involving step: ${step.stepId}`,
            code: ValidationErrorCode.CYCLIC_DEPENDENCIES,
          });
          return;
        }
      }
    }
  }

  /**
   * 验证元数据
   */
  private validateMetadata(
    request: TaskRequest,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { metadata } = request;

    // 验证置信度
    if (typeof metadata.confidence !== 'number') {
      errors.push({
        path: 'metadata.confidence',
        message: 'Confidence must be a number',
        code: ValidationErrorCode.INVALID_CONFIDENCE,
      });
    } else if (metadata.confidence < 0 || metadata.confidence > 1) {
      errors.push({
        path: 'metadata.confidence',
        message: 'Confidence must be between 0 and 1',
        code: ValidationErrorCode.INVALID_CONFIDENCE,
      });
    }

    // 验证优先级
    if (typeof metadata.priority !== 'number') {
      errors.push({
        path: 'metadata.priority',
        message: 'Priority must be a number',
        code: ValidationErrorCode.INVALID_PRIORITY,
      });
    } else if (metadata.priority < 1 || metadata.priority > 10) {
      warnings.push({
        path: 'metadata.priority',
        message: `Priority ${metadata.priority} is outside recommended range (1-10)`,
      });
    }

    // 验证预估时长
    if (metadata.estimatedDuration > this.config.maxEstimatedDuration) {
      warnings.push({
        path: 'metadata.estimatedDuration',
        message: `Estimated duration ${metadata.estimatedDuration}ms exceeds recommended max ${this.config.maxEstimatedDuration}ms`,
      });
    }
  }

  /**
   * 根据分数推断复杂度等级
   */
  private inferComplexityLevel(score: number): TaskComplexity {
    if (score >= 80) return TaskComplexity.VERY_COMPLEX;
    if (score >= 60) return TaskComplexity.COMPLEX;
    if (score >= 30) return TaskComplexity.MODERATE;
    return TaskComplexity.SIMPLE;
  }
}

// 导出默认实例
export const protocolValidator = new ProtocolValidator();
