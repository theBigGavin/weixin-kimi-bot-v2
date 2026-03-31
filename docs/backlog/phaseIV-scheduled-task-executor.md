# Phase IV 备选特性: Scheduled Task Executor 框架

> **状态**: 备选特性 (Backlog)  
> **阶段**: Phase IV - 高级功能  
> **优先级**: 低  
> **依赖**: LongTask, FlowTask, Scheduler 系统已稳定运行

## 背景

当前系统已实现的三种任务管理机制：
1. **ScheduledTask（定时任务）**: 基于时间触发的轻量级任务
2. **LongTask（长任务）**: 后台异步执行的重量级任务  
3. **FlowTask（流程任务）**: 需要人机协作的多步骤任务

本提案的目标是提供一种**标准化的方式**，让定时任务能够方便地触发长任务和流程任务。

## 概述

系统包含三种任务管理机制：

1. **ScheduledTask（定时任务）**: 基于时间触发的轻量级任务
2. **LongTask（长任务）**: 后台异步执行的重量级任务
3. **FlowTask（流程任务）**: 需要人机协作的多步骤任务

## 系统对比

| 特性 | ScheduledTask | LongTask | FlowTask |
|------|--------------|----------|----------|
| **触发方式** | 时间驱动 | 事件/用户驱动 | 用户驱动 |
| **执行时长** | 秒级 | 分钟-小时级 | 不确定（含等待） |
| **用户交互** | 无 | 进度通知 | 步骤确认 |
| **持久化** | 内存（计划支持文件） | 支持 | 支持 |
| **并发控制** | 无限制 | 有限制（maxConcurrent） | 无限制 |
| **进度追踪** | 简单（nextRunAt） | 详细（progress %） | 步骤级别 |
| **取消机制** | 支持 | 支持 | 支持 |

## 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                     用户交互层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 定时命令  │  │ 长任务提交 │  │ 流程启动  │                 │
│  │ /schedule│  │ /task    │  │ FLOW模式  │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
├───────┼────────────┼────────────┼──────────────────────────┤
│       │            │            │      任务路由层            │
│       │            │            │      (TaskRouter)          │
│       │            │            │                           │
├───────┼────────────┼────────────┼──────────────────────────┤
│  ┌────▼─────┐  ┌───▼────────┐  ┌─▼──────────┐             │
│  │Scheduler │  │ LongTask   │  │ FlowTask   │             │
│  │Manager   │  │ Manager    │  │ Manager    │             │
│  │          │  │            │  │            │             │
│  │ • ONCE   │  │ • Queue    │  │ • Plan     │             │
│  │ • INTERVAL│ │ • Execute  │  │ • Steps    │             │
│  │ • CRON   │  │ • Progress │  │ • Confirm  │             │
│  └────┬─────┘  └────┬───────┘  └────┬───────┘             │
├───────┼─────────────┼───────────────┼──────────────────────┤
│       │             │               │      执行引擎层        │
│  ┌────▼─────┐  ┌───▼────────┐  ┌─▼──────────┐             │
│  │ Handler  │  │ ACPManager │  │ ACPManager │             │
│  │ (同步)   │  │ (异步)     │  │ (交互式)   │             │
│  └──────────┘  └────────────┘  └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## 定时任务借助长任务/流程任务的能力

### 技术可行性

**可行，且架构支持这种集成。**

SchedulerManager 的 handler 是一个函数：
```typescript
type TaskHandler = (data?: Record<string, unknown>) => Promise<void> | void;
```

这个 handler 完全可以调用 LongTaskManager 或 FlowTaskManager 的 API。

### 实现方式

#### 方案1: 定时触发长任务

```typescript
// 在 initSchedulerManager 中
schedulerManager.registerHandler('scheduled_code_review', async (data) => {
  const agentId = data?.agentId as string;
  const userId = data?.userId as string;
  
  // 获取 LongTaskManager 实例
  const ltManager = getLongTaskManager();
  if (!ltManager) return;
  
  // 创建任务提交
  const submission = createTaskSubmission({
    prompt: '对项目代码进行全面审查，检查潜在问题和优化点',
    userId,
    contextId: '',
    agentId,
    priority: TaskPriority.NORMAL,
  });
  
  // 提交长任务
  const task = ltManager.submit(submission);
  
  // 启动任务
  await ltManager.start(task.id, userId);
  
  console.log(`[Scheduler] 定时代码审查任务已启动: ${task.id}`);
});
```

