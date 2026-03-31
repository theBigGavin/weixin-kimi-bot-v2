# 快速开始

本指南帮助您在 5 分钟内启动并运行 weixin-kimi-bot。

## ✅ 前置检查

确保您已安装：

- [ ] Node.js 18+ (`node --version`)
- [ ] npm 9+ (`npm --version`)
- [ ] Kimi CLI (`kimi --version`)

## 🚀 三步启动

### 第 1 步：下载项目

```bash
git clone <repository-url>
cd weixin-kimi-bot
npm install
```

### 第 2 步：配置

```bash
# 复制配置模板
cp config.example.json config.json

# 编辑配置（只需配置 API Key）
echo '{"kimi":{"apiKey":"YOUR_API_KEY"}}' > config.json
```

### 第 3 步：运行

```bash
# 运行测试
npm test

# 启动服务
npm run dev
```

服务启动后，您可以通过以下方式交互：

- **微信消息**：向绑定的微信账号发送消息
- **命令行**：使用 CLI 工具
- **API 调用**：HTTP 接口

## 💬 首次对话

### 基础对话

发送消息给 Bot：

```
你好！请介绍一下自己
```

Bot 会回复：

```
你好！我是你的 AI 助手，基于 Kimi 大模型。我可以帮助你：
- 回答问题
- 编写代码
- 分析数据
- 创作内容

你可以使用 /help 查看所有命令。
```

### 使用命令

发送命令查看帮助：

```
/help
```

输出：

```
📋 可用命令列表:

/help - 显示可用命令列表
  用法: /help

/start - 开始新会话
  用法: /start

/template <template-id> - 切换能力模板
  用法: /template <template-id>

/status - 查看当前Agent状态
  用法: /status

/reset - 重置当前会话
  用法: /reset

/memory <on|off> - 开关长期记忆
  用法: /memory <on|off>
```

## 🎭 切换角色模板

### 程序员模式

```
/template programmer
```

现在您可以：

```
帮我写一个 Python 函数，实现快速排序
```

### 作家模式

```
/template writer
```

现在您可以：

```
帮我润色这段文字，使其更有感染力
```

## 💾 长期记忆

开启长期记忆，Bot 会记住您的偏好：

```
/memory on
```

示例：

```
用户：我叫张三，是一名前端工程师
Bot：好的，我记住了。你好张三！

用户：帮我写一个组件
Bot：好的张三，作为前端工程师，你需要的组件是什么类型的？
```

## 🔄 重置会话

当对话历史过多时，重置会话：

```
/reset
```

这会清除当前会话历史，但保留长期记忆。

## 📊 查看状态

```
/status
```

输出：

```
📊 Agent 状态:
名称: Default Agent
模板: programmer
记忆: 开启
会话消息: 12
```

## 🛠️ 故障排除

### Bot 不回复

1. 检查服务是否运行：`pm2 status`
2. 检查日志：`pm2 logs`
3. 检查配置：`cat config.json`

### API 错误

1. 检查 Kimi API Key 是否有效
2. 检查网络连接
3. 查看详细错误日志

### 响应慢

1. 检查 Kimi 模型选择
2. 考虑使用流式响应
3. 优化消息长度

## 📚 下一步

- [用户手册](./user-manual.md) - 完整功能介绍
- [模板指南](./templates.md) - 角色模板详解
- [高级配置](./advanced.md) - 自定义配置
