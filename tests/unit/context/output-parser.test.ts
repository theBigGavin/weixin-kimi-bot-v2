import { describe, it, expect } from 'vitest';
import {
  OutputParser,
  parseOutput,
  extractOptions,
  containsConfirmationRequest,
  containsOptions,
} from '../../../src/context/output-parser.js';

describe('context/output-parser', () => {
  describe('OutputParser', () => {
    const parser = new OutputParser();

    describe('parse', () => {
      it('应该解析基本文本', () => {
        const result = parser.parse('Hello World');
        expect(result.text).toBe('Hello World');
      });

      it('应该提取选项（方括号格式）', () => {
        const result = parser.parse('[opt_123] 方案一 - 这是第一个方案');
        expect(result.options).toHaveLength(1);
        expect(result.options?.[0].id).toBe('opt_123');
        expect(result.options?.[0].label).toBe('方案一');
        expect(result.options?.[0].description).toBe('这是第一个方案');
      });

      it('应该提取选项（字母格式）', () => {
        const result = parser.parse('方案A: 这是A方案');
        expect(result.options?.[0]?.label || '').toContain('选项');
      });

      it('应该提取选项（数字列表格式）', () => {
        const result = parser.parse('1. 第一个选项\n2. 第二个选项');
        expect(result.options?.length).toBeGreaterThanOrEqual(2);
      });

      it('应该提取JSON', () => {
        const result = parser.parse('```json\n{"key": "value"}\n```');
        expect(result.json).toEqual({ key: 'value' });
      });

      it('应该提取代码块', () => {
        const result = parser.parse('```typescript\nconst x = 1;\n```');
        expect(result.codeBlocks).toHaveLength(1);
        expect(result.codeBlocks?.[0].language).toBe('typescript');
      });
    });

    describe('extractThinking', () => {
      it('应该提取思考过程', () => {
        const text = '<thinking>我在思考...</thinking>';
        expect(parser.extractThinking(text)).toBe('我在思考...');
      });

      it('没有找到时返回null', () => {
        expect(parser.extractThinking('普通文本')).toBeNull();
      });
    });

    describe('cleanOutput', () => {
      it('应该移除思考过程', () => {
        const text = 'Hello <thinking>思考中</thinking> World';
        expect(parser.cleanOutput(text)).toBe('Hello  World');
      });
    });
  });

  describe('parseOutput', () => {
    it('是便捷的解析函数', () => {
      const result = parseOutput('[opt1] 选项');
      expect(result.options).toBeDefined();
    });
  });

  describe('extractOptions', () => {
    it('是便捷的选项提取函数', () => {
      const options = extractOptions('[opt1] 选项1\n[opt2] 选项2');
      expect(options.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('containsConfirmationRequest', () => {
    it('应该检测确认请求', () => {
      expect(containsConfirmationRequest('请确认是否继续')).toBe(true);
      expect(containsConfirmationRequest('您确定要删除吗')).toBe(true);
    });

    it('普通文本返回false', () => {
      expect(containsConfirmationRequest('这是普通回复')).toBe(false);
    });
  });

  describe('containsOptions', () => {
    it('应该检测选项', () => {
      expect(containsOptions('[opt1] 选项')).toBe(true);
      expect(containsOptions('1. 第一个')).toBe(true);
    });

    it('普通文本返回false', () => {
      expect(containsOptions('普通文本')).toBe(false);
    });
  });
});
