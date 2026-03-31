# ACP 迁移与旧代码清理计划

## 1. 概述

### 1.1 迁移目标

项目已确定使用 **Kimi ACP (Agent Communication Protocol)** 作为 AI 调用方式，需要：
- 全面移除旧的 Kimi CLI 直接调用代码
- 完善 ACP 模块的功能
- 清理不再使用的代码和依赖

### 1.2 当前代码状态

```
src/
├── kimi/                    # ❌ 旧的 Kimi CLI 代码，需移除
│   ├── client.ts           # CLI 命令构建和输出解析
│   ├── executor.ts         # CLI 子进程执行器
│   ├── types.ts            # CLI 相关类型
│   └── index.ts            # 导出
│
├── acp/                     # ✅ Kimi ACP 代码，需完善
│   ├── client.ts           # ACP 客户端
│   ├── manager.ts          # ACP 会话管理
│   ├── types.ts            # ACP 类型定义
│   └── index.ts            # 导出
│
├── index.ts                 # ❌ 使用旧 kimi executor 的入口
├── index-acp.ts             # ✅ 使用 ACP 的入口 (应重命名为 index.ts)
└── ...
```

## 2. 代码清理清单

### 2.1 完全删除的文件

| 文件路径 | 删除原因 | 替代方案 |
|---------|---------|---------|
| `src/kimi/client.ts` | CLI 命令构建 | ACP 客户端 |
| `src/kimi/executor.ts` | CLI 子进程执行 | ACP 调用 |
| `src/kimi/types.ts` | CLI 类型定义 | ACP 类型 |
| `src/kimi/index.ts` | CLI 模块导出 | 删除 |
| `src/kimi/` | 整个目录 | 删除 |
| `src/index.ts` | 使用旧 CLI | 使用 `src/index-acp.ts` 替代 |

### 2.2 修改的文件

| 文件路径 | 修改内容 |
|---------|---------|
| `package.json` | 移除 `start` 和 `dev` 脚本中对旧 index.ts 的引用 |
| `src/handlers/command-handler.ts` | 移除对 kimi executor 的引用 |
| `tsconfig.json` | 检查并更新路径映射 |

### 2.3 重命名的文件

| 原路径 | 新路径 |
|-------|-------|
| `src/index-acp.ts` | `src/index.ts` |

## 3. 删除计划

### 3.1 删除脚本

```bash
#!/bin/bash
# scripts/cleanup-old-kimi.sh

echo "=== 清理旧的 Kimi CLI 代码 ==="

# 删除旧的 kimi 目录
echo "删除 src/kimi/ 目录..."
rm -rf src/kimi

# 删除旧的入口文件
echo "删除旧的 src/index.ts..."
rm -f src/index.ts

# 将 index-acp.ts 重命名为 index.ts
echo "重命名 src/index-acp.ts -> src/index.ts..."
mv src/index-acp.ts src/index.ts

# 更新 package.json 中的脚本
echo "更新 package.json 脚本..."
# (这里可以使用 jq 或 sed 进行替换)

echo "✅ 清理完成"
echo ""
echo "请检查以下文件是否需要手动调整："
echo "  - package.json 中的 scripts"
echo "  - 任何 import 了旧 kimi 模块的文件"
```

### 3.2 代码迁移检查清单

```typescript
// 迁移前：旧的使用方式
import { executeKimi } from './kimi/executor.js';

const result = await executeKimi({
  prompt: text,
  model: config.model,
  cwd: config.cwd,
  sessionId: userSessionId,
});

// 迁移后：使用 ACP
import { ACPManager } from './acp/index.js';

const acpManager = new ACPManager({
  acpConfig: {
    command: 'kimi',
    args: ['acp'],
    cwd: process.cwd(),
  },
});

const response = await acpManager.prompt(userId, { text });
```

## 4. ACP 模块完善

### 4.1 ACP 类型定义 (更新)

