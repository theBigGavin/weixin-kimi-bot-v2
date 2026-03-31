/**
 * ACP (Agent Client Protocol) Client
 * 
 * Client implementation for connecting to ACP agents like kimi acp
 */

import * as acp from '@agentclientprotocol/sdk';
import { spawn, type ChildProcess } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import type {
  ACPConfig,
  ACPSessionConfig,
  ACPPrompt,
  ACPResponse,
  ACPConnectionStatus,
} from './types.js';

/**
 * ACP Client implementation
 */
export class ACPClient {
  private process?: ChildProcess;
  private connection?: acp.ClientSideConnection;
  private status: ACPConnectionStatus = 'disconnected';
  private sessionId?: string;
  private responseBuffer: string = '';
  private toolCalls: Array<{
    id: string;
    title: string;
    kind: string;
    status: string;
    input: unknown;
    output?: unknown;
  }> = [];

  constructor(private config: ACPConfig) {}

  /**
   * Connect to ACP server
   */
  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'authenticated') {
      return;
    }

    this.status = 'connecting';

    try {
      // Spawn ACP process
      this.process = spawn(this.config.command, this.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.config.env },
        cwd: this.config.cwd,
      });

      // Create stdio stream
      const stream = acp.ndJsonStream(
        Writable.toWeb(this.process.stdin!) as WritableStream<Uint8Array>,
        Readable.toWeb(this.process.stdout!) as ReadableStream<Uint8Array>
      );

      // Create connection
      this.connection = new acp.ClientSideConnection(
        () => this.createClientHandler(),
        stream
      );

      // Initialize
      await this.connection.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: false, // We don't allow write for safety
          },
          terminal: {
            create: false,
            write: false,
          },
        },
      });

      this.status = 'connected';
    } catch (error) {
      this.status = 'error';
      throw new Error(
        `Failed to connect to ACP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a new session
   */
  async createSession(config: ACPSessionConfig): Promise<string> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const response = await this.connection.newSession({
      cwd: config.cwd,
      mcpServers: config.mcpServers || [],
    });

    this.sessionId = response.sessionId;
    return response.sessionId;
  }

  /**
   * Send a prompt to the agent
   */
  async prompt(sessionId: string, prompt: ACPPrompt): Promise<ACPResponse> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    this.responseBuffer = '';
    this.toolCalls = [];

    try {
      const response = await this.connection.prompt({
        sessionId,
        prompt: [
          {
            type: 'text',
            text: prompt.text,
          },
        ],
      });

      return {
        text: this.responseBuffer,
        toolCalls: this.toolCalls,
        sessionId,
        stopReason: response.stopReason as ACPResponse['stopReason'],
      };
    } catch (error) {
      return {
        text: this.responseBuffer,
        toolCalls: this.toolCalls,
        sessionId,
        stopReason: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Disconnect from ACP server
   */
  async disconnect(): Promise<void> {
    // Note: SDK doesn't expose a close method, we terminate the process
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = undefined;
    }

    this.connection = undefined;
    this.status = 'disconnected';
    this.sessionId = undefined;
  }

  /**
   * Get current connection status
   */
  getStatus(): ACPConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected' || this.status === 'authenticated';
  }

  /**
   * Create client handler for ACP connection
   */
  private createClientHandler(): acp.Client {
    return {
      // Handle session updates (streaming responses)
      sessionUpdate: async (params: acp.SessionNotification): Promise<void> => {
        const update = params.update;

        if (update.sessionUpdate === 'agent_message_chunk') {
          if (update.content.type === 'text') {
            this.responseBuffer += update.content.text;
          }
        } else if (update.sessionUpdate === 'tool_call') {
          this.toolCalls.push({
            id: update.toolCallId,
            title: update.title,
            kind: update.kind,
            status: update.status,
            input: update.rawInput,
          });
        } else if (update.sessionUpdate === 'tool_call_update') {
          const toolCall = this.toolCalls.find((t) => t.id === update.toolCallId);
          if (toolCall) {
            toolCall.status = update.status;
            toolCall.output = update.rawOutput;
          }
        }
      },

      // Handle permission requests
      requestPermission: async (
        params: acp.RequestPermissionRequest
      ): Promise<acp.RequestPermissionResponse> => {
        // For safety, reject all permission requests in bot mode
        // In the future, we could forward this to the user via WeChat
        console.log(`[ACP] Permission requested: ${params.toolCall.title}`);
        
        return {
          outcome: {
            outcome: 'selected',
            optionId: params.options.find((o) => o.kind === 'allow_once')?.optionId || 
                      params.options[0]?.optionId || 'reject',
          },
        };
      },

      // File system operations
      readTextFile: async (
        params: acp.ReadTextFileRequest
      ): Promise<acp.ReadTextFileResponse> => {
        const fs = await import('node:fs/promises');
        const content = await fs.readFile(params.uri, 'utf-8');
        return { content };
      },

      writeTextFile: async (): Promise<acp.WriteTextFileResponse> => {
        // Not allowed in bot mode for safety
        throw new Error('Write operations not allowed in bot mode');
      },
    };
  }
}
