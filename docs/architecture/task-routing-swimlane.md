# 智能任务路由 - 泳道图

基于 Capability Protocol 的任务处理全流程可视化

## 1. 主流程泳道图

```mermaid
sequenceDiagram
    autonumber
    
    %% 参与者定义
    actor U as 用户
    participant MG as 消息网关<br/>MessageGateway
    participant IC as 意图缓存<br/>IntentCache
    participant RA as 路由分析器<br/>RouterAnalyzer
    participant LLM as LLM决策引擎<br/>LLM Decision Engine
    participant PV as 协议验证器<br/>ProtocolValidator
    participant EO as 执行编排器<br/>ExecutionOrchestrator
    participant DE as Direct执行器
    participant LE as LongTask执行器
    participant FE as FlowTask执行器
    participant SE as Scheduled执行器
    participant NS as 通知服务

    %% 1. 用户输入
    U->>MG: 发送消息
    Note over U,MG: "每天早上9点检查代码覆盖率，<br/>低于80%就重构项目"

    %% 2. 消息预处理
    MG->>MG: 消息解析<br/>提取文本/附件/上下文

    %% 3. 意图缓存检查
    MG->>IC: 查询缓存(intentSignature)
    IC-->>MG: 缓存未命中

    %% 4. LLM路由分析
    MG->>RA: 提交 TaskSubmission
    RA->>RA: 快速规则匹配<br/>(关键词/正则)
    Note over RA: 匹配失败 → 需要LLM分析

    %% 5. LLM深度决策
    RA->>LLM: 请求结构化决策
    Note over RA,LLM: Prompt: 用户消息 + 可用能力列表

    LLM->>LLM: 意图识别 + 复杂度评估<br/>+ 能力选择 + 模式决策

    LLM-->>RA: 返回 TaskRequest (JSON)
    Note over RA: {
    Note over RA:   intent: "定时代码质量监控",
    Note over RA:   capabilities: ["coverage-checker", 
    Note over RA:                 "code-refactorer"],
    Note over RA:   plan: { strategy: "conditional", ... },
    Note over RA:   mode: "SCHEDULED"
    Note over RA: }

    %% 6. 缓存更新
    RA->>IC: 缓存决策结果

    %% 7. 协议验证
    RA->>PV: 验证 TaskRequest
    PV->>PV: 结构校验 + 能力可用性检查<br/>+ 参数有效性验证
    PV-->>RA: 验证通过

    %% 8. 任务分解
    RA->>EO: 提交验证后的请求
    EO->>EO: 分解为 ExecutionSteps
    Note over EO: Step1: coverage-check (DIRECT)<br/>Step2: code-refactor (FLOWTASK)<br/>Step3: notify-result (SCHEDULED)

    %% 9. 执行路由
    EO->>SE: 创建定时任务
    Note over EO,SE: 调度计划: 0 9 * * *<br/>触发器: 执行子工作流

    %% 10. 定时触发 (次日9点)
    Note over SE: 【次日 9:00】
    SE->>DE: 执行 coverage-check
    DE->>DE: 运行测试覆盖率分析
    DE-->>SE: 结果: 覆盖率 72%

    %% 11. 条件判断
    SE->>SE: 评估条件: 72% < 80%
    SE->>FE: 触发重构流程

    %% 12. FlowTask 执行
    FE->>FE: 生成重构方案
    FE->>U: 发送方案确认请求
    U-->>FE: 确认执行
    FE->>LE: 提交重构任务到后台

    %% 13. LongTask 执行
    LE->>LE: 异步执行重构
    LE->>NS: 进度通知 (10%...50%...)
    NS->>U: 微信消息: "重构进度 50%"

    LE-->>FE: 重构完成
    FE-->>SE: 子任务完成

    %% 14. 最终通知
    SE->>DE: 执行 notify-result
    DE->>NS: 发送完成通知
    NS->>U: 微信消息: "任务完成！<br/>覆盖率: 72% → 85%"

    %% 15. 完成
    SE-->>EO: 调度任务完成
    EO-->>MG: 流程结束
    MG-->>U: (会话保持)
```

## 2. 简化的路由决策泳道图

