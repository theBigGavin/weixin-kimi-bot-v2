/**
 * Command Handler Tests
 * 
 * TDD Red Phase: Define expected behavior for command processing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommandHandler,
  CommandResult,
  CommandType,
} from '../../../src/handlers/command-handler';
import { Agent } from '../../../src/agent/types';

describe('command-handler', () => {
  let handler: CommandHandler;
  let mockAgent: Agent;

  beforeEach(() => {
    handler = new CommandHandler();
    mockAgent = {
      id: 'agent_test_001',
      name: 'Test Agent',
      wechat: { accountId: 'wxid_test' },
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
  });

  describe('execute', () => {
    it('should handle /help command', async () => {
      // When
      const result = await handler.execute('/help', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.HELP);
      expect(result.success).toBe(true);
      expect(result.response).toContain('help');
    });

    it('should handle /start command', async () => {
      // When
      const result = await handler.execute('/start', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.START);
      expect(result.success).toBe(true);
    });

    it('should handle /template command with arg', async () => {
      // When
      const result = await handler.execute('/template programmer', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.TEMPLATE);
      expect(result.success).toBe(true);
      expect(result.data?.templateId).toBe('programmer');
    });

    it('should handle /template command without arg', async () => {
      // When
      const result = await handler.execute('/template', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.TEMPLATE);
      expect(result.success).toBe(false);
      expect(result.error).toContain('template ID');
    });

    it('should handle /status command', async () => {
      // When
      const result = await handler.execute('/status', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.STATUS);
      expect(result.success).toBe(true);
      expect(result.data?.agentId).toBe(mockAgent.id);
    });

    it('should handle /reset command', async () => {
      // When
      const result = await handler.execute('/reset', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.RESET);
      expect(result.success).toBe(true);
    });

    it('should handle /memory command to view memory', async () => {
      // When - view memory (no args)
      const result = await handler.execute('/memory', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.MEMORY);
      expect(result.success).toBe(true);
      expect(result.response).toContain('记忆');
    });

    it('should handle /memory update command', async () => {
      // When - update memory without content
      const resultEmpty = await handler.execute('/memory update', mockAgent);

      // Then - should fail without content
      expect(resultEmpty.type).toBe(CommandType.MEMORY);
      expect(resultEmpty.success).toBe(false);
      expect(resultEmpty.response).toContain('请提供记忆内容');
    });

    it('should handle /task command', async () => {
      // When
      const result = await handler.execute('/task list', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.TASK);
      expect(result.success).toBe(true);
    });

    it('should return UNKNOWN for unrecognized command', async () => {
      // When
      const result = await handler.execute('/unknown', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.UNKNOWN);
      expect(result.success).toBe(false);
    });

    it('should handle command with quoted arguments', async () => {
      // When
      const result = await handler.execute('/template "custom template"', mockAgent);

      // Then
      expect(result.type).toBe(CommandType.TEMPLATE);
      expect(result.data?.templateId).toBe('custom template');
    });
  });

  describe('getAvailableCommands', () => {
    it('should return list of available commands', () => {
      // When
      const commands = handler.getAvailableCommands();

      // Then
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some(c => c.name === 'help')).toBe(true);
      expect(commands.some(c => c.name === 'status')).toBe(true);
      expect(commands.some(c => c.name === 'template')).toBe(true);
    });

    it('should include command descriptions', () => {
      // When
      const commands = handler.getAvailableCommands();

      // Then
      const helpCmd = commands.find(c => c.name === 'help');
      expect(helpCmd?.description).toBeDefined();
      expect(helpCmd?.usage).toBeDefined();
    });
  });

  describe('isCommand', () => {
    it('should return true for valid commands', () => {
      expect(handler.isCommand('/help')).toBe(true);
      expect(handler.isCommand('/status')).toBe(true);
      expect(handler.isCommand('/template programmer')).toBe(true);
    });

    it('should return false for non-commands', () => {
      expect(handler.isCommand('hello')).toBe(false);
      expect(handler.isCommand('Can you help?')).toBe(false);
    });
  });

  describe('schedule command', () => {
    it('should show schedule help', async () => {
      const result = await handler.execute('/schedule help', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(true);
      expect(result.response).toContain('定时任务帮助');
      expect(result.response).toContain('list');
      expect(result.response).toContain('create');
      expect(result.response).toContain('cancel');
    });

    it('should list schedules (empty)', async () => {
      const result = await handler.execute('/schedule list', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(true);
      expect(result.response).toContain('没有定时任务');
    });

    it('should require subcommand', async () => {
      const result = await handler.execute('/schedule', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing subcommand');
    });

    it('should reject invalid subcommand', async () => {
      const result = await handler.execute('/schedule invalid', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.response).toContain('未知操作');
    });

    it('should reject create with insufficient args', async () => {
      const result = await handler.execute('/schedule create once', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient arguments');
    });

    it('should reject invalid schedule type', async () => {
      const result = await handler.execute('/schedule create invalid 1000 test', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid schedule type');
    });

    it('should require taskId for cancel', async () => {
      const result = await handler.execute('/schedule cancel', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing task ID');
    });

    it('should report task not found when canceling non-existent task', async () => {
      const result = await handler.execute('/schedule cancel non-existent-id', mockAgent);
      
      expect(result.type).toBe(CommandType.SCHEDULE);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });
});
