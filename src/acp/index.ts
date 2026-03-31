/**
 * ACP (Agent Client Protocol) Module
 * 
 * Provides integration with ACP-compatible agents like kimi acp
 */

// Client
export { ACPClient } from './client.js';

// Manager
export { ACPManager } from './manager.js';

// Types
export type {
  ACPConfig,
  ACPSessionConfig,
  MCPServerConfig,
  ACPPrompt,
  ACPResponse,
  ACPMention,
  ACPImage,
  ACPToolCall,
  ACPConnectionStatus,
} from './types.js';

export type { ACPManagerOptions } from './manager.js';
