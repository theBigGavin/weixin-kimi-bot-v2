# Agent 自我测试框架

## 概述

这是一个专门为 **AI Agent/Kimi Code** 设计的真实交互测试框架。与传统的 Mock 测试不同，此框架允许 Agent 像真实用户一样与系统交互——发送消息、执行命令、查询状态——使用真实的业务逻辑，而非模拟。

### 核心设计理念

```
微信聊天 (给人用的 UI)
       ↓
   [ 消息处理器 ]
       ↓
   [ 业务逻辑层 ] ←── Agent 测试框架 (给 Agent 用的 UI)
       ↓
   [ AI 响应层 ]
```

Agent 测试框架是系统的**第二套 UI**，专门供 AI Agent 使用，让它能够：
- **真实地**与系统交互（不走 Mock）
- **自动地**执行测试场景
- **智能地**发现问题、分析原因、提单修复

## 快速开始

### 1. 运行自动化测试

```bash
# 运行所有测试场景
npm run test:auto

# 持续监视模式（开发时使用）
npm run test:auto:watch

# 生成 HTML 报告
npm run test:auto -- --format json,markdown,html
```

### 2. 启动 API 服务器

```bash
# 启动测试 API 服务器（默认端口 3456）
npm run test:api

# 指定端口
npm run test:api -- --port 8080
```

### 3. 交互式 REPL 测试

```bash
# 启动交互式测试控制台
npm run test:repl
```

REPL 命令：
```
test> /new                    # 创建新会话
test> Hello, how are you?     # 发送消息
test> /state                  # 查看系统状态
test> /assert state.context.messageCount > 0  # 执行断言
test> /save                   # 保存会话
test> /quit                   # 退出
```

### 4. 运行单个场景

```bash
npm run test:scenario ./tests/scenarios/basic-chat.json
```

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Testing Framework                      │
├─────────────────────────────────────────────────────────────────┤
│  CLI Layer    │  REPL  │  Commands  │  Auto-Test Runner         │
├───────────────┼────────┼────────────┼───────────────────────────┤
│  API Layer    │  HTTP Server  │  REST Endpoints                  │
├───────────────┴────────┴────────────┴───────────────────────────┤
│  Engine Layer │  TestRunnerImpl  │  Scenario Executor            │
├───────────────┴───────────────────┴─────────────────────────────┤
│  System Layer │  Real MessageHandler  │  Real AgentManager         │
│               │  (NO MOCK - Real Business Logic)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
Agent/Kimi Code
      │
      ├──→ CLI Command ──→ TestRunner ──→ MessageHandler (真实)
      │                                           │
      ├──→ API Call ─────→ TestRunner ──→ AgentManager (真实)
      │                                           │
      └──→ REPL Input ───→ TestRunner ──→ Business Logic (真实)
                                                │
                                          [System Response]
                                                │
                                         TestReport/Issue
```

## API 参考

### REST API

#### 创建会话
```bash
POST /sessions
Content-Type: application/json

{
  "agentConfig": {
    "name": "TestAgent",
    "templateId": "general"
  }
}

# Response
{
  "sessionId": "test_session_xxx",
  "agentId": "agent_xxx",
  "agentName": "TestAgent"
}
```

#### 发送消息
```bash
POST /sessions/:id/messages
Content-Type: application/json

{
  "content": "Hello!"
}

# Response
{
  "success": true,
  "response": "Hello! How can I help you?",
  "type": "chat",
  "duration": 1234
}
```

#### 查询状态
```bash
GET /sessions/:id/state

# Response
{
  "session": { ... },
  "context": {
    "currentState": "IDLE",
    "messageCount": 5,
    "lastIntent": "greeting"
  },
  "memory": {
    "shortTerm": [...],
    "longTerm": [...]
  },
  "tasks": {
    "pending": [],
    "running": [],
    "completed": []
  }
}
```

#### 运行测试场景
```bash
POST /scenarios/run
Content-Type: application/json

{
  "scenario": {
    "id": "my-test",
    "name": "My Test",
    "category": "functional",
    "priority": "high",
    "steps": [...],
    "expectations": [...]
  }
}

# Response (TestReport)
{
  "id": "report_xxx",
  "scenarioId": "my-test",
  "status": "passed",
  "duration": 5678,
  "summary": {
    "totalSteps": 3,
    "passedSteps": 3,
    "failedSteps": 0
  },
  "issues": [],
  "steps": [...]
}
```

### TypeScript API

```typescript
import { TestRunnerImpl, createBasicScenario } from './src/testing/index.js';
import { Store } from './src/store.js';
import { AgentManager } from './src/agent/manager.js';

// 初始化
const store = new Store();
await store.init();

