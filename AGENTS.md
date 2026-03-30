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

- **开发语言**: TypeScript
- **运行时**: Node.js
- **测试框架**: Vitest
- **Mock 工具**: vi (Vitest 内置)
- **覆盖率工具**: v8 provider
- **断言库**: Vitest 内置 expect
- **微信协议**: 腾讯 iLink HTTP API
- **AI 服务**: Kimi CLI
- **进程管理**: PM2

## 项目结构

```
weixin-kimi-bot/
├── src/                      # 源代码目录
│   ├── agent/                # Agent 管理模块
│   │   ├── types.ts          # 类型定义
│   │   ├── manager.ts        # Agent 生命周期管理
│   │   ├── validation.ts     # 配置验证
│   │   └── prompt-builder.ts # 系统提示词构建
│   ├── context/              # 上下文感知系统
│   │   ├── types.ts          # 状态/意图类型定义
│   │   ├── state-machine.ts  # 对话状态机
│   │   ├── intent-resolver.ts    # 意图识别
│   │   ├── reference-resolver.ts # 指代消解
│   │   ├── session-context.ts    # 会话管理
│   │   ├── output-parser.ts      # 结构化输出解析
│   │   └── persistence.ts        # 持久化
│   ├── handlers/             # 消息处理层
│   │   ├── message-handler.ts    # 主消息处理器
│   │   ├── command-handler.ts    # 命令处理器
│   │   └── message-utils.ts      # 消息工具
│   ├── task-router/          # 智能任务路由
│   │   ├── analyzer.ts       # 任务分析器
│   │   └── decision.ts       # 决策引擎
│   ├── longtask/             # 长任务管理（后台执行）
│   ├── flowtask/             # 结构化流程任务
│   ├── workflow/             # 确定性工作流引擎
│   ├── kimi/                 # Kimi CLI 集成
│   ├── ilink/                # 微信 iLink 协议封装
│   ├── scheduler/            # 定时任务调度
│   ├── memory/               # 长期记忆管理
│   ├── notifications/        # 多渠道通知服务
│   ├── services/             # 服务层（消息轮询、会话管理）
│   ├── utils/                # 工具函数
│   └── types/                # 全局类型定义
├── tests/                    # 测试目录
│   ├── __helpers__/          # 测试辅助函数
│   ├── unit/                 # 单元测试
│   ├── integration/          # 集成测试
│   └── e2e/                  # 端到端测试
├── scripts/                  # 工程脚本
├── docs/                     # 项目文档
│   └── architecture/         # 架构设计文档
└── ~/.weixin-kimi-bot/       # 运行时数据目录（用户主目录下）
    ├── agents/               # Agent 配置和数据
    ├── templates/            # 能力模板
    ├── shared/               # 共享数据
    └── master-config.json    # 主配置
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
│ 6. 执行引擎层 (Kimi 调用 / 工作流引擎 / 定时任务 / 通知服务)     │
└─────────────────────────────────────────────────────────────┘
```

### 对话状态机

系统使用有限状态机管理对话流程：

- `IDLE` - 空闲，等待新任务
- `EXPLORING` - 探索需求
- `CLARIFYING` - 澄清疑问
- `PROPOSING` - 提供方案选项
- `COMPARING` - 对比选项
- `CONFIRMING` - 等待用户确认
- `REFINING` - 调整优化
- `PLANNING` - 制定执行计划
- `EXECUTING` - 执行中（T→D→I→E 子状态）
- `REVIEWING` - 审查结果
- `COMPLETED` - 已完成

### 任务路由决策

根据任务特征自动选择执行模式：

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| Direct | 简单问答、查资料、小修改 | 同步执行，快速响应 |
| LongTask | 代码重构、深度分析、批量搜索 | 异步后台执行，支持进度通知 |
| FlowTask | 部署上线、数据迁移、架构设计 | 结构化流程，人机协作确认 |

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
src/agent/manager.ts              → tests/agent/manager.test.ts
src/context/state-machine.ts      → tests/context/state-machine.test.ts
src/utils/helpers.ts              → tests/utils/helpers.test.ts
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

# 运行所有测试
npm test

# 监视模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm test -- tests/agent/manager.test.ts

# 运行特定测试（按名称）
npm test -- -t "应该使用默认配置创建 Agent"

# 失败时停止
npm test -- --bail

# 并行运行
npm test -- --parallel

# UI 模式
npm run test:ui
```

## 代码风格指南

### 命名规范

- **文件**: 小写，连字符分隔 (e.g., `state-machine.ts`)
- **类**: PascalCase (e.g., `AgentManager`)
- **接口**: PascalCase，前缀 I 可选 (e.g., `IAgentRepository`)
- **函数/变量**: camelCase (e.g., `createAgent`)
- **常量**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **枚举**: PascalCase，成员 UPPER_SNAKE_CASE

### 模块设计原则

1. **单一职责**: 每个类/模块只做一件事
2. **依赖注入**: 通过构造函数注入依赖，避免直接实例化
3. **接口隔离**: 定义清晰的接口，实现可替换

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

## 文档索引

- `docs/architecture/architecture-overview.md` - 多 Agent 架构设计
- `docs/architecture/context-system.md` - 上下文感知架构
- `docs/architecture/TDD_REDVELOPMENT_GUIDE.md` - TDD 开发指导
- `docs/architecture/TDD_QUICK_REFERENCE.md` - TDD 快速参考
- `docs/architecture/ARCHITECTURE_VISUAL.md` - 架构可视化图表

---

*本文档最后更新: 2026-03-31*
*项目版本: 1.0.0*
