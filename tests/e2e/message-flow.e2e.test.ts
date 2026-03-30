/**
 * End-to-End Message Flow Tests
 * 
 * Tests the complete message processing pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentManager } from '../../src/agent/manager';
import { MessageHandler } from '../../src/handlers/message-handler';
import { CommandHandler } from '../../src/handlers/command-handler';
import { DecisionEngine } from '../../src/task-router/decision';
import { TaskAnalyzer } from '../../src/task-router/analyzer';
import { SessionContextManager as SessionManager } from '../../src/context/session-context';
import { Agent } from '../../src/agent/types';

describe('E2E: Message Flow', () => {
  let agentManager: AgentManager;
  let messageHandler: MessageHandler;
  let sessionManager: SessionManager;
  let mockAgent: Agent;

  beforeEach(async () => {
    // Setup dependencies
    const commandHandler = new CommandHandler();
    const taskAnalyzer = new TaskAnalyzer();
    const decisionEngine = new DecisionEngine();
    messageHandler = new MessageHandler(commandHandler, {
      analyze: (s) => taskAnalyzer.analyze(s),
      decide: (s, a) => decisionEngine.decide(s, a),
    } as any);
    
    sessionManager = new SessionManager();
    agentManager = new AgentManager();

    // Create test agent
    mockAgent = {
      id: 'agent_e2e_test',
      name: 'E2E Test Agent',
      wechat: { accountId: 'wxid_e2e_test' },
      workspace: { path: '/tmp/e2e_test', createdAt: Date.now() },
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
  });

  describe('command flow', () => {
    it('should process /help command end-to-end', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);

      // When
      const result = await messageHandler.process('/help', mockAgent, session);

      // Then
      expect(result.type).toBe('command');
      expect(result.response).toContain('help');
      expect(session.messages).toHaveLength(2); // user message + response
    });

    it('should process /status command end-to-end', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);

      // When
      const result = await messageHandler.process('/status', mockAgent, session);

      // Then
      expect(result.type).toBe('command');
      expect(result.response).toContain(mockAgent.name);
      expect(session.messages[1].content).toContain(mockAgent.name);
    });
  });

  describe('chat flow', () => {
    it('should process simple chat message', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);
      const message = 'Hello, how are you?';

      // When
      const result = await messageHandler.process(message, mockAgent, session);

      // Then
      expect(['chat', 'task']).toContain(result.type); // Depends on analysis
      expect(result.mode).toBeDefined();
      expect(session.messages).toHaveLength(1); // user message
    });

    it('should maintain conversation context', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);

      // When - send multiple messages
      await messageHandler.process('Message 1', mockAgent, session);
      await messageHandler.process('Message 2', mockAgent, session);
      await messageHandler.process('Message 3', mockAgent, session);

      // Then
      expect(session.messages).toHaveLength(3);
      expect(session.messages[0].content).toBe('Message 1');
      expect(session.messages[1].content).toBe('Message 2');
      expect(session.messages[2].content).toBe('Message 3');
    });
  });

  describe('error handling', () => {
    it('should handle empty message gracefully', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);

      // When
      const result = await messageHandler.process('   ', mockAgent, session);

      // Then
      expect(result.type).toBe('error');
      expect(result.error).toContain('Empty');
    });

    it('should handle message too long', async () => {
      // Given
      const session = sessionManager.createSession(mockAgent.id);
      const longMessage = 'a'.repeat(10001);

      // When
      const result = await messageHandler.process(longMessage, mockAgent, session);

      // Then
      expect(result.type).toBe('error');
      expect(result.error).toContain('too long');
    });
  });
});
