/**
 * Settings/Config Management Module
 * 
 * Handles Bot configuration storage and retrieval.
 * Stores in ~/.weixin-kimi-bot/config.json
 * 
 * For testing, set WEIXIN_KIMI_BOT_HOME environment variable.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDefaultLogger } from '../logging/index.js';

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

/**
 * Bot configuration interface
 */
export interface BotConfig {
  /** Kimi model to use (e.g., 'kimi-k1.5', 'kimi-k1.5-long') */
  model: string;
  /** Max agentic turns per message */
  maxTurns: number;
  /** System prompt prepended to every conversation */
  systemPrompt: string;
  /** Working directory for Kimi CLI */
  cwd: string;
  /** Enable multi-turn conversation */
  multiTurn: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BotConfig = {
  model: 'kimi-k1.5',
  maxTurns: 10,
  systemPrompt: '',
  cwd: process.cwd(),
  multiTurn: true,
};

/**
 * Get the path to config file
 */
function configPath(): string {
  return path.join(getStateDir(), 'config.json');
}

/**
 * Ensure the state directory exists
 */
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Load configuration from storage
 * Merges saved config with defaults
 * @returns Complete configuration with defaults
 */
export function loadConfig(): BotConfig {
  try {
    const filePath = configPath();
    const raw = fs.readFileSync(filePath, 'utf-8');
    const saved = JSON.parse(raw) as Partial<BotConfig>;
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    // Return defaults if file doesn't exist or is corrupted
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to storage
 * Merges with existing config
 * @param config Partial config to save
 */
export function saveConfig(config: Partial<BotConfig>): void {
  ensureDir(getStateDir());
  
  // Load existing config and merge
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  
  const filePath = configPath();
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  
  // Log only when not in test mode
  if (!process.env.WEIXIN_KIMI_BOT_HOME) {
    getDefaultLogger().info(`配置已保存到 ${filePath}`);
  }
}
