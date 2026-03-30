import { describe, it, expect } from 'vitest';
import { ReferenceResolver, resolveReferences } from '../../../src/context/reference-resolver.js';
import { createSessionContext, createOption } from '../../../src/context/types.js';

describe('context/reference-resolver', () => {
  describe('ReferenceResolver', () => {
    const resolver = new ReferenceResolver();

    it('应该解析数字索引引用', () => {
      const session = createSessionContext('user1', 'agent1');
      const option1 = createOption('选项1', '描述1');
      const option2 = createOption('选项2', '描述2');
      session.activeOptions[option1.id] = option1;
      session.activeOptions[option2.id] = option2;

      const result = resolver.resolve('选择第2个', session);
      expect(result.success).toBe(true);
      expect(result.references).toHaveLength(1);
    });

    it('应该解析字母标签引用', () => {
      const session = createSessionContext('user1', 'agent1');
      const optionA = createOption('选项A');
      session.activeOptions[optionA.id] = optionA;

      const result = resolver.resolve('选方案A', session);
      expect(result.success).toBe(true);
    });

    it('应该解析指代词', () => {
      const session = createSessionContext('user1', 'agent1');
      const option = createOption('选项');
      session.activeOptions[option.id] = option;

      const result = resolver.resolve('这个方案不错', session);
      expect(result.success).toBe(true);
    });

    it('应该生成消解后的文本', () => {
      const session = createSessionContext('user1', 'agent1');
      const option = createOption('方案1');
      session.activeOptions[option.id] = option;

      const result = resolver.resolve('选择方案A', session);
      expect(result.resolvedText).toBeDefined();
    });

    it('没有引用时返回失败', () => {
      const session = createSessionContext('user1', 'agent1');
      const result = resolver.resolve('普通消息', session);
      expect(result.success).toBe(false);
    });
  });

  describe('resolveReferences', () => {
    it('是便捷的消解函数', () => {
      const session = createSessionContext('user1', 'agent1');
      const result = resolveReferences('选择第1个', session);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('references');
    });
  });
});
