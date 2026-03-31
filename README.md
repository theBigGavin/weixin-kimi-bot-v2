# weixin-kimi-bot 🤖💬

[![Tests](https://img.shields.io/badge/tests-476%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-94.65%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue)]()
[![Node](https://img.shields.io/badge/node-18%2B-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

> 基于 TDD 方法开发的微信智能助手系统，为每个用户提供独立的 AI Agent 服务

## ✨ 核心特性

- **🎭 多 Agent 架构**：每个微信用户拥有独立的 Agent，包含专属配置、记忆和工作空间
- **🧠 上下文感知**：四层架构（会话/任务/项目/用户画像）实现真正的连续对话
- **🎯 智能任务路由**：根据任务复杂度自动选择执行模式（Direct/LongTask/FlowTask）
- **💾 长期记忆**：自动提取和存储用户偏好、项目信息、重要事实
- **🎨 能力模板**：预置角色模板（程序员、作家、交易员等）快速切换助手风格
- **⏰ 定时任务**：支持 cron 表达式的定时任务调度
- **🔔 多渠道通知**：支持 Console、Webhook、Email 等多种通知渠道

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户交互层 (微信客户端 / Web 控制台 / CLI / 定时任务)        │
├─────────────────────────────────────────────────────────────┤
│ 2. 消息处理层 (命令处理器 / 聊天处理器 / 文件处理器)            │
├─────────────────────────────────────────────────────────────┤
│ 3. 任务路由层 (任务分析器 / 决策引擎 / 执行器选择)              │
├─────────────────────────────────────────────────────────────┤
│ 4. 上下文感知层 (状态机 / 意图识别 / 指代消解 / 会话管理)        │
├─────────────────────────────────────────────────────────────┤
│ 5. Agent 管理层 (Agent 配置 / 能力模板 / 记忆管理 / Prompt 构建) │
├─────────────────────────────────────────────────────────────┤
│ 6. 执行引擎层 (Kimi 调用 / 工作流引擎 / 定时任务 / 通知服务)     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- TypeScript 5.0+
- Kimi CLI 已安装并配置

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd weixin-kimi-bot

# 安装依赖
npm install

# 运行测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

### 基础配置

```bash
# 复制配置模板
cp config.example.json config.json

# 编辑配置文件
vim config.json
```

配置示例：
```json
{
  "kimi": {
    "apiKey": "your-api-key",
    "model": "kimi-latest"
  },
  "wechat": {
    "enabled": true,
    "pollingInterval": 5000
  },
  "agents": {
    "defaultTemplate": "default"
  }
}
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# PM2 部署
npm run pm2:start
```

## 📖 使用指南

### 命令列表

向 Bot 发送以下命令：

| 命令 | 说明 | 示例 |
|------|------|------|
| `/help` | 显示帮助信息 | `/help` |
| `/start` | 开始新会话 | `/start` |
| `/status` | 查看 Agent 状态 | `/status` |
| `/template <id>` | 切换能力模板 | `/template programmer` |
| `/memory <on/off>` | 开关长期记忆 | `/memory on` |
| `/reset` | 重置当前会话 | `/reset` |
| `/task <action>` | 管理任务 | `/task list` |

### 能力模板

系统内置以下角色模板：

- **default** - 通用助手
- **programmer** - 程序员助手（代码优化、调试、重构）
- **writer** - 作家助手（写作、编辑、润色）
- **trader** - 交易员助手（市场分析、策略建议）
- **researcher** - 研究员助手（深度分析、报告撰写）
- **pm** - 产品经理助手（需求分析、PRD 撰写）

## 📚 文档索引

| 文档 | 说明 |
|------|------|
| [docs/architecture/architecture-overview.md](docs/architecture/architecture-overview.md) | 架构设计总览 |
| [docs/architecture/context-system.md](docs/architecture/context-system.md) | 上下文系统详解 |
| [docs/development/setup.md](docs/development/setup.md) | 开发环境搭建 |
| [docs/development/tdd-guide.md](docs/development/tdd-guide.md) | TDD 开发指南 |
| [docs/api/README.md](docs/api/README.md) | API 文档 |
| [docs/deployment/installation.md](docs/deployment/installation.md) | 部署指南 |
| [docs/guides/user-manual.md](docs/guides/user-manual.md) | 用户手册 |

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行特定测试
npm test -- tests/unit/agent/manager.test.ts

# 运行 E2E 测试
npm test -- tests/e2e/
```

### 测试覆盖

| 类型 | 数量 | 覆盖率 |
|------|------|--------|
| 单元测试 | 470 | 94.65% |
| E2E 测试 | 6 | - |
| **总计** | **476** | **94.65%** |

## 🛠️ 技术栈

- **开发语言**: TypeScript 5.0+
- **运行时**: Node.js 18+
- **测试框架**: Vitest
- **AI 服务**: Kimi CLI
- **微信协议**: 腾讯 iLink HTTP API
- **进程管理**: PM2

## 📂 项目结构

```
weixin-kimi-bot/
├── src/                      # 源代码目录
│   ├── agent/                # Agent 管理模块
│   ├── context/              # 上下文感知系统
│   ├── handlers/             # 消息处理层
│   ├── task-router/          # 智能任务路由
│   ├── longtask/             # 长任务管理
│   ├── flowtask/             # 结构化流程任务
│   ├── workflow/             # 确定性工作流引擎
│   ├── kimi/                 # Kimi CLI 集成
│   ├── ilink/                # 微信 iLink 协议封装
│   ├── scheduler/            # 定时任务调度
│   ├── memory/               # 长期记忆管理
│   ├── notifications/        # 多渠道通知服务
│   ├── services/             # 核心服务层
│   ├── utils/                # 工具函数
│   └── types/                # 全局类型定义
├── tests/                    # 测试目录
│   ├── unit/                 # 单元测试
│   └── e2e/                  # 端到端测试
├── docs/                     # 项目文档
│   ├── architecture/         # 架构文档
│   ├── development/          # 开发文档
│   ├── api/                  # API 文档
│   ├── deployment/           # 部署文档
│   └── guides/               # 用户指南
└── scripts/                  # 工程脚本
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请阅读 [docs/development/contributing.md](docs/development/contributing.md) 了解如何参与项目。

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 编写测试（TDD 红-绿-重构循环）
4. 提交更改 (`git commit -m 'Add amazing feature'`)
5. 推送分支 (`git push origin feature/amazing-feature`)
6. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Kimi CLI](https://kimi.moonshot.cn/) - 提供强大的 AI 能力支持
- [Vitest](https://vitest.dev/) - 下一代测试框架
- 所有贡献者和用户

---

<p align="center">
  Made with ❤️ by the weixin-kimi-bot team
</p>
