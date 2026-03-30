import { describe, it, expect } from 'vitest';
import {
  AgentStatus,
  TemplateType,
  createAgentConfig,
  createAgentRuntime,
  createDefaultAgentConfig,
  DEFAULT_AGENT_CONFIG,
  AGENT_ID_PREFIX,
} from '../../../src/agent/types.js';

describe('agent/types', () => {
  describe('枚举类型', () => {
    it('应该定义 AgentStatus 状态枚举', () => {
      expect(AgentStatus.INITIALIZING).toBe('initializing');
      expect(AgentStatus.ACTIVE).toBe('active');
      expect(AgentStatus.PAUSED).toBe('paused');
      expect(AgentStatus.ERROR).toBe('error');
      expect(AgentStatus.DESTROYED).toBe('destroyed');
    });

    it('应该定义 TemplateType 模板类型枚举', () => {
      expect(TemplateType.PROGRAMMER).toBe('programmer');
      expect(TemplateType.WRITER).toBe('writer');
      expect(TemplateType.VLOG_CREATOR).toBe('vlog-creator');
      expect(TemplateType.CRYPTO_TRADER).toBe('crypto-trader');
      expect(TemplateType.A_STOCK_TRADER).toBe('a-stock-trader');
      expect(TemplateType.GENERAL).toBe('general');
    });
  });

  describe('常量', () => {
    it('应该定义 AGENT_ID_PREFIX', () => {
      expect(AGENT_ID_PREFIX).toBe('agent');
    });

    it('应该定义 DEFAULT_AGENT_CONFIG', () => {
      expect(DEFAULT_AGENT_CONFIG).toBeDefined();
      expect(DEFAULT_AGENT_CONFIG.ai.model).toBe('kimi');
      expect(DEFAULT_AGENT_CONFIG.ai.maxTurns).toBe(20);
      expect(DEFAULT_AGENT_CONFIG.memory.enabledL).toBe(true);
      expect(DEFAULT_AGENT_CONFIG.memory.enabledS).toBe(true);
      expect(DEFAULT_AGENT_CONFIG.features.fileAccess).toBe(true);
      expect(DEFAULT_AGENT_CONFIG.features.shellExec).toBe(false);
    });
  });

  describe('createAgentConfig', () => {
    it('应该创建基本配置', () => {
      const config = createAgentConfig({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test123',
      });

      expect(config.name).toBe('TestAgent');
      expect(config.wechat.accountId).toBe('wxid_test123');
      expect(config.id).toMatch(/^TestAgent_\d{8}_[a-z0-9]{8}$/);
      expect(config.createdAt).toBeGreaterThan(0);
    });

    it('应该应用自定义配置', () => {
      const config = createAgentConfig({
        name: 'CustomAgent',
        wechatAccountId: 'wxid_custom',
        templateId: 'programmer',
        model: 'kimi-code',
        maxTurns: 50,
        enableMemory: false,
        features: {
          shellExec: true,
          webSearch: true,
        },
      });

      expect(config.ai.templateId).toBe('programmer');
      expect(config.ai.model).toBe('kimi-code');
      expect(config.ai.maxTurns).toBe(50);
      expect(config.memory.enabledL).toBe(false);
      expect(config.memory.enabledS).toBe(false);
      expect(config.features.shellExec).toBe(true);
      expect(config.features.webSearch).toBe(true);
    });

    it('应该设置正确的工作目录', () => {
      const config = createAgentConfig({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test',
      });

      expect(config.workspace.path).toContain('.weixin-kimi-bot');
      expect(config.workspace.path).toContain(config.id);
    });

    it('应该处理微信昵称', () => {
      const config = createAgentConfig({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test',
        wechatNickname: '测试用户',
      });

      expect(config.wechat.nickname).toBe('测试用户');
    });
  });

  describe('createAgentRuntime', () => {
    it('应该创建运行时状态', () => {
      const runtime = createAgentRuntime('agent_test_123');

      expect(runtime.agentId).toBe('agent_test_123');
      expect(runtime.status).toBe(AgentStatus.INITIALIZING);
      expect(runtime.currentContextId).toBeNull();
      expect(runtime.startedAt).toBeGreaterThan(0);
      expect(runtime.messageCount).toBe(0);
      expect(runtime.lastActivityAt).toBeNull();
    });

    it('应该使用当前时间作为startedAt', () => {
      const before = Date.now();
      const runtime = createAgentRuntime('agent_test');
      const after = Date.now();

      expect(runtime.startedAt).toBeGreaterThanOrEqual(before);
      expect(runtime.startedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('createDefaultAgentConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultAgentConfig('DefaultAgent', 'wxid_default');

      expect(config.name).toBe('DefaultAgent');
      expect(config.wechat.accountId).toBe('wxid_default');
      expect(config.ai.model).toBe(DEFAULT_AGENT_CONFIG.ai.model);
      expect(config.ai.templateId).toBe(DEFAULT_AGENT_CONFIG.ai.templateId);
    });

    it('应该合并自定义配置', () => {
      const config = createDefaultAgentConfig(
        'CustomAgent',
        'wxid_custom',
        { customSystemPrompt: 'Custom prompt' }
      );

      expect(config.ai.customSystemPrompt).toBe('Custom prompt');
    });
  });
});
