# Phase III 架构设计 - 压缩摘要

## 关键决策 (必须记住)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent ID: {名称}_{微信ID前8位}_{4位随机码}                      │
│    例: 小助手_a1b2c3d4_x7k9                                      │
├─────────────────────────────────────────────────────────────────┤
│ 2. 数据目录结构 (按微信用户隔离)                                   │
│    ~/.weixin-kimi-bot/                                          │
│    ├── master-config.json        # 系统配置                      │
│    ├── founder.json              # 创世Agent标识                 │
│    ├── wechat-accounts/{prefix}/ # 微信凭证+绑定 (N)             │
│    └── agents/{agent_id}/        # Agent数据 (M)                 │
├─────────────────────────────────────────────────────────────────┤
│ 3. N:M 关系 + 默认完全隔离                                        │
│    - 每个微信用户可有多个Agent                                    │
│    - 默认 visibility=private (完全隔离)                          │
│    - 可选 shared/invite_only (需显式开启)                        │
├─────────────────────────────────────────────────────────────────┤
│ 4. 创世Agent (首次登录自动创建)                                   │
│    - 最高权限 (/system/* 命令)                                   │
│    - 存储在 founder.json                                         │
├─────────────────────────────────────────────────────────────────┤
│ 5. ACP 迁移 (清理旧代码)                                         │
│    - 删除 src/kimi/ 整个目录                                     │
│    - src/index-acp.ts → src/index.ts                             │
├─────────────────────────────────────────────────────────────────┤
│ 6. 无需数据迁移 (开发阶段直接重置)                                │
│    - npm run cleanup 清理旧数据                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 实施顺序 (9天)

```
Phase 1 (2天): Agent ID + 数据模型 + 目录结构
Phase 2 (2天): N:M 关系 + 微信账号管理 + 交互式登录
Phase 3 (1天): 创世Agent + 权限系统
Phase 4 (1天): ACP 迁移 + 代码清理
Phase 5 (1天): 备份 + GitHub同步
Phase 6 (2天): CI/CD + 测试覆盖
```

## 核心文件变更

```
新增:
  src/agent/id-generator.ts      # Agent ID 生成
  src/wechat/manager.ts          # 微信账号管理
  src/founder/manager.ts         # 创世Agent管理
  src/auth/permissions.ts        # 权限系统
  src/backup/manager.ts          # 备份管理
  src/paths.ts                   # 路径常量

修改:
  src/agent/types.ts             # 新数据模型
  src/agent/manager.ts           # 适配新模型
  src/config/credentials.ts      # 按用户隔离
  src/login.ts                   # 交互式配置
  src/index-acp.ts → index.ts    # 主入口

删除:
  src/kimi/                      # 整个目录
  src/index.ts (旧)              # 旧入口
```

## 登录流程关键逻辑

```typescript
// npm run login
1. 扫码登录微信
2. 保存凭证到 wechat-accounts/{prefix}/credentials.json
3. 检查是否已有绑定的Agent
4. 用户选择:
   - 使用现有Agent
   - 创建新Agent (交互式配置向导)
   - 绑定他人的Agent (输入Agent ID)
5. 首次登录 → 创建创世Agent + 设置 founder.json
```

## 绑定权限检查

```typescript
function canBind(agentId, wechatId):
  // 1. 检查是否已满
  if (currentCount >= maxBindings) return false
  
  // 2. 检查visibility
  switch (agent.visibility):
    case 'private': return false        // 完全隔离
    case 'shared': return true          // 开放绑定
    case 'invite_only': return allowedWechatIds.includes(wechatId)
```

## 关键CLI命令

```bash
# Agent管理
npm run agent:create          # 创建新Agent (交互式)
npm run agent:list            # 列出绑定的Agent
npm run agent:switch <id>     # 切换当前Agent
npm run agent:bind <id>       # 绑定他人Agent
npm run agent:share <id>      # 设置共享属性

# 备份
npm run backup:create         # 手动备份
npm run backup:github-sync    # 同步到GitHub

# 系统
npm run cleanup               # 清理旧数据
```

## 测试策略

```
覆盖率门槛: 行 ≥85%, 函数 ≥85%, 分支 ≥80%
新增测试:
  - tests/unit/agent/id-generator.test.ts
  - tests/unit/wechat/manager.test.ts
  - tests/integration/founder-creation.test.ts
  - tests/e2e/login-flow.test.ts
```

## 常见陷阱提醒

```
⚠️ 1. 微信凭证必须按用户隔离存储，不能全局存储
⚠️ 2. Agent ID 解析时要验证格式，防止错误ID
⚠️ 3. 共享Agent时记忆和工作空间是共享的，需提示用户
⚠️ 4. 删除 src/kimi/ 前要确保没有其他地方引用
⚠️ 5. 创世Agent只能有一个，setFounder() 会检查是否已存在
```

## 代码片段速查

```typescript
// 生成 Agent ID
const agentId = generateAgentId('小助手', 'wxid_a1b2c3d4');
// 结果: 小助手_a1b2c3d4_x7k9

// 路径常量
Paths.wechatCredentials(wechatId)  // ~/.weixin-kimi-bot/wechat-accounts/a1b2c3d4/credentials.json
Paths.agentConfig(agentId)         // ~/.weixin-kimi-bot/agents/小助手_a1b2c3d4_x7k9/config.json

// 检查创世Agent
const isFounder = await founderManager.isFounderAgent(agentId);

// 权限检查
const canBind = await agentManager.canBind(agentId, wechatId);
```

---
*压缩摘要 - 用于快速回顾*  
*完整文档见 phaseIII/ 目录下的 01-07.md*
