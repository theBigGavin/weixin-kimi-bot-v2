/**
 * Debug Interface - 调试接口
 * 
 * 在系统正常运行时（npm run dev）提供一个 HTTP 接口，
 * 供 Kimi Code / Agent 直接发送消息并接收响应。
 * 
 * 使用方式：
 *   1. 启动系统: DEBUG_ENABLED=true npm run dev
 *   2. Kimi Code 发送 HTTP 请求到 localhost:3456
 * 
 * 示例：
 *   curl -X POST http://localhost:3456/debug/message \
 *     -H "Content-Type: application/json" \
 *     -d '{"userId": "test_user", "content": "Hello"}'
 */

import http from 'http';
import { URL } from 'url';
import { ILinkClient } from 'weixin-ilink';
import type { AgentManager } from '../agent/manager.js';
import { getCommandHandler } from '../init/managers.js';
import { getDefaultLogger } from '../logging/index.js';
import { executeDirect, executeLongTask, executeFlowTask } from '../message-handlers/execute.js';
import { TaskRouter, createTaskSubmission, TaskPriority, ExecutionMode } from '../task-router/index.js';
import { CommandType } from '../commands/framework.js';

export interface DebugMessageRequest {
  /** 用户ID（模拟微信用户ID） */
  userId: string;
  /** 消息内容 */
  content: string;
  /** 可选：指定 Agent ID */
  agentId?: string;
  /** 可选：创建新 Agent 的配置 */
  agentConfig?: {
    name?: string;
    templateId?: string;
  };
}

export interface DebugMessageResponse {
  success: boolean;
  response?: string;
  type?: string;
  agentId?: string;
  agentName?: string;
  duration: number;
  error?: string;
}

/**
 * 调试接口
 * 
 * 让 Kimi Code 能够与运行中的系统交互
 */
export class DebugInterface {
  private server?: http.Server;
  private port: number;
  private agentManager: AgentManager;
  private isRunning = false;

  constructor(agentManager: AgentManager, port = 3456) {
    this.agentManager = agentManager;
    this.port = port;
  }

  /**
   * 启动调试接口
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.server = http.createServer(this.handleRequest.bind(this));
    
    this.server.listen(this.port, () => {
      this.isRunning = true;
      console.log(`\n🔧 Debug Interface: http://localhost:${this.port}`);
      console.log(`   Kimi Code 可以用这个地址发送消息测试系统\n`);
    });

    this.server.on('error', (err) => {
      getDefaultLogger().error('[DebugInterface] Server error:', err);
    });
  }

  /**
   * 发送消息到 Agent
   */
  async sendMessage(request: DebugMessageRequest): Promise<DebugMessageResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 获取或创建 Agent
      let agent;
      
      if (request.agentId) {
        agent = await this.agentManager.getAgent(request.agentId);
        if (!agent) {
          return {
            success: false,
            error: `Agent not found: ${request.agentId}`,
            duration: Date.now() - startTime,
          };
        }
      } else {
        // 查找用户的 Agent
        const agents = await this.agentManager.listAgents();
        agent = agents.find(a => a.config.wechat.accountId === request.userId);
        
        if (!agent) {
          // 自动创建新 Agent
          agent = await this.agentManager.createAgent({
            name: request.agentConfig?.name || `Agent_${request.userId.slice(0, 8)}`,
            wechatAccountId: request.userId,
            templateId: request.agentConfig?.templateId || 'general',
          });
        }
      }

      // 2. 执行命令（如果是命令）
      const commandHandler = getCommandHandler();
      const { parseCommand, isCommandMessage } = await import('../handlers/message-utils.js');
      
      // 检查是否是命令格式的消息（以 / 开头）
      if (isCommandMessage(request.content)) {
        const parsed = parseCommand(request.content);
        if (parsed && !commandHandler?.isCommand(request.content)) {
          // 未知命令：以 / 开头但不在注册表中
          return {
            success: false,
            response: `Unknown slash command "${request.content}".`,
            type: 'unknown_command',
            agentId: agent.id,
            agentName: agent.name,
            duration: Date.now() - startTime,
          };
        }
        
        // 已知命令：执行
        const result = await commandHandler!.execute(
          request.content,
          agent,
          async () => {} // 不需要进度回调
        );
        
        return {
          success: result.success,
          response: result.response,
          type: result.type === CommandType.UNKNOWN ? 'unknown_command' : 'command',
          agentId: agent.id,
          agentName: agent.name,
          duration: Date.now() - startTime,
        };
      }

          // 3. 执行普通消息（通过 TaskRouter 路由）
      // 使用模拟的 ILinkClient，它会捕获响应
      const responses: string[] = [];
      const mockClient = {
        sendText: async (_userId: string, text: string, _token?: string) => {
          responses.push(text);
          return { success: true };
        },
        sendTextChunked: async (_userId: string, text: string, _token?: string) => {
          responses.push(text);
          return 1;
        },
      } as unknown as ILinkClient;

      // 使用 TaskRouter 进行任务路由决策
      const router = new TaskRouter();
      const submission = createTaskSubmission({
        prompt: request.content,
        userId: request.userId,
        contextId: '',
        agentId: agent.id,
        priority: TaskPriority.NORMAL,
      });
      const decision = router.route(submission);

      getDefaultLogger().debug(`[DebugInterface] Task routed: ${decision.mode} (confidence: ${decision.confidence})`);

      // 根据决策执行不同模式
      switch (decision.mode) {
        case ExecutionMode.DIRECT:
          await executeDirect(mockClient, request.userId, request.content, '', agent.id);
          break;
        case ExecutionMode.LONGTASK:
          await executeLongTask(mockClient, request.userId, request.content, '', agent.id);
          break;
        case ExecutionMode.FLOWTASK:
          await executeFlowTask(mockClient, request.userId, request.content, '', agent.id);
          break;
      }

      return {
        success: true,
        response: responses.join('\n') || `[${decision.mode.toUpperCase()} mode] Task submitted`,
        type: decision.mode === ExecutionMode.DIRECT ? 'chat' : 'task',
        agentId: agent.id,
        agentName: agent.name,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      getDefaultLogger().error('[DebugInterface] sendMessage error:', errorMsg, '\n' + stack);
      return {
        success: false,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * HTTP 请求处理器
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    try {
      if (url.pathname === '/debug/message' && req.method === 'POST') {
        const body = await this.parseBody(req) as DebugMessageRequest;
        
        if (!body.userId || !body.content) {
          this.sendJSON(res, 400, { error: 'userId and content are required' });
          return;
        }

        // 检查内容是否为空或纯空白
        if (body.content.trim().length === 0) {
          this.sendJSON(res, 400, { error: 'Empty message' });
          return;
        }

        const response = await this.sendMessage(body);
        this.sendJSON(res, response.success ? 200 : 500, response);

      } else if (url.pathname === '/debug/agents' && req.method === 'GET') {
        const agents = await this.agentManager.listAgents();
        this.sendJSON(res, 200, {
          agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            userId: a.config.wechat.accountId,
          })),
          count: agents.length,
        });

      } else if (url.pathname === '/debug/health' && req.method === 'GET') {
        this.sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });

      } else {
        this.sendJSON(res, 404, { error: 'Not found' });
      }
    } catch (error) {
      this.sendJSON(res, 500, { 
        error: error instanceof Error ? error.message : 'Internal error' 
      });
    }
  }

  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status);
    res.end(JSON.stringify(data, null, 2));
  }
}