```mermaid
flowchart TB
    subgraph User["👤 用户层"]
        U1[输入请求]
        U2[接收结果/确认]
    end

    subgraph Gateway["📡 网关层"]
        G1[消息解析]
        G2[创建 TaskSubmission]
        G3[返回执行结果]
    end

    subgraph Router["🧠 智能路由层"]
        R1[意图缓存检查]
        R2{缓存命中?}
        R3[快速规则匹配]
        R4{匹配成功?}
        R5[LLM分析决策]
        R6[生成 TaskRequest]
        R7[协议验证]
    end

    subgraph Executor["⚙️ 执行层"]
        E1{执行模式?}
        E2[Direct执行]
        E3[LongTask排队]
        E4[FlowTask交互]
        E5[Scheduled注册]
    end

    subgraph Notification["📢 通知层"]
        N1[实时通知]
        N2[进度推送]
    end

    U1 --> G1
    G1 --> G2
    G2 --> R1
    R1 --> R2
    R2 -->|否| R3
    R2 -->|是| R6
    R3 --> R4
    R4 -->|否| R5
    R4 -->|是| R6
    R5 --> R6
    R6 --> R7
    R7 --> E1
    
    E1 -->|SIMPLE| E2
    E1 -->|BACKGROUND| E3
    E1 -->|INTERACTIVE| E4
    E1 -->|TIMED| E5
    
    E2 --> G3
    E3 --> N2
    E4 --> U2
    E5 --> N1
    
    N2 --> U2
    G3 --> U2
```

## 3. LLM决策详细流程

```mermaid
sequenceDiagram
    autonumber

    participant RA as 路由分析器
    participant FS as 快速规则集
    participant IC as 意图缓存
    participant LLM as LLM决策引擎
    participant TS as Token优化器

    RA->>FS: 尝试规则匹配
    FS->>FS: 关键词匹配<br/>正则表达式<br/>历史模式

    alt 规则匹配成功 (置信度 > 0.9)
        FS-->>RA: 返回快捷决策
        Note over RA: 零LLM调用
    else 规则匹配失败或低置信度
        FS-->>RA: 匹配失败
        RA->>IC: 计算意图签名
        IC->>IC: 哈希计算 + 特征提取
        IC-->>RA: 签名结果

        RA->>IC: 查询相似意图
        IC-->>RA: 未命中 / 过期

        RA->>TS: 构建优化Prompt
        Note over TS: 精简格式 + 示例注入<br/>+ 输出约束

        TS-->>RA: 优化后的Prompt
        RA->>LLM: 调用LLM (单次)

        Note over LLM: 输入: 用户消息 + 能力清单<br/>输出: TaskRequest JSON

        LLM-->>RA: 结构化决策
        RA->>IC: 缓存决策结果
    end

    RA->>RA: 后处理 + 验证
```

## 4. 任务分解与编排泳道图

```mermaid
sequenceDiagram
    autonumber

    participant EO as 执行编排器
    participant DT as 分解触发器
    participant DS as 分解策略器
    participant SV as 步骤验证器
    participant OR as 步骤编排器
    participant EX as 执行器集合

    EO->>DT: 评估分解需求

    Note over DT: 触发条件检查:<br/>- 复杂度 > 70?<br/>- 多领域交叉?<br/>- 预估时长 > 10min?<br/>- 用户要求分步?

    alt 无需分解
        DT-->>EO: 单步执行
        EO->>EX: 直接执行
    else 需要分解
        DT->>DS: 选择分解策略

        DS->>DS: 策略评估
        Note over DS: 功能分解?<br/>时间分解?<br/>风险分解?

        DS-->>EO: 返回子任务列表

        loop 每个子任务
            EO->>SV: 验证子任务
            SV->>SV: 参数检查<br/>依赖检查<br/>权限检查
            SV-->>EO: 验证结果
        end

        EO->>OR: 构建执行图
        OR->>OR: 拓扑排序<br/>并行识别<br/>条件路径

        loop 执行阶段
            OR->>EX: 执行当前步骤
            EX-->>OR: 步骤结果
            OR->>OR: 评估条件<br/>确定下一步
        end
    end

    OR-->>EO: 全部完成
```

## 5. 命令嵌入模式泳道图