const agentManager = new AgentManager(store);
const runner = new TestRunnerImpl(store, agentManager);

// 创建会话
const session = await runner.createSession({
  name: 'MyTestAgent',
  templateId: 'general',
});

// 发送消息（真实调用）
const result = await runner.executeAction(session, {
  type: 'send_message',
  params: { content: 'Hello!' },
  description: 'Test greeting',
});

console.log(result.success);  // true/false
console.log(result.actual);   // ProcessResult with response

// 查询系统状态
const state = await runner.queryState(session);
console.log(state.context.currentState);  // "IDLE"
console.log(state.memory.shortTerm);       // 短期记忆内容

// 运行测试场景
const scenario = createBasicScenario('Quick Test', [
  'Hello!',
  'What can you do?',
  'Thanks, bye!',
]);

const report = await runner.runScenario(scenario);
console.log(report.status);     // "passed" | "failed"
console.log(report.issues);     // 发现的问题列表
```

## 测试场景定义

### JSON 格式

```json
{
  "id": "context-memory-test",
  "name": "Context and Memory Test",
  "description": "测试上下文保持和记忆功能",
  "category": "integration",
  "priority": "high",
  
  "prerequisites": {
    "agentConfig": {
      "name": "MemoryTestAgent",
      "memory": {
        "enabledL": true,
        "enabledS": true
      }
    },
    "memoryItems": [
      { "key": "user_name", "value": "Alice" }
    ]
  },
  
  "steps": [
    {
      "id": "step-1",
      "name": "Send greeting",
      "action": {
        "type": "send_message",
        "params": { "content": "My name is Bob" },
        "description": "Establish context"
      },
      "validation": {
        "type": "no_error",
        "params": {}
      }
    },
    {
      "id": "step-2",
      "name": "Test recall",
      "action": {
        "type": "send_message",
        "params": { "content": "What's my name?" },
        "description": "Test context recall"
      },
      "validation": {
        "type": "response_contains",
        "params": { "text": "Bob" }
      }
    }
  ],
  
  "expectations": [
    {
      "description": "Context maintained across messages",
      "validator": "session.messages.length >= 4"
    }
  ]
}
```

### TypeScript 格式（推荐）

```typescript
import { TestScenario } from '../../src/testing/types.js';

const scenario: TestScenario = {
  id: 'advanced-test',
  name: 'Advanced Test',
  category: 'functional',
  priority: 'critical',
  
  steps: [
    {
      id: 'step-1',
      name: 'Test command',
      action: {
        type: 'send_command',
        params: { command: 'help', args: [] },
        description: 'Test /help command',
      },
    },
  ],
  
  expectations: [
    {
      description: 'Custom validation logic',
      validator: (session, results) => {
        // 自定义验证逻辑
        return session.messages.length > 0 &&
               results.every(r => r.success);
      },
    },
  ],
};

export default scenario;
```

## 问题报告

测试框架自动生成多种格式的问题报告：

### JSON 格式
适合程序化处理：
```bash
npm run test:auto -- --format json
# 输出: ./test-reports/test-report.json
```

### Markdown 格式
适合人工阅读：
```bash
npm run test:auto -- --format markdown
# 输出: ./test-reports/test-report.md
```

### HTML 格式
适合浏览器查看：
```bash
npm run test:auto -- --format html
# 输出: ./test-reports/test-report.html
```

### JUnit XML 格式
适合 CI/CD 集成：
```bash
npm run test:auto -- --format junit
# 输出: ./test-reports/junit-report.xml
```

## 为 Kimi Code 优化的工作流

### 工作流 1：探索性测试

```bash
# 1. 启动 REPL
npm run test:repl

# 2. 创建会话并测试
test> /new
test> Hello, what can you do?
test> /state
test> /assert state.context.messageCount > 0
test> /save ./exploration-session.json

# 3. 分析问题
# Kimi Code 可以查看会话状态，分析响应是否符合预期
```

### 工作流 2：回归测试

```bash
# 1. 添加新的测试场景到 tests/scenarios/

# 2. 运行所有测试
npm run test:auto

# 3. 如果失败，查看详细报告
# ./test-reports/test-report.md

# 4. 修复问题
# Kimi Code 根据报告中的 reproduction 信息定位并修复问题

# 5. 重新测试
npm run test:auto
```

### 工作流 3：自动化 CI 测试

```yaml
# .github/workflows/agent-test.yml
name: Agent Self Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Agent Tests
        run: npm run test:auto -- --format json,junit
        
      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: test-reports/
```

## 高级用法

### 自定义验证器

```typescript
import { TestScenario } from './src/testing/types.js';

