/**
 * ProjectSpace Module
 * 
 * 多项目管理和作品即能力
 */

// 类型定义
export {
  ProjectStatus,
  ProjectType,
  CapabilityEntryType,
  type ProjectSpace,
  type ProjectCapability,
  type ProjectManagerConfig,
  type AgentCapabilities,
  type CreateProjectParams,
  type ProjectSwitchResult,
  createProjectId,
  createProjectCapability,
  createProjectSpace,
  getProjectDisplayName,
  getProjectStatusDisplay,
  getProjectTypeDisplay,
  hasEnabledCapabilities,
  getEnabledCapabilities,
} from './types.js';

// 项目管理器
export {
  ProjectManager,
  createProjectManager,
  type ProjectManagerOptions,
  ProjectManagerError,
} from './manager.js';

// 能力自动发现
export {
  CapabilityDiscovery,
  DiscoverySource,
  type DiscoveredCapability,
  type DiscoveryOptions,
  type EntryPoint,
  type ValidationResult,
  capabilityDiscovery,
} from './capability-discovery.js';

// Agent 自举
export {
  AgentBootstrap,
  type BootstrapOptions,
  type BootstrapResult,
  type UnbootstrapResult,
  createAgentBootstrap,
} from './bootstrap.js';

// 项目模板
export {
  ProjectTemplateEngine,
  TemplateRegistry,
  TemplateType,
  type ProjectTemplate,
  type TemplateVariable,
  type TemplateFile,
  type CreateFromTemplateResult,
  type VariableValidationResult,
  createProjectTemplateEngine,
} from './templates.js';

// 项目分享/导入
export {
  ProjectShareManager,
  ShareCode,
  type ShareOptions,
  type ImportOptions,
  type SharedProjectMetadata,
  type ExportResult,
  type ImportResult,
  type ShareManagerConfig,
  createProjectShareManager,
} from './share.js';
