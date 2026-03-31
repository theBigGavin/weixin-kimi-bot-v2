/**
 * Agent ID 生成器测试
 * 
 * 测试新的 Agent ID 格式：{名称}_{微信ID前8位}_{4位随机码}
 * 示例：小助手_a1b2c3d4_x7k9
 */

import { describe, it, expect } from 'vitest';
import {
  generateAgentId,
  parseAgentId,
  isValidAgentId,
  sanitizeAgentName,
  extractWechatPrefix,
  AGENT_ID_PATTERN,
  AgentIdParts,
} from '../../../src/agent/id-generator.js';

describe('Agent ID 生成器', () => {
  describe('generateAgentId', () => {
    it('应该使用新格式生成 Agent ID', () => {
      // Given
      const name = '小助手';
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      expect(agentId).toContain('小助手_');
      expect(agentId).toContain('_a1b2c3d4_'); // 微信ID前8位
      expect(agentId.split('_')).toHaveLength(3);
    });

    it('应该生成包含4位随机码的ID', () => {
      // Given
      const name = '测试Agent';
      const wechatId = 'wxid_1234567890';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      const parts = agentId.split('_');
      expect(parts[2]).toHaveLength(4); // 4位随机码
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // 只包含小写字母和数字
    });

    it('应该清理名称中的特殊字符', () => {
      // Given
      const name = 'Test@Agent#123';
      const wechatId = 'wxid_abcdefghij';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      expect(agentId.startsWith('Test_Agent_123_')).toBe(true);
    });

    it('应该支持中文名称', () => {
      // Given
      const name = '智能助手';
      const wechatId = 'wxid_abcdefghij';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      expect(agentId.startsWith('智能助手_')).toBe(true);
    });

    it('微信ID不足8位时应该使用全部内容', () => {
      // Given
      const name = '助手';
      const wechatId = 'wxid_abc';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      expect(agentId).toContain('_abc_');
    });

    it('应该去除微信ID中的wxid_前缀', () => {
      // Given
      const name = '助手';
      const wechatId = 'wxid_12345678';

      // When
      const agentId = generateAgentId(name, wechatId);

      // Then
      expect(agentId).toContain('_12345678_');
      expect(agentId).not.toContain('wxid_');
    });

    it('多次生成应该产生不同的随机码', () => {
      // Given
      const name = '助手';
      const wechatId = 'wxid_12345678';

      // When
      const id1 = generateAgentId(name, wechatId);
      const id2 = generateAgentId(name, wechatId);

      // Then
      expect(id1).not.toBe(id2);
    });
  });

  describe('parseAgentId', () => {
    it('应该正确解析有效的 Agent ID', () => {
      // Given
      const agentId = '小助手_a1b2c3d4_x7k9';

      // When
      const parsed = parseAgentId(agentId);

      // Then
      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe('小助手');
      expect(parsed!.wechatPrefix).toBe('a1b2c3d4');
      expect(parsed!.randomCode).toBe('x7k9');
    });

    it('应该支持名称中包含下划线', () => {
      // Given
      const agentId = '智能_助手_a1b2c3d4_x7k9';

      // When
      const parsed = parseAgentId(agentId);

      // Then
      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe('智能_助手');
      expect(parsed!.wechatPrefix).toBe('a1b2c3d4');
    });

    it('应该对无效的ID返回null', () => {
      // Given
      const invalidIds = [
        'invalid',
        'name_only',
        'name_', // 空前缀和随机码
        '',
        '小助手_a1b2c3d4', // 只有一个下划线，缺少随机码
        '小助手__x7k9', // 空前缀
      ];

      // Then
      invalidIds.forEach(id => {
        expect(parseAgentId(id)).toBeNull();
      });
    });
  });

  describe('isValidAgentId', () => {
    it('应该验证有效的 Agent ID', () => {
      // Given
      const validIds = [
        '小助手_a1b2c3d4_x7k9',
        'TestAgent_12345678_abcd',
        'Agent_123_abc1',
      ];

      // Then
      validIds.forEach(id => {
        expect(isValidAgentId(id)).toBe(true);
      });
    });

    it('应该拒绝无效的 Agent ID', () => {
      // Given
      const invalidIds = [
        '',
        'invalid',
        'name_only', // 只有一个下划线
        '小助手_a1b2c3d4', // 只有一个下划线，缺少随机码
        '_prefix_code', // 空名称
        'name__code', // 空前缀
      ];

      // Then
      invalidIds.forEach(id => {
        expect(isValidAgentId(id)).toBe(false);
      });
    });
  });

  describe('sanitizeAgentName', () => {
    it('应该保留字母数字和中文字符', () => {
      // Given
      const name = 'Test123中文';

      // When
      const sanitized = sanitizeAgentName(name);

      // Then
      expect(sanitized).toBe('Test123中文');
    });

    it('应该将特殊字符替换为下划线', () => {
      // Given
      const name = 'Test@Agent#123';

      // When
      const sanitized = sanitizeAgentName(name);

      // Then
      expect(sanitized).toBe('Test_Agent_123');
    });

    it('应该去除连续的下划线', () => {
      // Given
      const name = 'Test@@@Agent';

      // When
      const sanitized = sanitizeAgentName(name);

      // Then
      expect(sanitized).toBe('Test_Agent');
    });

    it('应该去除首尾下划线', () => {
      // Given
      const name = '@TestAgent@';

      // When
      const sanitized = sanitizeAgentName(name);

      // Then
      expect(sanitized).toBe('TestAgent');
    });
  });

  describe('extractWechatPrefix', () => {
    it('应该提取微信ID的前8位', () => {
      // Given
      const wechatId = 'wxid_a1b2c3d4e5f6g7h8';

      // When
      const prefix = extractWechatPrefix(wechatId);

      // Then
      expect(prefix).toBe('a1b2c3d4');
    });

    it('应该去除wxid_前缀', () => {
      // Given
      const wechatId = 'wxid_1234567890';

      // When
      const prefix = extractWechatPrefix(wechatId);

      // Then
      expect(prefix).toBe('12345678');
    });

    it('应该处理不足8位的ID', () => {
      // Given
      const wechatId = 'wxid_abc';

      // When
      const prefix = extractWechatPrefix(wechatId);

      // Then
      expect(prefix).toBe('abc');
    });

    it('应该处理没有wxid_前缀的ID', () => {
      // Given
      const wechatId = 'abcdefghij';

      // When
      const prefix = extractWechatPrefix(wechatId);

      // Then
      expect(prefix).toBe('abcdefgh');
    });
  });

  describe('AGENT_ID_PATTERN', () => {
    it('应该匹配有效的 Agent ID', () => {
      // Given
      const validIds = [
        '小助手_a1b2c3d4_x7k9',
        'TestAgent_12345678_abcd',
        'My_Agent_abc12345_xyz1',
      ];

      // Then
      validIds.forEach(id => {
        expect(AGENT_ID_PATTERN.test(id)).toBe(true);
      });
    });

    it('应该拒绝无效的 Agent ID', () => {
      // Given
      const invalidIds = [
        '',
        'invalid',
        'name_only',
        'name_prefix_only_no_random',
      ];

      // Then
      invalidIds.forEach(id => {
        expect(AGENT_ID_PATTERN.test(id)).toBe(false);
      });
    });
  });
});
