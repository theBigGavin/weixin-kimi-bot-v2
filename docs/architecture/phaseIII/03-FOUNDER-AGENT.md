# 创世 Agent 与权限系统设计

## 1. 概述

### 1.1 设计目标

- **系统初始化**：首次部署时，执行 `npm run login` 的用户自动绑定为创世 Agent
- **最高权限**：创世 Agent 拥有系统级管理权限
- **安全保障**：权限系统防止未授权访问敏感操作

### 1.2 权限层级

```
┌─────────────────────────────────────────────────────────────┐
│                    权限层级结构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 3: SYSTEM (系统级)                                   │
│  ├── 修改系统配置                                           │
│  ├── 备份/恢复数据                                          │
│  ├── 管理所有 Agent                                         │
│  └── 仅限：创世 Agent                                        │
│                                                             │
│  Level 2: OWNER (所有者级)                                   │
│  ├── 修改 Agent 配置                                        │
│  ├── 共享 Agent 给其他用户                                   │
│  ├── 删除自己创建的 Agent                                    │
│  └── 仅限：Agent 创建者                                      │
│                                                             │
│  Level 1: USER (用户级)                                      │
│  ├── 使用 Agent 对话                                        │
│  ├── 切换当前 Agent                                         │
│  └── 所有绑定的微信用户                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2. 创世 Agent 设计

### 2.1 创世 Agent 特性

```typescript
// src/founder/types.ts

/**
 * 创世 Agent 标识
 * 存储位置：~/.weixin-kimi-bot/founder.json
 */
export interface FounderInfo {
  /** 创世 Agent ID */
  agentId: string;
  /** 创建者微信ID */
  creatorWechatId: string;
  /** 创建时间 */
  createdAt: number;
  /** 系统版本 */
  systemVersion: string;
}

/**
 * 创世 Agent 权限
 */
export enum FounderPermission {
  // 系统管理
  SYSTEM_CONFIG = 'system:config',       // 修改系统配置
  SYSTEM_BACKUP = 'system:backup',       // 备份系统数据
  SYSTEM_RESTORE = 'system:restore',     // 恢复系统数据
  SYSTEM_LOGS = 'system:logs',           // 查看系统日志
  
  // Agent 管理
  AGENT_CREATE = 'agent:create',         // 为其他用户创建 Agent
  AGENT_DELETE_ANY = 'agent:delete:any', // 删除任意 Agent
  AGENT_MODIFY_ANY = 'agent:modify:any', // 修改任意 Agent
  AGENT_BIND_ANY = 'agent:bind:any',     // 绑定任意 Agent 到任意用户
  
  // 用户管理
  USER_LIST = 'user:list',               // 列出所有微信用户
  USER_BINDINGS = 'user:bindings',       // 查看用户绑定关系
}

/**
 * 所有创世 Agent 权限
 */
export const ALL_FOUNDER_PERMISSIONS: FounderPermission[] = [
  FounderPermission.SYSTEM_CONFIG,
  FounderPermission.SYSTEM_BACKUP,
  FounderPermission.SYSTEM_RESTORE,
  FounderPermission.SYSTEM_LOGS,
  FounderPermission.AGENT_CREATE,
  FounderPermission.AGENT_DELETE_ANY,
  FounderPermission.AGENT_MODIFY_ANY,
  FounderPermission.AGENT_BIND_ANY,
  FounderPermission.USER_LIST,
  FounderPermission.USER_BINDINGS,
];
```

### 2.2 创世 Agent 检测

```typescript
// src/founder/manager.ts

import { Paths } from '../paths.js';
import { createStore } from '../store.js';
import type { FounderInfo } from './types.js';

/**
 * 创世 Agent 管理器
 */
export class FounderManager {
  private store = createStore(Paths.base);
  private founderPath = 'founder';

  /**
   * 检查是否已设置创世 Agent
   */
  async hasFounder(): Promise<boolean> {
    const founder = await this.store.get<FounderInfo>(this.founderPath);
    return founder !== null;
  }

  /**
   * 获取创世 Agent ID
   */
  async getFounderAgentId(): Promise<string | null> {
    const founder = await this.store.get<FounderInfo>(this.founderPath);
    return founder?.agentId || null;
  }

