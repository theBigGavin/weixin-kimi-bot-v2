# Agent ID 与数据模型设计

## 1. Agent ID 生成策略

### 1.1 新格式定义

```
{Agent名称}_{微信ID前8位}_{4位随机码}

示例：
- 小助手_a1b2c3d4_x7k9
- 程序员_a1b2c3d4_m2n4
- 写作助手_e5f6g7h8_p3q5
```

### 1.2 格式组成说明

| 部分 | 说明 | 限制 |
|-----|------|-----|
| Agent名称 | 用户可读的名称 | 2-20字符，支持中英文 |
| 微信ID前8位 | 关联的微信用户标识 | 固定8位 |
| 4位随机码 | 防止冲突 | a-z, 0-9 |

### 1.3 ID 生成算法

```typescript
// src/agent/id-generator.ts

/**
 * Agent ID 组成部分
 */
export interface AgentIdComponents {
  name: string;           // Agent 名称
  wechatIdPrefix: string; // 微信ID前8位
  randomSuffix: string;   // 4位随机码
}

/**
 * 生成 Agent ID
 * @param name Agent 名称
 * @param wechatId 完整微信ID
 * @returns 格式：{name}_{wechatId前8位}_{4位随机码}
 */
export function generateAgentId(name: string, wechatId: string): string {
  const sanitizedName = sanitizeAgentName(name);
  const wechatPrefix = wechatId.slice(0, 8);
  const randomSuffix = generateRandomSuffix(4);
  return `${sanitizedName}_${wechatPrefix}_${randomSuffix}`;
}

/**
 * 清理 Agent 名称
 * - 移除非字母数字中文字符
 * - 替换为下划线
 * - 限制长度
 */
function sanitizeAgentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    .slice(0, 20)
    .toLowerCase();
}

/**
 * 生成随机后缀
 */
function generateRandomSuffix(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

/**
 * 解析 Agent ID
 * @param agentId Agent ID
 * @returns 组成部分，解析失败返回 null
 */
export function parseAgentId(agentId: string): AgentIdComponents | null {
  const match = agentId.match(/^([a-z0-9_]+)_([a-z0-9]{8})_([a-z0-9]{4})$/i);
  if (!match) return null;
  
  return {
    name: match[1],
    wechatIdPrefix: match[2],
    randomSuffix: match[3],
  };
}

/**
 * 验证 Agent ID 格式
 */
export function isValidAgentId(agentId: string): boolean {
  return parseAgentId(agentId) !== null;
}

/**
 * 从 Agent ID 提取微信ID前缀
 */
export function extractWechatPrefix(agentId: string): string | null {
  const parsed = parseAgentId(agentId);
  return parsed?.wechatIdPrefix || null;
}

/**
 * 检查 Agent ID 是否属于指定微信用户
 */
export function isAgentBoundToWechat(agentId: string, wechatId: string): boolean {
  const prefix = extractWechatPrefix(agentId);
  return prefix === wechatId.slice(0, 8);
}
```

### 1.4 ID 生成示例

```typescript
// 测试用例
import { describe, it, expect } from 'vitest';
import { generateAgentId, parseAgentId, isValidAgentId } from './id-generator.js';

describe('Agent ID Generation', () => {
  it('should generate valid agent ID', () => {
    const id = generateAgentId('小助手', 'wxid_a1b2c3d4e5f6');
    expect(id).toMatch(/^小助手_a1b2c3d4_[a-z0-9]{4}$/);
  });

  it('should sanitize special characters in name', () => {
    const id = generateAgentId('My Agent!', 'wxid_test12345');
    expect(id).toMatch(/^my_agent_test12345_[a-z0-9]{4}$/);
  });

  it('should truncate long names', () => {
    const id = generateAgentId('这是一个非常长的名称', 'wxid_a1b2c3d4');
    expect(id.split('_')[0].length).toBeLessThanOrEqual(20);
  });

  it('should parse valid agent ID', () => {
    const parsed = parseAgentId('小助手_a1b2c3d4_x7k9');
    expect(parsed).toEqual({
      name: '小助手',
      wechatIdPrefix: 'a1b2c3d4',
      randomSuffix: 'x7k9',
    });
  });

  it('should return null for invalid ID', () => {
    expect(parseAgentId('invalid')).toBeNull();
    expect(parseAgentId('name_123_abc')).toBeNull(); // 长度不足
  });
});
```