```typescript
// src/acp/types.ts

/**
 * ACP 配置
 */
export interface ACPConfig {
  /** 命令 */
  command: string;
  /** 参数 */
  args: string[];
  /** 工作目录 */
  cwd: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

/**
 * ACP 会话配置
 */
export interface ACPSessionConfig {
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 系统提示词 */
  systemPrompt?: string;
}

/**
 * ACP Prompt
 */
export interface ACPPrompt {
  /** 文本内容 */
  text: string;
  /** 附件 */
  attachments?: ACPAttachment[];
}

/**
 * ACP 附件
 */
export interface ACPAttachment {
  /** 文件名 */
  name: string;
  /** MIME 类型 */
  mimeType: string;
  /** 内容 (base64) */
  content: string;
}

/**
 * ACP 响应
 */
export interface ACPResponse {
  /** 响应文本 */
  text: string;
  /** 工具调用记录 */
  toolCalls?: ACPToolCall[];
  /** 错误信息 */
  error?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 使用的 Token 数 */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * 工具调用
 */
export interface ACPToolCall {
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  parameters: Record<string, any>;
  /** 结果 */
  result?: string;
  /** 状态 */
  status: 'pending' | 'success' | 'error';
  /** 显示标题 */
  title?: string;
}

/**
 * ACP 错误码
 */
export enum ACPErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',
  PROMPT_FAILED = 'PROMPT_FAILED',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * ACP 错误
 */
export class ACPError extends Error {
  constructor(
    public code: ACPErrorCode,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ACPError';
  }
}
```

### 4.2 ACP 客户端 (更新)

