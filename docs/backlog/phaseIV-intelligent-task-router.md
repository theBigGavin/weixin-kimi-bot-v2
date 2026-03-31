# Phase IV 备选特性: 智能任务路由系统 (Intelligent Task Router)

## 基本信息

| 属性 | 值 |
|------|-----|
| **特性名称** | Intelligent Task Router (ITR) |
| **特性ID** | phaseIV-itr |
| **状态** | 设计完成，待实施 |
| **优先级** | 中-高 |
| **预计工作量** | 3-4 周 |
| **依赖特性** | Phase III 任务路由基础实现 |
| **相关文档** | [task-routing-swimlane.md](../architecture/task-routing-swimlane.md) |

---

## 1. 特性概述

### 1.1 问题陈述

当前系统的任务路由基于**启发式规则**（关键词匹配、正则表达式），存在以下问题：

- **路由准确性有限**: 复杂意图难以通过关键词准确判断
- **扩展成本高**: 新增路由规则需要修改代码
- **无法处理组合任务**: 无法自动分解"定时+长任务+流程任务"的复杂组合
- **上下文感知弱**: 不考虑用户历史、当前状态进行路由决策

### 1.2 目标

构建基于 **Capability Protocol** 的LLM智能任务路由系统，实现：

1. **语义级意图理解**: LLM深度分析用户请求，超越关键词匹配
2. **结构化任务定义**: 标准化的任务协议，支持复杂任务分解
3. **成本可控的智能**: 缓存+分层决策，平衡智能性与性能
4. **与现有命令集成**: 自然语言可调用 `/schedule`、`/longtask` 等命令

---

## 2. 核心设计

### 2.1 Capability Protocol 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Capability Protocol v1.0                   │
├─────────────────────────────────────────────────────────────┤
│  1. 能力注册层 (Capability Registry)                          │
│     - 系统能力声明式注册                                      │
│     - 输入/输出Schema定义                                     │
│     - 执行约束配置                                           │
├─────────────────────────────────────────────────────────────┤
│  2. 智能决策层 (LLM Router)                                   │
│     - 意图缓存 (Intent Cache)                                 │
│     - 分层决策 (规则 → LLM)                                   │
│     - Token优化 (精简Prompt)                                  │
├─────────────────────────────────────────────────────────────┤
│  3. 协议验证层 (Protocol Validator)                           │
│     - TaskRequest 结构验证                                    │
│     - 能力可用性检查                                          │
│     - 参数有效性验证                                          │
├─────────────────────────────────────────────────────────────┤
│  4. 执行编排层 (Execution Orchestrator)                       │
│     - 任务分解策略                                           │
│     - 执行图构建                                             │
│     - 多模式协调 (Direct/LongTask/FlowTask/Scheduled)         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键协议类型

```typescript
// 能力定义（类似MCP Tool）
interface Capability {
  id: string;                          // "file-analyzer", "code-refactorer"
  description: string;                 // LLM用于理解何时使用
  inputSchema: JSONSchema;
  constraints: {
    allowedModes: ExecutionMode[];     // [DIRECT, LONGTASK, FLOWTASK]
    maxDuration: number;
    requireConfirmation: boolean;
  };
}

// LLM输出的任务请求
interface TaskRequest {
  protocolVersion: '1.0';
  
  analysis: {
    userIntent: string;
    requiredCapabilities: string[];
    complexity: { score: number; factors: string[] };
  };
  
  plan: {
    strategy: 'single' | 'sequential' | 'parallel' | 'conditional';
    steps: ExecutionStep[];
  };
  
  metadata: {
    estimatedDuration: number;
    confidence: number;
  };
}

// 执行步骤
interface ExecutionStep {
  stepId: string;
  capability: string;
  mode: ExecutionMode;
  input: unknown;
  dependencies?: string[];
  condition?: { if: string; then: string; else?: string };
}
```

### 2.3 分层决策策略

| 层级 | 触发条件 | LLM调用 | 延迟 | 准确率 |
|------|---------|---------|------|--------|
| **L1: 意图缓存** | 相似历史请求 | 否 | <10ms | 95%+ |
| **L2: 快速规则** | 关键词匹配成功 | 否 | <50ms | 80-90% |
| **L3: LLM决策** | 规则匹配失败 | 是 | 500-800ms | 90-95% |

---

## 3. 任务分解边界

### 3.1 分解触发条件

```typescript
interface DecompositionTrigger {
  conditions: {
    complexityThreshold?: number;      // 复杂度 > 70
    domainSpan?: number;               // 涉及领域数 > 2
    estimatedDuration?: number;        // 预估 > 10分钟
    explicitDecomposition?: boolean;   // 用户明确要求
    riskFactors?: string[];            // ['production', 'data-migration']
  };
  limits: {
    maxDepth: 3;                       // 最大嵌套层数
    maxSteps: 10;                      // 单任务最大步骤
    minStepDuration: 30;               // 最小步骤粒度（秒）
  };
}
```

### 3.2 分解策略

| 策略 | 适用场景 | 示例 |
|------|---------|------|
| **功能分解** | 多能力组合任务 | 分析→重构→测试→部署 |
| **时间分解** | 长执行时间任务 | 每5分钟一个检查点 |
| **风险分解** | 高风险操作 | 高风险前插入确认步骤 |
| **条件分解** | 分支逻辑任务 | 如果覆盖率<80%则重构 |

---

## 4. 与现有系统集成

### 4.1 双轨制架构

```
用户输入
    │
    ├──→ 原始命令 (/schedule, /longtask, /flow)
    │    └──→ 命令解析器 → 直接执行 (现有逻辑不变)
    │
    └──→ 自然语言请求
         └──→ LLM智能路由器 → 可能生成嵌入命令的任务
                              └──→ 调用现有命令执行
```