## 2. 数据模型设计

### 2.1 微信账号模型

```typescript
// src/wechat/types.ts

/**
 * 微信账号信息
 */
export interface WechatAccount {
  /** 完整微信ID */
  id: string;
  /** 前8位ID (用于目录名) */
  idPrefix: string;
  /** 昵称 */
  nickname?: string;
  /** 首次绑定时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActiveAt: number;
}

/**
 * 微信账号绑定配置
 * 存储位置：~/.weixin-kimi-bot/wechat-accounts/{idPrefix}/bindings.json
 */
export interface WechatBindings {
  /** 微信ID */
  wechatId: string;
  /** 绑定的 Agent 列表 */
  agents: Array<{
    agentId: string;
    isDefault: boolean;
    boundAt: number;
  }>;
  /** 默认 Agent ID */
  defaultAgentId: string | null;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * 微信登录凭证
 * 存储位置：~/.weixin-kimi-bot/wechat-accounts/{idPrefix}/credentials.json
 */
export interface WechatCredentials {
  /** Bot Token */
  botToken: string;
  /** 账号ID */
  accountId: string;
  /** Base URL */
  baseUrl: string;
  /** 可选用户ID */
  userId?: string;
  /** 保存时间 */
  savedAt: string;
}
```

### 2.2 Agent 模型更新

```typescript
// src/agent/types.ts

/**
 * Agent 配置 (更新版)
 */
export interface AgentConfig {
  /** Agent ID */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 创建时间 */
  createdAt: number;
  
  /** 绑定的微信账号列表 (支持多微信用户共享一个Agent) */
  boundWechatIds: string[];
  
  /** 是否创世 Agent */
  isFounder: boolean;
  
  /** 微信配置 */
  wechat: {
    /** 主要绑定的微信账号ID */
    primaryAccountId: string;
    nickname?: string;
  };
  
  /** 工作空间 */
  workspace: {
    path: string;
    createdAt: number;
  };
  
  /** AI 配置 */
  ai: {
    model: string;
    templateId: string;
    customSystemPrompt?: string;
    maxTurns: number;
    temperature?: number;
  };
  
  /** 记忆配置 */
  memory: {
    enabledL: boolean;
    enabledS: boolean;
    maxItems: number;
    autoExtract: boolean;
  };
  
  /** 功能特性 */
  features: {
    scheduledTasks: boolean;
    notifications: boolean;
    fileAccess: boolean;
    shellExec: boolean;
    webSearch: boolean;
  };
}

/**
 * 创建 Agent 配置参数 (更新版)
 */
export interface CreateAgentParams {
  name: string;
  wechatId: string;
  nickname?: string;
  isFounder?: boolean;
  templateId?: string;
  model?: string;
  maxTurns?: number;
  temperature?: number;
  enableMemory?: boolean;
  features?: Partial<AgentConfig['features']>;
  customSystemPrompt?: string;
}
```

### 2.3 主配置模型

```typescript
// src/config/master-config.ts

/**
 * 系统主配置
 * 存储位置：~/.weixin-kimi-bot/master-config.json
 */
export interface MasterConfig {
  /** 系统版本 */
  version: string;
  /** 创世 Agent ID */
  founderAgentId: string | null;
  /** 备份配置 */
  backup: {
    enabled: boolean;
    autoBackupInterval: number; // 毫秒
    githubSync: {
      enabled: boolean;
      repo?: string;
      branch?: string;
      token?: string;
      lastSyncAt?: number;
    };
  };
  /** 系统设置 */
  system: {
    maxAgentsPerWechat: number;
    maxWechatsPerAgent: number;
    defaultTemplate: string;
  };
}

/** 默认主配置 */
export const DEFAULT_MASTER_CONFIG: MasterConfig = {
  version: '1.0.0',
  founderAgentId: null,
  backup: {
    enabled: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24小时
    githubSync: {
      enabled: false,
    },
  },
  system: {
    maxAgentsPerWechat: 10,
    maxWechatsPerAgent: 5,
    defaultTemplate: 'general',
  },
};
```

