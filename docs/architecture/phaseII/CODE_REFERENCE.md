# 代码参考指南

本文档提供可直接参考的代码片段，摘自 `weixin-claude-bot` 和 `weixin-ilink` 项目。

---

## 1. iLink HTTP API 实现

### 1.1 API 核心（`src/ilink/api.ts` 参考）

```typescript
import crypto from "node:crypto";

const DEFAULT_CHANNEL_VERSION = "weixin-ilink/0.1.0";
const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
const DEFAULT_API_TIMEOUT_MS = 15_000;

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(token: string, body: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin(),
  };
}

async function post<T>(
  opts: ClientOptions,
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const channelVersion = opts.channelVersion ?? DEFAULT_CHANNEL_VERSION;
  const url = new URL(endpoint, opts.baseUrl.endsWith("/") ? opts.baseUrl : opts.baseUrl + "/");
  const body = JSON.stringify({ ...payload, base_info: { channel_version: channelVersion } });
  const headers = buildHeaders(opts.token, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${text}`);
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// 5个端点实现
export async function getUpdates(
  opts: ClientOptions,
  params: GetUpdatesReq,
): Promise<GetUpdatesResp> {
  const timeout = opts.longPollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS;
  try {
    return await post<GetUpdatesResp>(
      opts,
      "ilink/bot/getupdates",
      { get_updates_buf: params.get_updates_buf ?? "" },
      timeout,
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ret: 0, msgs: [], get_updates_buf: params.get_updates_buf };
    }
    throw err;
  }
}

export async function sendMessage(opts: ClientOptions, body: SendMessageReq): Promise<void> {
  const timeout = opts.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  await post(opts, "ilink/bot/sendmessage", body as unknown as Record<string, unknown>, timeout);
}

export async function sendTyping(opts: ClientOptions, body: SendTypingReq): Promise<void> {
  const timeout = opts.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  await post(opts, "ilink/bot/sendtyping", body as unknown as Record<string, unknown>, timeout);
}

export async function getConfig(
  opts: ClientOptions,
  ilinkUserId: string,
  contextToken?: string,
): Promise<GetConfigResp> {
  const timeout = opts.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  return post<GetConfigResp>(
    opts,
    "ilink/bot/getconfig",
    { ilink_user_id: ilinkUserId, context_token: contextToken },
    timeout,
  );
}

export async function getUploadUrl(
  opts: ClientOptions,
  params: GetUploadUrlReq,
): Promise<GetUploadUrlResp> {
  const timeout = opts.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  return post<GetUploadUrlResp>(
    opts,
    "ilink/bot/getuploadurl",
    params as unknown as Record<string, unknown>,
    timeout,
  );
}
```

---

### 1.2 ILinkClient 类（`src/ilink/client.ts` 参考）

```typescript
import crypto from "node:crypto";
import * as api from "./api.js";
import type { ClientOptions, GetUpdatesResp, WeixinMessage, MessageItem } from "./types.js";
import { MessageType, MessageState, MessageItemType, TypingStatus } from "./types.js";

export class ILinkClient {
  private opts: ClientOptions;
  private syncBuf = "";

  constructor(opts: ClientOptions) {
    this.opts = opts;
  }

  set cursor(buf: string) {
    this.syncBuf = buf;
  }
  get cursor(): string {
    return this.syncBuf;
  }

  async poll(): Promise<GetUpdatesResp> {
    const resp = await api.getUpdates(this.opts, { get_updates_buf: this.syncBuf });
    if (resp.get_updates_buf) {
      this.syncBuf = resp.get_updates_buf;
    }
    return resp;
  }

  async sendText(toUserId: string, text: string, contextToken: string): Promise<void> {
    const msg: WeixinMessage = {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: this.generateClientId(),
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      context_token: contextToken,
      item_list: [{ type: MessageItemType.TEXT, text_item: { text } }],
    };
    await api.sendMessage(this.opts, { msg });
  }

