/**
 * 命令处理测试场景
 * 
 * 测试各种系统命令的处理
 */

import { TestScenario, TestSession, TestResult } from '../../src/testing/types.js';

const scenario: TestScenario = {
  id: 'command-handling',
  name: 'Command Handling',
  description: '测试系统命令的正确处理',
  category: 'functional',
  priority: 'high',
  
  prerequisites: {
    agentConfig: {
      name: 'CommandTestAgent',
      templateId: 'general',
      features: {
        scheduledTasks: true,
        notifications: true,
        fileAccess: true,
        shellExec: false,
        webSearch: true,
      },
    },
  },
  
  steps: [
    {
      id: 'help-command',
      name: 'Test /help command',
      action: {
        type: 'send_command',
        params: {
          command: 'help',
          args: [],
        },
        description: 'Send /help command',
      },
      validation: {
        type: 'response_contains',
        params: {
          text: 'Available commands',
        },
      },
    },
    {
      id: 'status-command',
      name: 'Test /status command',
      action: {
        type: 'send_command',
        params: {
          command: 'status',
          args: [],
        },
        description: 'Send /status command',
      },
      validation: {
        type: 'response_contains',
        params: {
          text: 'Agent',
        },
      },
    },
    {
      id: 'memory-command',
      name: 'Test /memory command',
      action: {
        type: 'send_command',
        params: {
          command: 'memory',
          args: ['list'],
        },
        description: 'Send /memory list command',
      },
      validation: {
        type: 'no_error',
        params: {},
      },
    },
  ],
  
  expectations: [
    {
      description: 'All commands should be recognized as commands',
      validator: (session: TestSession, results: TestResult[]) => {
        // 验证所有命令都被正确识别
        return results.every(r => 
          r.success && 
          (r.actual as { type?: string })?.type === 'command'
        );
      },
    },
    {
      description: 'Session should have responses for all commands',
      validator: (session: TestSession) => {
        return session.messages.filter(m => m.direction === 'out').length >= 3;
      },
    },
  ],
  
  cleanup: [
    {
      type: 'query_state',
      params: {},
      description: 'Capture final state',
    },
  ],
};

export default scenario;
