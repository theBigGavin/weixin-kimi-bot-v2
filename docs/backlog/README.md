# 项目 Backlog

本文档记录 weixin-kimi-bot 项目的待办特性、设计草案和Phase IV候选功能。

## Phase IV 备选特性

Phase IV 聚焦于**高级功能与智能化**，以下特性按优先级排序：

| 特性 | ID | 优先级 | 状态 | 预计工作量 | 说明 |
|------|-----|--------|------|-----------|------|
| [智能任务路由系统](./phaseIV-intelligent-task-router.md) | phaseIV-itr | 中-高 | 📝 设计完成 | 3-4周 | 基于LLM的智能任务路由与分解 |
| [调度任务执行器框架](./phaseIV-scheduled-task-executor.md) | phaseIV-ste | 低 | 📝 设计完成 | 2-3周 | 定时任务触发复杂任务链 |
| [模板热重载](./template-hot-reload.md) | phaseIV-thr | 低 | 📝 草案 | 1周 | 能力模板运行时更新 |

### 特性说明

#### 🧠 智能任务路由系统 (Intelligent Task Router)

**核心能力**:
- LLM语义级意图理解
- Capability Protocol 标准化任务定义
- 自动任务分解与编排
- 与现有命令的双轨集成

**关键价值**:
- 路由准确率从75%提升至90%+
- 支持复杂组合任务（定时+后台+交互式）
- 自然语言调用现有命令

**文档**: [phaseIV-intelligent-task-router.md](./phaseIV-intelligent-task-router.md)  
**泳道图**: [task-routing-swimlane.md](../architecture/task-routing-swimlane.md)

---

#### ⏰ 调度任务执行器框架 (Scheduled Task Executor)

**核心能力**:
- 定时任务触发长任务/流程任务
- 复杂任务链编排
- 任务依赖管理

**关键价值**:
- 实现真正的自动化工作流
- 支持"定时检查→条件执行→结果通知"模式

**文档**: [phaseIV-scheduled-task-executor.md](./phaseIV-scheduled-task-executor.md)

---

#### 🔥 模板热重载 (Template Hot Reload)

**核心能力**:
- 运行时更新能力模板
- 无需重启应用
- 模板变更自动生效

**关键价值**:
- 提升开发效率
- 支持动态模板配置

**文档**: [template-hot-reload.md](./template-hot-reload.md)

---

## 特性选择指南

### 何时选择智能任务路由？

选择条件：
- ✅ 当前规则路由准确率不满意
- ✅ 需要支持复杂组合任务
- ✅ 希望用户能用自然语言触发高级功能
- ✅ 有预算承担LLM调用成本

### 何时选择调度任务执行器？

选择条件：
- ✅ 已有定时任务需求
- ✅ 需要定时触发复杂工作流
- ✅ 需要任务链依赖管理

---

## 优先级评估标准

| 维度 | 权重 | 说明 |
|------|------|------|
| 用户价值 | 40% | 对用户核心需求的满足程度 |
| 技术债务 | 25% | 是否解决现有架构痛点 |
| 实施成本 | 20% | 开发工作量与复杂度 |
| 维护成本 | 15% | 长期运维与迭代成本 |

---

*最后更新: 2026-03-31*
