import { describe, it, expect } from 'vitest';
import {
  validateAgentConfig,
  validateWechatId,
  validateWorkspacePath,
  ValidationError,
  isValidAgentId,
  sanitizeAgentName,
} from '../../../src/agent/validation.js';
import { AgentConfig } from '../../../src/types/index.js';

describe('agent/validation', () => {
  describe('ValidationError', () => {
    it('应该创建带有字段信息的错误', () => {
      const error = new ValidationError({ name: '名称不能为空' });
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.fields).toEqual({ name: '名称不能为空' });
    });
  });

  describe('validateAgentConfig', () => {
    const validConfig: AgentConfig = {
      id: 'TestAgent_20240315_abcdef12',
      name: 'TestAgent',
      createdAt: Date.now(),
      wechat: {
        accountId: 'wxid_test123',
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

    it('应该验证有效配置', () => {
      const result = validateAgentConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺失的ID', () => {
      const config = { ...validConfig, id: '' };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent ID不能为空');
    });

    it('应该检测缺失的名称', () => {
      const config = { ...validConfig, name: '' };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent名称不能为空');
    });

    it('应该检测过长的名称', () => {
      const config = { ...validConfig, name: 'a'.repeat(51) };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent名称不能超过50个字符');
    });

    it('应该检测无效的微信ID', () => {
      const config = {
        ...validConfig,
        wechat: { ...validConfig.wechat, accountId: '' },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('微信账号ID不能为空');
    });

    it('应该检测无效的工作目录', () => {
      const config = {
        ...validConfig,
        workspace: { ...validConfig.workspace, path: '' },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('工作目录路径不能为空');
    });

    it('应该检测无效的maxTurns', () => {
      const config = {
        ...validConfig,
        ai: { ...validConfig.ai, maxTurns: 0 },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTurns必须大于0');
    });

    it('应该检测过大的maxTurns', () => {
      const config = {
        ...validConfig,
        ai: { ...validConfig.ai, maxTurns: 1001 },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTurns不能超过1000');
    });

    it('应该检测无效的temperature', () => {
      const config = {
        ...validConfig,
        ai: { ...validConfig.ai, temperature: 2.5 },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature必须在0-2之间');
    });

    it('应该检测负数的temperature', () => {
      const config = {
        ...validConfig,
        ai: { ...validConfig.ai, temperature: -0.5 },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature必须在0-2之间');
    });

    it('应该检测多个错误', () => {
      const config = {
        ...validConfig,
        id: '',
        name: '',
        wechat: { ...validConfig.wechat, accountId: '' },
      };
      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateWechatId', () => {
    it('应该验证有效的微信ID', () => {
      expect(validateWechatId('wxid_123')).toBe(true);
      expect(validateWechatId('wxid_abcdefghijklmnopqrst')).toBe(true);
    });

    it('应该拒绝无效的微信ID', () => {
      expect(validateWechatId('')).toBe(false);
      expect(validateWechatId('invalid')).toBe(false);
      expect(validateWechatId('wxid_')).toBe(false);
      expect(validateWechatId('wxid')).toBe(false);
    });
  });

  describe('validateWorkspacePath', () => {
    it('应该验证有效的工作目录路径', () => {
      expect(validateWorkspacePath('/home/user/.weixin-kimi-bot/agents/test')).toBe(true);
      expect(validateWorkspacePath('./agents/test')).toBe(true);
    });

    it('应该拒绝无效的路径', () => {
      expect(validateWorkspacePath('')).toBe(false);
      expect(validateWorkspacePath('   ')).toBe(false);
    });
  });

  describe('isValidAgentId', () => {
    it('应该识别有效的Agent ID格式', () => {
      expect(isValidAgentId('TestAgent_20240315_abcdef12')).toBe(true);
      expect(isValidAgentId('MyAgent_20231225_a1b2c3d4')).toBe(true);
    });

    it('应该拒绝无效的Agent ID', () => {
      expect(isValidAgentId('')).toBe(false);
      expect(isValidAgentId('invalid')).toBe(false);
      expect(isValidAgentId('TestAgent')).toBe(false);
      expect(isValidAgentId('TestAgent_20240315')).toBe(false);
    });
  });

  describe('sanitizeAgentName', () => {
    it('应该清理名称中的特殊字符', () => {
      expect(sanitizeAgentName('Test:Agent')).toBe('Test_Agent');
      expect(sanitizeAgentName('My/Agent\\Name')).toBe('My_Agent_Name');
    });

    it('应该保留有效字符', () => {
      expect(sanitizeAgentName('TestAgent_123')).toBe('TestAgent_123');
      expect(sanitizeAgentName('My-Agent')).toBe('My-Agent');
    });

    it('应该截断过长的名称', () => {
      const longName = 'a'.repeat(100);
      const result = sanitizeAgentName(longName);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
});
