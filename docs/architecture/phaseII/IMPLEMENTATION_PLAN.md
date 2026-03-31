# Phase II 实现计划

## 目标

实现一个可运行的微信 Kimi Bot，能够：
1. 通过 QR 码登录微信
2. 接收微信消息
3. 调用 Kimi CLI 生成回复
4. 将回复发送回微信

---

## 任务分解

### 任务 1：iLink API 层实现（4h）

#### 1.1 创建 `src/ilink/api.ts`

封装 iLink 5个 HTTP 端点：

```typescript
// 需要实现的函数
export async function getUpdates(opts: ClientOptions, params: GetUpdatesReq): Promise<GetUpdatesResp>
export async function sendMessage(opts: ClientOptions, body: SendMessageReq): Promise<void>
export async function sendTyping(opts: ClientOptions, body: SendTypingReq): Promise<void>
export async function getConfig(opts: ClientOptions, userId: string, contextToken?: string): Promise<GetConfigResp>
export async function getUploadUrl(opts: ClientOptions, params: GetUploadUrlReq): Promise<GetUploadUrlResp>
```

**技术要点：**
- 使用原生 `fetch` API
- 实现请求头构建（包含 Authorization 等）
- 长轮询超时处理（35秒）
- 错误码处理（特别是 -14 Session 过期）

#### 1.2 重构 `src/ilink/client.ts`

创建 `ILinkClient` 类：

```typescript
export class ILinkClient {
  constructor(opts: ClientOptions)
  
  // 核心方法
  async poll(): Promise<GetUpdatesResp>
  async sendText(toUserId: string, text: string, contextToken: string): Promise<void>
  async sendTextChunked(toUserId: string, text: string, contextToken: string, maxLength?: number): Promise<number>
  async sendTyping(userId: string, contextToken?: string): Promise<void>
  async getConfig(userId: string, contextToken?: string): Promise<GetConfigResp>
  async getUploadUrl(params: GetUploadUrlReq): Promise<GetUploadUrlResp>
  
  // cursor 管理
  get cursor(): string
  set cursor(buf: string)
}
```

**技术要点：**
- 自动管理 sync cursor（get_updates_buf）
- 长文本自动分块发送（微信限制约4000字符/条）
- client_id 生成（用于消息去重）

#### 1.3 更新 `src/ilink/types.ts`

补充缺失的类型定义，参考 weixin-ilink 的 types.ts。

**验收标准：**
- [ ] 可以成功调用 getUpdates 并获取消息
- [ ] 可以成功发送文本消息
- [ ] 单元测试覆盖主要路径

---

### 任务 2：登录流程实现（3h）

#### 2.1 创建 `src/auth/login.ts`

实现 QR 码登录流程：

```typescript
export interface LoginCallbacks {
  onQRCode: (url: string) => void;
  onStatusChange: (status: 'waiting' | 'scanned' | 'expired' | 'refreshing') => void;
}

export interface LoginResult {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId?: string;
}

export async function loginWithQR(
  callbacks: LoginCallbacks,
  baseUrl?: string
): Promise<LoginResult>
```

**技术要点：**
- QR 码获取：`GET /ilink/bot/get_bot_qrcode?bot_type=3`
- 状态轮询：`GET /ilink/bot/get_qrcode_status?qrcode=xxx`
- 超时处理：8分钟总超时，最多3次 QR 刷新
- 状态机：wait → scanned → confirmed

#### 2.2 创建 `src/auth/index.ts`

统一导出登录相关功能。

**验收标准：**
- [ ] 可以获取并显示 QR 码
- [ ] 可以完成扫码登录流程
- [ ] 返回有效的 botToken 和 accountId

---

### 任务 3：凭证和配置管理（3h）

#### 3.1 创建 `src/config/credentials.ts`

管理登录凭证：

```typescript
export interface Credentials {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId?: string;
  savedAt: string;
}

export function saveCredentials(creds: Omit<Credentials, 'savedAt'>): void
export function loadCredentials(): Credentials | null
```

**存储位置：** `~/.weixin-kimi-bot/credentials.json`

#### 3.2 创建 `src/config/settings.ts`

管理 Bot 配置：

