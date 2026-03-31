# Phase III 实施计划

## 1. 实施概览

### 1.1 实施阶段

| 阶段 | 名称 | 工期 | 目标 |
|-----|------|-----|------|
| 1 | 基础设施重构 | 2天 | Agent ID、数据模型、目录结构 |
| 2 | N:M 关系实现 | 2天 | 多微信用户、多 Agent 绑定 |
| 3 | 创世 Agent | 1天 | 权限系统、管理命令 |
| 4 | ACP 迁移 | 1天 | 清理旧代码、完善 ACP |
| 5 | 备份同步 | 1天 | 本地备份、GitHub 同步 |
| 6 | CI/CD 与测试 | 2天 | 流水线、测试覆盖 |
| **总计** | | **9天** | |

### 1.2 依赖关系

```
Phase 1: 基础设施重构
    │
    ▼
Phase 2: N:M 关系实现 ◄──► Phase 4: ACP 迁移
    │                         │
    ▼                         ▼
Phase 3: 创世 Agent  ◄──────┘
    │
    ▼
Phase 5: 备份同步
    │
    ▼
Phase 6: CI/CD 与测试
```

## 2. 详细任务分解

### Phase 1: 基础设施重构 (2天)

#### Day 1: Agent ID 与路径系统

| 任务 | 工时 | 产出 |
|-----|------|------|
| 实现 `src/agent/id-generator.ts` | 2h | ID 生成器 + 测试 |
| 创建 `src/paths.ts` 路径常量 | 2h | 统一路径管理 |
| 重构 `src/store.ts` 支持命名空间 | 3h | 隔离存储实现 |
| 编写单元测试 | 1h | 测试覆盖 ≥90% |

#### Day 2: 数据模型与目录结构

| 任务 | 工时 | 产出 |
|-----|------|------|
| 更新 `src/agent/types.ts` | 2h | 新数据模型 |
| 实现 `src/wechat/types.ts` | 2h | 微信账号模型 |
| 实现 `src/config/master-config.ts` | 2h | 主配置管理 |
| 更新 `src/agent/manager.ts` | 2h | 适配新模型 |

### Phase 2: N:M 关系实现 (2天)

#### Day 3: 微信账号管理

| 任务 | 工时 | 产出 |
|-----|------|------|
| 实现 `src/wechat/manager.ts` | 3h | 微信账号管理器 |
| 重构凭证存储 (按用户隔离) | 2h | 新凭证管理 |
| 实现绑定关系管理 | 2h | 绑定/解绑功能 |
| 编写测试 | 1h | 单元 + 集成测试 |

#### Day 4: 交互式登录与 Agent 管理

| 任务 | 工时 | 产出 |
|-----|------|------|
| 实现 `src/login/interactive-config.ts` | 3h | 交互式配置向导 |
| 更新 `src/login.ts` | 2h | 新登录流程 |
| 实现 `src/cli/agent.ts` | 2h | Agent CLI 工具 |
| 更新消息处理器 | 1h | 支持 Agent 切换 |

### Phase 3: 创世 Agent (1天)

#### Day 5: 权限系统

| 任务 | 工时 | 产出 |
|-----|------|------|
| 实现 `src/founder/manager.ts` | 2h | 创世 Agent 管理 |
| 实现 `src/auth/permissions.ts` | 2h | 权限管理器 |
| 实现创世 Agent 命令 | 2h | `/system/*` 命令 |
| 集成到登录流程 | 2h | 首次登录创建 |

### Phase 4: ACP 迁移 (1天)

#### Day 6: 代码清理与迁移

| 任务 | 工时 | 产出 |
|-----|------|------|
| 删除 `src/kimi/` 目录 | 0.5h | 清理旧代码 |
| 删除旧的 `src/index.ts` | 0.5h | 清理旧入口 |
| 重命名 `src/index-acp.ts` | 0.5h | 新主入口 |
| 更新 `package.json` | 0.5h | 脚本更新 |
| 完善 `src/acp/` 模块 | 3h | 功能完善 + 测试 |
| 验证构建 | 1h | 确保无错误 |

### Phase 5: 备份同步 (1天)

#### Day 7: 备份系统

| 任务 | 工时 | 产出 |
|-----|------|------|
| 实现 `src/backup/manager.ts` | 3h | 备份管理器 |
| 实现 `src/backup/github-sync.ts` | 3h | GitHub 同步 |
| 实现 `src/cli/backup.ts` | 1h | 备份 CLI |
| 编写测试 | 1h | 备份恢复测试 |

### Phase 6: CI/CD 与测试 (2天)

#### Day 8: CI/CD 流水线

| 任务 | 工时 | 产出 |
|-----|------|------|
| 创建 `.github/workflows/ci.yml` | 2h | CI 流水线 |
| 创建 `.github/workflows/deploy.yml` | 1h | 部署流水线 |
| 配置 Codecov 集成 | 1h | 覆盖率上报 |
| 设置测试环境变量 | 1h | 测试隔离 |
| 验证流水线 | 3h | 端到端验证 |

#### Day 9: 测试完善

| 任务 | 工时 | 产出 |
|-----|------|------|
| 编写 `tests/unit/agent/id-generator.test.ts` | 1h | ID 生成测试 |
| 编写 `tests/unit/wechat/manager.test.ts` | 2h | 微信管理测试 |
| 编写 `tests/integration/founder-creation.test.ts` | 2h | 创世 Agent 测试 |
| 编写 `tests/e2e/login-flow.test.ts` | 2h | E2E 登录测试 |
| 提升覆盖率到 85%+ | 1h | 补充测试用例 |

