# Claude Code 源码泄露分析 - 学习 Backlog

> 分析日期: 2026-04-01  
> 泄露规模: ~1,900 TypeScript文件, 512,000+行代码  
> 技术栈: TypeScript + Bun + React + Ink

---

## 1. 核心架构学习

### 1.1 五层架构设计

Claude Code采用清晰的分层架构：

```
Layer 1: Entrypoints     → CLI / Desktop / Web / SDK / IDE Extensions
Layer 2: Runtime         → REPL loop / Query executor / Hook system / State manager  
Layer 3: Engine          → QueryEngine / Context coordinator / Model manager / Compact
Layer 4: Tools & Caps    → 100+ tools / Plugin / MCP / Skill / Agent / Command
Layer 5: Infrastructure  → Auth / Storage / Cache / Analytics / Bridge transport
```

**学习点**:
- [ ] 研究如何将同一核心引擎支持多种前端（CLI、Desktop、Web、IDE）
- [ ] 设计Bridge层抽象，实现传输层与业务逻辑解耦
- [ ] 参考Entrypoints设计模式，支持快速路径（--version等）和完整初始化路径

### 1.2 核心模块规模

| 文件 | 代码行 | 职责 |
|------|--------|------|
| QueryEngine.ts | ~46,000 | LLM API调用、流式处理、缓存、多轮编排 |
| Tool.ts | ~29,000 | 工具类型定义、权限Schema |
| commands.ts | ~25,000 | 85+ slash命令注册与执行 |
| main.tsx | ~4,683 | CLI入口、REPL引导、Ink渲染 |

**学习点**:
- [ ] 超大模块的组织和维护策略
- [ ] 核心引擎的单文件设计 vs 多文件拆分的权衡
- [ ] 命令系统的插件化注册机制

---

## 2. 工具系统 (Tools)

### 2.1 工具架构

40+ 独立工具模块，每个工具包含：
- 实现代码
- 描述定义
- 参数Schema

核心工具列表：
- `BashTool` - 沙箱化shell执行
- `FileReadTool` / `FileEditTool` / `FileWriteTool` - 文件操作
- `GlobTool` / `GrepTool` - 文件搜索
- `AgentTool` - 子Agent生成
- `WebSearchTool` / `WebFetchTool` - Web访问
- `MCPTool` - Model Context Protocol集成
- `LSPTool` - Language Server Protocol集成
- `TaskCreateTool` - 后台任务创建
- `SkillTool` - 可复用Skill执行

**学习点**:
- [ ] 统一的Tool接口设计，支持Schema验证
- [ ] 工具的热插拔和动态发现机制
- [ ] 工具的分类组织（文件/搜索/执行/网络/Agent）

### 2.2 权限系统

四级权限模型：
```
default    → 每次询问用户
auto       → 根据分类器自动批准低风险操作
bypass     → 绕过确认（Plan模式下）
yolo       → 完全自动（危险）
```

权限检查流程：
```
用户命令 → 权限检查 → YOLO分类器 → 路径验证 → 规则匹配 → 执行/拒绝
```

**学习点**:
- [ ] AI驱动的风险分类器设计（Bash命令安全分类）
- [ ] 分层权限模型与用户体验平衡
- [ ] 路径白名单/黑名单的验证机制

### 2.3 智能并发

工具编排策略：
- **读操作并行**: 多个文件读取同时执行
- **写操作串行**: 避免冲突和竞态条件
- **智能分区**: 自动识别工具间的依赖关系

**学习点**:
- [ ] 实现toolOrchestration.ts类似的并发调度器
- [ ] 读写分离的并行策略
- [ ] 依赖图的自动分析

---

## 3. 多Agent系统

### 3.1 三种执行模型

| 模型 | 说明 | 适用场景 |
|------|------|----------|
| **Fork模型** | 字节级复制父上下文，共享Prompt缓存 | 同类型任务并行 |
| **Teammate模型** | 文件邮箱跨终端窗格通信 | 多人协作场景 |
| **Worktree模型** | 每个Agent独立git分支 | 复杂重构任务 |

**学习点**:
- [ ] Prompt缓存共享的成本优化策略
- [ ] 跨进程/跨窗口的Agent通信机制（mailbox）
- [ ] Git worktree与Agent隔离的结合

### 3.2 Agent协调器

```
coordinator/
├── coordinatorMode.ts    # 核心对话循环
├── AgentTool/            # 子Agent生成工具
├── coordinator/          # 多Agent协调逻辑
└── team/                 # 团队级并行工作
```

**学习点**:
- [ ] 父Agent与子Agent的上下文传递机制
- [ ] Agent生命周期的统一管理
- [ ] Team级别的任务分配和结果汇总

### 3.3 安全隔离

子Agent安全约束示例：
- **Explore Agent**: 严格只读模式，禁止创建/修改/删除任何文件
- **Bash Agent**: 详细的git安全规则（永不强制推送到main）