```typescript
export interface BotConfig {
  model: string;              // kimi 模型名称
  maxTurns: number;           // 最大轮次
  systemPrompt: string;       // 系统提示词
  cwd: string;                // 工作目录
  multiTurn: boolean;         // 是否开启多轮对话
}

export function loadConfig(): Required<BotConfig>
export function saveConfig(config: Partial<BotConfig>): void
```

**存储位置：** `~/.weixin-kimi-bot/config.json`

#### 3.3 创建 `src/config/session.ts`

管理会话状态：

```typescript
// 按用户存储 context_token
export function setContextToken(userId: string, token: string): void
export function getContextToken(userId: string): string | undefined

// 按用户存储 session_id（用于多轮对话）
export function setSessionId(userId: string, sessionId: string): void
export function getSessionId(userId: string): string | undefined
export function clearSessionId(userId: string): void

// sync cursor 持久化
export function saveSyncBuf(buf: string): void
export function loadSyncBuf(): string
```

**验收标准：**
- [ ] 凭证可以安全存储和加载
- [ ] 配置可以读写
- [ ] 会话状态可以持久化

---

### 任务 4：Kimi CLI 执行器（4h）

#### 4.1 创建 `src/kimi/executor.ts`

实现 Kimi CLI 调用：

```typescript
export interface KimiExecutorOptions {
  prompt: string;
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  sessionId?: string;  // 用于恢复会话
  maxTurns?: number;
}

export interface KimiExecutionResult {
  text: string;
  durationMs: number;
  sessionId?: string;  // 用于下次恢复
  error?: string;
}

export async function executeKimi(
  options: KimiExecutorOptions
): Promise<KimiExecutionResult>
```

**技术要点：**
- 使用 `spawn` 启动 kimi CLI 子进程
- 支持流式输出收集
- 超时处理
- session ID 提取和恢复

**参考命令格式：**
```bash
kimi --model k1.5 "用户输入的问题"
```

#### 4.2 创建 `src/kimi/session.ts`

管理 Kimi 会话：

```typescript
export class KimiSessionManager {
  getSession(userId: string): string | undefined
  saveSession(userId: string, sessionId: string): void
  clearSession(userId: string): void
  clearAllSessions(): void
}
```

**验收标准：**
- [ ] 可以成功调用 Kimi CLI 并获取回复
- [ ] 支持多轮对话恢复
- [ ] 错误处理和超时处理完善

---

### 任务 5：主入口和消息循环（4h）

#### 5.1 创建 `src/index.ts`

应用程序主入口：

**主要流程：**
1. 加载凭证
2. 初始化 ILinkClient
3. 恢复状态（cursor, context tokens, session IDs）
4. 启动长轮询循环
5. 处理消息 → 调用 Kimi → 发送回复
6. 错误恢复和优雅关闭

**伪代码：**
```typescript
async function main() {
  // 1. 加载凭证
  const creds = loadCredentials();
  if (!creds) { errorExit("请先运行: npm run login"); }
  
  // 2. 初始化客户端
  const client = new ILinkClient({
    baseUrl: creds.baseUrl,
    token: creds.botToken,
  });
  client.cursor = loadSyncBuf();
  
  // 3. 加载配置
  const config = loadConfig();
  
  // 4. 恢复状态
  loadContextTokens();
  loadSessionIds();
  
  // 5. 启动轮询
  while (true) {
    try {
      const resp = await client.poll();
      
      // 处理错误码
      if (resp.errcode === SESSION_EXPIRED_ERRCODE) {
        await sleep(SESSION_PAUSE_MS);  // 暂停1小时后重试
        continue;
      }
      
      // 保存 cursor
      saveSyncBuf(client.cursor);
      
      // 处理消息
      for (const msg of resp.msgs ?? []) {
        await handleMessage(client, msg, config);
      }
    } catch (err) {
      // 错误恢复逻辑
    }
  }
}
```

#### 5.2 实现消息处理器