  /**
   * 设置创世 Agent
   * 只能在首次登录时调用一次
   */
  async setFounder(
    agentId: string,
    creatorWechatId: string
  ): Promise<void> {
    // 检查是否已存在
    if (await this.hasFounder()) {
      throw new Error('创世 Agent 已存在，不能重复设置');
    }

    const founder: FounderInfo = {
      agentId,
      creatorWechatId,
      createdAt: Date.now(),
      systemVersion: '1.0.0',
    };

    await this.store.set(this.founderPath, founder);
  }

  /**
   * 验证指定 Agent 是否为创世 Agent
   */
  async isFounderAgent(agentId: string): Promise<boolean> {
    const founderId = await this.getFounderAgentId();
    return founderId === agentId;
  }

  /**
   * 获取创世 Agent 信息
   */
  async getFounderInfo(): Promise<FounderInfo | null> {
    return this.store.get<FounderInfo>(this.founderPath);
  }

  /**
   * 获取创世 Agent 绑定的微信用户
   */
  async getFounderWechatId(): Promise<string | null> {
    const info = await this.getFounderInfo();
    return info?.creatorWechatId || null;
  }
}
```

### 2.3 创世 Agent 命令

```typescript
// src/founder/commands.ts

/**
 * 创世 Agent 专用命令
 * 这些命令只有创世 Agent 可以使用
 */
export const FOUNDER_COMMANDS = {
  // 系统状态
  '/system status': async (ctx) => {
    return `系统状态:
- 运行时间: ${ctx.systemUptime}
- Agent 数量: ${ctx.agentCount}
- 微信用户: ${ctx.wechatUserCount}
- 版本: ${ctx.version}`;
  },

  // 列出所有 Agent
  '/system agents': async (ctx) => {
    const agents = await ctx.agentManager.listAgents();
    return `所有 Agent:\n${agents.map(a => 
      `- ${a.name} (${a.id}) - 创建于 ${new Date(a.createdAt).toLocaleDateString()}`
    ).join('\n')}`;
  },

  // 列出所有微信用户
  '/system users': async (ctx) => {
    const users = await ctx.wechatManager.listAllUsers();
    return `所有微信用户:\n${users.map(u => 
      `- ${u.nickname || u.id} (${u.idPrefix})`
    ).join('\n')}`;
  },

  // 查看用户绑定
  '/system bindings <wechatId>': async (ctx, wechatId) => {
    const bindings = await ctx.wechatManager.getBindings(wechatId);
    return `用户 ${wechatId} 的绑定:\n${bindings?.agents.map(b => 
      `- ${b.agentId} ${b.isDefault ? '(默认)' : ''}`
    ).join('\n') || '无绑定'}`;
  },

  // 手动触发备份
  '/system backup': async (ctx) => {
    const result = await ctx.backupManager.createBackup();
    return `备份完成: ${result.path}\n大小: ${result.size} bytes`;
  },

  // 查看备份列表
  '/system backups': async (ctx) => {
    const backups = await ctx.backupManager.listBackups();
    return `备份列表:\n${backups.map(b => 
      `- ${b.name} (${new Date(b.createdAt).toLocaleString()})`
    ).join('\n')}`;
  },

  // 系统配置查看
  '/system config': async (ctx) => {
    const config = await ctx.masterConfig.getConfig();
    return `系统配置:\n${JSON.stringify(config, null, 2)}`;
  },

  // 修改系统配置
  '/system config set <key> <value>': async (ctx, key, value) => {
    await ctx.masterConfig.set(key, value);
    return `已设置 ${key} = ${value}`;
  },

  // 强制删除任意 Agent (危险操作)
  '/system agent delete <agentId>': async (ctx, agentId) => {
    await ctx.agentManager.forceDeleteAgent(agentId);
    return `已删除 Agent: ${agentId}`;
  },

  // 为指定用户创建 Agent
  '/system agent create <wechatId> <name>': async (ctx, wechatId, name) => {
    const agent = await ctx.agentManager.createAgent({
      name,
      wechatId,
    });
    await ctx.wechatManager.bindAgent(wechatId, agent.id, false);
    return `已为 ${wechatId} 创建 Agent: ${agent.name} (${agent.id})`;
  },
};
```

## 3. 权限系统

### 3.1 权限管理器

```typescript
// src/auth/permissions.ts