**学习点**:
- [ ] 通过能力分离实现防御纵深
- [ ] 为不同Agent类型定制系统提示词
- [ ] 危险操作的多层确认机制

---

## 4. 上下文与内存系统

### 4.1 三层Token压缩

| 层级 | 机制 | 成本 |
|------|------|------|
| **Microcompact** | `cache_edits` API移除消息（保留Prompt缓存） | 零成本 |
| **Session Memory** | 预提取的会话记忆作为摘要 | 低成本 |
| **Full Compact** | 子Agent总结为9段结构化格式 | 标准API调用 |

优化技巧：
- `FILE_UNCHANGED_STUB`: 重新读取未变文件时返回30字短桩
- 动态输出上限（默认8K，重试64K）
- 缓存锁防止UI切换破坏70K上下文

**学习点**:
- [ ] 实现零成本的cache_edits压缩策略
- [ ] 设计结构化的对话总结格式
- [ ] Token预算的实时监控和预警

### 4.2 持久化内存 (memdir)

三层内存架构防止上下文熵增：
```
MEMORY.md          → 轻量级索引，指向分布式主题文件
topics/*.md        → 分布式主题文件
.observations.md   → 观察记录
```

严格写入纪律：仅成功写入的变更才反映到内存

**学习点**:
- [ ] 自修复内存系统设计
- [ ] 索引+分布式文件的混合存储
- [ ] 内存更新的原子性和一致性保证

### 4.3 CLAUDE.md 层级

```
~/.claude/CLAUDE.md          # 全局偏好
./CLAUDE.md                  # 项目级
./.claude/rules/*.md         # 模块化规则
./.claude/CLAUDE.md.local    # gitignored本地笔记（40K字符限制）
```

