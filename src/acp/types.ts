/**
 * ACP (Agent Client Protocol) Types
 * 
 * Type definitions for ACP integration
 */

/**
 * ACP Connection Configuration
 */
export interface ACPConfig {
  /** Command to start ACP server (e.g., 'kimi', 'claude-code-acp') */
  command: string;
  /** Arguments for the command */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * ACP Session Configuration
 */
export interface ACPSessionConfig {
  /** Session working directory */
  cwd: string;
  /** MCP servers to connect */
  mcpServers?: MCPServerConfig[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MCP Server Environment Variable
 */
export interface MCP_SERVEREnvVariable {
  name: string;
  value: string;
}

/**
 * MCP Server Configuration
 * 注意：Kimi ACP 要求 env 是数组格式 [{name, value}]
 */
export interface MCPServerConfig {
  /** Server type - 必须是 stdio */
  type: 'stdio';
  /** Server name */
  name: string;
  /** Server command */
  command: string;
  /** Server arguments */
  args: string[];
  /** Server environment - 必须是 [{name, value}] 数组格式 */
  env: MCP_SERVEREnvVariable[];
}

/**
 * User prompt for ACP
 */
export interface ACPPrompt {
  /** Text content */
  text: string;
  /** Optional context mentions (@-mentions) */
  mentions?: ACPMention[];
  /** Optional images */
  images?: ACPImage[];
}

/**
 * Context mention
 */
export interface ACPMention {
  /** Mention type */
  type: 'file' | 'url' | 'symbol';
  /** Mention content */
  content: string;
}

/**
 * Image attachment
 */
export interface ACPImage {
  /** Image data (base64) */
  data: string;
  /** MIME type */
  mimeType: string;
}

/**
 * ACP Response
 */
export interface ACPResponse {
  /** Response text */
  text: string;
  /** Tool calls made */
  toolCalls?: ACPToolCall[];
  /** Session ID */
  sessionId: string;
  /** Stop reason */
  stopReason: 'end_turn' | 'cancelled' | 'error';
  /** Error if any */
  error?: string;
}

/**
 * ACP Tool Call
 */
export interface ACPToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  title: string;
  /** Tool kind */
  kind: string;
  /** Status */
  status: 'pending' | 'completed' | 'failed';
  /** Input */
  input: unknown;
  /** Output */
  output?: unknown;
}

/**
 * ACP Connection Status
 */
export type ACPConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'error';