const scenario: TestScenario = {
  id: 'custom-validation',
  name: 'Custom Validation Test',
  // ...
  expectations: [
    {
      description: 'Validate response structure',
      validator: async (session, results) => {
        // 访问完整的会话历史
        const lastResponse = session.messages
          .filter(m => m.direction === 'out')
          .pop();
        
        // 验证响应内容
        if (!lastResponse?.content.includes('expected')) {
          return false;
        }
        
        // 查询系统状态
        const state = await runner.queryState(session);
        return state.context.currentState === 'IDLE';
      },
    },
  ],
};
```

### 复杂测试流程

```typescript
const scenario: TestScenario = {
  id: 'complex-flow',
  name: 'Complex User Flow',
  steps: [
    // 1. 初始化
    { action: { type: 'send_command', params: { command: 'start' }, ... } },
    
    // 2. 等待系统处理
    { action: { type: 'wait', params: { duration: 1000 }, ... } },
    
    // 3. 查询状态
    { action: { type: 'query_state', params: {}, ... } },
    
    // 4. 发送消息
    { action: { type: 'send_message', params: { content: '...' }, ... } },
    
    // 5. 断言
    { action: { type: 'assert', params: { condition: '...' }, ... } },
    
    // 6. 检查记忆
    { action: { type: 'check_memory', params: { key: 'user_pref' }, ... } },
  ],
};
```

### 集成到 Kimi Code

Kimi Code 可以通过以下方式使用测试框架：

1. **通过 CLI 调用**
```typescript
// 在 Kimi Code 中执行命令
const result = await exec('npm run test:auto');
if (result.exitCode !== 0) {
  // 读取报告并分析问题
  const report = await readFile('./test-reports/test-report.json');
  // 生成修复建议
}
```

2. **通过 API 调用**
```typescript
// 调用本地 API 服务器
const response = await fetch('http://localhost:3456/scenarios/run', {
  method: 'POST',
  body: JSON.stringify({ scenario: testScenario }),
});
const report = await response.json();
// 分析 report.issues 并生成修复
```

3. **程序化调用**
```typescript
import { TestRunnerImpl } from './src/testing/index.js';

// 直接在代码中使用
const runner = new TestRunnerImpl(store, agentManager);
const report = await runner.runScenario(scenario);

// 智能分析问题
if (report.issues.length > 0) {
  for (const issue of report.issues) {
    console.log(`发现 ${issue.severity} 级别问题: ${issue.title}`);
    console.log(`建议: ${issue.suggestions?.join(', ')}`);
    // 自动创建修复 PR
  }
}
```

## 最佳实践

### 1. 测试场景组织

```
tests/scenarios/
├── functional/          # 功能测试
│   ├── basic-chat.json
│   ├── commands.json
│   └── context.json
├── integration/         # 集成测试
│   ├── memory-flow.json
│   └── task-router.json
├── regression/          # 回归测试
│   └── issue-123-fix.json
└── exploratory/         # 探索性测试
    └── new-feature.json
```

### 2. 命名规范

- **ID**: `kebab-case`，描述性，包含模块名
  - ✅ `memory-store-recall`
  - ❌ `test1`

- **名称**: 简洁描述测试内容
  - ✅ "Memory Store and Recall Test"
  - ❌ "Test 1"

- **优先级**: 根据影响范围选择
  - `critical`: 核心功能，失败会导致系统不可用
  - `high`: 主要功能，失败影响用户体验
  - `medium`: 次要功能，有 workaround
  - `low`: 边缘情况，影响很小

### 3. 持续改进

1. **发现 Bug → 添加回归测试**
   - 复现问题的场景
   - 验证修复的场景

2. **新功能 → 添加功能测试**
   - 覆盖主要使用路径
   - 覆盖边界情况

3. **定期审查测试效果**
   - 哪些测试经常失败？
   - 哪些测试从未发现过问题？
   - 测试执行时间是否合理？

## 故障排除

### 测试运行器无法启动

```bash
# 检查存储目录权限
ls -la ~/.weixin-kimi-bot/

# 清理并重新初始化
npm run cleanup
npm run test:auto
```

### 场景加载失败

```bash
# 验证 JSON 格式
npx jsonlint tests/scenarios/my-test.json

# 检查 TypeScript 编译错误
npx tsc --noEmit tests/scenarios/my-test.ts
```

### API 服务器无法连接

```bash
# 检查端口占用
lsof -i :3456

# 使用其他端口
npm run test:api -- --port 8080
```

## 贡献指南

1. 添加新功能时，同时添加对应的测试场景
2. 修复 Bug 时，先添加复现该 Bug 的测试
3. 优化代码时，确保所有测试仍然通过
4. 测试场景应该具有描述性，能说明测试目的

---

*本文档适用于 weixin-kimi-bot v1.1.0+*