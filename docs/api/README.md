# API 文档

本文档介绍 weixin-kimi-bot 的核心模块 API。

## 📚 模块列表

| 模块 | 说明 | 路径 |
|------|------|------|
| [Agent Manager](./agent-manager.md) | Agent 生命周期管理 | `src/agent/manager.ts` |
| [Session Context](./session-context.md) | 会话管理 | `src/context/session-context.ts` |
| [Message Handler](./message-handler.md) | 消息处理 | `src/handlers/message-handler.ts` |
| [Command Handler](./command-handler.md) | 命令处理 | `src/handlers/command-handler.ts` |
| [Task Router](./task-router.md) | 任务路由 | `src/task-router/` |
| [Workflow Engine](./workflow-engine.md) | 工作流引擎 | `src/workflow/engine.ts` |
| [Scheduler](./scheduler.md) | 定时任务 | `src/scheduler/manager.ts` |
| [Notification Service](./notification.md) | 通知服务 | `src/notifications/service.ts` |

## 🔧 通用类型

### Agent

```typescript
interface Agent {
  id: string;
  name: string;
  wechat: {
    accountId: string;
    nickname?: string;
  };
  workspace: {
    path: string;
    createdAt: number;
  };
  ai: {
    model: string;
    templateId: string;
    customSystemPrompt?: string;
    maxTurns: number;
    temperature?: number;
  };
  memory: {
    enabledL: boolean;
    enabledS: boolean;
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

### SessionContext

```typescript
interface SessionContext {
  id: string;
  agentId: string;
  state: DialogState;
  messages: Message[];
  metadata: Record<string, unknown>;
  createdAt: number;
  lastActivityAt: number;
}
```

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

## 🎯 快速示例

### 创建 Agent

```typescript
import { AgentManager } from './src/agent/manager';

const manager = new AgentManager();
const agent = await manager.createAgent('wxid_user123', {
  name: 'My Agent',
  templateId: 'programmer'
});
```

### 处理消息

```typescript
import { MessageHandler } from './src/handlers/message-handler';
import { CommandHandler } from './src/handlers/command-handler';
import { DecisionEngine } from './src/task-router/decision';
import { TaskAnalyzer } from './src/task-router/analyzer';

const commandHandler = new CommandHandler();
const taskRouter = {
  analyze: (s) => new TaskAnalyzer().analyze(s),
  decide: (s, a) => new DecisionEngine().decide(s, a)
};
const messageHandler = new MessageHandler(commandHandler, taskRouter);

const result = await messageHandler.process(
  'Hello, how are you?',
  agent,
  sessionContext
);
```

### 创建工作流

```typescript
import { WorkflowEngine } from './src/workflow/engine';

const engine = new WorkflowEngine();

// 注册工作流
engine.register({
  id: 'deploy-flow',
  name: 'Deploy Workflow',
  version: '1.0.0',
  steps: [
    { id: 'build', name: 'Build', type: 'action', handler: 'buildHandler' },
    { id: 'test', name: 'Test', type: 'action', handler: 'testHandler' },
    { id: 'deploy', name: 'Deploy', type: 'action', handler: 'deployHandler' }
  ]
});

// 注册处理器
engine.registerHandler('buildHandler', async () => {
  // 执行构建
  return { success: true, output: 'Build complete' };
});

// 创建并执行实例
const instance = engine.createInstance('deploy-flow', { env: 'production' });
await engine.start(instance.id);
```

### 调度定时任务

```typescript
import { SchedulerManager, ScheduleType } from './src/scheduler/manager';

const scheduler = new SchedulerManager();

// 注册处理器
scheduler.registerHandler('cleanup', async () => {
  // 执行清理
  console.log('Running cleanup...');
});

// 创建定时任务
scheduler.schedule({
  name: 'Daily Cleanup',
  type: ScheduleType.CRON,
  schedule: { cron: '0 2 * * *' },  // 每天凌晨 2 点
  handler: 'cleanup'
});

// 启动调度器
scheduler.start();
```

### 发送通知

```typescript
import { 
  NotificationService, 
  NotificationChannel, 
  NotificationPriority 
} from './src/notifications/service';

const service = new NotificationService();

// 注册通知渠道
service.registerChannel(NotificationChannel.CONSOLE, async (notification) => {
  console.log(`[${notification.priority}] ${notification.title}: ${notification.message}`);
});

// 发送通知
await service.send({
  title: 'Task Complete',
  message: 'Deployment finished successfully',
  priority: NotificationPriority.NORMAL,
  channel: NotificationChannel.CONSOLE,
  timestamp: Date.now()
});
```

## 📖 更多文档

- 各模块详细 API 请查看对应文档
- 类型定义请参考 `src/types/` 目录
- 示例代码请参考 `tests/` 目录
