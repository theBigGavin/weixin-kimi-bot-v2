import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildWelcomeMessage,
  formatMemoryForPrompt,
  formatContextForPrompt,
  buildPromptContext,
  PromptContext,
} from '../../../src/agent/prompt-builder.js';
import { AgentConfig, CapabilityTemplate, Memory } from '../../../src/types/index.js';

// 辅助函数：创建测试用的Agent配置
function createTestAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  const base: AgentConfig = {
    id: 'TestAgent_20240315_abcdef12',
    name: 'TestAgent',
    createdAt: Date.now(),
    wechat: {
      accountId: 'wxid_test',
      nickname: '测试用户',
    },
    workspace: {
      path: '/home/user/.weixin-kimi-bot/agents/TestAgent_20240315_abcdef12',
      createdAt: Date.now(),
    },
    ai: {
      model: 'kimi',
      templateId: 'general',
      maxTurns: 20,
      temperature: 0.7,
      customSystemPrompt: '',
    },
    memory: {
      enabledL: true,
      enabledS: true,
      maxItems: 1000,
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
  return { ...base, ...overrides };
}

// 辅助函数：创建测试用的模板
function createTestTemplate(overrides?: Partial<CapabilityTemplate>): CapabilityTemplate {
  const base: CapabilityTemplate = {
    id: 'general',
    name: '通用助手',
    description: '通用AI助手',
    icon: '🤖',
    systemPrompt: '你是一个智能助手。',
    defaults: {
      model: 'kimi',
      maxTurns: 20,
      temperature: 0.7,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: true,
      verbose: false,
      confirmDestructive: true,
    },
  };
  return { ...base, ...overrides };
}

describe('agent/prompt-builder', () => {
  describe('buildSystemPrompt', () => {
    it('应该构建基本系统提示词', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      
      const prompt = buildSystemPrompt(config, template);
      
      expect(prompt).toContain('你是一个智能助手');
      expect(prompt).toContain(config.workspace.path);
    });

    it('应该包含自定义提示词', () => {
      const config = createTestAgentConfig({
        ai: {
          ...createTestAgentConfig().ai,
          customSystemPrompt: '请记住用户的偏好。',
        },
      });
      const template = createTestTemplate();
      
      const prompt = buildSystemPrompt(config, template);
      
      expect(prompt).toContain('请记住用户的偏好');
    });

    it('应该包含记忆信息', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      const memories: Memory['facts'] = [
        { id: '1', content: '用户喜欢Python', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const prompt = buildSystemPrompt(config, template, memories);
      
      expect(prompt).toContain('用户喜欢Python');
    });

    it('应该在记忆禁用时跳过', () => {
      const config = createTestAgentConfig({
        memory: { enabledL: false, enabledS: false, maxItems: 100, autoExtract: false },
      });
      const template = createTestTemplate();
      const memories: Memory['facts'] = [
        { id: '1', content: '用户喜欢Python', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const prompt = buildSystemPrompt(config, template, memories);
      
      expect(prompt).not.toContain('用户喜欢Python');
    });

    it('应该只包含高重要性记忆', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      const memories: Memory['facts'] = [
        { id: '1', content: '高重要性', category: 'personal', importance: 5, createdAt: Date.now(), updatedAt: Date.now() },
        { id: '2', content: '低重要性', category: 'personal', importance: 1, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const prompt = buildSystemPrompt(config, template, memories, { minImportance: 3 });
      
      expect(prompt).toContain('高重要性');
      expect(prompt).not.toContain('低重要性');
    });

    it('应该限制记忆数量', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      const memories: Memory['facts'] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        content: `记忆${i}`,
        category: 'personal',
        importance: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      
      const prompt = buildSystemPrompt(config, template, memories, { maxMemories: 5 });
      
      // 只应该包含最多5条记忆
      const memoryMatches = prompt.match(/记忆\d/g);
      expect(memoryMatches?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('buildWelcomeMessage', () => {
    it('应该返回模板的欢迎语', () => {
      const template = createTestTemplate({
        welcomeMessage: '欢迎！我是你的助手。',
      });
      
      const message = buildWelcomeMessage(template);
      
      expect(message).toBe('欢迎！我是你的助手。');
    });

    it('应该在无欢迎语时返回默认消息', () => {
      const template = createTestTemplate({ welcomeMessage: undefined });
      
      const message = buildWelcomeMessage(template);
      
      expect(message).toContain('你好');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('formatMemoryForPrompt', () => {
    it('应该格式化记忆', () => {
      const memories: Memory['facts'] = [
        { id: '1', content: '用户喜欢Python', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
        { id: '2', content: '用户在创业', category: 'work', importance: 5, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const formatted = formatMemoryForPrompt(memories);
      
      expect(formatted).toContain('用户喜欢Python');
      expect(formatted).toContain('用户在创业');
    });

    it('应该处理空数组', () => {
      const formatted = formatMemoryForPrompt([]);
      expect(formatted).toBe('');
    });

    it('应该去重', () => {
      const memories: Memory['facts'] = [
        { id: '1', content: '重复内容', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
        { id: '2', content: '重复内容', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      
      const formatted = formatMemoryForPrompt(memories);
      
      // 应该只出现一次
      const matches = formatted.match(/重复内容/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('formatContextForPrompt', () => {
    it('应该格式化上下文', () => {
      const context: PromptContext = {
        currentProject: 'MyProject',
        recentTopics: ['Python', 'AI'],
        activeOptions: [
          { id: 'opt1', label: '选项1', description: '第一个选项' },
        ],
      };
      
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('MyProject');
      expect(formatted).toContain('Python');
      expect(formatted).toContain('选项1');
    });

    it('应该处理空上下文', () => {
      const formatted = formatContextForPrompt({});
      expect(formatted).toBe('');
    });
  });

  describe('buildPromptContext', () => {
    it('应该构建完整的提示词上下文', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      const memories: Memory['facts'] = [
        { id: '1', content: '用户喜欢Python', category: 'tech', importance: 4, createdAt: Date.now(), updatedAt: Date.now() },
      ];
      const context: PromptContext = {
        currentProject: 'TestProject',
      };
      
      const result = buildPromptContext(config, template, memories, context);
      
      expect(result.systemPrompt).toContain('你是一个智能助手');
      expect(result.memoryContext).toContain('用户喜欢Python');
      expect(result.workspacePath).toBe(config.workspace.path);
      expect(result.currentProject).toBe('TestProject');
    });

    it('应该处理缺失的可选参数', () => {
      const config = createTestAgentConfig();
      const template = createTestTemplate();
      
      const result = buildPromptContext(config, template);
      
      expect(result.systemPrompt).toBeTruthy();
      expect(result.memoryContext).toBe('');
      expect(result.currentProject).toBeUndefined();
    });
  });
});
