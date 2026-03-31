/**
 * ACP Mode Main Entry Tests
 * 
 * Tests for index-acp.ts module imports and basic functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ACP Mode Main Entry', () => {
  it('should import all required modules', async () => {
    const module = await import('../../src/index-acp.js');
    expect(module).toBeDefined();
  });

  it('should import createAgent from agent/types', async () => {
    const { createAgent } = await import('../../src/agent/types.js');
    expect(createAgent).toBeDefined();
    expect(typeof createAgent).toBe('function');
  });

  it('should create agent with createAgent function', async () => {
    const { createAgent } = await import('../../src/agent/types.js');
    
    const agent = createAgent({
      wechat: { accountId: 'test-user-123' },
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.name).toBeDefined();
    expect(agent.ai).toBeDefined();
    expect(agent.memory).toBeDefined();
    expect(agent.wechat).toBeDefined();
    expect(agent.wechat.accountId).toBe('test-user-123');
  });

  it('should create agent with custom name', async () => {
    const { createAgent } = await import('../../src/agent/types.js');
    
    const agent = createAgent({
      name: 'TestAgent',
      wechat: { accountId: 'test-user-456' },
    });

    expect(agent.name).toBe('TestAgent');
  });

  it('should create agent with templateId', async () => {
    const { createAgent } = await import('../../src/agent/types.js');
    
    const agent = createAgent({
      wechat: { accountId: 'test-user-789' },
      templateId: 'programmer',
    });

    expect(agent.ai.templateId).toBe('programmer');
  });

  it('should import CommandHandler', async () => {
    const { CommandHandler } = await import('../../src/handlers/command-handler.js');
    expect(CommandHandler).toBeDefined();
    expect(typeof CommandHandler).toBe('function');
  });

  it('should create CommandHandler instance', async () => {
    const { CommandHandler } = await import('../../src/handlers/command-handler.js');
    const handler = new CommandHandler();
    
    expect(handler).toBeDefined();
    expect(typeof handler.isCommand).toBe('function');
    expect(typeof handler.execute).toBe('function');
  });

  it('should import ACPManager', async () => {
    const { ACPManager } = await import('../../src/acp/manager.js');
    expect(ACPManager).toBeDefined();
    expect(typeof ACPManager).toBe('function');
  });

  it('should create ACPManager instance', async () => {
    const { ACPManager } = await import('../../src/acp/manager.js');
    
    const manager = new ACPManager({
      acpConfig: {
        command: 'kimi',
        args: ['acp'],
      },
    });

    expect(manager).toBeDefined();
    expect(typeof manager.prompt).toBe('function');
    expect(typeof manager.closeAll).toBe('function');
  });
});

describe('ACP Mode Integration', () => {
  it('should detect command with CommandHandler', async () => {
    const { CommandHandler } = await import('../../src/handlers/command-handler.js');
    const handler = new CommandHandler();

    expect(handler.isCommand('/help')).toBe(true);
    expect(handler.isCommand('/status')).toBe(true);
    expect(handler.isCommand('hello')).toBe(false);
  });

  it('should execute help command', async () => {
    const { CommandHandler } = await import('../../src/handlers/command-handler.js');
    const { createAgent } = await import('../../src/agent/types.js');
    
    const handler = new CommandHandler();
    const agent = createAgent({ wechat: { accountId: 'test' } });
    
    const result = await handler.execute('/help', agent);
    
    expect(result.success).toBe(true);
    expect(result.type).toBe('help');
    expect(result.response).toContain('可用命令');
  });
});
