/**
 * Factory Functions Existence Tests
 * 
 * Ensures all factory functions are properly exported and callable
 */

import { describe, it, expect } from 'vitest';

describe('Agent Module Factories', () => {
  it('should export createAgentConfig', async () => {
    const { createAgentConfig } = await import('../../src/agent/types.js');
    expect(createAgentConfig).toBeDefined();
    expect(typeof createAgentConfig).toBe('function');
  });

  it('should export createAgentRuntime', async () => {
    const { createAgentRuntime } = await import('../../src/agent/types.js');
    expect(createAgentRuntime).toBeDefined();
    expect(typeof createAgentRuntime).toBe('function');
  });

  it('should export createDefaultAgentConfig', async () => {
    const { createDefaultAgentConfig } = await import('../../src/agent/types.js');
    expect(createDefaultAgentConfig).toBeDefined();
    expect(typeof createDefaultAgentConfig).toBe('function');
  });

  it('should export createAgent', async () => {
    const { createAgent } = await import('../../src/agent/types.js');
    expect(createAgent).toBeDefined();
    expect(typeof createAgent).toBe('function');
  });

  it('should export buildSystemPrompt', async () => {
    const { buildSystemPrompt } = await import('../../src/agent/prompt-builder.js');
    expect(buildSystemPrompt).toBeDefined();
    expect(typeof buildSystemPrompt).toBe('function');
  });

  it('should export buildWelcomeMessage', async () => {
    const { buildWelcomeMessage } = await import('../../src/agent/prompt-builder.js');
    expect(buildWelcomeMessage).toBeDefined();
    expect(typeof buildWelcomeMessage).toBe('function');
  });

  it('should export buildPromptContext', async () => {
    const { buildPromptContext } = await import('../../src/agent/prompt-builder.js');
    expect(buildPromptContext).toBeDefined();
    expect(typeof buildPromptContext).toBe('function');
  });

  it('should export buildTaskSystemPrompt', async () => {
    const { buildTaskSystemPrompt } = await import('../../src/agent/prompt-builder.js');
    expect(buildTaskSystemPrompt).toBeDefined();
    expect(typeof buildTaskSystemPrompt).toBe('function');
  });
});

describe('Types Module Factories', () => {
  it('should export createAgentId', async () => {
    const { createAgentId } = await import('../../src/types/index.js');
    expect(createAgentId).toBeDefined();
    expect(typeof createAgentId).toBe('function');
  });

  it('should export createTaskId', async () => {
    const { createTaskId } = await import('../../src/types/index.js');
    expect(createTaskId).toBeDefined();
    expect(typeof createTaskId).toBe('function');
  });

  it('should export createContextId', async () => {
    const { createContextId } = await import('../../src/types/index.js');
    expect(createContextId).toBeDefined();
    expect(typeof createContextId).toBe('function');
  });

  it('should export createMemoryId', async () => {
    const { createMemoryId } = await import('../../src/types/index.js');
    expect(createMemoryId).toBeDefined();
    expect(typeof createMemoryId).toBe('function');
  });

  it('should export createOptionId', async () => {
    const { createOptionId } = await import('../../src/types/index.js');
    expect(createOptionId).toBeDefined();
    expect(typeof createOptionId).toBe('function');
  });
});

describe('Context Module Factories', () => {
  it('should export createContextId from context/types', async () => {
    const { createContextId } = await import('../../src/context/types.js');
    expect(createContextId).toBeDefined();
    expect(typeof createContextId).toBe('function');
  });

  it('should export createOptionId from context/types', async () => {
    const { createOptionId } = await import('../../src/context/types.js');
    expect(createOptionId).toBeDefined();
    expect(typeof createOptionId).toBe('function');
  });

  it('should export createMessageId', async () => {
    const { createMessageId } = await import('../../src/context/types.js');
    expect(createMessageId).toBeDefined();
    expect(typeof createMessageId).toBe('function');
  });

  it('should export createStateContext', async () => {
    const { createStateContext } = await import('../../src/context/types.js');
    expect(createStateContext).toBeDefined();
    expect(typeof createStateContext).toBe('function');
  });

  it('should export createIntent', async () => {
    const { createIntent } = await import('../../src/context/types.js');
    expect(createIntent).toBeDefined();
    expect(typeof createIntent).toBe('function');
  });

  it('should export createSessionContext', async () => {
    const { createSessionContext } = await import('../../src/context/types.js');
    expect(createSessionContext).toBeDefined();
    expect(typeof createSessionContext).toBe('function');
  });

  it('should export createOption', async () => {
    const { createOption } = await import('../../src/context/types.js');
    expect(createOption).toBeDefined();
    expect(typeof createOption).toBe('function');
  });

  it('should export createContextMessage', async () => {
    const { createContextMessage } = await import('../../src/context/types.js');
    expect(createContextMessage).toBeDefined();
    expect(typeof createContextMessage).toBe('function');
  });
});

