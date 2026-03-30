import { describe, it, expect } from 'vitest';
import {
  IntentResolver,
  resolveIntent,
  extractEntities,
  extractNumber,
} from '../../../src/context/intent-resolver.js';
import { IntentType } from '../../../src/context/types.js';

describe('context/intent-resolver', () => {
  describe('IntentResolver', () => {
    const resolver = new IntentResolver();

    describe('确认意图', () => {
      it('应该识别"确认"', () => {
        const intent = resolver.resolve('确认');
        expect(intent.type).toBe(IntentType.CONFIRM);
        expect(intent.confidence).toBeGreaterThan(0.8);
      });

      it('应该识别"好的"', () => {
        const intent = resolver.resolve('好的');
        expect(intent.type).toBe(IntentType.CONFIRM);
      });

      it('应该识别"可以"', () => {
        const intent = resolver.resolve('可以');
        expect(intent.type).toBe(IntentType.CONFIRM);
      });

      it('应该识别"是的"', () => {
        const intent = resolver.resolve('是的');
        expect(intent.type).toBe(IntentType.CONFIRM);
      });
    });

    describe('拒绝意图', () => {
      it('应该识别"不行"', () => {
        const intent = resolver.resolve('不行');
        expect(intent.type).toBe(IntentType.REJECT);
      });

      it('应该识别"不对"', () => {
        const intent = resolver.resolve('不对');
        expect(intent.type).toBe(IntentType.REJECT);
      });

      it('应该识别"取消"', () => {
        const intent = resolver.resolve('取消');
        expect(intent.type).toBe(IntentType.CANCEL);
      });
    });

    describe('选择意图', () => {
      it('应该识别"选第一个"', () => {
        const intent = resolver.resolve('选第一个');
        expect(intent.type).toBe(IntentType.SELECT_OPTION);
        expect(intent.entities).toContainEqual(
          expect.objectContaining({ type: 'number', value: '1' })
        );
      });

      it('应该识别"用方案A"', () => {
        const intent = resolver.resolve('用方案A');
        expect(intent.type).toBe(IntentType.SELECT_OPTION);
      });

      it('应该识别"就这个"', () => {
        const intent = resolver.resolve('就这个');
        expect(intent.type).toBe(IntentType.SELECT_OPTION);
      });
    });

    describe('执行意图', () => {
      it('应该识别"开始吧"', () => {
        const intent = resolver.resolve('开始吧');
        expect(intent.type).toBe(IntentType.EXECUTE);
      });

      it('应该识别"执行"', () => {
        const intent = resolver.resolve('执行');
        expect(intent.type).toBe(IntentType.EXECUTE);
      });

      it('应该识别"开始"', () => {
        const intent = resolver.resolve('开始');
        expect(intent.type).toBe(IntentType.EXECUTE);
      });
    });

    describe('询问意图', () => {
      it('应该识别"什么是..."', () => {
        const intent = resolver.resolve('什么是量子计算');
        expect(intent.type).toBe(IntentType.ASK_INFO);
      });

      it('应该识别"怎么做..."', () => {
        const intent = resolver.resolve('怎么做这个');
        expect(intent.type).toBe(IntentType.ASK_INFO);
      });

      it('应该识别"为什么..."', () => {
        const intent = resolver.resolve('为什么会这样');
        expect(intent.type).toBe(IntentType.ASK_INFO);
      });
    });

    describe('引用意图', () => {
      it('应该识别"这个"', () => {
        const intent = resolver.resolve('这个方案不错');
        expect(intent.type).toBe(IntentType.REFERENCE);
      });

      it('应该识别"刚才的"', () => {
        const intent = resolver.resolve('刚才的任务');
        expect(intent.type).toBe(IntentType.REFERENCE);
      });
    });

    describe('修改意图', () => {
      it('应该识别"修改"', () => {
        const intent = resolver.resolve('修改一下');
        expect(intent.type).toBe(IntentType.MODIFY);
      });

      it('应该识别"换成"', () => {
        const intent = resolver.resolve('换成B方案');
        expect(intent.type).toBe(IntentType.MODIFY);
      });
    });

    describe('暂停/继续', () => {
      it('应该识别"暂停"', () => {
        const intent = resolver.resolve('暂停一下');
        expect(intent.type).toBe(IntentType.PAUSE);
      });

      it('应该识别"继续"', () => {
        const intent = resolver.resolve('继续');
        expect(intent.type).toBe(IntentType.RESUME);
      });
    });

    describe('问候意图', () => {
      it('应该识别"你好"', () => {
        const intent = resolver.resolve('你好');
        expect(intent.type).toBe(IntentType.GREETING);
      });

      it('应该识别"在吗"', () => {
        const intent = resolver.resolve('在吗');
        expect(intent.type).toBe(IntentType.GREETING);
      });
    });

    describe('未知意图', () => {
      it('对于不明确的文本返回UNKNOWN', () => {
        const intent = resolver.resolve('啦啦啦');
        expect(intent.type).toBe(IntentType.UNKNOWN);
      });
    });
  });

  describe('resolveIntent', () => {
    it('应该返回正确的意图', () => {
      const intent = resolveIntent('确认执行');
      expect(intent.type).toBe(IntentType.CONFIRM);
    });
  });

  describe('extractEntities', () => {
    it('应该提取数字实体', () => {
      const entities = extractEntities('选择第3个方案');
      expect(entities).toContainEqual(
        expect.objectContaining({ type: 'number', value: '3' })
      );
    });

    it('应该提取选项标签', () => {
      const entities = extractEntities('选方案A');
      expect(entities).toContainEqual(
        expect.objectContaining({ type: 'label', value: 'A' })
      );
    });
  });

  describe('extractNumber', () => {
    it('应该提取阿拉伯数字', () => {
      expect(extractNumber('第5个')).toBe(5);
    });

    it('应该提取中文数字', () => {
      expect(extractNumber('第一个')).toBe(1);
      expect(extractNumber('第三个')).toBe(3);
    });

    it('应该提取"两"', () => {
      expect(extractNumber('选前两个')).toBe(2);
    });

    it('没有数字时返回null', () => {
      expect(extractNumber('这个方案')).toBeNull();
    });
  });
});
