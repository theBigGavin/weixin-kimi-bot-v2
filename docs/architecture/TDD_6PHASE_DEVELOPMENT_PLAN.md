# TDD 驱动 6 阶段开发计划

## 概述

本文档基于架构设计制定详细的 TDD（测试驱动开发）驱动的 6 阶段开发计划。每个阶段严格遵循 **红-绿-重构** 循环，确保代码质量和可维护性。

**开发原则**: 🔴 红阶段 → 🟢 绿阶段 → 🔵 重构阶段

---

## 第 1 阶段：基础设施层（Week 1-2）

### 目标
建立稳定的开发基础，包括类型定义、工具函数、数据持久化和外部服务封装。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| 全局类型 | `src/types/index.ts` | Agent、Message、Task 等核心类型定义 | `tests/types/index.test.ts` |
| 工具函数 | `src/utils/helpers.ts` | ID生成、日期格式化、字符串处理 | `tests/utils/helpers.test.ts` |
| 数据持久化 | `src/store.ts` | JSON文件存储、数据迁移、备份 | `tests/store.test.ts` |
| 微信协议 | `src/ilink/types.ts` | 微信消息类型定义 | `tests/ilink/types.test.ts` |
| 微信协议 | `src/ilink/client.ts` | HTTP API 封装、消息解析 | `tests/ilink/client.test.ts` |
| Kimi CLI | `src/kimi/types.ts` | Kimi 调用类型定义 | `tests/kimi/types.test.ts` |
| Kimi CLI | `src/kimi/client.ts` | CLI 调用封装、流式输出处理 | `tests/kimi/client.test.ts` |

### 依赖关系
```
types/
  ↓
utils/ → store.ts
  ↓
ilink/ → kimi/
```

### 关键测试场景
1. **类型测试**: 验证类型定义的完整性和正确性
2. **工具函数**: 边界值测试、异常处理测试
3. **数据持久化**: CRUD 操作、并发安全、数据迁移
4. **微信协议**: 消息解析、错误处理、重试机制
5. **Kimi CLI**: 命令构建、输出解析、超时处理

---

## 第 2 阶段：Agent 核心层（Week 3-4）

### 目标
实现多 Agent 管理能力，包括 Agent 生命周期、配置验证和能力模板。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| Agent 类型 | `src/agent/types.ts` | AgentConfig、AgentRuntime 等类型 | `tests/agent/types.test.ts` |
| 配置验证 | `src/agent/validation.ts` | 配置校验、默认值填充 | `tests/agent/validation.test.ts` |
| Agent 管理 | `src/agent/manager.ts` | CRUD、初始化、销毁 | `tests/agent/manager.test.ts` |
| 能力模板 | `src/templates/definitions.ts` | 模板定义、加载、应用 | `tests/templates/definitions.test.ts` |
| 提示词构建 | `src/agent/prompt-builder.ts` | 系统提示词组装 | `tests/agent/prompt-builder.test.ts` |

### 依赖关系
```
types/ + utils/ + store.ts
  ↓
agent/types.ts
  ↓
agent/validation.ts → agent/manager.ts → agent/prompt-builder.ts
  ↓
templates/definitions.ts
```

### 关键测试场景
1. **配置验证**: 有效/无效配置、默认值、自定义提示词
2. **Agent 管理**: 创建、加载、更新、删除、工作目录管理
3. **模板系统**: 模板加载、参数替换、工具权限
4. **提示词构建**: 记忆注入、上下文拼接、模板渲染

---

## 第 3 阶段：上下文感知层（Week 5-6）

### 目标
实现智能对话管理，包括状态机、意图识别、指代消解和会话管理。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| 上下文类型 | `src/context/types.ts` | 状态、意图、消息等类型定义 | `tests/context/types.test.ts` |
| 状态机 | `src/context/state-machine.ts` | 状态流转规则、转移验证 | `tests/context/state-machine.test.ts` |
| 意图识别 | `src/context/intent-resolver.ts` | 15种意图类型识别 | `tests/context/intent-resolver.test.ts` |
| 指代消解 | `src/context/reference-resolver.ts` | 解析"方案1"、"这个"等 | `tests/context/reference-resolver.test.ts` |
| 会话管理 | `src/context/session-context.ts` | 上下文CRUD、选项管理 | `tests/context/session-context.test.ts` |
| 输出解析 | `src/context/output-parser.ts` | 结构化内容提取 | `tests/context/output-parser.test.ts` |
| 持久化 | `src/context/persistence.ts` | 上下文存储和加载 | `tests/context/persistence.test.ts` |

