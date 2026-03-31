/**
 * 交互式配置向导测试
 * 
 * 由于交互式配置涉及用户输入，这里主要测试辅助函数
 */

import { describe, it, expect } from 'vitest';
import {
  InteractiveAgentConfig,
  runInteractiveConfig,
  askBindingChoice,
  askAgentIdToBind,
  selectExistingAgent,
} from '../../../src/login/interactive-config.js';
import { AgentVisibility, TemplateType } from '../../../src/agent/types.js';

describe('login/interactive-config', () => {
  describe('类型定义', () => {
    it('应该定义配置接口', () => {
      const config: InteractiveAgentConfig = {
        name: 'TestAgent',
        templateId: TemplateType.GENERAL,
        model: 'kimi-k1.5',
        enableMemory: true,
        features: {
          shellExec: false,
          webSearch: true,
          fileAccess: true,
        },
        visibility: AgentVisibility.PRIVATE,
        maxBindings: 1,
      };

      expect(config.name).toBe('TestAgent');
      expect(config.visibility).toBe('private');
    });
  });

  // 注意：由于 runInteractiveConfig 涉及用户输入，
  // 完整的测试需要在集成测试中进行
  // 这里仅验证模块可以正确导入

  describe('模块导出', () => {
    it('应该导出 runInteractiveConfig', () => {
      expect(typeof runInteractiveConfig).toBe('function');
    });

    it('应该导出 askBindingChoice', () => {
      expect(typeof askBindingChoice).toBe('function');
    });

    it('应该导出 askAgentIdToBind', () => {
      expect(typeof askAgentIdToBind).toBe('function');
    });

    it('应该导出 selectExistingAgent', () => {
      expect(typeof selectExistingAgent).toBe('function');
    });
  });
});
