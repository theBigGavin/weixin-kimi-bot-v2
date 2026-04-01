/**
 * ProjectSpace Manager
 * 
 * 管理多项目的创建、切换、查询
 * 维护 current 软链接实现快速切换
 */

import { mkdir, symlink, unlink } from 'fs/promises';

import { join } from 'path';
import {
  ProjectSpace,
  ProjectManagerConfig,
  CreateProjectParams,
  ProjectSwitchResult,
  ProjectStatus,
  createProjectSpace,

} from './types.js';
import { createWorkspaceManager } from '../workspace/index.js';

/**
 * 项目管理器选项
 */
export interface ProjectManagerOptions {
  /** Agent ID */
  agentId: string;
  /** Agent workspace 根路径 */
  agentWorkspacePath: string;
  /** 默认项目代码根目录 */
  defaultProjectsPath: string;
  /** 项目配置存储路径 */
  configPath: string;
}

/**
 * 项目管理错误
 */
export class ProjectManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly projectId?: string
  ) {
    super(message);
    this.name = 'ProjectManagerError';
  }
}

/**
 * 项目空间管理器
 */
export class ProjectManager {
  private config: ProjectManagerConfig;
  private options: ProjectManagerOptions;

  constructor(options: ProjectManagerOptions, savedConfig?: ProjectManagerConfig) {
    this.options = options;
    this.config = savedConfig || {
      list: [],
      defaultPath: options.defaultProjectsPath,
    };
  }

  /**
   * 获取所有项目
   */
  getProjects(): ProjectSpace[] {
    return [...this.config.list];
  }

  /**
   * 获取活跃项目
   */
  getActiveProject(): ProjectSpace | null {
    if (!this.config.activeProjectId) {
      return null;
    }
    return this.getProjectById(this.config.activeProjectId);
  }

  /**
   * 根据ID获取项目
   */
  getProjectById(id: string): ProjectSpace | null {
    return this.config.list.find(p => p.id === id) || null;
  }

  /**
   * 根据名称获取项目
   */
  getProjectByName(name: string): ProjectSpace | null {
    return this.config.list.find(p => p.name === name) || null;
  }

  /**
   * 创建新项目
   */
  async createProject(params: CreateProjectParams): Promise<ProjectSpace> {
    // 检查名称是否已存在
    const existing = this.getProjectByName(params.name);
    if (existing) {
      throw new ProjectManagerError(
        `项目 "${params.name}" 已存在`,
        'PROJECT_EXISTS',
        existing.id
      );
    }

    // 创建项目空间
    const project = createProjectSpace(
      params,
      this.options.agentWorkspacePath,
      this.options.defaultProjectsPath
    );

    // 创建项目代码目录
    await mkdir(project.path, { recursive: true });

    // 创建项目 workspace 目录结构
    const projectWorkspaceDir = join(
      this.options.agentWorkspacePath,
      'projects',
      project.id
    );
    await mkdir(projectWorkspaceDir, { recursive: true });

    // 初始化项目 workspace
    const workspaceManager = createWorkspaceManager(
      project.id,
      project.workspacePath,
      { paraEnabled: true }
    );
    await workspaceManager.initialize();

    // 创建 project 软链接
    const projectLinkPath = join(project.workspacePath, 'project');
    await symlink(project.path, projectLinkPath, 'dir');

    // 添加到列表
    this.config.list.push(project);

    // 如果需要，切换为活跃项目
    if (params.switchTo) {
      await this.switchToProject(project.id);
    }

    await this.saveConfig();

    console.log(`[ProjectManager] Created project: ${project.name} (${project.id})`);
    console.log(`  Path: ${project.path}`);
    console.log(`  Workspace: ${project.workspacePath}`);

    return project;
  }

  /**
   * 切换到指定项目
   */
  async switchToProject(projectId: string): Promise<ProjectSwitchResult> {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new ProjectManagerError(
        `项目 "${projectId}" 不存在`,
        'PROJECT_NOT_FOUND',
        projectId
      );
    }

    const previousProject = this.config.activeProjectId;
    
    // 更新活跃项目ID
    this.config.activeProjectId = projectId;
    project.lastUsedAt = Date.now();

    // 更新 current 软链接
    await this.updateCurrentSymlink(projectId);

    await this.saveConfig();

    console.log(`[ProjectManager] Switched to project: ${project.name}`);