  async sendTextChunked(
    toUserId: string,
    text: string,
    contextToken: string,
    maxLength = 4000,
  ): Promise<number> {
    if (text.length <= maxLength) {
      await this.sendText(toUserId, text, contextToken);
      return 1;
    }
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.slice(i, i + maxLength));
    }
    for (const chunk of chunks) {
      await this.sendText(toUserId, chunk, contextToken);
    }
    return chunks.length;
  }

  async sendTyping(userId: string, contextToken?: string): Promise<void> {
    const config = await this.getConfig(userId, contextToken);
    if (config.typing_ticket) {
      await api.sendTyping(this.opts, {
        ilink_user_id: userId,
        typing_ticket: config.typing_ticket,
        status: TypingStatus.TYPING,
      });
    }
  }

  async getConfig(userId: string, contextToken?: string): Promise<GetConfigResp> {
    return api.getConfig(this.opts, userId, contextToken);
  }

  private generateClientId(): string {
    const hex = crypto.randomBytes(6).toString("hex");
    return `ilink-${Date.now()}-${hex}`;
  }
}
```

---

## 2. 登录流程实现

### 2.1 QR 码登录（`src/auth/login.ts` 参考）

```typescript
const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const QR_POLL_TIMEOUT_MS = 35_000;
const LOGIN_TIMEOUT_MS = 480_000; // 8 minutes
const MAX_QR_REFRESH = 3;

async function fetchQRCode(baseUrl: string): Promise<QRCodeResponse> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = `${base}ilink/bot/get_bot_qrcode?bot_type=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch QR code: ${res.status}`);
  return (await res.json()) as QRCodeResponse;
}

async function pollStatus(baseUrl: string, qrcode: string): Promise<QRStatusResponse> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = `${base}ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_POLL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "iLink-App-ClientVersion": "1" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`QR status poll failed: ${res.status}`);
    return (await res.json()) as QRStatusResponse;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "wait" };
    }
    throw err;
  }
}

export async function loginWithQR(
  callbacks: LoginCallbacks,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<LoginResult> {
  let qr = await fetchQRCode(baseUrl);
  let refreshCount = 1;

  callbacks.onQRCode(qr.qrcode_img_content);
  callbacks.onStatusChange("waiting");

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await pollStatus(baseUrl, qr.qrcode);

    switch (status.status) {
      case "wait":
        break;
      case "scaned":
        callbacks.onStatusChange("scanned");
        break;
      case "expired":
        refreshCount++;
        if (refreshCount > MAX_QR_REFRESH) {
          throw new Error("QR code expired too many times");
        }
        callbacks.onStatusChange("refreshing");
        qr = await fetchQRCode(baseUrl);
        callbacks.onQRCode(qr.qrcode_img_content);
        callbacks.onStatusChange("waiting");
        break;
      case "confirmed":
        if (!status.ilink_bot_id || !status.bot_token) {
          throw new Error("Login failed: server did not return required credentials");
        }
        return {
          botToken: status.bot_token,
          accountId: status.ilink_bot_id,
          baseUrl: status.baseurl || baseUrl,
          userId: status.ilink_user_id,
        };
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("Login timed out");
}
```

---

## 3. 凭证和配置管理

### 3.1 凭证管理（`src/config/credentials.ts` 参考）

```typescript
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STATE_DIR = path.join(os.homedir(), ".weixin-kimi-bot");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface Credentials {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId?: string;
  savedAt: string;
}

function credentialsPath(): string {
  return path.join(STATE_DIR, "credentials.json");
}

export function saveCredentials(creds: Omit<Credentials, "savedAt">): void {
  ensureDir(STATE_DIR);
  const data: Credentials = { ...creds, savedAt: new Date().toISOString() };
  fs.writeFileSync(credentialsPath(), JSON.stringify(data, null, 2));
  fs.chmodSync(credentialsPath(), 0o600);
  console.log(`凭证已保存到 ${credentialsPath()}`);
}

export function loadCredentials(): Credentials | null {
  try {
    const raw = fs.readFileSync(credentialsPath(), "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}
```

---

### 3.2 会话状态管理（`src/config/session.ts` 参考）