**使用**:
```
/schedule create cron "0 2 * * 1" scheduled_code_review
```
每周一凌晨2点自动执行代码审查。

#### 方案2: 定时触发流程任务

```typescript
schedulerManager.registerHandler('scheduled_deploy', async (data) => {
  const agentId = data?.agentId as string;
  const userId = data?.userId as string;
  
  const ftManager = getFlowTaskManager();
  if (!ftManager) return;
  
  // 创建部署流程计划
  const plan = ftManager.createPlan('执行定时部署流程');
  
  const submission = createTaskSubmission({
    prompt: '定时部署任务',
    userId,
    contextId: '',
    agentId,
    priority: TaskPriority.HIGH,
  });
  
  // 创建流程任务
  const task = ftManager.create(submission, plan);
  
  // 通知用户等待确认
  const notifier = getTaskNotifier(agentId, userId);
  if (notifier) {
    await notifier.taskWaitingConfirm(
      task.id,
      '定时部署',
      '定时任务触发了部署流程，请确认是否执行'
    );
  }
  
  // 将任务加入等待确认队列
  waitingFlowTasks.set(userId, { taskId: task.id, agentId });
});
```

**使用**:
```
/schedule create cron "0 9 * * *" scheduled_deploy
```
每天早上9点触发部署流程，等待用户确认。

### 架构整合方案

为了更优雅地支持这种集成，建议增加 `ScheduledTaskExecutor`：

```typescript
// src/scheduler/executor.ts
export interface ScheduledTaskExecutor {
  name: string;
  description: string;
  execute(data: Record<string, unknown>): Promise<void>;
}

// 基础执行器
export class SimpleExecutor implements ScheduledTaskExecutor {
  constructor(
    public name: string,
    public description: string,
    private fn: (data: Record<string, unknown>) => Promise<void>
  ) {}
  
  async execute(data: Record<string, unknown>): Promise<void> {
    return this.fn(data);
  }
}

// 长任务执行器
export class LongTaskExecutor implements ScheduledTaskExecutor {
  constructor(
    public name: string,
    public description: string,
    private ltManager: LongTaskManager,
    private promptBuilder: (data: Record<string, unknown>) => string
  ) {}
  
  async execute(data: Record<string, unknown>): Promise<void> {
    const submission = createTaskSubmission({
      prompt: this.promptBuilder(data),
      userId: data.userId as string,
      contextId: '',
      agentId: data.agentId as string,
      priority: TaskPriority.NORMAL,
    });
    
    const task = this.ltManager.submit(submission);
    await this.ltManager.start(task.id, data.userId as string);
  }
}

// 流程任务执行器
export class FlowTaskExecutor implements ScheduledTaskExecutor {
  constructor(
    public name: string,
    public description: string,
    private ftManager: FlowTaskManager,
    private planBuilder: (data: Record<string, unknown>) => FlowStep[]
  ) {}
  
  async execute(data: Record<string, unknown>): Promise<void> {
    const plan = this.planBuilder(data);
    const submission = createTaskSubmission({
      prompt: '流程任务',
      userId: data.userId as string,
      contextId: '',
      agentId: data.agentId as string,
      priority: TaskPriority.HIGH,
    });
    
    const task = this.ftManager.create(submission, plan);
    // 等待用户确认...
  }
}
```

## 应用场景

### 1. 定时执行复杂分析任务

```
/schedule create cron "0 3 * * *" analyze_logs
```
每天凌晨3点自动分析日志（LongTask）
- 读取日志文件
- 分析错误模式
- 生成报告
- 发送给用户

### 2. 定时执行需要确认的操作

```
/schedule create cron "0 18 * * 5" weekly_deploy
```
每周五晚上6点触发部署流程（FlowTask）
- 步骤1: 执行测试（自动）
- 步骤2: 构建镜像（自动）
- 步骤3: 部署到 staging（需要确认）
- 步骤4: 部署到 production（需要确认）