## 3. 数据目录结构

### 3.1 完整目录树

```
~/.weixin-kimi-bot/
│
├── master-config.json              # 系统主配置
├── founder.json                    # 创世 Agent 标识
│
├── wechat-accounts/                # 微信账号数据 (按微信用户隔离)
│   └── {wechat_id_prefix}/         # 微信ID前8位作为目录名
│       ├── credentials.json        # 微信登录凭证
│       ├── bindings.json           # Agent 绑定关系
│       └── last-active.json        # 最后活动时间
│
├── agents/                         # Agent 数据 (按Agent ID隔离)
│   └── {agent_id}/                 # Agent名称_微信ID前8位_4位随机码
│       ├── config.json             # Agent 配置
│       ├── memory.json             # 长期记忆
│       ├── workspace/              # 工作目录
│       │   └── projects/           # 项目子目录
│       └── context/                # 会话上下文
│           ├── sessions/           # 历史会话
│           └── current.json        # 当前会话
│
├── templates/                      # 自定义模板
│   └── {template_id}.json
│
└── backups/                        # 备份目录
    ├── auto/                       # 自动备份
    │   └── {timestamp}.tar.gz
    └── github-sync/                # GitHub 同步缓存
```

### 3.2 目录路径工具

```typescript
// src/paths.ts

import path from 'node:path';
import os from 'node:os';

const HOME_DIR = process.env.WEIXIN_KIMI_BOT_HOME || os.homedir();
const BASE_DIR = path.join(HOME_DIR, '.weixin-kimi-bot');

export const Paths = {
  /** 基础目录 */
  base: BASE_DIR,
  
  /** 主配置 */
  masterConfig: () => path.join(BASE_DIR, 'master-config.json'),
  founder: () => path.join(BASE_DIR, 'founder.json'),
  
  /** 微信账号目录 */
  wechatAccountDir: (wechatId: string) => 
    path.join(BASE_DIR, 'wechat-accounts', wechatId.slice(0, 8)),
  wechatCredentials: (wechatId: string) => 
    path.join(Paths.wechatAccountDir(wechatId), 'credentials.json'),
  wechatBindings: (wechatId: string) => 
    path.join(Paths.wechatAccountDir(wechatId), 'bindings.json'),
  wechatLastActive: (wechatId: string) => 
    path.join(Paths.wechatAccountDir(wechatId), 'last-active.json'),
  
  /** Agent 目录 */
  agentDir: (agentId: string) => 
    path.join(BASE_DIR, 'agents', agentId),
  agentConfig: (agentId: string) => 
    path.join(Paths.agentDir(agentId), 'config.json'),
  agentMemory: (agentId: string) => 
    path.join(Paths.agentDir(agentId), 'memory.json'),
  agentWorkspace: (agentId: string) => 
    path.join(Paths.agentDir(agentId), 'workspace'),
  agentContextDir: (agentId: string) => 
    path.join(Paths.agentDir(agentId), 'context'),
  
  /** 备份目录 */
  backups: {
    base: path.join(BASE_DIR, 'backups'),
    auto: path.join(BASE_DIR, 'backups', 'auto'),
    githubSync: path.join(BASE_DIR, 'backups', 'github-sync'),
  },
  
  /** 模板目录 */
  templates: path.join(BASE_DIR, 'templates'),
} as const;
```

## 4. 数据访问层 (DAL) 设计

### 4.1 微信账号管理器

