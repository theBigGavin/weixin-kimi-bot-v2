/**
 * ACP Service Manager
 * 
 * Manages ACP connections for multiple users
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
   */
  private async getOrCreateSession(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = Date.now();
      return existing;
    }

    // Create new client
    const client = new ACPClient(this.options.acpConfig);
    await client.connect();

    // Create session
    const sessionId = await client.createSession({
      cwd: process.cwd(),
    });

    const session: UserSession = {
      userId,
      client,
      sessionId,
      lastActivity: Date.now(),
    };

    this.sessions.set(userId, session);
    console.log(`[ACP] Created new session for user ${userId}: ${sessionId}`);

    return session;
  }

  /**
   * Send prompt to ACP for user
   */
  async prompt(userId: string, prompt: ACPPrompt): Promise<ACPResponse> {
    try {
      const session = await this.getOrCreateSession(userId);
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
