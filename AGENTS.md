# weixin-kimi-bot 项目指南

## 项目概述

weixin-kimi-bot 是一个基于 TDD（测试驱动开发）方法重新开发的微信智能助手系统。它将 Kimi AI 的能力与微信消息系统结合，通过多 Agent 架构为每个微信用户提供个性化的 AI 助手服务。

**核心目标**: 构建一个可靠的可自我迭代的智能助手，确保 Agent 能够持续跟踪和理解用户上下文。

**主要特性**:
- 多 Agent 架构：每个微信用户拥有独立的 Agent，包含专属配置、记忆和工作空间
- 上下文感知：四层架构（会话/任务/项目/用户画像）实现真正的连续对话
- 智能任务路由：根据任务复杂度自动选择执行模式（Direct/LongTask/FlowTask）
- 长期记忆：自动提取和存储用户偏好、项目信息、重要事实
- 能力模板：预置角色模板（程序员、作家、交易员等）快速切换助手风格

## 技术栈

- **开发语言**: TypeScript 5.0+
- **运行时**: Node.js 18+ (ES2022)
- **模块系统**: ES Modules (NodeNext)
- **测试框架**: Vitest 1.2+
- **Mock 工具**: vi (Vitest 内置)
- **覆盖率工具**: @vitest/coverage-v8
- **断言库**: Vitest 内置 expect
- **构建工具**: TypeScript 编译器 (tsc)
- **开发运行**: tsx
- **微信协议**: 腾讯 iLink HTTP API
- **AI 服务**: ACP (Agent Client Protocol)
- **进程管理**: PM2 (可选)

## 项目结构

```
weixin-kimi-bot/
├── src/                      # 源代码目录
│   ├── agent/                # Agent 管理模块
│   │   ├── types.ts          # Agent 领域类型定义和工厂函数
│   │   ├── manager.ts        # Agent 生命周期管理（CRUD、状态管理）
│   │   ├── validation.ts     # Agent 配置验证
│   │   └── prompt-builder.ts # 系统提示词构建
│   ├── context/              # 上下文感知系统
│   │   ├── types.ts          # 状态/意图/会话类型定义
│   │   ├── state-machine.ts  # 对话状态机（FSM）
│   │   ├── intent-resolver.ts    # 意图识别
│   │   ├── reference-resolver.ts # 指代消解
│   │   ├── session-context.ts    # 会话管理
│   │   ├── output-parser.ts      # 结构化输出解析
│   │   └── persistence.ts        # 上下文持久化
│   ├── handlers/             # 消息处理层
│   │   ├── message-handler.ts    # 主消息处理器
│   │   ├── command-handler.ts    # 命令处理器
│   │   └── message-utils.ts      # 消息工具
│   ├── task-router/          # 智能任务路由
│   │   ├── types.ts          # 任务提交、分析、决策类型
│   │   ├── analyzer.ts       # 任务分析器
│   │   └── decision.ts       # 决策引擎
│   ├── longtask/             # 长任务管理（后台执行）
│   │   ├── types.ts          # 长任务类型定义
│   │   └── manager.ts        # 长任务生命周期管理
│   ├── flowtask/             # 结构化流程任务
│   │   ├── types.ts          # 流程任务类型定义
│   │   └── manager.ts        # 流程任务管理
│   ├── workflow/             # 确定性工作流引擎
│   │   └── engine.ts         # 工作流执行引擎
│   ├── acp/                  # ACP (Agent Client Protocol) 集成
│   │   ├── types.ts          # ACP 类型定义
│   │   ├── client.ts         # ACP 客户端
│   │   └── manager.ts        # ACP 连接管理器
│   ├── ilink/                # 微信 iLink 协议封装
│   │   ├── types.ts          # 微信消息类型定义
│   │   └── client.ts         # iLink API 客户端
│   ├── logging/              # 日志系统
│   │   ├── types.ts          # 日志类型定义
│   │   └── index.ts          # 日志实现（基于 pino）
│   ├── scheduler/            # 定时任务调度
│   │   └── manager.ts        # Cron 任务管理器
│   ├── memory/               # 长期记忆管理（预留目录）
│   ├── notifications/        # 多渠道通知服务
│   │   └── service.ts        # 通知服务实现
│   ├── services/             # 服务层（消息轮询、会话管理）
│   │   └── message-polling.ts    # 微信消息轮询服务
│   ├── debug/                # 调试接口（供 Kimi Code 测试）
│   │   ├── interface.ts      # HTTP 调试服务器
│   │   └── client.ts         # 调试客户端
│   ├── templates/            # 能力模板
│   │   ├── definitions.ts    # 模板定义和工具函数
│   │   ├── loader.ts         # 模板加载器
│   │   ├── templates.json    # 模板清单
│   │   └── prompts/          # 模板系统提示词（Markdown）
│   │       ├── general.md
│   │       ├── programmer.md
│   │       ├── writer.md
│   │       └── ...
│   ├── types/                # 全局类型定义
│   │   └── index.ts          # 核心领域模型、枚举、工具函数
│   ├── utils/                # 工具函数
│   │   └── helpers.ts        # 通用辅助函数
│   └── store.ts              # 数据持久化模块（JSON文件存储）
├── tests/                    # 测试目录
│   ├── __helpers__/          # 测试辅助函数（预留）
│   ├── unit/                 # 单元测试（与src结构对应）
│   │   ├── agent/
│   │   ├── context/
│   │   ├── flowtask/
│   │   ├── handlers/
│   │   ├── ilink/
│   │   ├── acp/
│   │   ├── longtask/
│   │   ├── notifications/
│   │   ├── scheduler/
│   │   ├── services/
│   │   ├── store.test.ts
│   │   ├── task-router/
│   │   ├── templates/
│   │   ├── types/
│   │   ├── utils/
│   │   └── workflow/
│   ├── integration/          # 集成测试
│   └── e2e/                  # 端到端测试
├── docs/                     # 项目文档
│   ├── architecture/         # 架构设计文档
│   │   ├── architecture-overview.md
│   │   ├── context-system.md
│   │   ├── TDD_REDVELOPMENT_GUIDE.md
│   │   ├── TDD_QUICK_REFERENCE.md
│   │   ├── TDD_6PHASE_DEVELOPMENT_PLAN.md
│   │   └── ARCHITECTURE_VISUAL.md
│   ├── development/          # 开发文档
│   │   ├── setup.md
│   │   ├── tdd-guide.md
│   │   └── contributing.md
│   ├── api/                  # API 文档
│   ├── deployment/           # 部署文档
│   ├── guides/               # 用户指南
│   └── *.md                  # 阶段完成报告
├── dist/                     # 编译输出目录（TypeScript -> JavaScript）
├── coverage/                 # 测试覆盖率报告
├── package.json              # 项目配置和依赖
├── tsconfig.json             # TypeScript 配置
├── vitest.config.ts          # Vitest 测试配置
└── .gitignore                # Git 忽略配置
```