**学习点**:
- [ ] 每轮迭代重新读取CLAUDE.md的设计
- [ ] 层级化的配置继承机制
- [ ] 规则模块化（rules/*.md）

---

## 5. Hook系统与扩展性

### 5.1 25+生命周期事件

五类Hook：
1. **Shell命令** - Pre/Post工具执行
2. **LLM注入上下文** - 动态修改Prompt
3. **完整Agent验证循环** - 复杂审批流程
4. **HTTP Webhook** - 外部系统集成
5. **JavaScript函数** - 自定义逻辑

关键事件：
- PreToolUse / PostToolUse
- UserPromptSubmit
- SessionStart / SessionEnd
- ToolExecutionError

**学习点**:
- [ ] 设计可插拔的Hook架构
- [ ] Hook的异步执行和错误处理
- [ ] Hook配置的热加载机制

### 5.2 Plugin系统

```
services/plugins/     # 插件加载和生命周期
plugins/              # 内置和第三方插件
```

**学习点**:
- [ ] 插件的注册、验证、加载流程
- [ ] 插件与核心系统的安全隔离
- [ ] 插件API的版本兼容性

### 5.3 Skill系统

可复用的Prompt模板：
```
skills/
├── commit/           # /commit 命令
├── review-pr/        # /review 命令
└── [user-skills]/    # 用户自定义Skill
```

通过 `SkillTool` 执行

**学习点**:
- [ ] Skill的定义格式和参数化
- [ ] Skill的版本管理和更新
- [ ] Skill的市场化分享机制

---

## 6. 终端UI (Ink + React)

### 6.1 自定义渲染引擎

```
ink/                      # 自定义终端渲染引擎
├── components/           # 基础UI组件（Box, Text, Button, ScrollBox）
├── hooks/                # React hooks（输入处理、动画、终端状态）
├── layout/               # Yoga-based flexbox布局引擎
└── ...
```

**学习点**:
- [ ] Yoga布局引擎在终端的应用
- [ ] 自定义Ink组件的性能优化
- [ ] 终端焦点管理和选择交互

### 6.2 组件层次

```
components/
├── messages/             # 消息展示
├── PromptInput/          # 输入框
├── StructuredDiff/       # 富文本diff
├── settings/             # 设置界面
└── ...

screens/                  # 全屏视图
```

**学习点**:
- [ ] 消息组件的虚拟滚动优化
- [ ] Diff视图的高亮和折叠
- [ ] 模态对话框和确认流程

### 6.3 Vim模式

完整的Vim仿真：
- 动作（motions）
- 操作符（operators）
- 文本对象（text objects）

**学习点**:
- [ ] Vim状态机实现
- [ ] 键位映射的可配置性
- [ ] 与REPL输入的集成

---

## 7. Bridge与集成

### 7.1 IDE Bridge

双向通信层连接IDE扩展：
```
bridge/
├── bridgeMain.ts              # Bridge主循环
├── bridgeMessaging.ts         # 消息协议
├── bridgePermissionCallbacks.ts # 权限回调
├── replBridge.ts              # REPL会话Bridge
├── jwtUtils.ts                # JWT认证
└── sessionRunner.ts           # 会话执行管理
```

**学习点**:
- [ ] 设计IDE-CLI双向通信协议
- [ ] JWT在本地进程间的应用
- [ ] 会话跨进程恢复机制

### 7.2 MCP (Model Context Protocol)

```
services/mcp/             # MCP服务器管理
```

支持外部工具服务器连接

**学习点**:
- [ ] MCP协议的实现细节
- [ ] 外部工具服务器的动态注册
- [ ] MCP与内置工具的权限统一

### 7.3 LSP集成

```
services/lsp/             # Language Server Protocol客户端
```

代码智能特性支持

**学习点**:
- [ ] LSP客户端的生命周期管理
- [ ] 代码补全/定义跳转的集成
- [ ] 多语言LSP服务器的协调

---

## 8. 性能优化

### 8.1 启动优化

并行预取策略：
```typescript
// main.tsx - 在其他导入前执行
startMdmRawRead()       // MDM设置
startKeychainPrefetch() // 密钥链读取
apiPreconnect()         // API预连接
```

**学习点**:
- [ ] 启动路径的关键路径分析
- [ ] 并行IO减少启动时间
- [ ] 延迟加载重型模块（OpenTelemetry 400KB, gRPC 700KB）

### 8.2 懒加载

```typescript
// 动态导入重型模块
const otel = await import('./services/otel.js')
```

**学习点**:
- [ ] 模块依赖分析和拆分
- [ ] 动态导入的错误处理
- [ ] 预加载关键路径模块

---

## 9. 特性标志系统

### 9.1 Bun Bundle特性标志

```typescript
import { feature } from 'bun:bundle'

const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

未激活代码在构建时完全剔除

**学习点**:
- [ ] 编译时特性标志 vs 运行时特性标志
- [ ] 死代码消除的优化效果
- [ ] 特性标志的管理和发布流程

### 9.2 未发布特性

泄露的隐藏特性：
- `KAIROS` - 后台守护模式，自动整理记忆
- `PROACTIVE` - 主动自主模式
- `BRIDGE_MODE` - VS Code/JetBrains桥接
- `VOICE_MODE` - 语音输入
- `COORDINATOR_MODE` - 多Agent集群协调
- `BUDDY` - 虚拟宠物伴侣系统
- `AGENT_TRIGGERS` - 定时Cron Agent

**学习点**:
- [ ] 特性标志驱动的功能开发
- [ ] 长周期特性的渐进式发布
- [ ] 用户可见性与内部测试的平衡

---

## 10. 安全设计

### 10.1 多层安全

```
用户确认 → 权限系统 → 沙箱 → Hook验证 → 审计日志
```

**学习点**:
- [ ] 默认安全的设计原则
- [ ] 沙箱化Bash执行
- [ ] 审计日志的完整性保证

### 10.2 攻击防护

已知防护：
- 恶意仓库数据泄露防护
- 命令注入防护
- 路径遍历防护

**学习点**:
- [ ] 项目加载流程的安全审查
- [ ] 不可信输入的验证策略
- [ ] 供应链攻击防护

---

## 11. 实现Backlog

### 高优先级 (立即实现)

- [ ] **多Agent架构**: 实现Fork/Teammate/Worktree三种子Agent模型
- [ ] **工具权限系统**: 四级权限模型 + YOLO分类器
- [ ] **智能并发**: 读写分离的并行工具执行
- [ ] **Token压缩**: 三层压缩系统（Microcompact/Session/Full）
- [ ] **持久化内存**: MEMORY.md索引 + 分布式主题文件

### 中优先级 (近期实现)

- [ ] **Hook系统**: 25+生命周期事件的可插拔架构
- [ ] **Skill系统**: 可复用Prompt模板 + SkillTool
- [ ] **Bridge系统**: IDE双向通信 + JWT认证
- [ ] **MCP支持**: Model Context Protocol集成
- [ ] **特性标志**: 编译时特性标志系统

### 低优先级 (长期规划)

- [ ] **LSP集成**: Language Server Protocol客户端
- [ ] **Plugin架构**: 第三方插件支持
- [ ] **Vim模式**: 完整的Vim仿真
- [ ] **语音模式**: 语音输入支持
- [ ] **后台守护**: KAIROS模式的自主Agent

---

## 12. 参考资料

- [Claude Code泄露分析 - David Borish](https://www.davidborish.com/post/anthropic-s-claude-code-source-code-leaked-and-here-s-what-it-shows)
- [Claude Code架构深度解析 - Redreamality](https://redreamality.com/blog/claude-code-source-leak-architecture-analysis/)
- [GitHub - leaked-claude-code](https://github.com/leaked-claude-code/leaked-claude-code)
- [GitHub - nirholas/claude-code](https://github.com/nirholas/claude-code)

---

*本文档基于2026-03-31泄露的Claude Code源码分析整理，仅供学习参考。*