### 依赖关系
```
types/ + utils/ + store.ts
  ↓
context/types.ts
  ↓
context/state-machine.ts → context/intent-resolver.ts
  ↓
context/reference-resolver.ts → context/session-context.ts
  ↓
context/output-parser.ts + context/persistence.ts
```

### 关键测试场景
1. **状态机**: 所有状态转移组合、无效转移处理
2. **意图识别**: 15种意图类型的准确识别、置信度计算
3. **指代消解**: 数字索引、字母标签、指代词、时间指代
4. **会话管理**: 消息历史、活跃选项、话题栈
5. **输出解析**: JSON提取、Markdown解析、选项识别

---

## 第 4 阶段：任务处理层（Week 7-8）

### 目标
实现智能任务路由，包括任务分析、决策引擎、长任务和流程任务管理。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| 任务类型 | `src/task-router/types.ts` | 任务模型、决策模型 | `tests/task-router/types.test.ts` |
| 任务分析 | `src/task-router/analyzer.ts` | 复杂度分析、特征提取 | `tests/task-router/analyzer.test.ts` |
| 决策引擎 | `src/task-router/decision.ts` | 执行模式选择、置信度评估 | `tests/task-router/decision.test.ts` |
| 长任务类型 | `src/longtask/types.ts` | 长任务模型 | `tests/longtask/types.test.ts` |
| 长任务管理 | `src/longtask/manager.ts` | 后台执行、进度通知 | `tests/longtask/manager.test.ts` |
| 流程任务类型 | `src/flowtask/types.ts` | 流程任务模型 | `tests/flowtask/types.test.ts` |
| 流程任务管理 | `src/flowtask/manager.ts` | 结构化流程、人机协作 | `tests/flowtask/manager.test.ts` |

### 依赖关系
```
types/ + utils/ + store.ts + context/
  ↓
task-router/types.ts
  ↓
task-router/analyzer.ts → task-router/decision.ts
  ↓
longtask/types.ts → longtask/manager.ts
flowtask/types.ts → flowtask/manager.ts
```

### 关键测试场景
1. **任务分析**: 复杂度评估、关键词提取、上下文分析
2. **决策引擎**: Direct/LongTask/FlowTask 选择逻辑
3. **长任务**: 提交、执行、进度更新、完成通知
4. **流程任务**: 步骤执行、状态流转、确认点处理

---

## 第 5 阶段：业务编排层（Week 9-10）

### 目标
实现完整业务流程，包括消息处理、命令解析、工作流引擎和定时任务。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| 消息工具 | `src/handlers/message-utils.ts` | 消息解析、格式化 | `tests/handlers/message-utils.test.ts` |
| 命令处理 | `src/handlers/command-handler.ts` | Agent/记忆/提示词命令 | `tests/handlers/command-handler.test.ts` |
| 消息处理 | `src/handlers/message-handler.ts` | 主消息处理器 | `tests/handlers/message-handler.test.ts` |
| 工作流类型 | `src/workflow/types.ts` | 工作流节点、边定义 | `tests/workflow/types.test.ts` |
| 工作流引擎 | `src/workflow/engine.ts` | 确定性工作流执行 | `tests/workflow/engine.test.ts` |
| 调度器 | `src/scheduler/types.ts` | 定时任务类型 | `tests/scheduler/types.test.ts` |
| 调度器 | `src/scheduler/manager.ts` | Cron 解析、任务调度 | `tests/scheduler/manager.test.ts` |

