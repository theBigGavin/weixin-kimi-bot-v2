# 微信 Kimi Bot - TDD 驱动重新开发指导文档

## 📋 目录

1. [核心技术架构概览](#核心技术架构概览)
2. [领域模型与模块划分](#领域模型与模块划分)
3. [TDD 开发原则与流程](#tdd-开发原则与流程)
4. [分层测试策略](#分层测试策略)
5. [推荐开发顺序](#推荐开发顺序)
6. [代码组织最佳实践](#代码组织最佳实践)
7. [测试示例与模式](#测试示例与模式)

---

## 核心技术架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               微信消息层 (iLink)                              │
│                         基于腾讯 iLink 协议的 HTTP API                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           消息处理器层 (Handlers)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Command    │  │    Chat      │  │    File      │  │    Legacy      │  │
│  │   Handler    │  │   Handler    │  │   Handler    │  │    Handler     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                          智能任务路由层 (Task Router)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Task        │  │  Decision    │  │  LongTask    │  │   FlowTask     │  │
│  │  Analyzer    │  │   Engine     │  │   Manager    │  │   Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         上下文感知层 (Context System)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Session    │  │    State     │  │   Intent     │  │   Reference    │  │
│  │   Context    │  │   Machine    │  │  Resolver    │  │   Resolver     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           Agent 管理层 (Agent Manager)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Agent      │  │ Capability   │  │   Memory     │  │    Prompt      │  │
│  │   Config     │  │   Template   │  │   Manager    │  │   Builder      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           执行引擎层 (Execution)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Kimi       │  │   Workflow   │  │  Scheduler   │  │ Notification   │  │
│  │   Handler    │  │   Engine     │  │   Service    │  │   Service      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心数据流

```
微信消息 → Message Handler → Intent 识别 → 状态机 → 任务路由 → Agent 执行 → 微信回复
                ↓                 ↓        ↓        ↓           ↓
              命令解析          指代消解   状态管理   模式选择   Kimi CLI
```

---

## 领域模型与模块划分

### 2.1 核心领域模型

#### Agent 领域
```typescript
// Agent 实体 - 多 Agent 架构的核心
interface Agent {
  id: string;                    // 唯一标识: 显示名称_创建日期_8位随机码
  name: string;                  // 显示名称
  config: AgentConfig;           // 配置信息
  runtime: AgentRuntime;         // 运行时状态
  memory: AgentMemory;           // 长期记忆
  workspace: Workspace;          // 工作目录: Agent的持久化信息保存的位置
  projectspace: projectspace;    // 项目目录: 需要长期维护的编程工作的工作空间
}

// Agent 配置
interface AgentConfig {
  id: string;
  name: string;
  type: 'founder' | 'assistant';
  wechat: WechatBinding;
  workspace: WorkspaceConfig;
  ai: AIConfig;
  memory: MemoryConfig;
  features: FeatureFlags;
  capability: Capabilitys;
}

// 能力模板
interface CapabilityTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  tools: ToolPermissions;
  behavior: BehaviorConfig;
  defaults: ModelDefaults;
}
```

#### 上下文领域
```typescript
// 会话上下文
interface SessionContext {
  id: string;
  userId: string;
  agentId: string;
  state: StateContext;
  messages: ContextMessage[];
  topicStack: TopicFrame[];
  activeOptions: Map<string, Option>;
}

// 对话状态机
enum ConversationState {
  IDLE = 'idle',
  EXPLORING = 'exploring',
  CLARIFYING = 'clarifying',
  PROPOSING = 'proposing',
  COMPARING = 'comparing',
  CONFIRMING = 'confirming',
  REFINING = 'refining',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
}

// 意图识别
interface Intent {
  type: IntentType;
  confidence: number;
  entities: Entity[];
  references: Reference[];
  resolvedText?: string;
}
```

#### 任务领域
```typescript
// 任务提交
interface TaskSubmission {
  prompt: string;
  userId: string;
  chatId: string;
  contextToken: string;
  cwd: string;
  model?: string;
  systemPrompt?: string;
}

// 路由决策
interface TaskDecision {
  mode: ExecutionMode;           // 'direct' | 'longtask' | 'flowtask'
  confidence: number;
  reason: string;
  analysis: TaskAnalysis;
}

// 长任务
interface LongTask {
  id: string;
  status: LongTaskStatus;
  prompt: string;
  progressLogs: ProgressInfo[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// 流程任务
interface FlowTask {
  id: string;
  status: FlowTaskStatus;
  plan: ValidatedPlan;
  currentStep: number;
  executionState: ExecutionState;
}
```

### 2.2 模块划分

| 模块 | 职责 | 依赖模块 |
|------|------|----------|
| `agent` | Agent 生命周期管理、配置、模板 | memory, templates |
| `context` | 会话上下文、状态机、意图识别 | - |
| `handlers` | 消息处理、命令解析 | agent, context, task-router |
| `task-router` | 任务分析、路由决策 | longtask, flowtask |
| `longtask` | 耗时任务后台执行 | kimi |
| `flowtask` | 结构化任务流程 | kimi, workflow |
| `workflow` | 确定性工作流引擎 | - |
| `kimi` | Kimi CLI 集成 | - |
| `scheduler` | 定时任务调度 | notification |
| `memory` | 长期记忆管理 | agent |
| `notification` | 多渠道通知 | - |
| `ilink` | 微信 iLink 协议 | - |

---

## TDD 开发原则与流程

### 3.1 TDD 三步走（强制）

```
🔴 红阶段 → 🟢 绿阶段 → 🔵 重构阶段
```

#### 🔴 红阶段 - 编写测试
- [ ] 先写测试，描述期望的行为
- [ ] 运行测试，确认它失败（红）
- [ ] 如果测试通过，说明测试写得有问题，或者功能已存在

#### 🟢 绿阶段 - 实现功能
- [ ] 编写最简单的代码使测试通过
- [ ] 不要过度设计，先让测试变绿
- [ ] 运行测试，确认通过（绿）

#### 🔵 重构阶段 - 优化代码
- [ ] 在测试保护下重构代码
- [ ] 运行测试，确保仍然通过
- [ ] 提交代码

### 3.2 禁止行为 ❌

1. **直接修改功能代码而不写测试**
2. **先改代码再补测试**（这是作弊！）
3. **跳过红阶段**（不验证测试失败就改代码）

### 3.3 自检清单（每次提交前）

```
□ 我是否先写了测试？
□ 我是否看到测试失败（红）？
□ 我是否只写了让测试通过的最简单代码？
□ 所有测试是否都通过？
□ 我是否重构了代码（可选）？
```

---

## 分层测试策略

### 4.1 测试金字塔

```
         /\
        /  \      E2E 测试 (5%)
       /____\     - 完整用户场景
      /      \    - 集成验证
     /--------\   
    /          \  集成测试 (20%)
   /------------\ - 模块间交互
  /              \- 数据库/外部服务
 /----------------\
/                  \单元测试 (75%)
                    - 函数/类逻辑
                    - 纯业务逻辑
                    - 边界条件
```

### 4.2 单元测试规范

#### 测试文件命名
```
src/agent/manager.ts        → tests/agent/manager.test.ts
src/context/state-machine.ts → tests/context/state-machine.test.ts
src/utils/helpers.ts        → tests/utils/helpers.test.ts
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

#### Mock 规范
```typescript
// Mock 外部依赖
vi.mock('../src/kimi/session.js', () => ({
  checkKimiSession: vi.fn(() => Promise.resolve({ 
    exists: true, 
    sessionId: 'test-session' 
  })),
  clearKimiSessions: vi.fn(() => Promise.resolve()),
}));

// 每个测试后清理
afterEach(() => {
  vi.clearAllMocks();
});
```

### 4.3 集成测试规范

#### 测试场景
- Agent 完整生命周期（创建→初始化→消息处理→删除）
- 任务路由全流程
- 上下文状态流转

#### 示例
```typescript
describe('Agent Lifecycle Integration', () => {
  it('应该完成 Agent 的完整生命周期', async () => {
    // 创建
    const agent = await agentManager.createAgent('wxid_test');
    
    // 初始化
    await agentManager.initialize();
    const loaded = agentManager.getAgent(agent.id);
    expect(loaded).toBeDefined();
    
    // 构建运行时
    const runtime = await agentManager.buildRuntime(agent.id);
    expect(runtime).toBeDefined();
    
    // 更新
    await agentManager.updateAgent(agent.id, { name: 'New Name' });
    
    // 删除
    await agentManager.deleteAgent(agent.id);
    expect(agentManager.getAgent(agent.id)).toBeUndefined();
  });
});
```

### 4.4 覆盖率要求

| 层级 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 |
|------|----------|------------|------------|
| 单元测试 | ≥80% | ≥80% | ≥75% |
| 集成测试 | ≥60% | ≥60% | ≥50% |
| 整体 | ≥80% | ≥80% | ≥75% |

---

## 推荐开发顺序

### 阶段 1: 基础设施层（第 1-2 周）

**目标**: 建立稳定的开发基础

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `types/` | 类型定义完整性 |
| 2 | `utils/` | 工具函数正确性 |
| 3 | `store.ts` | 数据持久化 |
| 4 | `ilink/` | 微信协议封装 |
| 5 | `kimi/` | CLI 调用封装 |

**TDD 示例**:
```typescript
// 1. 先写测试
it('应该正确解析微信消息', () => {
  const raw = { message_type: 1, from_user_id: 'wxid_123' };
  const msg = parseWeixinMessage(raw);
  expect(msg.type).toBe('user');
  expect(msg.fromUser).toBe('wxid_123');
});

// 2. 实现功能
export function parseWeixinMessage(raw: any): WeixinMessage {
  return {
    type: raw.message_type === 1 ? 'user' : 'bot',
    fromUser: raw.from_user_id,
    // ...
  };
}
```

### 阶段 2: Agent 核心层（第 3-4 周）

**目标**: 实现多 Agent 管理能力

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `agent/types.ts` | 数据模型 |
| 2 | `agent/validation.ts` | 配置验证 |
| 3 | `agent/manager.ts` | CRUD 操作 |
| 4 | `templates/definitions.ts` | 模板管理 |
| 5 | `agent/prompt-builder.ts` | 提示词构建 |

### 阶段 3: 上下文感知层（第 5-6 周）

**目标**: 实现智能对话管理

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `context/types.ts` | 状态/意图模型 |
| 2 | `context/state-machine.ts` | 状态转移规则 |
| 3 | `context/intent-resolver.ts` | 意图识别 |
| 4 | `context/reference-resolver.ts` | 指代消解 |
| 5 | `context/session-context.ts` | 会话管理 |

### 阶段 4: 任务处理层（第 7-8 周）

**目标**: 实现智能任务路由

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `task-router/types.ts` | 任务模型 |
| 2 | `task-router/analyzer.ts` | 任务分析 |
| 3 | `task-router/decision.ts` | 路由决策 |
| 4 | `longtask/` | 后台任务执行 |
| 5 | `flowtask/` | 结构化流程任务 |

### 阶段 5: 业务编排层（第 9-10 周）

**目标**: 实现完整业务流程

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `handlers/message-utils.ts` | 消息处理工具 |
| 2 | `handlers/command-handler.ts` | 命令处理 |
| 3 | `handlers/message-handler.ts` | 消息处理器 |
| 4 | `workflow/` | 工作流引擎 |
| 5 | `scheduler.ts` | 定时任务 |

### 阶段 6: 系统集成层（第 11-12 周）

**目标**: 实现完整系统

| 优先级 | 模块 | 测试重点 |
|--------|------|----------|
| 1 | `services/agent-poller.ts` | 消息轮询 |
| 2 | `services/session-manager.ts` | 会话管理 |
| 3 | `notifications/` | 通知系统 |
| 4 | `index.ts` | 应用启动 |
| 5 | E2E 测试 | 完整场景 |

---

## 代码组织最佳实践

### 6.1 目录结构

```
weixin-kimi-bot/
├── src/
│   ├── agent/              # Agent 管理
│   │   ├── types.ts        # 类型定义
│   │   ├── manager.ts      # 管理器
│   │   ├── validation.ts   # 验证逻辑
│   │   └── prompt-builder.ts
│   ├── context/            # 上下文系统
│   │   ├── types.ts
│   │   ├── state-machine.ts
│   │   ├── intent-resolver.ts
│   │   ├── reference-resolver.ts
│   │   └── session-context.ts
│   ├── handlers/           # 消息处理
│   │   ├── types.ts
│   │   ├── message-handler.ts
│   │   ├── command-handler.ts
│   │   └── message-utils.ts
│   ├── task-router/        # 任务路由
│   │   ├── types.ts
│   │   ├── analyzer.ts
│   │   └── decision.ts
│   ├── longtask/           # 长任务管理
│   ├── flowtask/           # 流程任务
│   ├── workflow/           # 工作流引擎
│   ├── kimi/               # Kimi CLI 集成
│   ├── ilink/              # 微信协议
│   ├── scheduler/          # 定时任务
│   ├── memory/             # 长期记忆
│   ├── notifications/      # 通知系统
│   ├── services/           # 服务层
│   ├── utils/              # 工具函数
│   └── types/              # 全局类型
├── tests/
│   ├── __helpers__/        # 测试辅助
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   └── e2e/                # E2E 测试
├── scripts/                # 工程、运维脚本
└── docs/                   # 文档
```

### 6.2 模块设计原则

#### 单一职责原则
```typescript
// ❌ 不好的设计
class AgentManager {
  createAgent() {}
  deleteAgent() {}
  sendMessage() {}      // 不应该在这里
  parseCommand() {}     // 不应该在这里
  saveToDatabase() {}   // 不应该在这里
}

// ✅ 好的设计
class AgentManager {
  createAgent() {}
  deleteAgent() {}
  updateAgent() {}
  getAgent() {}
}

class MessageHandler {
  handleMessage() {}
  parseCommand() {}
}

class MessageSender {
  sendMessage() {}
}
```

#### 依赖注入
```typescript
// ❌ 紧耦合
class TaskRouter {
  private analyzer = new TaskAnalyzer();  // 直接实例化
}

// ✅ 依赖注入
class TaskRouter {
  constructor(
    private analyzer: TaskAnalyzer,
    private decisionEngine: DecisionEngine
  ) {}
}
```

#### 接口隔离
```typescript
// ✅ 定义清晰的接口
interface IAgentRepository {
  findById(id: string): Promise<Agent | null>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
}

interface IMessageHandler {
  handle(message: Message): Promise<Response>;
}

// 实现可以替换
class FileAgentRepository implements IAgentRepository {}
class MemoryAgentRepository implements IAgentRepository {}
```

### 6.3 错误处理

```typescript
// ✅ 定义领域错误
class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

// ✅ 使用 Result 类型
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

async function createAgent(config: AgentConfig): Promise<Result<Agent>> {
  const validation = validateConfig(config);
  if (!validation.valid) {
    return { success: false, error: new ValidationError(validation.errors) };
  }
  
  try {
    const agent = await repository.save(config);
    return { success: true, data: agent };
  } catch (e) {
    return { success: false, error: e as Error };
  }
}
```

---

## 测试示例与模式

### 7.1 状态机测试模式

```typescript
describe('ConversationStateMachine', () => {
  const stateMachine = new ConversationStateMachine();

  describe('状态转移矩阵', () => {
    const transitions = [
      { from: ConversationState.IDLE, intent: IntentType.ASK_INFO, to: ConversationState.EXPLORING },
      { from: ConversationState.EXPLORING, intent: IntentType.EXECUTE, to: ConversationState.PLANNING },
      { from: ConversationState.PLANNING, intent: IntentType.CONFIRM, to: ConversationState.EXECUTING },
      { from: ConversationState.EXECUTING, intent: IntentType.CANCEL, to: ConversationState.IDLE },
    ];

    transitions.forEach(({ from, intent, to }) => {
      it(`${from} + ${intent} → ${to}`, () => {
        const result = stateMachine.transition(
          { current: from, topic: '' },
          { type: intent, confidence: 1, rawText: '', entities: [], references: [] }
        );
        expect(result.success).toBe(true);
        expect(result.newState).toBe(to);
      });
    });
  });

  describe('无效转移', () => {
    it('IDLE 状态不能 CONFIRM', () => {
      const result = stateMachine.transition(
        { current: ConversationState.IDLE, topic: '' },
        { type: IntentType.CONFIRM, confidence: 1, rawText: '', entities: [], references: [] }
      );
      expect(result.success).toBe(false);
    });
  });
});
```

### 7.2 Mock 外部服务

```typescript
// Mock Kimi CLI
vi.mock('../src/kimi/handler.js', () => ({
  askKimi: vi.fn((prompt: string) => {
    if (prompt.includes('错误')) {
      return Promise.reject(new Error('Kimi 调用失败'));
    }
    return Promise.resolve({
      text: `AI 回复: ${prompt}`,
      durationMs: 1000,
    });
  }),
  checkKimiInstalled: vi.fn(() => Promise.resolve(true)),
  checkKimiAuthenticated: vi.fn(() => Promise.resolve(true)),
}));

// 测试中使用
describe('Kimi Integration', () => {
  it('应该处理 AI 回复', async () => {
    const response = await askKimi('你好', { model: 'kimi-code', cwd: '/tmp' });
    expect(response.text).toContain('AI 回复');
  });

  it('应该处理调用失败', async () => {
    await expect(askKimi('错误测试', { model: 'kimi-code', cwd: '/tmp' }))
      .rejects.toThrow('Kimi 调用失败');
  });
});
```

### 7.3 数据驱动测试

```typescript
describe('Cron Parser', () => {
  const testCases = [
    { cron: '0 9 * * *', expected: { minutes: [0], hours: [9], days: [1, 2, ..., 31], months: [1, ..., 12], weekdays: [0, ..., 6] } },
    { cron: '*/5 * * * *', expected: { minutes: [0, 5, 10, ..., 55], hours: [0, ..., 23], ... } },
    { cron: '0 0 * * 0', expected: { minutes: [0], hours: [0], days: [1, ..., 31], months: [1, ..., 12], weekdays: [0] } },
  ];

  testCases.forEach(({ cron, expected }) => {
    it(`应该正确解析 ${cron}`, () => {
      const result = parseCron(cron);
      expect(result.minutes).toEqual(expected.minutes);
      expect(result.hours).toEqual(expected.hours);
    });
  });
});
```

### 7.4 异步测试模式

```typescript
describe('LongTask Manager', () => {
  it('应该完成长任务执行', async () => {
    // Arrange
    const task = manager.submit({ prompt: '测试任务', ... });
    
    // Act - 等待任务完成
    await vi.waitFor(() => {
      const t = manager.getTask(task.id);
      return t?.status === 'completed';
    }, { timeout: 5000 });
    
    // Assert
    const completed = manager.getTask(task.id);
    expect(completed?.result).toBeDefined();
    expect(completed?.error).toBeUndefined();
  });

  it('应该支持并发控制', async () => {
    // 提交多个任务
    const tasks = await Promise.all([
      manager.submit({ ... }),
      manager.submit({ ... }),
      manager.submit({ ... }),
    ]);
    
    // 验证并发限制
    expect(manager.getActiveCount()).toBeLessThanOrEqual(MAX_CONCURRENCY);
  });
});
```

---

## 总结

### 关键要点

1. **测试先行**: 永远先写测试，再写实现
2. **小步快跑**: 每次只实现一个功能点
3. **红绿重构**: 严格遵守 TDD 循环
4. **覆盖率保障**: 核心模块覆盖率 ≥80%
5. **持续集成**: 每次提交都运行全部测试

### 工具链

- **测试框架**: Vitest
- **Mock 工具**: vi (Vitest 内置)
- **覆盖率**: v8 provider
- **断言库**: Vitest 内置 expect

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm test -- tests/agent/manager.test.ts

# 运行特定测试
npm test -- -t "应该使用默认配置创建 Agent"
```

---

**记住: TDD 不是可选项，是强制要求！**