## 3. 文件变更清单

### 3.1 新增文件

```
src/
├── agent/
│   └── id-generator.ts              # Agent ID 生成器
│
├── wechat/
│   ├── types.ts                     # 微信账号类型
│   └── manager.ts                   # 微信账号管理器
│
├── founder/
│   ├── types.ts                     # 创世 Agent 类型
│   └── manager.ts                   # 创世 Agent 管理器
│
├── auth/
│   └── permissions.ts               # 权限管理器
│
├── backup/
│   ├── manager.ts                   # 备份管理器
│   └── github-sync.ts               # GitHub 同步
│
├── login/
│   └── interactive-config.ts        # 交互式配置向导
│
├── cli/
│   ├── agent.ts                     # Agent CLI
│   └── backup.ts                    # 备份 CLI
│
└── paths.ts                         # 路径常量

tests/
├── unit/
│   ├── agent/
│   │   └── id-generator.test.ts
│   └── wechat/
│       └── manager.test.ts
│
├── integration/
│   ├── founder-creation.test.ts
│   ├── wechat-binding.test.ts
│   └── backup-restore.test.ts
│
└── e2e/
    └── login-flow.test.ts

.github/
└── workflows/
    ├── ci.yml
    └── deploy.yml
```

### 3.2 修改文件

```
src/
├── agent/
│   ├── types.ts                     # 更新数据模型
│   └── manager.ts                   # 适配新模型
│
├── config/
│   ├── credentials.ts               # 按用户隔离存储
│   ├── session.ts                   # 按用户隔离
│   └── master-config.ts             # 新增主配置
│
├── handlers/
│   └── message-handler.ts           # 支持 Agent 切换
│
├── login.ts                         # 新登录流程
│
├── index-acp.ts ──► index.ts        # 重命名
└── index.ts                         # 删除旧版本

package.json                         # 更新脚本
vitest.config.ts                     # 更新测试配置
```

### 3.3 删除文件

```
src/
├── kimi/                            # 整个目录
│   ├── client.ts
│   ├── executor.ts
│   ├── types.ts
│   └── index.ts
└── index.ts                         # 旧的入口

tests/
└── unit/
    └── kimi/                        # 整个目录
```

## 4. 风险与应对

| 风险 | 可能性 | 影响 | 应对策略 |
|-----|-------|------|---------|
| Agent ID 格式变更导致冲突 | 中 | 高 | 充分测试 ID 生成唯一性 |
| 数据迁移问题 | 低 | 中 | 根据要求 #6，直接重置 |
| ACP 兼容性问题 | 中 | 高 | 保留回退方案，逐步切换 |
| 测试覆盖率不达标 | 中 | 中 | 预留时间补充测试 |
| CI/CD 配置错误 | 中 | 低 | 先在分支测试 |

## 5. 验收标准

### 5.1 功能验收

- [ ] Agent ID 使用新格式：`{名称}_{微信ID前8位}_{4位随机码}`
- [ ] 支持多微信用户，每个用户独立存储凭证
- [ ] 支持 N:M 绑定关系
- [ ] 首次登录自动创建创世 Agent
- [ ] 创世 Agent 拥有系统管理权限
- [ ] 支持本地自动备份
- [ ] 支持 GitHub 私有仓库同步
- [ ] 旧 Kimi CLI 代码已完全移除

### 5.2 质量验收

- [ ] 单元测试覆盖率 ≥85%
- [ ] 集成测试覆盖核心流程
- [ ] E2E 测试覆盖登录和消息处理
- [ ] CI/CD 流水线运行稳定
- [ ] 代码审查通过
- [ ] 文档完整更新

## 6. 实施检查清单

### 每日检查清单

```markdown
## Day X 检查清单

### 已完成
- [ ] 任务 1
- [ ] 任务 2
- [ ] ...

### 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 覆盖率达标

### 代码质量
- [ ] 代码审查完成
- [ ] 文档已更新
- [ ] 无 TypeScript 错误

### 提交
- [ ] 代码已提交
- [ ] Commit 信息规范
- [ ] PR 已创建
```

## 7. 文档更新计划

| 文档 | 更新内容 | 负责人 |
|-----|---------|-------|
| `README.md` | 更新架构图、命令列表 | - |
| `AGENTS.md` | 更新开发规范、数据架构 | - |
| `docs/development/setup.md` | 更新安装步骤 | - |
| `docs/guides/user-manual.md` | 更新用户命令 | - |
| `docs/deployment/installation.md` | 更新部署流程 | - |

## 8. 培训与交接

### 8.1 新架构培训

- Agent ID 生成规则
- N:M 关系模型
- 权限系统设计
- 备份恢复流程

### 8.2 运维手册

- CI/CD 流水线维护
- 备份监控
- 故障恢复
- 日志查看

---

## 附录：TDD 实施规范

每个任务必须遵循 TDD 流程：

```
🔴 红阶段 (10%)
   └── 编写测试，确认失败

🟢 绿阶段 (70%)
   └── 实现最小代码，使测试通过

🔵 重构阶段 (20%)
   └── 优化代码，保持测试通过
```

### 提交信息规范

```
feat(agent): 实现 Agent ID 生成器

- 添加 id-generator.ts
- 实现 generateAgentId 函数
- 添加 parseAgentId 函数
- 编写单元测试，覆盖率 95%

Refs: #1
```

### 分支策略

```
main
  └── develop
       ├── feature/agent-id-refactor
       ├── feature/nm-relationship
       ├── feature/founder-agent
       ├── feature/acp-migration
       ├── feature/backup-sync
       └── feature/ci-cd
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