    return {
      success: true,
      previousProject,
      currentProject: projectId,
      workspacePath: project.workspacePath,
      projectPath: project.path,
    };
  }

  /**
   * 获取当前工作目录（用于 ACP）
   * 
   * 如果指定了项目，返回项目 workspace
   * 否则返回通用 workspace
   */
  getWorkingDirectory(projectId?: string): string {
    if (projectId) {
      const project = this.getProjectById(projectId);
      if (project) {
        return project.workspacePath;
      }
    }

    // 如果有活跃项目，使用活跃项目的 workspace
    const activeProject = this.getActiveProject();
    if (activeProject) {
      return activeProject.workspacePath;
    }

    // 否则使用通用 workspace
    return this.options.agentWorkspacePath;
  }

  /**
   * 获取当前项目路径（用于显示和访问 project 软链接）
   */
  getCurrentProjectPath(): string | null {
    const activeProject = this.getActiveProject();
    return activeProject?.path || null;
  }

  /**
   * 更新项目状态
   */
  async updateProjectStatus(
    projectId: string,
    status: ProjectStatus
  ): Promise<void> {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new ProjectManagerError(
        `项目 "${projectId}" 不存在`,
        'PROJECT_NOT_FOUND',
        projectId
      );
    }

    project.status = status;
    project.updatedAt = Date.now();
    await this.saveConfig();
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string, deleteFiles: boolean = false): Promise<void> {
    const projectIndex = this.config.list.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      throw new ProjectManagerError(
        `项目 "${projectId}" 不存在`,
        'PROJECT_NOT_FOUND',
        projectId
      );
    }

    const project = this.config.list[projectIndex];

    // 如果删除的是活跃项目，先切换到 null
    if (this.config.activeProjectId === projectId) {
      this.config.activeProjectId = undefined;
      await this.removeCurrentSymlink();
    }

    // 从列表移除
    this.config.list.splice(projectIndex, 1);

    // 如果需要，删除文件
    if (deleteFiles) {
      // TODO: 实现递归删除目录
      // TODO: 实现项目文件删除
    }

    await this.saveConfig();

    console.log(`[ProjectManager] Deleted project: ${project.name}`);
  }

  /**
   * 获取配置（用于持久化）
   */
  getConfig(): ProjectManagerConfig {
    return { ...this.config };
  }

  /**
   * 按状态分组的项目列表
   */
  getProjectsByStatus(): Record<ProjectStatus, ProjectSpace[]> {
    const grouped: Record<ProjectStatus, ProjectSpace[]> = {
      [ProjectStatus.ACTIVE]: [],
      [ProjectStatus.PAUSED]: [],
      [ProjectStatus.COMPLETED]: [],
      [ProjectStatus.ARCHIVED]: [],
    };

    for (const project of this.config.list) {
      grouped[project.status].push(project);
    }

    return grouped;
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 更新 current 软链接
   */
  private async updateCurrentSymlink(projectId: string): Promise<void> {
    const projectsDir = join(this.options.agentWorkspacePath, 'projects');
    const currentLink = join(projectsDir, 'current');
    const targetDir = join(projectsDir, projectId);

    // 确保目录存在
    await mkdir(projectsDir, { recursive: true });

    // 删除旧的软链接
    try {
      await unlink(currentLink);
    } catch {
      // 可能不存在，忽略
    }

    // 创建新的软链接
    await symlink(targetDir, currentLink, 'dir');
  }

  /**
   * 删除 current 软链接
   */
  private async removeCurrentSymlink(): Promise<void> {
    const projectsDir = join(this.options.agentWorkspacePath, 'projects');
    const currentLink = join(projectsDir, 'current');

    try {
      await unlink(currentLink);
    } catch {
      // 可能不存在，忽略
    }
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    // TODO: 实际保存到文件
    // 这里可以集成 Store 模块
    // await writeFile(this.options.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * 加载配置
   */
  static async load(options: ProjectManagerOptions): Promise<ProjectManager> {
    // TODO: 从文件加载配置
    // try {
    //   const data = await readFile(options.configPath, 'utf-8');
    //   const config = JSON.parse(data) as ProjectManagerConfig;
    //   return new ProjectManager(options, config);
    // } catch {
    //   return new ProjectManager(options);
    // }
    return new ProjectManager(options);
  }
}

/**
 * 创建项目管理器的便捷函数
 */
export function createProjectManager(
  agentId: string,
  agentWorkspacePath: string,
  defaultProjectsPath: string
): ProjectManager {
  return new ProjectManager({
    agentId,
    agentWorkspacePath,
    defaultProjectsPath,
    configPath: join(agentWorkspacePath, 'projects.json'),
  });
}