## 运行时数据目录

应用程序在运行时会在用户主目录下创建以下数据结构：

```
~/.weixin-kimi-bot/
├── agents/                      # 每个 Agent 的独立配置和数据
│   ├── {agent_id}/             # Agent 实例目录
│   │   ├── config.json         # Agent 配置
│   │   ├── memory.json         # 长期记忆
│   │   ├── context/            # 对话上下文历史
│   │   └── credentials.json    # 微信登录凭证
├── templates/                   # 自定义能力模板
├── shared/                      # 共享数据
│   └── scheduled-tasks.json    # 定时任务
├── logs/                        # 应用日志目录
│   ├── app-YYYY-MM-DD.log      # 应用日志（按日期滚动）
│   └── ...
└── master-config.json          # 主配置
```

## 架构概览

### 六层架构

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户交互层 (微信客户端 / Web 控制台 / CLI / 定时任务)        │
├─────────────────────────────────────────────────────────────┤
│ 2. 消息处理层 (命令处理器 / 聊天处理器 / 文件处理器)            │
├─────────────────────────────────────────────────────────────┤
│ 3. 任务路由层 (任务分析器 / 决策引擎 / 执行器选择)              │
├─────────────────────────────────────────────────────────────┤
│ 4. 上下文感知层 (状态机 / 意图识别 / 指代消解 / 会话管理)        │
├─────────────────────────────────────────────────────────────┤
│ 5. Agent 管理层 (Agent 配置 / 能力模板 / 记忆管理 / Prompt 构建) │
├─────────────────────────────────────────────────────────────┤
│ 6. 执行引擎层 (ACP 调用 / 工作流引擎 / 定时任务 / 通知服务)      │
└─────────────────────────────────────────────────────────────┘
```

### 对话状态机

系统使用有限状态机管理对话流程：

| 状态 | 说明 |
|------|------|
| `IDLE` | 空闲，等待新任务 |
| `EXPLORING` | 探索需求 |
| `CLARIFYING` | 澄清疑问 |
| `PROPOSING` | 提供方案选项 |
| `COMPARING` | 对比选项 |
| `CONFIRMING` | 等待用户确认 |
| `REFINING` | 调整优化 |
| `PLANNING` | 制定执行计划 |
| `EXECUTINGT` | 执行中（T阶段）|
| `EXECUTINGD` | 执行中（D阶段）|
| `EXECUTINGI` | 执行中（I阶段）|
| `EXECUTINGE` | 执行中（E阶段）|
| `REVIEWING` | 审查结果 |
| `COMPLETED` | 已完成 |

### 任务路由决策

根据任务特征自动选择执行模式：

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| Direct | 简单问答、查资料、小修改 | 同步执行，快速响应 |
| LongTask | 代码重构、深度分析、批量搜索 | 异步后台执行，支持进度通知 |
| FlowTask | 部署上线、数据迁移、架构设计 | 结构化流程，人机协作确认 |

### 日志系统

系统使用基于 **pino** 的日志模块，支持结构化日志输出。

#### 日志级别

| 级别 | 优先级 | 用途 |
|------|--------|------|
| trace | 10 | 最详细的追踪信息 |
| debug | 20 | 调试信息 |
| info | 30 | 一般信息（默认） |
| warn | 40 | 警告信息 |
| error | 50 | 错误信息 |
| fatal | 60 | 致命错误 |

#### 使用示例

```typescript
import { createAgentLogger, getDefaultLogger, info, error } from './logging/index.js';

