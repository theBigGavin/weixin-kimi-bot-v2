# Phase III 架构设计：多 Agent 与 N:M 关系系统

## 概述

Phase III 旨在解决 weixin-kimi-bot-v2 在多 Agent 架构、数据隔离、权限管理、配置备份以及测试策略方面的核心设计缺陷。

## 核心问题与解决方案

| 问题编号 | 问题描述 | 解决方案 |
|---------|---------|---------|
| 1 | AgentID 格式不友好 | 新格式：`{Agent名称}_{微信ID前8位}_{4位随机码}` |
| 2 | npm run login 缺乏 Agent 个性化配置 | 引入交互式 Agent 配置向导 |
| 3 | 微信凭证全局存储，限制单用户 | N:M 架构：多个微信用户 ↔ 多个 Agent |
| 4 | 无创世 Agent 概念 | 引入创世 Agent，具备系统管理权限 |
| 5 | 缺乏配置备份机制 | GitHub 私有仓库同步 + 本地自动备份 |
| 6 | 迁移复杂性 | 开发阶段直接重置，无需迁移 |
| 7 | 旧 Kimi CLI 代码冗余 | 全面迁移至 ACP，清理旧代码 |
| 8 | TDD 缺乏 CI/CD 支持 | 完整 CI/CD 流水线 + 集成测试自动化 |

## 文档索引

| 文档 | 说明 |
|------|------|
| [01-AGENT-ID-DESIGN.md](./01-AGENT-ID-DESIGN.md) | Agent ID 生成策略与数据模型 |
| [02-NM-RELATIONSHIP.md](./02-NM-RELATIONSHIP.md) | 微信用户与 Agent 的 N:M 关系设计 |
| [03-FOUNDER-AGENT.md](./03-FOUNDER-AGENT.md) | 创世 Agent 与权限系统 |
| [04-BACKUP-SYNC.md](./04-BACKUP-SYNC.md) | 配置备份与 GitHub 同步 |
| [05-ACP-MIGRATION.md](./05-ACP-MIGRATION.md) | ACP 迁移与旧代码清理 |
| [06-CI-CD-TESTING.md](./06-CI-CD-TESTING.md) | CI/CD 与测试策略 |
| [07-IMPLEMENTATION-PLAN.md](./07-IMPLEMENTATION-PLAN.md) | 实施计划与任务分解 |

## 新数据架构

```
~/.weixin-kimi-bot/
├── master-config.json              # 系统主配置
├── founder.json                    # 创世 Agent 标识
│
├── wechat-accounts/                # 微信账号数据 (N)
│   └── {wechat_id前8位}/
│       ├── credentials.json        # 微信登录凭证
│       ├── bindings.json           # 绑定的 Agent 列表
│       └── last-active.json        # 最后活动时间
│
├── agents/                         # Agent 数据 (M)
│   └── {Agent名称}_{微信ID前8位}_{4位随机码}/
│       ├── config.json             # Agent 配置
│       ├── memory.json             # 长期记忆
│       ├── workspace/              # 工作目录
│       └── context/                # 会话上下文
│
└── backups/                        # 本地备份
    ├── auto/                       # 自动备份
    └── github-sync/                # GitHub 同步缓存
```

## 关键架构图

### N:M 关系模型

```
┌─────────────────────────────────────────────────────────────────┐
│                     WeChat Users (N)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  User A     │    │  User B     │    │  User C     │         │
│  │ wxid_a1b2   │    │ wxid_c3d4   │    │ wxid_e5f6   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          │     Binding      │     Binding      │     Binding
          │     Table        │     Table        │     Table
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agents (M)                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Agent_1     │◄───┤ Agent_2     │◄───┤ Agent_3     │         │
│  │ (通用助手)   │    │ (程序员)    │    │ (创世)      │         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                                │                │
│                                         ┌──────┴──────┐        │
│                                         │  系统管理权限 │        │
│                                         └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 绑定关系表

```typescript
// wechat-accounts/{wxid}/bindings.json
{
  "wechatId": "wxid_a1b2c3d4",
  "agents": [
    {
      "agentId": "小助手_a1b2c3d4_x7k9",
      "isDefault": true,
      "boundAt": 1712051200000
    },
    {
      "agentId": "程序员_a1b2c3d4_m2n4",
      "isDefault": false,
      "boundAt": 1712051300000
    }
  ],
  "defaultAgentId": "小助手_a1b2c3d4_x7k9"
}

// agents/{agentId}/config.json
{
  "id": "小助手_a1b2c3d4_x7k9",
  "name": "小助手",
  "boundWechatIds": ["wxid_a1b2c3d4"],
  "isFounder": false,
  // ... 其他配置
}
```

## 命令体系

### 登录与配置命令

```bash
# 首次登录 - 创建创世 Agent
npm run login

# 为当前微信账号添加/切换 Agent
npm run agent:create

# 列出当前微信账号绑定的所有 Agent
npm run agent:list

# 切换当前使用的 Agent
npm run agent:switch

# 删除 Agent 绑定
npm run agent:unbind
```

### 微信端命令

```
/agent list          # 列出可用的 Agent
/agent switch <id>   # 切换到指定 Agent
/agent create        # 创建新 Agent（交互式）
/agent config        # 修改当前 Agent 配置
/reset               # 重置当前对话
/backup              # 手动触发备份（仅创世Agent）
```

## 实施优先级

| 优先级 | 模块 | 预估工时 |
|-------|------|---------|
| P0 | Agent ID 重构 + 数据模型 | 8h |
| P0 | N:M 关系系统 | 10h |
| P0 | 创世 Agent 与权限 | 6h |
| P1 | 交互式登录配置 | 6h |
| P1 | ACP 迁移与清理 | 8h |
| P2 | GitHub 备份同步 | 8h |
| P2 | CI/CD 与测试 | 10h |
| **总计** | | **56h** |

## 破坏性变更

1. **Agent ID 格式变更**：旧 Agent 需要重新绑定
2. **数据目录结构变更**：旧数据将被忽略
3. **Kimi CLI 代码移除**：`src/kimi/` 目录将被清理
4. **登录流程变更**：`npm run login` 将支持交互式配置

## 向后兼容性

- **无迁移支持**：根据要求 #6，开发阶段直接重置
- **清理脚本**：提供 `npm run cleanup` 清理旧数据

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
