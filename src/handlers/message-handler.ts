/**
 * Message Handler
 * 
 * Main message processing pipeline.
 * Routes messages through: Parser → Command? → Task Router → Executor
 */

import { Agent } from '../agent/types.js';
import type { SessionContext } from '../context/types.js';
import { CommandHandler } from './command-handler.js';
import { DecisionEngine } from '../task-router/decision.js';
import { TaskAnalyzer } from '../task-router/analyzer.js';
import type { TaskSubmission } from '../types/index.js';
import { sanitizeInput } from './message-utils.js';
import { ExecutionMode } from '../task-router/types.js';

export interface HandlerContext {
  message: string;
  agent: Agent;
  session: SessionContext;
  timestamp: number;
}

export interface ProcessResult {
  type: 'command' | 'chat' | 'task' | 'error';
  response?: string;
  mode?: string;
  taskId?: string;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedMessage?: string;
}

const MAX_MESSAGE_LENGTH = 10000;

export class MessageHandler {
  private taskAnalyzer: TaskAnalyzer;

  constructor(
    private commandHandler: CommandHandler,
    private taskRouter: DecisionEngine,
    taskAnalyzer?: TaskAnalyzer
  ) {
    this.taskAnalyzer = taskAnalyzer || new TaskAnalyzer();
  }

  /**
   * Process an incoming message
   */
  async process(
    message: string,
    agent: Agent,
    session: SessionContext
  ): Promise<ProcessResult> {
    // Validate input
    const validation = this.validateMessage(message);
    if (!validation.valid) {
      return {
        type: 'error',
        error: validation.error,
      };
    }

    const sanitizedMessage = validation.sanitizedMessage!;
    this.createContext(sanitizedMessage, agent, session);

    // Check if it's a command
    if (this.commandHandler.isCommand(sanitizedMessage)) {
      return await this.processCommand(sanitizedMessage, agent, session);
    }

    // Process as chat/task
    return await this.processChat(sanitizedMessage, agent, session);
  }

  /**
   * Create handler context
   */
  private createContext(
    message: string,
    agent: Agent,
    session: SessionContext
  ): HandlerContext {
    return {
      message,
      agent,
      session,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate message input
   */
  private validateMessage(message: string): ValidationResult {
    // Check length before sanitization
    if (message.length > MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      };
    }

    const sanitized = sanitizeInput(message, MAX_MESSAGE_LENGTH);

    if (!sanitized || sanitized.length === 0) {
      return {
        valid: false,
        error: 'Empty message',
      };
    }

    return {
      valid: true,
      sanitizedMessage: sanitized,
    };
  }

  /**
   * Process command message
   */
  private async processCommand(
    message: string,
    agent: Agent,
    session: SessionContext
  ): Promise<ProcessResult> {
    const result = await this.commandHandler.execute(message, agent);

    // Add to session history
    session.messages.push({
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });
    session.messages.push({
      id: `msg_${Date.now()}_resp`,
      role: 'assistant',
      content: result.response,
      timestamp: Date.now(),
    });
    session.lastActivityAt = Date.now();

    return {
      type: 'command',
      response: result.response,
    };
  }

  /**
   * Process chat message
   */
  private async processChat(
    message: string,
    agent: Agent,
    session: SessionContext
  ): Promise<ProcessResult> {
    // Create task submission
    const submission: TaskSubmission = {
      id: `submission_${Date.now()}`,
      prompt: message,
      userId: agent.wechat.accountId,
      contextId: session.id,
      agentId: agent.id,
      priority: 'NORMAL' as any,
      createdAt: Date.now(),
    };

    // Analyze task
    const analysis = this.taskAnalyzer.analyze(submission);

    // Make routing decision
    const decision = this.taskRouter.decide(submission, analysis);

    // Add to session history
    session.messages.push({
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });
    session.lastActivityAt = Date.now();

    return {
      type: decision.mode === ExecutionMode.DIRECT ? 'chat' : 'task',
      mode: decision.mode,
      response: `Task analyzed: ${decision.reason}`,
    };
  }
}