```typescript
async function handleMessage(
  client: ILinkClient,
  msg: WeixinMessage,
  config: BotConfig
): Promise<void> {
  // 1. 只处理用户消息
  if (msg.message_type !== MessageType.USER) return;
  
  // 2. 提取文本内容
  const text = extractText(msg);
  if (!text) return;
  
  // 3. 保存 context_token
  if (msg.context_token) {
    setContextToken(fromUser, msg.context_token);
  }
  
  // 4. 处理重置命令
  if (isResetCommand(text)) {
    clearSessionId(fromUser);
    await client.sendText(fromUser, "已开始新对话", contextToken);
    return;
  }
  
  // 5. 显示输入状态
  client.sendTyping(fromUser, contextToken).catch(() => {});
  
  // 6. 调用 Kimi
  const result = await executeKimi({
    prompt: text,
    model: config.model,
    sessionId: getSessionId(fromUser),
  });
  
  // 7. 保存 session ID
  if (result.sessionId) {
    setSessionId(fromUser, result.sessionId);
  }
  
  // 8. 发送回复
  await client.sendTextChunked(fromUser, result.text, contextToken);
}
```

**验收标准：**
- [ ] 可以启动并保持运行
- [ ] 可以接收消息并回复
- [ ] 错误恢复机制有效
- [ ] 优雅关闭保存状态

---

### 任务 6：登录脚本（1h）

#### 6.1 创建 `src/login.ts`

独立的登录入口：

```typescript
async function main() {
  console.log("=== 微信 Kimi Bot 登录 ===\n");
  
  const result = await loginWithQR({
    onQRCode: (url) => {
      // 显示 QR 码
      qrterm.generate(url, { small: true });
    },
    onStatusChange: (status) => {
      // 显示状态变化
    },
  });
  
  saveCredentials(result);
  console.log("\n✅ 登录成功！可以运行 npm start 启动 Bot。");
}
```

#### 6.2 更新 package.json

```json
{
  "scripts": {
    "start": "node --import tsx src/index.ts",
    "login": "node --import tsx src/login.ts"
  }
}
```

**验收标准：**
- [ ] `npm run login` 可以完成登录
- [ ] 凭证正确保存

---

### 任务 7：集成测试（4h）

#### 7.1 端到端测试

1. **登录测试**
   - QR 码正常显示
   - 扫码后登录成功
   - 凭证正确保存

2. **消息流程测试**
   - 发送消息到 Bot
   - Bot 正确接收
   - Kimi 生成回复
   - 回复正确发送

3. **多轮对话测试**
   - 连续对话保持上下文
   - 重置命令有效

4. **错误恢复测试**
   - 网络中断后恢复
   - Session 过期处理

#### 7.2 添加依赖

```bash
npm install qrcode-terminal
npm install -D @types/qrcode-terminal
```

**验收标准：**
- [ ] 所有核心流程可正常工作
- [ ] 文档已更新

---

## 文件变更清单

### 新建文件

```
src/
├── index.ts              # 主入口（新建）
├── login.ts              # 登录脚本（新建）
├── ilink/
│   ├── api.ts            # HTTP API 层（新建）
│   └── client.ts         # 完全重构
├── auth/
│   ├── login.ts          # 登录逻辑（新建）
│   └── index.ts          # 统一导出（新建）
├── config/
│   ├── credentials.ts    # 凭证管理（新建）
│   ├── settings.ts       # 配置管理（新建）
│   ├── session.ts        # 会话状态（新建）
│   └── index.ts          # 统一导出（新建）
└── kimi/
    ├── executor.ts       # CLI 执行器（新建）
    └── session.ts        # 会话管理（新建）
```

### 修改文件

```
src/
├── ilink/
│   ├── types.ts          # 补充类型定义
│   └── client.ts         # 重构为 ILinkClient 类
└── kimi/
    └── types.ts          # 补充执行相关类型

package.json              # 添加脚本和依赖
```

---

## 时间安排

| 天 | 任务 | 输出 |
|----|------|------|
| 第1天 | 任务1-2 | iLink API + 登录流程 |
| 第2天 | 任务3-4 | 配置管理 + Kimi 执行器 |
| 第3天 | 任务5-6 | 主入口 + 登录脚本 |
| 第4天 | 任务7 | 集成测试 + Bug 修复 |

---

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Kimi CLI 调用方式不确定 | 高 | 提前调研，准备备选方案 |
| 微信 API 限制 | 中 | 参考 weixin-claude-bot 的处理方式 |
| 长时间运行的稳定性 | 中 | 完善的错误恢复和日志 |
| 消息并发处理 | 低 | 先串行处理，后续优化 |

---

*计划制定时间：2026-03-31*
*预期完成时间：4个工作日*