```typescript
// src/acp/client.ts

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type {
  ACPConfig,
  ACPSessionConfig,
  ACPPrompt,
  ACPResponse,
  ACPError,
  ACPToolCall,
} from './types.js';
import { ACPErrorCode } from './types.js';

/**
 * ACP 客户端
 * 通过 stdio 与 Kimi ACP 进程通信
 */
export class ACPClient extends EventEmitter {
  private process: ReturnType<typeof spawn> | null = null;
  private config: ACPConfig;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: ACPConfig) {
    super();
    this.config = config;
  }

  /**
   * 连接到 ACP 服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ACP connection timeout'));
      }, 30000);

      this.process = spawn(this.config.command, this.config.args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn ACP: ${err.message}`));
      });

      this.process.stdout?.on('data', (data) => {
        this.handleMessage(data.toString());
      });

      this.process.stderr?.on('data', (data) => {
        console.error('[ACP stderr]', data.toString());
      });

      this.process.on('exit', (code) => {
        this.emit('disconnect', code);
        this.cleanup();
      });

      // 等待初始化消息
      const checkInit = () => {
        // 实际实现中应该解析 ACP 的初始化消息
        clearTimeout(timeout);
        resolve();
      };

      setTimeout(checkInit, 1000);
    });
  }

  /**
   * 创建会话
   */
  async createSession(config?: ACPSessionConfig): Promise<string> {
    const response = await this.sendRequest({
      method: 'initialize',
      params: {
        cwd: config?.cwd || this.config.cwd,
        env: config?.env,
        systemPrompt: config?.systemPrompt,
      },
    });

    return response.sessionId;
  }

  /**
   * 发送 Prompt
   */
  async prompt(sessionId: string, prompt: ACPPrompt): Promise<ACPResponse> {
    const response = await this.sendRequest({
      method: 'prompt',
      params: {
        sessionId,
        text: prompt.text,
        attachments: prompt.attachments,
      },
    });

    return {
      text: response.text || '',
      toolCalls: response.toolCalls,
      error: response.error,
      sessionId,
      tokens: response.tokens,
    };
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }
      
      this.process = null;
    }
    this.cleanup();
  }

  /**
   * 发送请求并等待响应
   */
  private sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('ACP not connected'));
        return;
      }

      const id = ++this.messageId;
      const message = JSON.stringify({ ...request, id }) + '\n';

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 120000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.process.stdin.write(message);
    });
  }

  /**
   * 处理响应消息
   */
  private handleMessage(data: string): void {
    try {
      const lines = data.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const message = JSON.parse(line);
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!;
          clearTimeout(timeout);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      }
    } catch (err) {
      console.error('[ACP] Failed to parse message:', err);
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    for (const { reject, timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}
```

### 4.3 ACP 管理器 (更新)

```typescript
// src/acp/manager.ts

import { ACPClient } from './client.js';
import type {
  ACPConfig,
  ACPSessionConfig,
  ACPPrompt,
  ACPResponse,
} from './types.js';

/**
 * 用户会话
 */
interface UserSession {
  userId: string;
  client: ACPClient;
  sessionId: string;
  lastActivity: number;
  config: {
    templateId?: string;
    systemPrompt?: string;
  };
}

/**
 * ACP 管理器选项
 */
export interface ACPManagerOptions {
  acpConfig: ACPConfig;
  sessionTimeout?: number;
  cleanupInterval?: number;
  defaultSystemPrompt?: string;
}

/**
 * ACP 管理器
 */
export class ACPManager {
  private sessions = new Map<string, UserSession>();
  private options: Required<ACPManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: ACPManagerOptions) {
    this.options = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      defaultSystemPrompt: '',
      ...options,
    };

    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.options.cleanupInterval);
  }

  /**
   * 获取或创建用户会话
   */
  private async getOrCreateSession(
    userId: string,
    config?: {
      templateId?: string;
      systemPrompt?: string;
    }
  ): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      return existing;
    }

    // 创建新客户端
    const client = new ACPClient(this.options.acpConfig);
    await client.connect();

    // 构建系统提示词
    const systemPrompt = config?.systemPrompt || this.options.defaultSystemPrompt;

    // 创建会话
    const sessionId = await client.createSession({
      cwd: this.options.acpConfig.cwd,
      systemPrompt,
    });

    const session: UserSession = {
      userId,
      client,
      sessionId,
      lastActivity: Date.now(),
      config: config || {},
    };

    this.sessions.set(userId, session);
    console.log(`[ACP] Created session for ${userId}: ${sessionId}`);

    return session;
  }

  /**
   * 发送 Prompt
   */
  async prompt(
    userId: string,
    prompt: ACPPrompt,
    config?: {
      templateId?: string;
      systemPrompt?: string;
    }
  ): Promise<ACPResponse> {
    try {
      const session = await this.getOrCreateSession(userId, config);
      const response = await session.client.prompt(session.sessionId, prompt);

      session.lastActivity = Date.now();

      return response;
    } catch (error) {
      console.error(`[ACP] Error for ${userId}:`, error);

      // 会话失败，移除以便下次重建
      await this.closeUserSession(userId);

      throw error;
    }
  }

  /**
   * 关闭指定用户的会话
   */
  async closeUserSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await session.client.disconnect();
      this.sessions.delete(userId);
      console.log(`[ACP] Closed session for ${userId}`);
    }
  }

  /**
   * 关闭所有会话
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((session) =>
      session.client.disconnect().catch((err) => {
        console.error(`[ACP] Error closing ${session.userId}:`, err);
      })
    );

    await Promise.all(promises);
    this.sessions.clear();

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('[ACP] All sessions closed');
  }

  /**
   * 清理不活跃会话
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > this.options.sessionTimeout) {
        toClose.push(userId);
      }
    }

    for (const userId of toClose) {
      console.log(`[ACP] Cleanup inactive session: ${userId}`);
      await this.closeUserSession(userId);
    }
  }
}
```

## 5. 更新 package.json

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "start": "node --import tsx src/index.ts",
    "dev": "tsx src/index.ts",
    "login": "node --import tsx src/login.ts",
    "lint": "tsc --noEmit",
    
    "agent:create": "node --import tsx src/cli/agent.ts create",
    "agent:list": "node --import tsx src/cli/agent.ts list",
    "agent:switch": "node --import tsx src/cli/agent.ts switch",
    
    "backup:create": "node --import tsx src/cli/backup.ts create",
    "backup:list": "node --import tsx src/cli/backup.ts list",
    "backup:restore": "node --import tsx src/cli/backup.ts restore",
    "backup:github-config": "node --import tsx src/cli/backup.ts github-config",
    "backup:github-sync": "node --import tsx src/cli/backup.ts github-sync",
    
    "cleanup": "node --import tsx scripts/cleanup.ts"
  }
}
```

## 6. 测试更新

### 6.1 移除旧测试

```bash
# 删除 kimi 相关测试
rm -rf tests/unit/kimi/
```

### 6.2 更新 ACP 测试

```typescript
// tests/unit/acp/manager.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACPManager } from '../../../src/acp/manager.js';

describe('ACPManager', () => {
  let manager: ACPManager;

  beforeEach(() => {
    manager = new ACPManager({
      acpConfig: {
        command: 'kimi',
        args: ['acp'],
        cwd: process.cwd(),
      },
      sessionTimeout: 1000,
      cleanupInterval: 500,
    });
  });

  afterEach(async () => {
    await manager.closeAll();
  });

  it('should create session for new user', async () => {
    // 测试实现
  });

  it('should reuse existing session', async () => {
    // 测试实现
  });

  it('should cleanup inactive sessions', async () => {
    // 测试实现
  });
});
```

## 7. 迁移检查清单

- [ ] 删除 `src/kimi/` 目录
- [ ] 删除旧的 `src/index.ts`
- [ ] 重命名 `src/index-acp.ts` -> `src/index.ts`
- [ ] 更新 `package.json` 脚本
- [ ] 更新所有 import 语句
- [ ] 删除 kimi 相关测试
- [ ] 完善 ACP 测试
- [ ] 验证构建通过
- [ ] 验证测试通过

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
