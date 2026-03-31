/**
 * 权限管理模块
 * 
 * 管理系统用户角色和权限
 */

import { FounderManager } from '../founder/manager.js';
import { AgentManager } from '../agent/manager.js';
import { WechatManager } from '../wechat/manager.js';
import { Store } from '../store.js';

/**
 * 用户角色
 */
export enum UserRole {
  FOUNDER = 'founder',      // 创世 Agent 持有者
  OWNER = 'owner',          // Agent 创建者
  USER = 'user',            // 普通绑定用户
  GUEST = 'guest',          // 访客 (未绑定)
}

/**
 * 权限定义
 */
export enum Permission {
  // Agent 使用
  AGENT_USE = 'agent:use',
  AGENT_SWITCH = 'agent:switch',
  
  // Agent 管理 (所有者)
  AGENT_CONFIG = 'agent:config',
  AGENT_SHARE = 'agent:share',
  AGENT_DELETE_OWN = 'agent:delete:own',
  
  // 系统管理 (创世)
  FOUNDER_SYSTEM_CONFIG = 'founder:system:config',
  FOUNDER_SYSTEM_BACKUP = 'founder:system:backup',
  FOUNDER_AGENT_MANAGE_ALL = 'founder:agent:manage:all',
  FOUNDER_USER_VIEW_ALL = 'founder:user:view:all',
}

/**
 * 角色权限映射
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.FOUNDER]: Object.values(Permission),
  [UserRole.OWNER]: [
    Permission.AGENT_USE,
    Permission.AGENT_SWITCH,
    Permission.AGENT_CONFIG,
    Permission.AGENT_SHARE,
    Permission.AGENT_DELETE_OWN,
  ],
  [UserRole.USER]: [
    Permission.AGENT_USE,
    Permission.AGENT_SWITCH,
  ],
  [UserRole.GUEST]: [],
};

/**
 * 权限管理器
 */
export class PermissionManager {
  private founderManager: FounderManager;
  private agentManager: AgentManager;
  private wechatManager: WechatManager;

  constructor(store: Store) {
    this.founderManager = new FounderManager();
    this.agentManager = new AgentManager(store);
    this.wechatManager = new WechatManager(store);
  }

  /**
   * 获取用户在指定 Agent 上的角色
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 用户角色
   */
  async getRole(wechatId: string, agentId: string): Promise<UserRole> {
    // 检查是否为创世 Agent 持有者
    const isFounderCreator = await this.founderManager.isFounderCreator(wechatId);
    const isFounderAgent = await this.founderManager.isFounderAgent(agentId);
    
    if (isFounderCreator && isFounderAgent) {
      return UserRole.FOUNDER;
    }

    // 检查是否为 Agent 创建者
    const isOwner = await this.agentManager.isAgentOwner(wechatId, agentId);
    if (isOwner) {
      return UserRole.OWNER;
    }

    // 检查是否绑定了该 Agent
    const isBound = await this.wechatManager.isBound(wechatId, agentId);
    if (isBound) {
      return UserRole.USER;
    }

    return UserRole.GUEST;
  }

  /**
   * 检查用户是否有指定权限
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @param permission 权限
   * @returns 是否有权限
   */
  async hasPermission(
    wechatId: string,
    agentId: string,
    permission: Permission
  ): Promise<boolean> {
    const role = await this.getRole(wechatId, agentId);
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.includes(permission);
  }

  /**
   * 检查用户是否有任意指定权限
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @param permissions 权限列表
   * @returns 是否有任意权限
   */
  async hasAnyPermission(
    wechatId: string,
    agentId: string,
    ...permissions: Permission[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (await this.hasPermission(wechatId, agentId, perm)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查用户是否有所有指定权限
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @param permissions 权限列表
   * @returns 是否有所有权限
   */
  async hasAllPermissions(
    wechatId: string,
    agentId: string,
    ...permissions: Permission[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (!(await this.hasPermission(wechatId, agentId, perm))) {
        return false;
      }
    }
    return true;
  }

  /**
   * 检查用户是否有创世权限
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 是否有创世权限
   */
  async hasFounderPermission(wechatId: string, agentId: string): Promise<boolean> {
    const role = await this.getRole(wechatId, agentId);
    return role === UserRole.FOUNDER;
  }

  /**
   * 检查用户是否为创世 Agent 持有者（不限定 Agent）
   * @param wechatId 微信用户ID
   * @returns 是否为创世者
   */
  async isFounderHolder(wechatId: string): Promise<boolean> {
    return this.founderManager.isFounderCreator(wechatId);
  }

  /**
   * 获取用户的所有权限
   * @param wechatId 微信用户ID
   * @param agentId Agent ID
   * @returns 权限列表
   */
  async getPermissions(wechatId: string, agentId: string): Promise<Permission[]> {
    const role = await this.getRole(wechatId, agentId);
    return ROLE_PERMISSIONS[role];
  }

  /**
   * 获取角色名称（中文）
   * @param role 角色
   * @returns 角色名称
   */
  getRoleName(role: UserRole): string {
    const names: Record<UserRole, string> = {
      [UserRole.FOUNDER]: '创世者',
      [UserRole.OWNER]: '所有者',
      [UserRole.USER]: '用户',
      [UserRole.GUEST]: '访客',
    };
    return names[role];
  }

  /**
   * 获取权限名称（中文）
   * @param permission 权限
   * @returns 权限名称
   */
  getPermissionName(permission: Permission): string {
    const names: Record<Permission, string> = {
      [Permission.AGENT_USE]: '使用 Agent',
      [Permission.AGENT_SWITCH]: '切换 Agent',
      [Permission.AGENT_CONFIG]: '配置 Agent',
      [Permission.AGENT_SHARE]: '共享 Agent',
      [Permission.AGENT_DELETE_OWN]: '删除自己的 Agent',
      [Permission.FOUNDER_SYSTEM_CONFIG]: '系统配置',
      [Permission.FOUNDER_SYSTEM_BACKUP]: '系统备份',
      [Permission.FOUNDER_AGENT_MANAGE_ALL]: '管理所有 Agent',
      [Permission.FOUNDER_USER_VIEW_ALL]: '查看所有用户',
    };
    return names[permission];
  }
}

/**
 * 权限拒绝错误
 */
export class PermissionDeniedError extends Error {
  constructor(
    public permission: Permission,
    public wechatId: string,
    public agentId: string
  ) {
    super(`权限被拒绝: ${permission} (用户: ${wechatId}, Agent: ${agentId})`);
    this.name = 'PermissionDeniedError';
  }
}

export default PermissionManager;
