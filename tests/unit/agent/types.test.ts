import { describe, it, expect } from 'vitest';
import {
  AgentStatus,
  TemplateType,
  AgentVisibility,
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
      expect(TemplateType.FOUNDER).toBe('founder');
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

  describe('AgentVisibility', () => {
    it('应该定义可见性枚举', () => {
      expect(AgentVisibility.PRIVATE).toBe('private');
      expect(AgentVisibility.SHARED).toBe('shared');
      expect(AgentVisibility.INVITE_ONLY).toBe('invite_only');
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
      // 新格式：名称_微信前缀_4位随机码
      expect(config.id).toMatch(/^TestAgent_test123_[a-z0-9]{4}$/);
      expect(config.createdAt).toBeGreaterThan(0);
    });

    it('应该设置默认的共享绑定配置', () => {
      const config = createAgentConfig({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test123',
      });

      // 默认应该是私有，只允许创建者绑定
      expect(config.visibility).toBe('private');
      expect(config.maxBindings).toBe(1);
      expect(config.currentBindingCount).toBe(0);
      expect(config.allowedWechatIds).toEqual([]);
      expect(config.primaryWechatId).toBe('wxid_test123');
    });

    it('应该应用自定义共享绑定配置', () => {
      const config = createAgentConfig({
        name: 'TestAgent',
        wechatAccountId: 'wxid_test123',
        visibility: AgentVisibility.SHARED,
        maxBindings: 5,
        allowedWechatIds: ['wxid_user1', 'wxid_user2'],
      });

      expect(config.visibility).toBe('shared');
      expect(config.maxBindings).toBe(5);
      expect(config.allowedWechatIds).toEqual(['wxid_user1', 'wxid_user2']);
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

    it('应该正确处理微信ID前缀提取', () => {
      const config1 = createAgentConfig({
        name: '助手',
        wechatAccountId: 'wxid_a1b2c3d4e5f6g7h8',
      });
      // 应该提取 wxid_ 后的前8位
      expect(config1.id).toContain('_a1b2c3d4_');

      const config2 = createAgentConfig({
        name: '助手',
        wechatAccountId: 'abcdefghij', // 没有 wxid_ 前缀
      });
      // 应该直接取前8位
      expect(config2.id).toContain('_abcdefgh_');
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
