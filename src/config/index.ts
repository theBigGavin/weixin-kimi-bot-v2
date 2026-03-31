/**
 * Configuration Module
 * 
 * Centralized configuration management for the bot.
 */

// Credentials
export {
  saveCredentials,
  loadCredentialsForAgent,
  loadAllCredentials,
  type Credentials,
} from './credentials.js';

// Settings
export {
  saveConfig,
  loadConfig,
  type BotConfig,
} from './settings.js';

// Session State
export {
  loadContextTokens,
  getContextToken,
  setContextToken,
  loadSessionIds,
  getSessionId,
  setSessionId,
  clearSessionId,
  saveSyncBuf,
  loadSyncBuf,
} from './session.js';