### 3. 定时健康检查 + 自动修复

```
/schedule create interval 3600000 auto_heal
```
每小时检查系统健康（Scheduler + LongTask）
- 检查磁盘空间（Scheduler）
- 如果不足，启动清理任务（LongTask）
- 清理旧日志、临时文件
- 发送清理报告

## 数据流示例

```
用户: /schedule create cron "0 2 * * *" code_review

         │
         ▼
┌─────────────────────┐
│ SchedulerManager    │
│ - 解析 CRON         │
│ - 计算下次执行时间   │
│ - 设置定时器         │
└─────────────────────┘
         │
         │ 凌晨2:00触发
         ▼
┌─────────────────────┐
│ Handler: code_review│
│ - 收到 data         │
│ - 包含 agentId      │
│ - 包含 userId       │
└─────────────────────┘
         │
         │ 调用 API
         ▼
┌─────────────────────┐
│ LongTaskManager     │
│ - submit()          │
│ - start()           │
│ - 后台执行代码审查   │
└─────────────────────┘
         │
         │ 进度/完成回调
         ▼
┌─────────────────────┐
│ NotificationService │
│ - 发送微信消息       │
│ - 报告审查结果       │
└─────────────────────┘
         │
         ▼
用户收到: "✅ 任务完成
代码审查已完成
发现问题: 3个
建议优化: 5处"
```

## 当前限制

1. **Handler 注册时机**: 目前 handlers 在 `initSchedulerManager` 中注册，需要在其他 managers 初始化之后

2. **上下文传递**: `data` 字段可以传递任意数据，但需要约定字段名（agentId, userId 等）

3. **错误处理**: 如果 LongTask/FlowTask 启动失败，Scheduler 不会重试（需要额外实现）

4. **任务关联**: 目前无法从 LongTask 反查到是由哪个 ScheduledTask 触发的（可以添加 metadata 字段）

## 建议的增强

1. **添加 metadata 字段**:
```typescript
interface ScheduledTask {
  // ... existing fields
  metadata?: {
    sourceTaskId?: string;
    triggeredBy?: string;
    [key: string]: unknown;
  };
}
```

2. **支持任务链**:
```typescript
schedulerManager.schedule({
  name: 'chain_example',
  type: ScheduleType.ONCE,
  schedule: { delay: 60000 },
  handler: 'chain_starter',
  data: {
    steps: [
      { type: 'longtask', handler: 'analyze' },
      { type: 'flowtask', handler: 'review' },
      { type: 'notification', message: '完成' }
    ]
  }
});
```

3. **执行历史记录**:
```typescript
interface ScheduledTaskExecution {
  taskId: string;
  executedAt: number;
  result: 'success' | 'failure';
  output?: string;
  childTaskId?: string; // 关联的长任务/流程任务ID
}
```

## 实施路线图 (Phase IV)

### Phase IV-A: 基础增强
- [ ] 添加 metadata 字段到 ScheduledTask
- [ ] 实现 execution history 记录
- [ ] 添加从 LongTask/FlowTask 反向查询触发源的能力

### Phase IV-B: Executor 框架
- [ ] 实现 `ScheduledTaskExecutor` 抽象类
- [ ] 实现 `SimpleExecutor`、`LongTaskExecutor`、`FlowTaskExecutor`
- [ ] 重构现有 handlers 使用新框架

### Phase IV-C: 任务链支持
- [ ] 设计任务链 DSL
- [ ] 实现链式执行引擎
- [ ] 支持条件分支和错误处理

### Phase IV-D: 持久化
- [ ] ScheduledTask 持久化到文件
- [ ] 支持重启后恢复定时任务
- [ ] Execution history 持久化

## 结论

**定时任务完全具备借助长任务、流程任务执行复杂任务的能力。**

架构上是解耦的，SchedulerManager 通过 handler 函数可以方便地调用其他两个系统的 API。这种设计允许：

1. **轻量级定时任务**: 使用简单 handler（如 reminder）
2. **重量级定时任务**: 触发 LongTask 执行复杂分析
3. **交互式定时任务**: 触发 FlowTask 执行需要确认的流程

建议下一步实现 `ScheduledTaskExecutor` 框架，提供更优雅的集成方式。
