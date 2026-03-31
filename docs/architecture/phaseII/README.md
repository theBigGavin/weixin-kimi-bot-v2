# Phase II 实施文档

本文档集合用于指导 weixin-kimi-bot-v2 项目从当前框架状态推进到可实际运行的微信聊天机器人。

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) | 差距分析报告，对比当前项目与参考项目的差异 |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | 详细的实现计划，包含任务分解和时间安排 |
| [CODE_REFERENCE.md](./CODE_REFERENCE.md) | 可直接参考的代码片段和实现模式 |

---

## 快速导航

### 如果你是项目新成员
1. 先阅读 [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) 了解项目现状
2. 然后阅读 [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) 了解实现计划
3. 开发时参考 [CODE_REFERENCE.md](./CODE_REFERENCE.md) 获取代码示例

### 如果你要开始开发
1. 查看 [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) 的"任务分解"部分
2. 选择当前要完成的任务
3. 参考 [CODE_REFERENCE.md](./CODE_REFERENCE.md) 中对应的代码片段

---

## 核心目标

Phase II 的核心目标是让 Bot **真正可用**：

```
当前状态                    Phase II 目标
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 无法独立运行    ───►    ✅ 可独立运行
❌ 仅消息解析      ───►    ✅ 完整 iLink 客户端
❌ 仅命令构建      ───►    ✅ Kimi CLI 调用
❌ 无登录流程      ───►    ✅ QR 码登录
❌ 无配置管理      ───►    ✅ 完整的配置体系
```

---

## 关键决策

### 1. 外部依赖策略

**推荐方案：直接依赖 `weixin-ilink` npm 包**

```bash
npm install weixin-ilink qrcode-terminal
npm install -D @types/qrcode-terminal
```

理由：
- 经过测试验证
- 减少重复开发
- 可以快速推进到 Kimi 集成部分

### 2. 功能裁剪策略

**Phase II 暂时禁用的高级功能：**
- 多 Agent 管理（先单用户）
- 任务路由系统（先用 Direct 模式）
- 长任务/流程任务管理
- 定时任务调度
- 工作流引擎

**保留的核心功能：**
- 微信消息收发
- Kimi CLI 调用
- 多轮对话
- 基础配置管理

---

## 参考项目

| 项目 | 路径 | 说明 |
|------|------|------|
| weixin-claude-bot | `/home/gavin/playground/weixin-claude-bot` | 功能完整的参考实现 |
| weixin-ilink | `/home/gavin/playground/weixin-ilink` | iLink 协议 SDK |

---

## 开发顺序建议

```
第1天 ─┬─ 添加 weixin-ilink 依赖
       ├─ 实现登录流程 (src/login.ts)
       └─ 实现凭证管理 (src/config/credentials.ts)

第2天 ─┬─ 实现配置管理 (src/config/settings.ts)
       ├─ 实现会话管理 (src/config/session.ts)
       └─ 调研 Kimi CLI 调用方式

第3天 ─┬─ 实现 Kimi 执行器 (src/kimi/executor.ts)
       └─ 实现主入口 (src/index.ts)

第4天 ─┬─ 集成测试
       ├─ Bug 修复
       └─ 文档更新
```

---

## 验收标准

Phase II 完成时，应该能够：

1. **登录流程**
   - [ ] `npm run login` 可以显示 QR 码
   - [ ] 扫码后登录成功
   - [ ] 凭证保存到 `~/.weixin-kimi-bot/credentials.json`

2. **消息收发**
   - [ ] `npm start` 可以启动 Bot
   - [ ] 能接收微信消息
   - [ ] 能调用 Kimi 生成回复
   - [ ] 能将回复发送回微信

3. **多轮对话**
   - [ ] 连续对话保持上下文
   - [ ] "新对话"命令可以重置会话

4. **错误处理**
   - [ ] 网络中断后自动恢复
   - [ ] Session 过期正确处理
   - [ ] 优雅关闭保存状态

---

## 注意事项

1. **TDD 原则**：虽然时间紧张，但仍建议为核心逻辑编写测试
2. **代码复用**：优先复用参考项目的代码，减少重复造轮子
3. **渐进式开发**：先跑通主流程，再处理边界情况
4. **日志记录**：添加足够的日志便于调试

---

*文档版本：v1.0*
*最后更新：2026-03-31*