### 依赖关系
```
types/ + utils/ + store.ts + context/ + task-router/ + longtask/ + flowtask/
  ↓
handlers/message-utils.ts → handlers/command-handler.ts
  ↓
handlers/message-handler.ts
  ↓
workflow/types.ts → workflow/engine.ts
scheduler/types.ts → scheduler/manager.ts
```

### 关键测试场景
1. **消息处理**: 消息分类、命令解析、普通消息路由
2. **命令处理**: /agent、/memory、/prompt、/context 命令
3. **工作流引擎**: 节点执行、条件分支、循环处理
4. **定时任务**: Cron 解析、任务调度、执行监控

---

## 第 6 阶段：系统集成层（Week 11-12）

### 目标
实现完整系统，包括消息轮询、会话管理、通知系统和 E2E 测试。

### 交付物

| 模块 | 文件 | 功能描述 | 测试文件 |
|------|------|----------|----------|
| 消息轮询 | `src/services/agent-poller.ts` | 微信消息轮询、分发 | `tests/services/agent-poller.test.ts` |
| 会话管理 | `src/services/session-manager.ts` | 会话生命周期管理 | `tests/services/session-manager.test.ts` |
| 通知类型 | `src/notifications/types.ts` | 通知渠道类型 | `tests/notifications/types.test.ts` |
| 通知服务 | `src/notifications/service.ts` | 多渠道通知发送 | `tests/notifications/service.test.ts` |
| 应用入口 | `src/index.ts` | 应用启动、依赖注入 | `tests/index.test.ts` |
| E2E 测试 | `tests/e2e/` | 完整用户场景测试 | `tests/e2e/*.test.ts` |

### 依赖关系
```
所有下层模块
  ↓
services/agent-poller.ts + services/session-manager.ts
  ↓
notifications/types.ts → notifications/service.ts
  ↓
src/index.ts
  ↓
tests/e2e/
```

### 关键测试场景
1. **消息轮询**: 消息获取、去重、分发、错误重试
2. **会话管理**: 会话创建、恢复、超时清理
3. **通知服务**: 微信通知、推送通知、邮件通知
4. **E2E 测试**: 完整对话流程、多 Agent 场景、错误恢复

---

## 测试覆盖率目标

| 阶段 | 单元测试行覆盖 | 单元测试函数覆盖 | 单元测试分支覆盖 |
|------|----------------|------------------|------------------|
| 第1阶段 | ≥80% | ≥80% | ≥75% |
| 第2阶段 | ≥80% | ≥80% | ≥75% |
| 第3阶段 | ≥80% | ≥80% | ≥75% |
| 第4阶段 | ≥80% | ≥80% | ≥75% |
| 第5阶段 | ≥80% | ≥80% | ≥75% |
| 第6阶段 | ≥80% | ≥80% | ≥75% |
| **整体** | **≥80%** | **≥80%** | **≥75%** |

---

## 开发检查清单

### 每个阶段的检查清单

- [ ] 创建所有测试文件（红阶段）
- [ ] 运行测试确认全部失败（红阶段）
- [ ] 实现所有功能代码（绿阶段）
- [ ] 运行测试确认全部通过（绿阶段）
- [ ] 重构代码消除重复（重构阶段）
- [ ] 验证测试覆盖率达标
- [ ] 编写/更新模块文档
- [ ] 代码审查和自测

### TDD 自检清单

- [ ] 是否先写了测试？
- [ ] 是否看到测试失败（红）？
- [ ] 是否只写了让测试通过的最简单代码？
- [ ] 所有测试是否都通过？
- [ ] 是否重构了代码（可选）？

---

## 附录

### 参考文档

- `docs/architecture/architecture-overview.md` - 多 Agent 架构设计
- `docs/architecture/context-system.md` - 上下文感知架构
- `docs/architecture/TDD_REDVELOPMENT_GUIDE.md` - TDD 开发指导
- `docs/architecture/TDD_QUICK_REFERENCE.md` - TDD 快速参考

### 开发命令

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm test -- tests/agent/manager.test.ts

# 运行特定测试
npm test -- -t "应该使用默认配置创建 Agent"

# 失败时停止
npm test -- --bail
```

---

*本文档创建日期: 2026-03-31*
*版本: 1.0.0*
