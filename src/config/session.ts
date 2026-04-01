/**
 * Session State Management Module - Phase 2 Refactoring
 * 
 * Improvements:
 * - Better error handling with specific error types
 * - Eliminated empty catch blocks
 * - Added logging for unexpected errors
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDefaultLogger } from '../logging/index.js';

// ============================================================================
// Error Types
// ============================================================================

export class SessionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SessionError';
  }
}

// ============================================================================
// Constants
// ============================================================================

function getHomeDir(): string {
  return process.env.WEIXIN_KIMI_BOT_HOME || os.homedir();
}

function getStateDir(): string {
  return path.join(getHomeDir(), '.weixin-kimi-bot');
}

// ============================================================================
// State Cache
// ============================================================================

let tokenCache: Record<string, string> = {};
let sessionCache: Record<string, string> = {};

// ============================================================================
// Context Tokens
// ============================================================================

function contextTokensPath(): string {
  return path.join(getStateDir(), 'context-tokens.json');
}

/**
 * Load context tokens from storage into memory
 */
export function loadContextTokens(): void {
  const filePath = contextTokensPath();
  
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      tokenCache = JSON.parse(raw) as Record<string, string>;
    } catch (parseError) {
      getDefaultLogger().warn(`Session: Failed to parse context tokens, resetting: ${(parseError as Error).message}`);
      tokenCache = {};
    }
  } catch (error) {
    // File doesn't exist is okay - start with empty cache
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      tokenCache = {};
    } else {
      getDefaultLogger().error(`Session: Failed to load context tokens: ${(error as Error).message}`);
      tokenCache = {};
    }
  }
}

/**
 * Get context token for a user
 */
export function getContextToken(userId: string): string | undefined {
  return tokenCache[userId];
}

/**
 * Set context token for a user and persist to storage
 */
export function setContextToken(userId: string, token: string): void {
  tokenCache[userId] = token;
  
  try {
    ensureDir(getStateDir());
    fs.writeFileSync(contextTokensPath(), JSON.stringify(tokenCache), 'utf-8');
  } catch (error) {
    throw new SessionError(
      `Failed to save context token for user ${userId}`,
      error as Error
    );
  }
}

// ============================================================================
// Session IDs
// ============================================================================

function sessionIdsPath(): string {
  return path.join(getStateDir(), 'session-ids.json');
}

/**
 * Load session IDs from storage into memory
 */
export function loadSessionIds(): void {
  const filePath = sessionIdsPath();
  
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      sessionCache = JSON.parse(raw) as Record<string, string>;
    } catch (parseError) {
      getDefaultLogger().warn(`Session: Failed to parse session IDs, resetting: ${(parseError as Error).message}`);
      sessionCache = {};
    }
  } catch (error) {
    // File doesn't exist is okay - start with empty cache
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      sessionCache = {};
    } else {
      getDefaultLogger().error(`Session: Failed to load session IDs: ${(error as Error).message}`);
      sessionCache = {};
    }
  }
}

/**
 * Get session ID for a user
 */
export function getSessionId(userId: string): string | undefined {
  return sessionCache[userId];
}

/**
 * Set session ID for a user and persist to storage
 */
export function setSessionId(userId: string, sessionId: string): void {
  sessionCache[userId] = sessionId;
  
  try {
    ensureDir(getStateDir());
    fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache), 'utf-8');
  } catch (error) {
    throw new SessionError(
      `Failed to save session ID for user ${userId}`,
      error as Error
    );
  }
}

/**
 * Clear session ID for a user
 */
export function clearSessionId(userId: string): void {
  delete sessionCache[userId];
  
  try {
    ensureDir(getStateDir());
    fs.writeFileSync(sessionIdsPath(), JSON.stringify(sessionCache), 'utf-8');
  } catch (error) {
    throw new SessionError(
      `Failed to clear session ID for user ${userId}`,
      error as Error
    );
  }
}

// ============================================================================
// Sync Buffer
// ============================================================================

function syncBufPath(): string {
  return path.join(getStateDir(), 'sync-buf.txt');
}

/**
 * Load sync buffer (cursor for message polling)
 */
export function loadSyncBuf(): string {
  try {
    return fs.readFileSync(syncBufPath(), 'utf-8');
  } catch (error) {
    // File doesn't exist is okay - return empty string
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      getDefaultLogger().error(`Session: Failed to load sync buffer: ${(error as Error).message}`);
    }
    return '';
  }
}

/**
 * Save sync buffer (cursor for message polling)
 */
export function saveSyncBuf(buf: string): void {
  try {
    ensureDir(getStateDir());
    fs.writeFileSync(syncBufPath(), buf, 'utf-8');
  } catch (error) {
    throw new SessionError(
      'Failed to save sync buffer',
      error as Error
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function ensureDir(dir: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw new SessionError(
      `Failed to create directory: ${dir}`,
      error as Error
    );
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Auto-load on module import
loadContextTokens();
loadSessionIds();
