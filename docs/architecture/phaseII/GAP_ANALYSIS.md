# 项目差距分析报告

## 概述

本报告对比分析 `weixin-kimi-bot-v2`（当前项目）与 `weixin-claude-bot`（参考实现）之间的差距，明确需要完成的工作以达到实际打通微信聊天的效果。

## 参考项目架构分析

### weixin-claude-bot 架构

```
weixin-claude-bot/
├── src/
│   ├── index.ts          # 主入口：消息轮询循环、错误处理、会话管理
│   ├── login.ts          # QR码登录流程
│   ├── config.ts         # CLI配置工具
│   ├── store.ts          # 凭证/配置/会话状态持久化
│   └── claude/
│       └── handler.ts    # Claude Code SDK 调用封装
├── package.json
└── 依赖: weixin-ilink, @anthropic-ai/claude-agent-sdk
```

### weixin-ilink SDK 架构

```
weixin-ilink/
├── src/
│   ├── index.ts          # 统一导出
│   ├── client.ts         # ILinkClient 类：封装5个HTTP端点
│   ├── api.ts            # 底层API函数：getUpdates, sendMessage等
│   ├── types.ts          # 完整的类型定义
│   └── auth.ts           # QR码登录流程
```

**iLink 5个HTTP端点：**
1. `ilink/bot/getupdates` - 长轮询获取消息
2. `ilink/bot/sendmessage` - 发送消息
3. `ilink/bot/sendtyping` - 发送"正在输入"状态
4. `ilink/bot/getconfig` - 获取Bot配置
5. `ilink/bot/getuploadurl` - 获取文件上传URL

---

## 当前项目差距分析

### 1. 🔴 关键缺失：入口文件与主循环

| 项目 | 状态 | 说明 |
|------|------|------|
| weixin-claude-bot | ✅ 完整 | `src/index.ts` 实现主循环，包含：凭证加载、客户端初始化、消息轮询、错误恢复 |
| weixin-kimi-bot-v2 | ❌ 缺失 | 缺少入口文件，无法独立运行 |

**需要实现：**
- `src/index.ts` - 应用程序入口
- 消息轮询主循环（long-polling）
- 优雅关闭处理（SIGINT）
- 连续错误恢复机制

### 2. 🔴 关键缺失：iLink 完整客户端

| 功能 | weixin-claude-bot | weixin-kimi-bot-v2 |
|------|-------------------|-------------------|
| HTTP API 调用 | ✅ `ILinkClient` 类 | ❌ 仅消息解析 |
| 长轮询 (poll) | ✅ 自动管理 cursor | ❌ 未实现 |
| 发送文本消息 | ✅ `sendText()` | ❌ 仅格式化 |
| 分块发送长文本 | ✅ `sendTextChunked()` | ❌ 未实现 |
| 发送媒体消息 | ✅ `sendMedia()` | ❌ 未实现 |
| 发送输入状态 | ✅ `sendTyping()` | ❌ 未实现 |
| 获取上传URL | ✅ `getUploadUrl()` | ❌ 未实现 |

**需要实现：**
- 重构 `src/ilink/client.ts` 为完整的 `ILinkClient` 类
- 实现 `src/ilink/api.ts` 封装5个HTTP端点
- 同步 cursor 持久化机制

### 3. 🔴 关键缺失：登录流程

| 项目 | 状态 | 说明 |
|------|------|------|
| weixin-claude-bot | ✅ 完整 | `src/login.ts` 实现 QR 码登录、凭证保存 |
| weixin-kimi-bot-v2 | ❌ 缺失 | 无登录相关代码 |

**需要实现：**
- `src/login.ts` - QR 码登录脚本
- 凭证管理（`~/.weixin-kimi-bot/credentials.json`）

### 4. 🟡 部分缺失：Kimi CLI 调用

| 功能 | weixin-claude-bot | weixin-kimi-bot-v2 |
|------|-------------------|-------------------|
| 调用 AI | ✅ 使用 `@anthropic-ai/claude-agent-sdk` | 🟡 仅命令构建 |
| 会话恢复 | ✅ `sessionId` 管理 | 🟡 类型定义有 |
| 流式响应处理 | ✅ 完整实现 | ❌ 未实现 |
| 错误处理 | ✅ 详细错误分类 | 🟡 基础错误检测 |

**需要实现：**
- 实际的 Kimi CLI 执行逻辑（spawn subprocess）
- 流式输出处理
- 会话 ID 持久化管理

### 5. 🟡 配置管理差异

| 功能 | weixin-claude-bot | weixin-kimi-bot-v2 |
|------|-------------------|-------------------|
| 配置存储 | ✅ `~/.weixin-claude-bot/config.json` | ❌ 未实现 |
| CLI配置工具 | ✅ `npm run config` | ❌ 未实现 |
| 会话ID管理 | ✅ 按用户持久化 | ❌ 未实现 |
| Context Token | ✅ 按用户缓存 | ❌ 未实现 |

**需要实现：**
- 专用配置管理（非通用 Store）
- CLI 配置命令

### 6. 🟢 已有但可能过度设计

当前项目有一些 weixin-claude-bot 没有的高级功能，但可能过度设计：

| 模块 | 说明 | 建议 |
|------|------|------|
| Agent 管理 | 复杂的 Agent 生命周期管理 | 可简化，先支持单用户 |
| 任务路由 | Direct/LongTask/FlowTask 三种模式 | 可先实现 Direct 模式 |
| 上下文感知 | 状态机、意图识别、指代消解 | 基础功能完成后再完善 |
| 工作流引擎 | 预留但未实现 | 低优先级 |
| 定时任务 | 预留但未实现 | 低优先级 |

---

## 工作量估算

### Phase II 核心目标（MVP）
让 bot 能实际运行并与微信打通，实现最基本的对话功能。

| 任务 | 预估工时 | 优先级 |
|------|----------|--------|
| 1. 实现 iLink HTTP API 层 | 4h | P0 |
| 2. 实现 QR 登录流程 | 3h | P0 |
| 3. 实现 Kimi CLI 执行器 | 4h | P0 |
| 4. 实现主入口和消息循环 | 4h | P0 |
| 5. 实现配置和凭证管理 | 3h | P0 |
| 6. 集成测试和调试 | 4h | P0 |
| **总计** | **~22h** | |

---

## 关键决策建议

### 1. 是否复用 weixin-ilink npm 包？

**选项 A：直接依赖 weixin-ilink（推荐）**
- 优点：快速集成，经过测试
- 缺点：类型系统可能与当前项目不完全匹配
- 实施：在 package.json 中添加依赖

**选项 B：自行实现**
- 优点：完全控制，类型统一
- 缺点：重复造轮子，需要测试
- 实施：参考 weixin-ilink 源码重写

### 2. Kimi CLI 调用方式

**选项 A：spawn 子进程**
- 类似 claude-code SDK 的实现方式
- 需要处理流式输出

**选项 B：使用 SDK（如果存在）**
- 检查是否有官方 SDK

### 3. 功能裁剪建议

对于 Phase II，建议暂时禁用以下功能，专注于核心对话：
- 多 Agent 管理（先支持单 Agent）
- 任务路由（先全部使用 Direct 模式）
- 长任务/流程任务管理
- 定时任务调度

---

## 下一步行动

1. **立即开始**：实现 iLink API 层和登录流程
2. **并行进行**：调研 Kimi CLI 的最佳调用方式
3. **随后完成**：主入口和消息循环
4. **最后**：端到端测试

---

*报告生成时间：2026-03-31*
*参考项目版本：weixin-claude-bot v0.1.0, weixin-ilink v0.1.0*
