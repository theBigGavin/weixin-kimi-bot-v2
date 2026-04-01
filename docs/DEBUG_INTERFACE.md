# Debug Interface - Kimi Code 调试接口

## 一句话说明

在 `npm run dev` 启动系统时，额外开启一个 HTTP 端口（3456），Kimi Code 可以通过这个端口发送消息给系统，就像微信用户在发消息一样。

## 使用方法

### 1. 启动系统（带调试接口）

```bash
DEBUG_ENABLED=true npm run dev
```

你会看到输出：
```
🔧 Debug Interface: http://localhost:3456
   Kimi Code 可以用这个地址发送消息测试系统
```

### 2. Kimi Code 发送消息

**方式 A：使用客户端脚本（推荐）**

```bash
# 在新终端窗口执行
npm run ask "Hello"
npm run ask "/help"
npm run ask "你能做什么？"
```

**方式 B：直接使用 curl**

```bash
curl -X POST http://localhost:3456/debug/message \
  -H "Content-Type: application/json" \
  -d '{"userId": "kimi_test", "content": "Hello"}'
```

**方式 C：在 Kimi Code 中编程调用**

```typescript
// Kimi Code 直接调用
const response = await fetch('http://localhost:3456/debug/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'kimi_test_user',
    content: 'Hello!'
  }),
});

const result = await response.json();
console.log(result.response);  // Agent 的回复
```

## 完整测试流程示例

```bash
# 终端 1：启动系统
DEBUG_ENABLED=true npm run dev

# 终端 2：测试系统
npm run ask "Hello"
npm run ask "/help"
npm run ask "请帮我查一下天气"
```

## API 说明

### POST /debug/message

发送消息给系统。

**请求体：**
```json
{
  "userId": "test_user",        // 用户ID（必填）
  "content": "Hello",           // 消息内容（必填）
  "agentId": "agent_xxx",       // 指定Agent（可选，不指定则自动创建）
  "agentConfig": {              // 创建新Agent的配置（可选）
    "name": "MyAgent",
    "templateId": "general"
  }
}
```

**响应：**
```json
{
  "success": true,
  "response": "Hello! How can I help you?",
  "type": "chat",
  "agentId": "agent_xxx",
  "agentName": "MyAgent",
  "duration": 1234
}
```

### GET /debug/agents

列出所有 Agent。

### GET /debug/health

健康检查。

## 工作原理

```
┌─────────────────┐         ┌──────────────────────┐
│  Kimi Code      │         │  npm run dev         │
│                 │         │                      │
│  npm run ask    │ ──────► │  ┌───────────────┐   │
│  "Hello"        │  HTTP   │  │ DebugInterface│   │
│                 │         │  │   :3456       │   │
│                 │         │  └───────┬───────┘   │
│                 │         │          │           │
│                 │         │  ┌───────▼───────┐   │
│                 │         │  │ Agent Manager │   │
│                 │         │  └───────┬───────┘   │
│                 │         │          │           │
│                 │         │  ┌───────▼───────┐   │
│                 │ ◄────── │  │ AI Response   │   │
│  "Hello! How..."│  HTTP   │  └───────────────┘   │
└─────────────────┘         └──────────────────────┘
```

简单来说：**Kimi Code 通过 HTTP 发消息，系统像处理微信消息一样处理，然后返回响应。**

## 用途

1. **自动测试**：Kimi Code 可以写脚本自动测试各种功能
2. **探索性测试**：Kimi Code 与系统对话，了解系统行为
3. **发现问题**：Kimi Code 发送测试消息，检查响应是否符合预期
4. **回归测试**：修改代码后，自动运行测试确保没破坏功能

## 常见问题

**Q: 为什么需要 DEBUG_ENABLED=true？**  
A: 为了安全，调试接口默认不开启。生产环境不应开启。

**Q: 端口冲突怎么办？**  
A: 使用 DEBUG_PORT 指定其他端口：
```bash
DEBUG_ENABLED=true DEBUG_PORT=8080 npm run dev
npm run ask "Hello"  # 会使用默认 3456
DEBUG_URL=http://localhost:8080 npm run ask "Hello"
```

**Q: 和微信聊天有什么区别？**  
A: 对系统来说没有区别。都是通过相同的路径处理消息。只是：
- 微信聊天：用户在微信 App 里发消息
- Debug 接口：Kimi Code 通过 HTTP 发消息
