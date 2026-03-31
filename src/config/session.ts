/**
 * Session State Management Module
 * 
 * Manages per-user context tokens and session IDs for multi-turn conversations.
 * Also manages the sync buffer for message polling.
 * 
 * For testing, set WEIXIN_KIMI_BOT_HOME environment variable.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Get the home directory to use for storage
 */
function getHomeDir(): string {
  return process.env.WEIXIN_KIMI_BOT_HOME || os.homedir();
}

/**
 * Get the storage directory for bot data
 */
function getStateDir(): string {
  return path.join(getHomeDir(), '.weixin-kimi-bot');
}

// Context tokens cache (per-user)
let tokenCache: Record<string, string> = {};

// Session IDs cache (per-user, for multi-turn conversations)
let sessionCache: Record<string, string> = {};

// --- Context Tokens ---

function contextTokensPath(): string {
  return path.join(getStateDir(), 'context-tokens.json');
}

/**
 * Load context tokens from storage into memory
 */
export function loadContextTokens(): void {
  try {
    const raw = fs.readFileSync(contextTokensPath(), 'utf-8');
    tokenCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    tokenCache = {};
  }
}

/**
 * Get context token for a user
 * @param userId User ID
 * @returns Context token or undefined
 */
export function getContextToken(userId: string): string | undefined {
  return tokenCache[userId];
}

/**
 * Set context token for a user and persist to storage
 * @param userId User ID
 * @param token Context token
 */
export function setContextToken(userId: string, token: string): void {
  tokenCache[userId] = token;
  ensureDir(getStateDir());
  fs.writeFileSync(contextTokensPath(), JSON.stringify(tokenCache), 'utf-8');
}

// --- Session IDs ---

function sessionIdsPath(): string {
  return path.join(getStateDir(), 'session-ids.json');
}

/**
 * Load session IDs from storage into memory
 */
export function loadSessionIds(): void {
  try {
    const raw = fs.readFileSync(sessionIdsPath(), 'utf-8');
    sessionCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    sessionCache = {};
  }
}

/**
 * Get session ID for a user (for multi-turn conversations)
 * @param userId User ID
 * @returns Session ID or undefined
 */
export function getSessionId(userId: string): string | undefined {
  return sessionCache[userId];
}

/**
 * Set session ID for a user and persist to storage
 * @param userId User ID
 * @param sessionId Session ID from Kimi
 */
export function setSessionId(userId: string, sessionId: string): void {
  sessionCache[userId] = sessionId;
  ensureDir(getStateDir());
  fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache), 'utf-8');
}

/**
 * Clear session ID for a user
 * @param userId User ID
 */
export function clearSessionId(userId: string): void {
  delete sessionCache[userId];
  ensureDir(getStateDir());
  fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache), 'utf-8');
}

// --- Sync Buffer ---

function syncBufPath(): string {
  return path.join(getStateDir(), 'sync-buf.txt');
}

/**
 * Load sync buffer (cursor for message polling)
 * @returns Buffer content or empty string
 */
export function loadSyncBuf(): string {
  try {
    return fs.readFileSync(syncBufPath(), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Save sync buffer (cursor for message polling)
 * @param buf Buffer content
 */
export function saveSyncBuf(buf: string): void {
  ensureDir(getStateDir());
  fs.writeFileSync(syncBufPath(), buf, 'utf-8');
}

// --- Helpers ---

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