```typescript
// Context tokens (per-user)
let tokenCache: Record<string, string> = {};

export function loadContextTokens(): void {
  try {
    const raw = fs.readFileSync(contextTokensPath(), "utf-8");
    tokenCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    tokenCache = {};
  }
}

export function getContextToken(userId: string): string | undefined {
  return tokenCache[userId];
}

export function setContextToken(userId: string, token: string): void {
  tokenCache[userId] = token;
  ensureDir(STATE_DIR);
  fs.writeFileSync(contextTokensPath(), JSON.stringify(tokenCache));
}

// Session IDs (per-user, for multi-turn conversations)
let sessionCache: Record<string, string> = {};

export function loadSessionIds(): void {
  try {
    const raw = fs.readFileSync(sessionIdsPath(), "utf-8");
    sessionCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    sessionCache = {};
  }
}

export function getSessionId(userId: string): string | undefined {
  return sessionCache[userId];
}

export function setSessionId(userId: string, sessionId: string): void {
  sessionCache[userId] = sessionId;
  ensureDir(STATE_DIR);
  fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache));
}

export function clearSessionId(userId: string): void {
  delete sessionCache[userId];
  ensureDir(STATE_DIR);
  fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache));
}

// Sync buffer (getUpdates cursor)
export function loadSyncBuf(): string {
  try {
    return fs.readFileSync(syncBufPath(), "utf-8");
  } catch {
    return "";
  }
}

export function saveSyncBuf(buf: string): void {
  ensureDir(STATE_DIR);
  fs.writeFileSync(syncBufPath(), buf);
}
```

---

## 4. 消息处理

### 4.1 文本提取（参考）

```typescript
const RESET_COMMANDS = new Set(["新对话", "/reset", "/clear"]);

function extractText(msg: WeixinMessage): string {
  if (!msg.item_list?.length) return "";
  for (const item of msg.item_list) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text) {
      const ref = item.ref_msg;
      if (ref?.title) {
        return `[引用: ${ref.title}]\n${item.text_item.text}`;
      }
      return item.text_item.text;
    }
    // Voice ASR transcript
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return "";
}
```

---

## 5. 主循环结构（`src/index.ts` 参考）

```typescript
const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000; // 1 hour

async function main() {
  const creds = loadCredentials();
  if (!creds) {
    console.error("未找到登录凭证。请先运行: npm run login");
    process.exit(1);
  }

  const client = new ILinkClient({
    baseUrl: creds.baseUrl,
    token: creds.botToken,
  });

  // Restore sync cursor
  client.cursor = loadSyncBuf();

  const config = loadConfig();

  console.log("=== 微信 Kimi Bot 已启动 ===");
  console.log(`账号: ${creds.accountId}`);
  console.log(`Base URL: ${creds.baseUrl}`);

  // Restore state
  loadContextTokens();
  loadSessionIds();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n正在关闭...");
    process.exit(0);
  });

  // Long-poll loop
  let consecutiveFailures = 0;

  while (true) {
    try {
      const resp = await client.poll();

      // Handle errors
      if ((resp.ret && resp.ret !== 0) || (resp.errcode && resp.errcode !== 0)) {
        if (resp.errcode === SESSION_EXPIRED_ERRCODE || resp.ret === SESSION_EXPIRED_ERRCODE) {
          console.error(`⚠️  Session 过期，暂停 1 小时后重试...`);
          await sleep(SESSION_PAUSE_MS);
          continue;
        }

        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          console.error("连续失败 3 次，等待 30 秒...");
          consecutiveFailures = 0;
          await sleep(30_000);
        } else {
          await sleep(2_000);
        }
        continue;
      }

      consecutiveFailures = 0;

      // Persist sync cursor
      saveSyncBuf(client.cursor);

      // Process messages
      const msgs = resp.msgs ?? [];
      for (const msg of msgs) {
        await handleMessage(client, msg, config);
      }
    } catch (err) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        consecutiveFailures = 0;
        await sleep(30_000);
      } else {
        await sleep(2_000);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
```

---

## 6. 类型定义参考

### 6.1 iLink 核心类型

```typescript
// Message type constants
export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const;

export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const;

export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2,
} as const;

export const TypingStatus = {
  TYPING: 1,
  CANCEL: 2,
} as const;

// Message structures
export interface TextItem { text?: string; }
export interface VoiceItem { text?: string; encode_type?: number; playtime?: number; }
export interface ImageItem { url?: string; cdn_url?: string; width?: number; height?: number; }

export interface MessageItem {
  type?: number;
  text_item?: TextItem;
  voice_item?: VoiceItem;
  image_item?: ImageItem;
  ref_msg?: { title?: string; message_item?: MessageItem };
}

export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  session_id?: string;
  group_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
  create_time_ms?: number;
}

// API types
export interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface ClientOptions {
  baseUrl: string;
  token: string;
  channelVersion?: string;
  longPollTimeoutMs?: number;
  apiTimeoutMs?: number;
}

// Auth types
export interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

export interface QRStatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

export interface LoginResult {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId?: string;
}
```

---

*代码参考来源：weixin-claude-bot v0.1.0, weixin-ilink v0.1.0*
