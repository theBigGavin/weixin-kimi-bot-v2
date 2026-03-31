/**
 * Capability Protocol v1.0
 * 
 * 智能任务路由协议 - 核心模块导出
 */

// 从父模块重新导出 ExecutionMode 和 TaskComplexity
export { ExecutionMode, TaskComplexity } from '../types.js';

// 类型定义
export {
  // 协议版本
  CAPABILITY_PROTOCOL_VERSION,
  
  // Schema
  type JSONSchema,
  
  // Capability
  type Capability,
  type CapabilityConstraints,
  type CapabilityExample,
  type ConfirmationCondition,
  type ResourceSpec,
  
  // TaskRequest
  type TaskRequest,
  type TaskAnalysis,
  type ComplexityAssessment,
  type ExecutionPlan,
  type ExecutionStep,
  type CommandStep,
  type StepCondition,
  type TaskMetadata,
  type ExecutionStrategy,
  
  // Intent Cache
  type IntentSignature,
  type CachedDecision,
  
  // Validation
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  
  // 工厂函数
  createComplexityAssessment,
  createTaskRequest,
  createCapability,
  createExecutionStep,
  createCommandStep,
  type CreateTaskRequestParams,
  type CreateCapabilityParams,
  type CreateExecutionStepParams,
  type CreateCommandStepParams,
} from './types.js';

// Capability Registry
export {
  CapabilityRegistry,
  capabilityRegistry,
  type CapabilityRegistryConfig,
  type CapabilityFilter,
  type CapabilityManifestItem,
  CapabilityRegistrationError,
  CapabilityNotFoundError,
} from './capability-registry.js';

// Protocol Validator
export {
  ProtocolValidator,
  protocolValidator,
  ValidationErrorCode,
  type ProtocolValidatorConfig,
  DEFAULT_VALIDATOR_CONFIG,
} from './validator.js';
