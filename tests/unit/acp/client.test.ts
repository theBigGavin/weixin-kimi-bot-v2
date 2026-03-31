/**
 * ACP Client Unit Tests
 */

import { describe, it, expect } from 'vitest';
import type { ACPConfig, ACPPrompt, ACPResponse } from '../../../src/acp/types.js';

describe('ACP Types', () => {
  it('should define ACPConfig interface', () => {
    const config: ACPConfig = {
      command: 'kimi',
      args: ['acp'],
      cwd: '/tmp',
      env: { KEY: 'value' },
    };

    expect(config.command).toBe('kimi');
    expect(config.args).toEqual(['acp']);
    expect(config.cwd).toBe('/tmp');
  });

  it('should define ACPPrompt interface', () => {
    const prompt: ACPPrompt = {
      text: 'Hello, world!',
      mentions: [{ type: 'file', content: '/path/to/file' }],
    };

    expect(prompt.text).toBe('Hello, world!');
    expect(prompt.mentions).toHaveLength(1);
  });

  it('should define ACPResponse interface', () => {
    const response: ACPResponse = {
      text: 'Response text',
      sessionId: 'session-123',
      stopReason: 'end_turn',
      toolCalls: [
        {
          id: 'call-1',
          title: 'Read file',
          kind: 'read',
          status: 'completed',
          input: { path: '/file.txt' },
        },
      ],
    };

    expect(response.text).toBe('Response text');
    expect(response.sessionId).toBe('session-123');
    expect(response.stopReason).toBe('end_turn');
    expect(response.toolCalls).toHaveLength(1);
  });
});

describe('ACP Client Module', () => {
  it('should export ACPClient class', async () => {
    const { ACPClient } = await import('../../../src/acp/client.js');
    expect(ACPClient).toBeDefined();
    expect(typeof ACPClient).toBe('function');
  });

  it('should export ACPManager class', async () => {
    const { ACPManager } = await import('../../../src/acp/manager.js');
    expect(ACPManager).toBeDefined();
    expect(typeof ACPManager).toBe('function');
  });
});