```typescript
// src/wechat/manager.ts

import { Paths } from '../paths.js';
import { createStore } from '../store.js';
import type { WechatAccount, WechatBindings, WechatCredentials } from './types.js';

/**
 * 微信账号管理器
 */
export class WechatAccountManager {
  private store = createStore(Paths.base);

  /**
   * 创建或获取微信账号
   */
  async createAccount(wechatId: string, nickname?: string): Promise<WechatAccount> {
    const account: WechatAccount = {
      id: wechatId,
      idPrefix: wechatId.slice(0, 8),
      nickname,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    // 创建目录结构
    const accountDir = Paths.wechatAccountDir(wechatId);
    await this.store.set(`wechat-accounts/${account.idPrefix}/account`, account);
    
    return account;
  }

  /**
   * 保存微信凭证 (按微信用户隔离)
   */
  async saveCredentials(wechatId: string, credentials: Omit<WechatCredentials, 'savedAt'>): Promise<void> {
    const data: WechatCredentials = {
      ...credentials,
      savedAt: new Date().toISOString(),
    };
    
    await this.store.set(`wechat-accounts/${wechatId.slice(0, 8)}/credentials`, data);
  }

  /**
   * 加载微信凭证
   */
  async loadCredentials(wechatId: string): Promise<WechatCredentials | null> {
    return this.store.get(`wechat-accounts/${wechatId.slice(0, 8)}/credentials`);
  }

  /**
   * 绑定 Agent 到微信账号
   */
  async bindAgent(wechatId: string, agentId: string, isDefault: boolean = false): Promise<void> {
    const key = `wechat-accounts/${wechatId.slice(0, 8)}/bindings`;
    const existing = await this.store.get<WechatBindings>(key);
    
    const bindings: WechatBindings = existing || {
      wechatId,
      agents: [],
      defaultAgentId: null,
      updatedAt: Date.now(),
    };

    // 检查是否已绑定
    const existingBinding = bindings.agents.find(a => a.agentId === agentId);
    if (!existingBinding) {
      bindings.agents.push({
        agentId,
        isDefault,
        boundAt: Date.now(),
      });
    }

    // 更新默认 Agent
    if (isDefault) {
      bindings.agents.forEach(a => a.isDefault = (a.agentId === agentId));
      bindings.defaultAgentId = agentId;
    }

    bindings.updatedAt = Date.now();
    await this.store.set(key, bindings);
  }

  /**
   * 获取微信账号绑定的 Agent 列表
   */
  async getBindings(wechatId: string): Promise<WechatBindings | null> {
    return this.store.get(`wechat-accounts/${wechatId.slice(0, 8)}/bindings`);
  }

  /**
   * 获取默认 Agent ID
   */
  async getDefaultAgentId(wechatId: string): Promise<string | null> {
    const bindings = await this.getBindings(wechatId);
    return bindings?.defaultAgentId || null;
  }
}
```

## 5. 与旧格式的对比

| 方面 | 旧格式 | 新格式 |
|-----|-------|-------|
| ID 格式 | `agent_1774886864822_zpjire` | `小助手_a1b2c3d4_x7k9` |
| 可读性 | 差 (时间戳+随机码) | 好 (名称+微信前缀) |
| 关联性 | 无法直接识别微信用户 | 可直接识别绑定的微信用户 |
| 目录结构 | 全局存储 | 按微信用户和Agent双重隔离 |
| 凭证存储 | 全局 credentials.json | 按微信用户隔离存储 |

## 6. 迁移策略

根据要求 #6：**开发阶段无需迁移，直接重置**

```typescript
// scripts/cleanup.ts - 清理脚本

import { rmSync } from 'node:fs';
import { Paths } from '../src/paths.js';

console.log('清理旧数据...');

// 删除旧数据目录
const oldPaths = [
  Paths.base,
];

for (const p of oldPaths) {
  try {
    rmSync(p, { recursive: true });
    console.log(`  ✓ 已删除: ${p}`);
  } catch {
    // 忽略不存在的目录
  }
}

console.log('\n清理完成。下次启动时将创建新的数据结构。');
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