describe('Task Router Module Factories', () => {
  it('should export createLongTaskId', async () => {
    const { createLongTaskId } = await import('../../src/task-router/types.js');
    expect(createLongTaskId).toBeDefined();
    expect(typeof createLongTaskId).toBe('function');
  });

  it('should export createFlowTaskId', async () => {
    const { createFlowTaskId } = await import('../../src/task-router/types.js');
    expect(createFlowTaskId).toBeDefined();
    expect(typeof createFlowTaskId).toBe('function');
  });

  it('should export createTaskSubmission', async () => {
    const { createTaskSubmission } = await import('../../src/task-router/types.js');
    expect(createTaskSubmission).toBeDefined();
    expect(typeof createTaskSubmission).toBe('function');
  });

  it('should export createTaskAnalysis', async () => {
    const { createTaskAnalysis } = await import('../../src/task-router/types.js');
    expect(createTaskAnalysis).toBeDefined();
    expect(typeof createTaskAnalysis).toBe('function');
  });

  it('should export createTaskDecision', async () => {
    const { createTaskDecision } = await import('../../src/task-router/types.js');
    expect(createTaskDecision).toBeDefined();
    expect(typeof createTaskDecision).toBe('function');
  });

  it('should export makeDecision', async () => {
    const { makeDecision } = await import('../../src/task-router/decision.js');
    expect(makeDecision).toBeDefined();
    expect(typeof makeDecision).toBe('function');
  });
});

describe('iLink Module Factories', () => {
  it('should export createTextMessage', async () => {
    const { createTextMessage } = await import('../../src/ilink/client.js');
    expect(createTextMessage).toBeDefined();
    expect(typeof createTextMessage).toBe('function');
  });

  it('should export createReplyMessage', async () => {
    const { createReplyMessage } = await import('../../src/ilink/client.js');
    expect(createReplyMessage).toBeDefined();
    expect(typeof createReplyMessage).toBe('function');
  });
});

describe('Templates Module Factories', () => {
  it('should export createCustomTemplate', async () => {
    const { createCustomTemplate } = await import('../../src/templates/definitions.js');
    expect(createCustomTemplate).toBeDefined();
    expect(typeof createCustomTemplate).toBe('function');
  });
});

describe('Store Module Factories', () => {
  it('should export createStore', async () => {
    const { createStore } = await import('../../src/store.js');
    expect(createStore).toBeDefined();
    expect(typeof createStore).toBe('function');
  });
});

describe('Factory Function Integration', () => {
  it('should create valid IDs', async () => {
    const { createAgentId, createTaskId, createContextId } = await import('../../src/types/index.js');
    
    const agentId = createAgentId('test');
    const taskId = createTaskId();
    const contextId = createContextId();

    expect(agentId).toContain('test');
    expect(taskId).toContain('task');
    expect(contextId).toContain('ctx');
  });

  it('should create valid agent config', async () => {
    const { createAgentConfig } = await import('../../src/agent/types.js');
    
    const config = createAgentConfig({
      name: 'TestAgent',
      wechatAccountId: 'wxid_test',
    });

    expect(config.id).toBeDefined();
    expect(config.name).toBe('TestAgent');
    expect(config.wechat.accountId).toBe('wxid_test');
  });

  it('should create valid task submission', async () => {
    const { createTaskSubmission } = await import('../../src/task-router/types.js');
    
    const submission = createTaskSubmission({
      prompt: 'Test prompt',
      userId: 'user123',
      contextId: 'ctx456',
      agentId: 'agent789',
    });

    expect(submission.id).toBeDefined();
    expect(submission.prompt).toBe('Test prompt');
  });
});
