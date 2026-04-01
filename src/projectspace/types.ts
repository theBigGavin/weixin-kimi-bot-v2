/**
 * ProjectSpace 类型定义
 * 
 * 定义多项目管理和作品即能力的核心类型
 */

// ============================================
// 项目状态枚举
// ============================================
export enum ProjectStatus {
  ACTIVE = 'active',       // 活跃开发中
  PAUSED = 'paused',       // 暂停
  COMPLETED = 'completed', // 已完成
  ARCHIVED = 'archived',   // 已归档
}

// ============================================
// 项目类型枚举
// ============================================
export enum ProjectType {
  TOOL = 'tool',           // 可执行工具
  LIBRARY = 'library',     // 代码库/包
  SERVICE = 'service',     // 服务
  KNOWLEDGE = 'knowledge', // 知识库
  OTHER = 'other',         // 其他
}

// ============================================
// 项目能力入口类型
// ============================================
export enum CapabilityEntryType {
  CLI = 'cli',             // 命令行工具
  API = 'api',             // API 服务
  FUNCTION = 'function',   // 函数调用
  WORKFLOW = 'workflow',   // 工作流
}

// ============================================
// 项目能力定义
// ============================================
export interface ProjectCapability {
  /** 能力ID */
  id: string;
  /** 能力名称 */
  name: string;
  /** 能力描述 */
  description: string;
  
  /** 入口点配置 */
  entryPoint: {
    type: CapabilityEntryType;
    /** CLI 命令 */
    command?: string;
    /** API 端点 */
    endpoint?: string;
    /** 函数名 */
    function?: string;
    /** 工作流ID */
    workflowId?: string;
  };
  
  /** 使用统计 */
  usageCount: number;
  lastUsedAt?: number;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 元数据 */
  metadata?: {
    version?: string;
    author?: string;
    createdAt?: number;
  };
}

// ============================================
// 项目空间定义
// ============================================
export interface ProjectSpace {
  /** 项目唯一ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  
  /** 项目代码目录（真实路径） */
  path: string;
  
  /** 项目状态 */
  status: ProjectStatus;
  /** 项目类型 */
  type: ProjectType;
  
  /** 项目能力列表（作品即能力） */
  capabilities: ProjectCapability[];
  
  /** 项目专属的 workspace 子目录 */
  workspacePath: string;
  
  /** 项目管理 */
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  
  /** 版本控制 */
  version?: string;
  repository?: string;
  
  /** 扩展配置 */
  config?: {
    /** 自动构建命令 */
    buildCommand?: string;
    /** 测试命令 */
    testCommand?: string;
    /** 部署命令 */
    deployCommand?: string;
  };
}

// ============================================
// 项目管理配置
// ============================================
export interface ProjectManagerConfig {
  /** 当前活跃项目ID */
  activeProjectId?: string;
  /** 项目列表 */
  list: ProjectSpace[];
  /** 默认项目代码根目录 */
  defaultPath: string;
}

// ============================================
// Agent 能力清单
// ============================================
export interface AgentCapabilities {
  /** 内置能力ID列表 */
  builtin: string[];
  /** 来自项目的能力ID列表 */
  fromProjects: string[];
}

// ============================================
// 创建项目参数
// ============================================
export interface CreateProjectParams {
  name: string;
  description?: string;
  type: ProjectType;
  /** 项目代码目录，如不指定则使用默认路径 */
  path?: string;
  /** 是否立即切换为活跃项目 */
  switchTo?: boolean;
}

// ============================================
// 项目切换结果
// ============================================
export interface ProjectSwitchResult {
  success: boolean;
  previousProject?: string;
  currentProject: string;
  workspacePath: string;
  projectPath: string;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建项目空间ID
 */
export function createProjectId(name: string): string {
  const timestamp = Date.now().toString(36);
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${sanitized}-${timestamp}`;
}

/**
 * 创建项目能力
 */
export function createProjectCapability(
  id: string,
  name: string,
  description: string,
  entryPoint: ProjectCapability['entryPoint']
): ProjectCapability {
  return {
    id,
    name,
    description,
    entryPoint,
    usageCount: 0,
    enabled: true,
  };
}

/**
 * 创建项目空间
 */
export function createProjectSpace(
  params: CreateProjectParams,
  agentWorkspacePath: string,
  defaultProjectsPath: string
): ProjectSpace {
  const id = createProjectId(params.name);
  const now = Date.now();
  
  // 项目代码目录
  const projectPath = params.path || `${defaultProjectsPath}/${id}`;
  
  // 项目专属的 workspace 目录
  const projectWorkspacePath = `${agentWorkspacePath}/projects/${id}/workspace`;
  
  return {
    id,
    name: params.name,
    description: params.description,
    path: projectPath,
    status: ProjectStatus.ACTIVE,
    type: params.type,
    capabilities: [],
    workspacePath: projectWorkspacePath,
    createdAt: now,
    updatedAt: now,
    version: '0.1.0',
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取项目显示名称
 */
export function getProjectDisplayName(project: ProjectSpace): string {
  return `${project.name} [${project.type}]`;
}

/**
 * 获取项目状态显示
 */
export function getProjectStatusDisplay(status: ProjectStatus): string {
  const statusMap: Record<ProjectStatus, string> = {
    [ProjectStatus.ACTIVE]: '🟢 活跃',
    [ProjectStatus.PAUSED]: '⏸️ 暂停',
    [ProjectStatus.COMPLETED]: '✅ 完成',
    [ProjectStatus.ARCHIVED]: '📦 归档',
  };
  return statusMap[status] || status;
}

/**
 * 获取项目类型显示
 */
export function getProjectTypeDisplay(type: ProjectType): string {
  const typeMap: Record<ProjectType, string> = {
    [ProjectType.TOOL]: '🔧 工具',
    [ProjectType.LIBRARY]: '📚 库',
    [ProjectType.SERVICE]: '⚙️ 服务',
    [ProjectType.KNOWLEDGE]: '📖 知识',
    [ProjectType.OTHER]: '📦 其他',
  };
  return typeMap[type] || type;
}

/**
 * 检查项目是否有可用能力
 */
export function hasEnabledCapabilities(project: ProjectSpace): boolean {
  return project.capabilities.some(c => c.enabled);
}

/**
 * 获取项目的可用能力列表
 */
export function getEnabledCapabilities(project: ProjectSpace): ProjectCapability[] {
  return project.capabilities.filter(c => c.enabled);
}
