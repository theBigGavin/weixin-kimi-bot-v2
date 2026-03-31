/**
 * Credentials Management Module
 * 
 * Handles secure storage and retrieval of WeChat iLink credentials.
 * Stores in ~/.weixin-kimi-bot/credentials.json with restricted permissions.
 * 
 * For testing, set WEIXIN_KIMI_BOT_HOME environment variable to override
 * the default home directory location.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Get the home directory to use for storage
 * Can be overridden with WEIXIN_KIMI_BOT_HOME environment variable for testing
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

/**
 * Credentials data structure
 */
export interface Credentials {
  /** Bot authentication token */
  botToken: string;
  /** WeChat account ID */
  accountId: string;
  /** iLink API base URL */
  baseUrl: string;
  /** Optional user ID */
  userId?: string;
  /** ISO timestamp when credentials were saved */
  savedAt: string;
}

/**
 * Get the path to credentials file
 */
function credentialsPath(): string {
  return path.join(getStateDir(), 'credentials.json');
}

/**
 * Ensure the state directory exists
 */
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save credentials to secure storage
 * @param creds Credentials to save (without savedAt timestamp)
 */
export function saveCredentials(creds: Omit<Credentials, 'savedAt'>): void {
  ensureDir(getStateDir());
  
  const data: Credentials = {
    ...creds,
    savedAt: new Date().toISOString(),
  };
  
  const filePath = credentialsPath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  
  // Set restrictive permissions (owner read/write only)
  // On Windows, this may not have effect but it's good practice
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Ignore permission errors on platforms that don't support it
  }
  
  // Log only when not in test mode to avoid test output noise
  if (!process.env.WEIXIN_KIMI_BOT_HOME) {
    console.log(`凭证已保存到 ${filePath}`);
  }
}

/**
 * Load credentials from secure storage
 * @returns Credentials if they exist, null otherwise
 */
export function loadCredentials(): Credentials | null {
  try {
    const filePath = credentialsPath();
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Credentials;
  } catch {
    // Return null if file doesn't exist or is corrupted
    return null;
  }
}