import { FounderManager } from '../founder/manager.js';
import { AgentManager } from '../agent/manager.js';
import { WechatAccountManager } from '../wechat/manager.js';

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
  private founderManager = new FounderManager();
  private agentManager = new AgentManager();
  private wechatManager = new WechatAccountManager();

  /**
   * 获取用户在指定 Agent 上的角色
   */
  async getRole(
    wechatId: string,
    agentId: string
  ): Promise<UserRole> {
    // 检查是否为创世 Agent
    const isFounder = await this.founderManager.isFounderAgent(agentId);
    if (isFounder) {
      const founderWechatId = await this.founderManager.getFounderWechatId();
      if (founderWechatId === wechatId) {
        return UserRole.FOUNDER;
      }
    }

    // 检查是否为 Agent 创建者
    const agent = await this.agentManager.getAgent(agentId);
    if (agent?.primaryWechatId === wechatId) {
      return UserRole.OWNER;
    }

    // 检查是否绑定了该 Agent
    const bindings = await this.wechatManager.getBindings(wechatId);
    const hasBinding = bindings?.agents.some(b => b.agentId === agentId);
    if (hasBinding) {
      return UserRole.USER;
    }

    return UserRole.GUEST;
  }

  /**
   * 检查用户是否有指定权限
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
   * 检查用户是否有创世权限
   */
  async hasFounderPermission(wechatId: string, agentId: string): Promise<boolean> {
    const role = await this.getRole(wechatId, agentId);
    return role === UserRole.FOUNDER;
  }

  /**
   * 获取用户的所有权限
   */
  async getPermissions(
    wechatId: string,
    agentId: string
  ): Promise<Permission[]> {
    const role = await this.getRole(wechatId, agentId);
    return ROLE_PERMISSIONS[role];
  }
}
```

### 3.2 权限装饰器

```typescript
// src/auth/decorators.ts

import { PermissionManager, Permission } from './permissions.js';

/**
 * 需要权限的装饰器
 */