### 4.2 命令嵌入协议

```typescript
interface CommandStep {
  type: 'native-command';
  command: string;                     // 完整命令字符串
  args: Record<string, unknown>;       // 结构化参数
  mode: ExecutionMode;
}

// 示例: LLM生成的嵌入命令任务
const embeddedTask = {
  plan: {
    steps: [{
      type: 'native-command',
      command: '/schedule add --type CRON --pattern "0 9 * * *" --handler code-quality-check',
      mode: 'DIRECT'
    }]
  }
};
```

### 4.3 向后兼容性

- **现有命令**: 100%兼容，不受智能路由影响
- **任务路由API**: `TaskRouter.route()` 接口保持不变
- **存储格式**: 新增 `TaskRequest` 类型，现有数据不受影响

---

## 5. 实施路线图

### Phase IV-A: 协议基础设施 (1周)

```
□ Capability Registry 实现
  □ 能力注册/注销接口
  □ Schema验证
  □ LLM可见的能力清单生成

□ Protocol Validator 实现
  □ TaskRequest结构验证
  □ 能力可用性检查
  □ 参数类型检查
```

### Phase IV-B: LLM决策引擎 (1周)

```
□ Intent Cache 实现
  □ 意图签名计算
  □ LRU缓存策略
  □ 相似意图匹配

□ LLM Analyzer 实现
  □ 分层决策逻辑 (L1→L2→L3)
  □ Token优化Prompt
  □ 结构化输出解析

□ 回退策略
  □ LLM调用失败处理
  □ 启发式路由回退
```

### Phase IV-C: 执行编排器 (1周)

```
□ 任务分解器
  □ 触发条件评估
  □ 分解策略选择
  □ 子任务验证

□ 执行编排器
  □ 执行图构建
  □ 拓扑排序
  □ 条件路径执行

□ 多模式协调
  □ Direct/LongTask/FlowTask/Scheduled 统一调度
```

### Phase IV-D: 集成与优化 (1周)

```
□ 与现有命令集成
  □ 命令嵌入协议实现
  □ CommandRegistry桥接

□ 性能优化
  □ 缓存命中率监控
  □ LLM调用频率优化

□ 测试与文档
  □ 单元测试覆盖 > 80%
  □ 集成测试
  □ 用户文档更新
```

---

## 6. 技术方案选型

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| **协议粒度** | MCP风格 / Workflow风格 / Agent风格 | **MCP风格** | 兼顾灵活性与可控性 |
| **缓存策略** | 精确匹配 / 语义相似 | **语义相似** | 使用意图签名+模糊匹配 |
| **LLM调用** | 每请求调用 / 批量调用 / 流式 | **按需调用** | 分层决策控制成本 |
| **分解深度** | 固定深度 / 动态深度 | **动态深度** | 基于触发条件自适应 |

---

## 7. 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| LLM调用成本过高 | 中 | 高 | 缓存+分层决策，目标<20%请求走LLM |
| 路由延迟增加 | 中 | 中 | L1/L2缓存确保90%请求<50ms |
| LLM输出不稳定 | 中 | 高 | 协议验证层+错误修正机制 |
| 与现有系统集成复杂 | 低 | 中 | 双轨制设计，渐进式迁移 |

---

## 8. 成功指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|---------|
| 路由准确率 | ~75% | >90% | 人工标注测试集 |
| 平均路由延迟 | 50ms | <100ms (P95) | 性能测试 |
| LLM调用占比 | N/A | <20% | 生产监控 |
| 缓存命中率 | N/A | >70% | 生产监控 |
| 用户满意度 | N/A | >4.5/5 | 用户反馈 |

---

## 9. 相关文档

- [任务路由泳道图](../architecture/task-routing-swimlane.md) - 完整流程可视化
- [架构总览](../architecture/ARCHITECTURE_VISUAL.md) - 系统整体架构
- [Phase III 调度任务执行器](./phaseIV-scheduled-task-executor.md) - 相关特性

---

## 10. 附录

### A. 示例场景

#### 场景1: 复杂组合任务

**用户输入**: "每天早上9点检查代码覆盖率，低于80%就重构项目，完成后发邮件通知我"

**LLM输出**:
```json
{
  "analysis": {
    "intent": "定时代码质量监控与自动重构",
    "capabilities": ["scheduler", "coverage-checker", "code-refactorer", "email-notifier"],
    "complexity": { "score": 85, "level": "complex" }
  },
  "plan": {
    "strategy": "conditional",
    "steps": [
      { "stepId": "schedule", "capability": "scheduler", "mode": "DIRECT" },
      { "stepId": "check", "capability": "coverage-checker", "mode": "LONGTASK", "dependencies": ["schedule"] },
      { "stepId": "refactor", "capability": "code-refactorer", "mode": "FLOWTASK", "dependencies": ["check"], "condition": { "if": "${check.coverage} < 80" } },
      { "stepId": "notify", "capability": "email-notifier", "mode": "DIRECT", "dependencies": ["refactor"] }
    ]
  }
}
```

#### 场景2: 命令嵌入

**用户输入**: "帮我安排每天自动备份数据库"

**LLM输出**:
```json
{
  "analysis": {
    "intent": "创建定时备份任务",
    "capabilities": ["scheduler"],
    "complexity": { "score": 30, "level": "simple" }
  },
  "plan": {
    "strategy": "single",
    "steps": [{
      "type": "native-command",
      "command": "/schedule add --type CRON --pattern '0 2 * * *' --handler db-backup",
      "mode": "DIRECT"
    }]
  }
}
```

---

*创建时间: 2026-03-31*  
*最后更新: 2026-03-31*  
*文档版本: v1.0*
