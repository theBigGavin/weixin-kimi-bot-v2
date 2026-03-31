/**
 * Message Handler Tests
 * 
 * TDD Red Phase: Define expected behavior for message processing pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageHandler,
  HandlerContext,
  ProcessResult,
} from '../../../src/handlers/message-handler';
import { Agent } from '../../../src/agent/types';
import { SessionContext } from '../../../src/context/session-context';
import { CommandHandler } from '../../../src/handlers/command-handler';
import { DecisionEngine } from '../../../src/task-router/decision';
import { TaskAnalyzer } from '../../../src/task-router/analyzer';

describe('message-handler', () => {
  let handler: MessageHandler;
  let mockAgent: Agent;
  let mockSessionContext: SessionContext;
  let mockCommandHandler: CommandHandler;
  let mockTaskRouter: DecisionEngine;
  let mockTaskAnalyzer: TaskAnalyzer;

  beforeEach(() => {
    mockAgent = {
      id: 'agent_test_001',
      name: 'Test Agent',
      wechat: { accountId: 'wxid_test123' },
      workspace: { path: '/tmp/test', createdAt: Date.now() },
      ai: {
        model: 'kimi-latest',
        templateId: 'default',
        maxTurns: 10,
      },
      memory: {
        enabledL: true,
        enabledS: true,
        maxItems: 100,
        autoExtract: true,
      },
      features: {
        scheduledTasks: true,
        notifications: true,
        fileAccess: true,
        shellExec: false,
        webSearch: true,
      },
    };

    mockSessionContext = {
      id: 'session_001',
      agentId: mockAgent.id,
      state: 'IDLE',
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    } as SessionContext;

    mockCommandHandler = {
      execute: vi.fn(),
      isCommand: vi.fn(),
    } as unknown as CommandHandler;

    mockTaskRouter = {
      decide: vi.fn(),
    } as unknown as DecisionEngine;

    mockTaskAnalyzer = {
      analyze: vi.fn(),
    } as unknown as TaskAnalyzer;

    handler = new MessageHandler(mockCommandHandler, mockTaskRouter, mockTaskAnalyzer);
  });

  describe('process', () => {
    it('should process command message', async () => {
      // Given
      const message = '/help';
      vi.mocked(mockCommandHandler.isCommand).mockReturnValue(true);
      vi.mocked(mockCommandHandler.execute).mockResolvedValue({
        type: 'help',
        success: true,
        response: 'Help text',
      });

      // When
      const result = await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(result.type).toBe('command');
      expect(result.response).toBe('Help text');
    });

    it('should process chat message with DIRECT mode', async () => {
      // Given
      const message = 'Hello, how are you?';
      vi.mocked(mockCommandHandler.isCommand).mockReturnValue(false);
      vi.mocked(mockTaskAnalyzer.analyze).mockReturnValue({
        complexity: 'SIMPLE',
        estimatedDuration: 1000,
        features: {},
      });
      vi.mocked(mockTaskRouter.decide).mockReturnValue({
        mode: 'direct',
        confidence: 0.9,
        reason: 'Simple query',
        analysis: {},
      });

      // When
      const result = await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(result.type).toBe('chat');
      expect(result.mode).toBe('direct');
    });

    it('should sanitize input message', async () => {
      // Given
      const message = '  hello   world  \x00';
      vi.mocked(mockCommandHandler.isCommand).mockReturnValue(false);
      vi.mocked(mockTaskAnalyzer.analyze).mockReturnValue({
        complexity: 'SIMPLE',
        estimatedDuration: 1000,
        features: {},
      });
      vi.mocked(mockTaskRouter.decide).mockReturnValue({
        mode: 'direct',
        confidence: 0.9,
        reason: 'Simple query',
        analysis: {},
      });

      // When
      await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(mockTaskAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'hello world' })
      );
    });

    it('should handle empty message', async () => {
      // Given
      const message = '   ';

      // When
      const result = await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(result.type).toBe('error');
      expect(result.error).toContain('Empty');
    });

    it('should handle message too long', async () => {
      // Given
      const message = 'a'.repeat(10001);
      // Mock the router methods to avoid undefined errors in case validation passes
      vi.mocked(mockTaskRouter.decide).mockReturnValue({
        mode: 'direct',
        confidence: 0.9,
        reason: 'Test',
        analysis: {},
      });

      // When
      const result = await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(result.type).toBe('error');
      expect(result.error).toContain('too long');
    });

    it('should update session context after processing', async () => {
      // Given
      const message = 'Test message';
      vi.mocked(mockCommandHandler.isCommand).mockReturnValue(false);
      vi.mocked(mockTaskAnalyzer.analyze).mockReturnValue({
        complexity: 'SIMPLE',
        estimatedDuration: 1000,
        features: {},
      });
      vi.mocked(mockTaskRouter.decide).mockReturnValue({
        mode: 'direct',
        confidence: 0.9,
        reason: 'Simple query',
        analysis: {},
      });

      // When
      await handler.process(message, mockAgent, mockSessionContext);

      // Then
      expect(mockSessionContext.messages.length).toBeGreaterThan(0);
      expect(mockSessionContext.lastActivityAt).toBeGreaterThan(0);
    });
  });

  describe('createContext', () => {
    it('should create handler context with all fields', () => {
      // Given
      const message = 'Test message';

      // When
      const context = (handler as any).createContext(message, mockAgent, mockSessionContext);

      // Then
      expect(context.message).toBe('Test message');
      expect(context.agent).toBe(mockAgent);
      expect(context.session).toBe(mockSessionContext);
      expect(context.timestamp).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate message length', () => {
      // When - valid
      const validResult = (handler as any).validateMessage('Short');
      
      // Then
      expect(validResult.valid).toBe(true);

      // When - too long
      const longResult = (handler as any).validateMessage('a'.repeat(10001));
      
      // Then
      expect(longResult.valid).toBe(false);
      expect(longResult.error).toContain('10000');
    });

    it('should reject empty message', () => {
      // When
      const result = (handler as any).validateMessage('   ');

      // Then
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Empty');
    });
  });
});
