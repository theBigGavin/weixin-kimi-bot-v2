/**
 * ACP Service Manager
 * 
 * Manages ACP connections for multiple users
 * Each user session is isolated to their own workspace
 */

import { ACPClient } from './client.js';
import type { ACPConfig, ACPPrompt, ACPResponse } from './types.js';

/**
 * User session mapping
 */
interface UserSession {
  userId: string;
  client: ACPClient;
  sessionId: string;
  lastActivity: number;
  workspacePath: string;
}

/**
 * ACP Service Manager options
 */
export interface ACPManagerOptions {
  /** ACP server configuration */
  acpConfig: ACPConfig;
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout?: number;
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  cleanupInterval?: number;
}

/**
 * ACP Service Manager
 * 
 * Manages isolated ACP sessions per user, each bound to their workspace
 */
export class ACPManager {
  private sessions = new Map<string, UserSession>();
  private options: Required<ACPManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: ACPManagerOptions) {
    this.options = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      ...options,
    };

    // Start cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.options.cleanupInterval);
  }

  /**
   * Get or create session for user
   * @param userId User identifier
   * @param workspacePath Agent's workspace path (must be provided)
   */
  private async getOrCreateSession(
    userId: string,
    workspacePath: string
  ): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    
    // Check if existing session is valid and uses the same workspace
    if (existing) {
      if (existing.workspacePath === workspacePath) {
        existing.lastActivity = Date.now();
        return existing;
      }
      
      // Workspace changed, close existing session
      console.log(`[ACP] Workspace changed for user ${userId}, recreating session`);
      await this.closeUserSession(userId);
    }

    // Create new client
    const client = new ACPClient(this.options.acpConfig);
    await client.connect();

    // Create session with user's workspace as cwd
    const sessionId = await client.createSession({
      cwd: workspacePath,
    });

    const session: UserSession = {
      userId,
      client,
      sessionId,
      lastActivity: Date.now(),
      workspacePath,
    };

    this.sessions.set(userId, session);
    console.log(`[ACP] Created new session for user ${userId}: ${sessionId}`);
    console.log(`[ACP] Workspace: ${workspacePath}`);

    return session;
  }

  /**
   * Send prompt to ACP for user
   * @param userId User identifier
   * @param prompt The prompt to send
   * @param workspacePath Agent's workspace path (required for isolation)
   */
  async prompt(
    userId: string,
    prompt: ACPPrompt,
    workspacePath: string
  ): Promise<ACPResponse> {
    if (!workspacePath) {
      throw new Error('workspacePath is required for session isolation');
    }

    try {
      const session = await this.getOrCreateSession(userId, workspacePath);
      const response = await session.client.prompt(session.sessionId, prompt);
      
      session.lastActivity = Date.now();
      
      return response;
    } catch (error) {
      console.error(`[ACP] Error processing prompt for user ${userId}:`, error);
      
      // If session failed, remove it so it will be recreated next time
      await this.closeUserSession(userId);
      
      throw error;
    }
  }

  /**
   * Close session for specific user
   */
  async closeUserSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      await session.client.disconnect();
      this.sessions.delete(userId);
      console.log(`[ACP] Closed session for user ${userId}`);
    }
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((session) =>
      session.client.disconnect().catch((err) => {
        console.error(`[ACP] Error closing session for ${session.userId}:`, err);
      })
    );

    await Promise.all(promises);
    this.sessions.clear();

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('[ACP] All sessions closed');
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get active user IDs
   */
  getActiveUsers(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session info (for debugging)
   */
  getSessionInfo(userId: string): { sessionId: string; workspacePath: string } | null {
    const session = this.sessions.get(userId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      workspacePath: session.workspacePath,
    };
  }

  /**
   * Cleanup inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > this.options.sessionTimeout) {
        toClose.push(userId);
      }
    }

    for (const userId of toClose) {
      console.log(`[ACP] Cleaning up inactive session for user ${userId}`);
      await this.closeUserSession(userId);
    }
  }
}
