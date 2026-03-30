import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  getTemplateById,
  listTemplates,
  createCustomTemplate,
  validateTemplate,
  applyTemplateToConfig,
  TemplateError,
} from '../../../src/templates/definitions.js';

describe('templates/definitions', () => {
  describe('BUILTIN_TEMPLATES', () => {
    it('应该包含programmer模板', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.id === 'programmer');
      expect(template).toBeDefined();
      expect(template?.name).toBe('程序员助手');
      expect(template?.tools.codeExecution).toBe(true);
      expect(template?.tools.gitOperations).toBe(true);
    });

    it('应该包含writer模板', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.id === 'writer');
      expect(template).toBeDefined();
      expect(template?.name).toBe('写作助手');
      expect(template?.tools.fileOperations).toBe(true);
    });

    it('应该包含general模板', () => {
      const template = BUILTIN_TEMPLATES.find(t => t.id === 'general');
      expect(template).toBeDefined();
      expect(template?.name).toBe('通用助手');
    });

    it('所有模板应该有系统提示词', () => {
      BUILTIN_TEMPLATES.forEach(template => {
        expect(template.systemPrompt).toBeTruthy();
        expect(template.systemPrompt.length).toBeGreaterThan(10);
      });
    });

    it('所有模板应该有默认配置', () => {
      BUILTIN_TEMPLATES.forEach(template => {
        expect(template.defaults.model).toBeDefined();
        expect(template.defaults.maxTurns).toBeGreaterThan(0);
        expect(template.defaults.temperature).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getTemplateById', () => {
    it('应该返回存在的模板', () => {
      const template = getTemplateById('programmer');
      expect(template).toBeDefined();
      expect(template?.id).toBe('programmer');
    });

    it('应该对不存在的模板返回undefined', () => {
      const template = getTemplateById('non-existent');
      expect(template).toBeUndefined();
    });

    it('应该对大小写不敏感', () => {
      const template1 = getTemplateById('PROGRAMMER');
      const template2 = getTemplateById('Programmer');
      expect(template1?.id).toBe('programmer');
      expect(template2?.id).toBe('programmer');
    });
  });

  describe('listTemplates', () => {
    it('应该返回所有模板列表', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
      expect(templates.map(t => t.id)).toContain('programmer');
      expect(templates.map(t => t.id)).toContain('general');
    });

    it('应该返回模板摘要', () => {
      const templates = listTemplates();
      const programmer = templates.find(t => t.id === 'programmer');
      expect(programmer?.name).toBeDefined();
      expect(programmer?.description).toBeDefined();
      expect(programmer?.icon).toBeDefined();
    });
  });

  describe('createCustomTemplate', () => {
    it('应该创建自定义模板', () => {
      const template = createCustomTemplate({
        id: 'custom-template',
        name: '自定义模板',
        description: '测试描述',
        systemPrompt: '你是一个测试助手',
      });

      expect(template.id).toBe('custom-template');
      expect(template.name).toBe('自定义模板');
      expect(template.description).toBe('测试描述');
      expect(template.systemPrompt).toBe('你是一个测试助手');
    });

    it('应该使用默认值', () => {
      const template = createCustomTemplate({
        id: 'minimal',
        name: '最小模板',
        systemPrompt: '测试',
      });

      expect(template.icon).toBe('🤖');
      expect(template.defaults.model).toBe('kimi');
      expect(template.defaults.maxTurns).toBe(20);
      expect(template.defaults.temperature).toBe(0.7);
      expect(template.tools.fileOperations).toBe(false);
      expect(template.behavior.proactive).toBe(true);
    });

    it('应该合并自定义配置', () => {
      const template = createCustomTemplate({
        id: 'full-custom',
        name: '完全自定义',
        description: '完整测试',
        systemPrompt: '测试',
        icon: '🎯',
        welcomeMessage: '欢迎！',
        suggestions: ['建议1', '建议2'],
        defaults: {
          model: 'kimi-pro',
          maxTurns: 50,
          temperature: 0.5,
        },
        tools: {
          fileOperations: true,
          codeExecution: true,
          webSearch: false,
          gitOperations: true,
        },
        behavior: {
          proactive: false,
          verbose: false,
          confirmDestructive: true,
        },
      });

      expect(template.icon).toBe('🎯');
      expect(template.welcomeMessage).toBe('欢迎！');
      expect(template.suggestions).toEqual(['建议1', '建议2']);
      expect(template.defaults.model).toBe('kimi-pro');
      expect(template.tools.fileOperations).toBe(true);
      expect(template.behavior.proactive).toBe(false);
    });
  });

  describe('validateTemplate', () => {
    it('应该验证有效模板', () => {
      const template = createCustomTemplate({
        id: 'valid',
        name: '有效模板',
        systemPrompt: '有效',
      });

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺失的id', () => {
      const result = validateTemplate({ name: 'test', systemPrompt: 'test' } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('模板ID不能为空');
    });

    it('应该检测缺失的name', () => {
      const result = validateTemplate({ id: 'test', systemPrompt: 'test' } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('模板名称不能为空');
    });

    it('应该检测缺失的systemPrompt', () => {
      const result = validateTemplate({ id: 'test', name: 'test' } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('系统提示词不能为空');
    });

    it('应该检测无效的maxTurns', () => {
      const template = createCustomTemplate({
        id: 'invalid',
        name: '无效',
        systemPrompt: 'test',
        defaults: { maxTurns: 0 },
      });
      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTurns必须大于0');
    });

    it('应该检测多个错误', () => {
      const result = validateTemplate({} as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('applyTemplateToConfig', () => {
    it('应该应用模板到配置', () => {
      const config = {
        ai: {
          model: 'default',
          templateId: 'general',
          maxTurns: 10,
          temperature: 0.5,
        },
        features: {
          shellExec: false,
          webSearch: false,
          fileAccess: false,
          notifications: true,
          scheduledTasks: true,
        },
      } as any;

      const template = getTemplateById('programmer')!;
      const updatedConfig = applyTemplateToConfig(config, template);

      expect(updatedConfig.ai.templateId).toBe('programmer');
      expect(updatedConfig.ai.model).toBe(template.defaults.model);
      expect(updatedConfig.ai.maxTurns).toBe(template.defaults.maxTurns);
      expect(updatedConfig.ai.temperature).toBe(template.defaults.temperature);
      expect(updatedConfig.features.shellExec).toBe(true);
    });

    it('应该保留已有自定义值', () => {
      const config = {
        ai: {
          model: 'custom-model',
          templateId: 'general',
          maxTurns: 100,
          customSystemPrompt: '自定义提示词',
        },
      } as any;

      const template = getTemplateById('programmer')!;
      const updatedConfig = applyTemplateToConfig(config, template);

      expect(updatedConfig.ai.model).toBe('custom-model');
      expect(updatedConfig.ai.maxTurns).toBe(100);
      expect(updatedConfig.ai.customSystemPrompt).toBe('自定义提示词');
    });

    it('应该在模板无效时抛出错误', () => {
      const config = { ai: { templateId: 'general' } } as any;
      const invalidTemplate = { id: 'bad', name: '' } as any;

      expect(() => applyTemplateToConfig(config, invalidTemplate))
        .toThrow(TemplateError);
    });
  });
});
