/**
 * ACP Service Manager
 * 
 * Manages ACP connections for multiple users
 * Each user session is isolated to their own workspace
 */

import { ACPClient } from './client.js';
import type { ACPConfig, ACPPrompt, ACPResponse, MCPServerConfig } from './types.js';
import type { SkillManager } from '../skills/manager.js';
import { getDefaultLogger } from '../logging/index.js';

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
  /** Skill manager for registering skills as MCP servers */
  skillManager?: SkillManager;
}

/**
 * ACP Service Manager
 * 
 * Manages isolated ACP sessions per user, each bound to their workspace
 */
export class ACPManager {
  private sessions = new Map<string, UserSession>();
  private options: ACPManagerOptions & { sessionTimeout: number; cleanupInterval: number };
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
   * @param agentId Optional agent ID to load skills for
   */
  private async getOrCreateSession(
    userId: string,
    workspacePath: string,
    agentId?: string
  ): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    
    // Check if existing session is valid and uses the same workspace
    if (existing) {
      if (existing.workspacePath === workspacePath) {
        existing.lastActivity = Date.now();
        return existing;
      }
      
      // Workspace changed, close existing session
      getDefaultLogger().info(`[ACP] Workspace changed for user ${userId}, recreating session`);
      await this.closeUserSession(userId);
    }

    // Create new client
    const client = new ACPClient(this.options.acpConfig);
    await client.connect();

    // Build MCP servers from agent skills
    const mcpServers: MCPServerConfig[] = [];
    if (agentId && this.options.skillManager) {
      const skillServers = await this.buildSkillMCPServers(agentId);
      mcpServers.push(...skillServers);
    }

    // Debug: log MCP servers
    if (mcpServers.length > 0) {
      getDefaultLogger().debug(`[ACP] Registering ${mcpServers.length} MCP server(s):`);
      mcpServers.forEach(s => getDefaultLogger().debug(`  - ${s.name}: ${s.command} ${s.args?.join(' ')}`));
      getDefaultLogger().debug('[ACP] MCP config:', JSON.stringify(mcpServers, null, 2));
    }

    // Create session with user's workspace as cwd and skill MCP servers
    let sessionId: string;
    try {
      sessionId = await client.createSession({
        cwd: workspacePath,
        mcpServers: mcpServers.length > 0 ? mcpServers : undefined,
      });

      if (mcpServers.length > 0) {
        console.log(`[ACP] Registered ${mcpServers.length} skill(s) as MCP servers for user ${userId}`);
      }
    } catch (error) {
      getDefaultLogger().error('[ACP] Failed to create session with MCP servers:', error);
      getDefaultLogger().debug('[ACP] MCP servers config:', JSON.stringify(mcpServers, null, 2));
      // Fallback: create session without MCP servers
      console.log('[ACP] Retrying without MCP servers...');
      sessionId = await client.createSession({
        cwd: workspacePath,
      });
    }

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
   * @param agentId Optional agent ID to load skills for
   */
  async prompt(
    userId: string,
    prompt: ACPPrompt,
    workspacePath: string,
    agentId?: string
  ): Promise<ACPResponse> {
    if (!workspacePath) {
      throw new Error('workspacePath is required for session isolation');
    }

    try {
      const session = await this.getOrCreateSession(userId, workspacePath, agentId);
      const response = await session.client.prompt(session.sessionId, prompt);
      
      session.lastActivity = Date.now();
      
      return response;
    } catch (error) {
      getDefaultLogger().error(`[ACP] Error processing prompt for user ${userId}:`, error);
      
      // If session failed, remove it so it will be recreated next time
      await this.closeUserSession(userId);
      
      throw error;
    }
  }

  /**
   * Build MCP server configurations from agent's enabled skills
   */
  private async buildSkillMCPServers(agentId: string): Promise<MCPServerConfig[]> {
    if (!this.options.skillManager) {
      return [];
    }

    const servers: MCPServerConfig[] = [];
    const skills = await this.options.skillManager.listAgentSkills(agentId, true);

    for (const agentSkill of skills) {
      const skillResult = await this.options.skillManager.getSkill(agentSkill.skillId);
      if (!skillResult.ok) continue;

      const skill = skillResult.value;
      
      // Convert skill to MCP server config
      const skillDir = `${process.env.HOME}/.weixin-kimi-bot/skills/${skill.id}`;
      
      // 构建 MCP server 配置
      // 注意：Kimi ACP 对 MCP server 名称有格式要求，需要将 - 替换为 _
      const serverName = skill.id.replace(/-/g, '_');
      
      // MCP Server 配置 - stdio 类型
      // 使用 mcp_server.py 作为 MCP 入口点（如果存在），否则使用原脚本
      const mcpServerPath = `${skillDir}/scripts/mcp_server.py`;
      const fs = await import('fs');
      let useMCPServer = false;
      
      try {
        await fs.promises.access(mcpServerPath);
        useMCPServer = true;
      } catch {
        useMCPServer = false;
      }
      
      let command: string;
      let args: string[];
      
      if (useMCPServer) {
        // 使用 MCP Server 包装器
        command = 'python3';
        args = [mcpServerPath];
      } else {
        // 回退到原脚本（可能不支持 MCP 协议）
        switch (skill.execution.type) {
          case 'python':
            command = 'python3';
            args = [`${skillDir}/${skill.execution.entry}`];
            break;
          case 'node':
            command = 'node';
            args = [`${skillDir}/${skill.execution.entry}`];
            break;
          case 'shell':
            command = 'sh';
            args = ['-c', `${skillDir}/${skill.execution.entry}`];
            break;
          default:
            continue; // 跳过不支持的类型
        }
      }
      
      // MCP Server 配置
      const serverConfig: MCPServerConfig = {
        type: 'stdio',
        name: serverName,
        command,
        args,
        env: skill.execution.env 
          ? Object.entries(skill.execution.env).map(([name, value]) => ({ name, value }))
          : [],
      };
      
      servers.push(serverConfig);
    }

    return servers;
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
        getDefaultLogger().error(`[ACP] Error closing session for ${session.userId}:`, err);
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