```mermaid
sequenceDiagram
    autonumber

    actor U as 用户
    participant LLM as LLM决策引擎
    participant TR as 任务路由器
    participant CR as 命令解析器
    participant CE as 命令执行器
    participant NS as 通知服务

    Note over U,NS: 场景: 用户使用自然语言<br/>创建原本需要命令的任务

    U->>TR: "帮我安排每天自动备份"

    TR->>LLM: 分析 + 生成嵌入命令

    Note over LLM: LLM识别意图后生成:<br/>{
    Note over LLM:   plan: {
    Note over LLM:     steps: [{
    Note over LLM:       type: "native-command",
    Note over LLM:       command: "/schedule add<br/>--type CRON<br/>--pattern '0 2 * * *'<br/>--handler backup"
    Note over LLM:     }]
    Note over LLM:   }
    Note over LLM: }

    LLM-->>TR: TaskRequest
    TR->>CR: 解析嵌入命令
    CR->>CR: 提取命令 + 参数
    CR-->>TR: 结构化命令

    TR->>CE: 执行命令
    CE->>CE: 注册定时任务
    CE-->>TR: 注册成功

    TR->>NS: 发送确认
    NS->>U: "已创建每日备份任务<br/>执行时间: 每天凌晨2点"
```

## 6. 错误处理与降级泳道图

```mermaid
sequenceDiagram
    autonumber

    participant RA as 路由分析器
    participant PV as 协议验证器
    participant EH as 错误处理器
    participant FB as 回退执行器
    participant LLM as LLM引擎
    participant U as 用户

    RA->>PV: 提交 TaskRequest
    PV->>PV: 验证

    alt 验证失败
        PV-->>RA: 验证错误
        RA->>EH: 处理错误

        alt 结构错误
            EH->>EH: 尝试修复JSON
            EH->>PV: 重新验证
        else 能力不可用
            EH->>EH: 查找替代能力
            EH->>RA: 重试路由
        else 参数无效
            EH->>LLM: 请求修正
            LLM-->>EH: 修正后的请求
            EH->>PV: 重新验证
        end
    end

    alt LLM调用失败
        RA->>EH: 超时/错误
        EH->>FB: 激活回退
        FB->>FB: 启发式路由
        Note over FB: 基于关键词<br/>历史模式<br/>默认规则
        FB-->>RA: 回退决策
    end

    alt 执行失败
        FB->>U: 询问明确意图
        U-->>FB: 澄清/确认
        FB->>RA: 重新路由
    end
```

## 7. 泳道图对比：旧 vs 新架构

### 旧架构（基于规则）

```mermaid
flowchart LR
    subgraph Old["旧架构 - 规则驱动"]
        direction TB
        O1[用户输入] --> O2[关键词匹配]
        O2 --> O3{规则命中?}
        O3 -->|是| O4[直接路由]
        O3 -->|否| O5[默认路由]
        O4 --> O6[执行]
        O5 --> O6
    end

    style Old fill:#ffcccc
```

### 新架构（基于协议）

```mermaid
flowchart LR
    subgraph New["新架构 - 协议驱动"]
        direction TB
        N1[用户输入] --> N2[意图缓存]
        N2 --> N3{缓存命中?}
        N3 -->|是| N7[协议验证]
        N3 -->|否| N4[快速规则]
        N4 --> N5{匹配成功?}
        N5 -->|是| N7
        N5 -->|否| N6[LLM决策]
        N6 --> N7
        N7 --> N8{验证通过?}
        N8 -->|是| N9[任务分解]
        N8 -->|否| N10[错误修正]
        N10 --> N6
        N9 --> N11[执行编排]
        N11 --> N12[多模式执行]
    end

    style New fill:#ccffcc
```

## 8. 时序对比

| 场景 | 旧架构 | 新架构 | 说明 |
|------|--------|--------|------|
| 简单问答 | 10ms | 10ms (缓存) | 缓存命中时相同 |
| 常见开发任务 | 50ms | 50ms (规则) | 规则匹配时相同 |
| 复杂任务 | 100ms (错误路由) | 500ms (LLM) | LLM开销换取准确性 |
| 首次复杂任务 | 100ms (错误) | 500ms + 缓存 | 后续相同任务 10ms |
| 边界任务 | 100ms (默认) | 500ms (LLM) | 避免错误路由 |

---

*生成时间: 2026-03-31*
*版本: Capability Protocol v1.0 Draft*