export function RequirePermission(...permissions: Permission[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 假设 context 包含 wechatId 和 agentId
      const ctx = args[0];
      const { wechatId, agentId } = ctx;

      const permManager = new PermissionManager();
      
      for (const perm of permissions) {
        const hasPerm = await permManager.hasPermission(wechatId, agentId, perm);
        if (!hasPerm) {
          throw new PermissionDeniedError(perm, wechatId, agentId);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
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
    super(`Permission denied: ${permission} for user ${wechatId} on agent ${agentId}`);
    this.name = 'PermissionDeniedError';
  }
}
```

### 3.3 权限使用示例

```typescript
// 在命令处理器中使用权限

class CommandHandler {
  private permManager = new PermissionManager();

  async handleCommand(
    wechatId: string,
    agentId: string,
    command: string,
    args: string[]
  ): Promise<string> {
    // 检查是否为创世命令
    if (command.startsWith('/system/')) {
      const isFounder = await this.permManager.hasFounderPermission(wechatId, agentId);
      if (!isFounder) {
        return '❌ 该命令仅限创世 Agent 使用';
      }
      return this.handleFounderCommand(command, args);
    }

    // 检查 Agent 配置权限
    if (command === '/agent/config') {
      const canConfig = await this.permManager.hasPermission(
        wechatId, agentId, Permission.AGENT_CONFIG
      );
      if (!canConfig) {
        return '❌ 您没有权限修改该 Agent 配置';
      }
      return this.handleAgentConfig(args);
    }

    // ... 其他命令
  }
}
```

## 4. 创世 Agent 初始化流程

### 4.1 首次登录序列图

```
┌────────┐    ┌─────────────┐    ┌────────────────┐    ┌─────────────┐    ┌──────────┐
│  User  │    │ npm run login│    │ FounderManager │    │ AgentManager │    │ WechatMgr │
└───┬────┘    └──────┬──────┘    └───────┬────────┘    └───────┬──────┘    └────┬─────┘
    │                │                    │                     │                │
    │  npm run login │                    │                     │                │
    │───────────────►│                    │                     │                │
    │                │                    │                     │                │
    │                │ hasFounder()?      │                     │                │
    │                │───────────────────►│                     │                │
    │                │                    │                     │                │
    │                │ false (首次登录)   │                     │                │
    │                │◄───────────────────│                     │                │
    │                │                    │                     │                │
    │                │ 显示 QR 码          │                     │                │
    │◄───────────────│                    │                     │                │
    │                │                    │                     │                │
    │ 扫码并确认      │                    │                     │                │
    │───────────────►│                    │                     │                │
    │                │                    │                     │                │
    │                │ 交互式配置向导      │                     │                │
    │◄───────────────│                    │                     │                │
    │                │                    │                     │                │
    │ 输入配置信息    │                    │                     │                │
    │───────────────►│                    │                     │                │
    │                │                    │                     │                │
    │                │ createAgent()      │                     │                │
    │                │──────────────────────────────────────────►│                │
    │                │                    │                     │                │
    │                │                    │                     │ bindAgent()    │
    │                │                    │                     │───────────────►│
    │                │                    │                     │                │
    │                │ setFounder()       │                     │                │
    │                │───────────────────►│                     │                │
    │                │                    │                     │                │
    │                │ 保存凭证到微信目录  │                     │                │
    │                │──────────────────────────────────────────────────────────►│
    │                │                    │                     │                │
    │ 登录成功提示    │                    │                     │                │
    │◄───────────────│                    │                     │                │
    │                │                    │                     │                │
```

### 4.2 初始化代码

```typescript
// src/login/init-founder.ts

/**
 * 初始化创世 Agent
 */
export async function initializeFounder(
  wechatId: string,
  loginResult: LoginResult
): Promise<void> {
  const founderManager = new FounderManager();
  const agentManager = new AgentManager();
  const wechatManager = new WechatAccountManager();

  // 1. 检查是否已存在创世 Agent
  if (await founderManager.hasFounder()) {
    console.log('创世 Agent 已存在，跳过初始化');
    return;
  }

  console.log('\n=== 首次登录，创建创世 Agent ===\n');

  // 2. 运行交互式配置
  const config = await runInteractiveConfig(wechatId, true);

  // 3. 生成 Agent ID
  const agentId = generateAgentId(config.name, wechatId);

  // 4. 创建 Agent (标记为创世 Agent)
  const agent = await agentManager.createAgent({
    id: agentId,
    name: config.name,
    wechatId,
    isFounder: true,
    templateId: config.templateId,
    model: config.model,
    enableMemory: config.enableMemory,
    features: config.features,
  });

  // 5. 绑定到微信账号
  await wechatManager.bindAgent(wechatId, agentId, true);

  // 6. 标记为创世 Agent
  await founderManager.setFounder(agentId, wechatId);

  // 7. 保存微信凭证
  await wechatManager.saveCredentials(wechatId, {
    botToken: loginResult.botToken,
    accountId: loginResult.accountId,
    baseUrl: loginResult.baseUrl,
    userId: loginResult.userId,
  });

  // 8. 输出成功信息
  console.log('\n✅ 创世 Agent 创建成功！');
  console.log(`   ID: ${agentId}`);
  console.log(`   名称: ${config.name}`);
  console.log(`   权限: 系统管理权限`);
  console.log('\n作为创世 Agent 持有者，您可以：');
  console.log('  - 查看系统状态: /system status');
  console.log('  - 管理所有 Agent: /system agents');
  console.log('  - 备份系统数据: /system backup');
  console.log('  - 查看所有用户: /system users');
}
```

## 5. 安全考虑

### 5.1 创世 Agent 转移

创世 Agent 理论上不应转移，但考虑到极端情况：

```typescript
/**
 * 转移创世 Agent (需要非常严格的验证)
 */
async function transferFounder(
  currentFounderWechatId: string,
  newFounderWechatId: string,
  verificationCode: string
): Promise<void> {
  // 1. 验证当前用户确实是创世者
  const founderWechatId = await founderManager.getFounderWechatId();
  if (founderWechatId !== currentFounderWechatId) {
    throw new Error('只有当前创世 Agent 持有者可以转移');
  }

  // 2. 多重验证 (例如：发送到微信的验证码)
  const isVerified = await verifyTransferCode(currentFounderWechatId, verificationCode);
  if (!isVerified) {
    throw new Error('验证失败');
  }

  // 3. 更新创世 Agent
  const newFounderAgentId = await findAgentForWechat(newFounderWechatId);
  await founderManager.setFounder(newFounderAgentId, newFounderWechatId);

  // 4. 记录转移日志
  await auditLog.record('founder_transferred', {
    from: currentFounderWechatId,
    to: newFounderWechatId,
    timestamp: Date.now(),
  });
}
```

### 5.2 权限审计日志

```typescript
// 记录重要权限操作

interface AuditLog {
  action: string;
  actor: string;      // 执行者 wechatId
  target: string;     // 目标 (agentId 或其他)
  timestamp: number;
  details: Record<string, any>;
}

// 在关键操作处记录日志
async function recordAuditLog(log: AuditLog): Promise<void> {
  const logs = await loadAuditLogs();
  logs.push(log);
  await saveAuditLogs(logs.slice(-1000)); // 保留最近1000条
}
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