// 创建带 Agent 上下文的日志记录器
const logger = createAgentLogger('agent_123', 'wxid_test');
logger.info('消息已收到', { content: 'hello' });
logger.error('处理失败', error);

// 使用默认日志记录器
getDefaultLogger().warn('警告信息');

// 使用快捷函数
info('一般信息');
error('错误信息', err);
```

#### 环境配置

| 环境 | 日志级别 | 文件输出 | 彩色输出 |
|------|----------|----------|----------|
| development | debug | 是 | 是 |
| test | error | 否 | 否 |
| production | info | 是 | 否 |

通过设置 `NODE_ENV` 环境变量自动切换配置。

## 开发规范

### TDD 开发流程（强制）

必须严格遵守 **红-绿-重构** 循环：

1. **🔴 红阶段**: 编写测试 → 运行测试确认失败
2. **🟢 绿阶段**: 编写最简单代码使测试通过
3. **🔵 重构阶段**: 在测试保护下优化代码

**禁止行为**:
- ❌ 直接修改功能代码而不写测试
- ❌ 先改代码再补测试
- ❌ 跳过红阶段（不验证测试失败）

### 测试规范

#### 测试文件组织
```
src/agent/manager.ts              → tests/unit/agent/manager.test.ts
src/context/state-machine.ts      → tests/unit/context/state-machine.test.ts
src/utils/helpers.ts              → tests/unit/utils/helpers.test.ts
```

#### 测试结构（Given-When-Then）
```typescript
describe('AgentManager', () => {
  describe('createAgent', () => {
    it('应该使用默认配置创建 Agent', async () => {
      // Given (Arrange)
      const wechatId = 'wxid_test123';
      
      // When (Act)
      const agent = await manager.createAgent(wechatId);
      
      // Then (Assert)
      expect(agent).toBeDefined();
      expect(agent.wechat.accountId).toBe(wechatId);
    });
  });
});
```

#### 覆盖率要求

| 层级 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 |
|------|----------|------------|------------|
| 单元测试 | ≥80% | ≥80% | ≥75% |
| 集成测试 | ≥60% | ≥60% | ≥50% |
| 整体 | ≥80% | ≥80% | ≥75% |

## 构建和测试命令

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 运行所有测试
npm test

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# UI 测试模式
npm run test:ui

# 开发运行（tsx 直接执行 TypeScript）
npm run dev

# 类型检查（不生成输出）
npm run lint

# 运行特定测试文件
npm test -- tests/unit/agent/manager.test.ts

# 运行特定测试（按名称）
npm test -- -t "应该使用默认配置创建 Agent"

# 失败时停止
npm test -- --bail

# 并行运行
npm test -- --parallel
```

## 代码风格指南

### 命名规范

- **文件**: 小写，连字符分隔 (e.g., `state-machine.ts`)
- **类**: PascalCase (e.g., `AgentManager`)
- **接口**: PascalCase，前缀 I 可选 (e.g., `IAgentRepository`)
- **函数/变量**: camelCase (e.g., `createAgent`)
- **常量**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **枚举**: PascalCase，成员 UPPER_SNAKE_CASE
- **类型别名**: PascalCase (e.g., `AgentConfig`)

### 模块设计原则

1. **单一职责**: 每个类/模块只做一件事
2. **依赖注入**: 通过构造函数注入依赖，避免直接实例化
3. **接口隔离**: 定义清晰的接口，实现可替换
4. **类型优先**: 先定义类型，再实现逻辑

### 文件组织规范

每个模块目录通常包含：
- `types.ts` - 类型定义、接口、枚举、工厂函数
- `manager.ts` / `service.ts` - 主要业务逻辑
- `utils.ts` / `helpers.ts` - 工具函数
- 其他具体实现文件

### 错误处理

```typescript
// 定义领域错误
class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

// 使用 Result 类型
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
```

### 导入规范

- 使用 `.js` 扩展名导入（ES Modules 要求）
- 按顺序：内置模块 → 第三方模块 → 本地模块
- 使用命名空间导入组织类型

```typescript
import { readFile } from 'fs/promises';
import { describe, it, expect } from 'vitest';
import { AgentManager } from './manager.js';
import type { AgentConfig } from '../types/index.js';
```

## 开发顺序建议

项目按 6 个阶段开发，每阶段 1-2 周：

| 阶段 | 模块 | 目标 |
|------|------|------|
| 1 | types/, utils/, store.ts, ilink/, kimi/ | 基础设施层 |
| 2 | agent/, templates/ | Agent 核心层 |
| 3 | context/ | 上下文感知层 |
| 4 | task-router/, longtask/, flowtask/ | 任务处理层 |
| 5 | handlers/, workflow/, scheduler/ | 业务编排层 |
| 6 | services/, notifications/, E2E 测试 | 系统集成层 |

## 关键配置

### TypeScript 配置 (tsconfig.json)

- `target`: ES2022
- `module`: NodeNext
- `moduleResolution`: NodeNext
- `strict`: true
- `outDir`: ./dist
- `rootDir`: ./src
- `declaration`: true (生成 .d.ts 类型声明)
- `sourceMap`: true (生成 source map)

### Vitest 配置 (vitest.config.ts)

- 测试环境: Node.js
- 测试文件: `tests/**/*.test.ts`
- 覆盖率: v8 provider
- 覆盖率阈值: lines ≥80%, functions ≥80%, branches ≥75%
- 超时: 10秒

### Agent 配置示例

```typescript
interface AgentConfig {
  id: string;                    // 名称_日期_8位随机码
  name: string;
  wechat: { accountId: string; nickname?: string; };
  workspace: { path: string; createdAt: number; };
  ai: {
    model: string;
    templateId: string;
    customSystemPrompt?: string;
    maxTurns: number;
    temperature?: number;
  };
  memory: {
    enabledL: boolean;           // 长期记忆
    enabledS: boolean;           // 短期记忆
    maxItems: number;
    autoExtract: boolean;
  };
  features: {
    scheduledTasks: boolean;
    notifications: boolean;
    fileAccess: boolean;
    shellExec: boolean;
    webSearch: boolean;
  };
}
```

## 安全注意事项

1. **敏感信息**: 微信凭证、API Key 等存储在 `credentials.json`，禁止提交到版本控制
2. **命令执行**: Agent 的 `shellExec` 权限默认关闭，开启后需警告用户
3. **文件访问**: 限制 Agent 只能访问其工作目录内的文件
4. **输入验证**: 所有用户输入必须经过验证，防止注入攻击
5. **错误信息**: 对外暴露的错误信息不应包含内部实现细节
6. **数据隔离**: 每个 Agent 的数据必须完全隔离，防止交叉访问

## Debug Interface - 调试接口

在系统正常运行时（`npm run dev`）提供 HTTP 接口，供 Kimi Code / Agent 直接发送消息并接收响应。

### 快速使用

```bash
# 1. 启动系统（带调试接口）
DEBUG_ENABLED=true npm run dev

# 2. 发送测试消息
npm run ask "Hello"
npm run ask "/help"
```

### 核心特性

- **真实交互**: 不走 Mock，真实调用业务逻辑
- **简单直接**: 一行命令即可测试
- **HTTP 接口**: 支持编程调用

### 文档
- `DEBUG_INTERFACE.md` - 完整使用指南

## 文档索引

### 架构文档
- `docs/architecture/architecture-overview.md` - 多 Agent 架构设计
- `docs/architecture/context-system.md` - 上下文感知架构
- `docs/architecture/TDD_REDVELOPMENT_GUIDE.md` - TDD 开发指导
- `docs/architecture/TDD_QUICK_REFERENCE.md` - TDD 快速参考
- `docs/architecture/TDD_6PHASE_DEVELOPMENT_PLAN.md` - 6阶段开发计划
- `docs/architecture/ARCHITECTURE_VISUAL.md` - 架构可视化图表

### 开发文档
- `docs/development/setup.md` - 开发环境搭建
- `docs/development/tdd-guide.md` - TDD 开发指南
- `docs/development/contributing.md` - 贡献指南

### 其他文档
- `docs/api/README.md` - API 文档
- `docs/deployment/installation.md` - 部署指南
- `docs/guides/user-manual.md` - 用户手册
- `docs/guides/quickstart.md` - 快速开始
- `README.md` - 项目主文档

---

*本文档最后更新: 2026-04-01*
*项目版本: 1.1.0*
