import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseWeixinMessage,
  formatWeixinMessage,
  extractMentions,
  isGroupMessage,
  createTextMessage,
  createReplyMessage,
} from '../../../src/ilink/client.js';

describe('ilink/client', () => {
  describe('parseWeixinMessage', () => {
    it('应该解析基本文本消息', () => {
      const raw = {
        msg_id: 'msg_123',
        msg_type: 1,
        from_user_id: 'wxid_abc',
        content: 'Hello World',
        create_time: 1709836800,
      };

      const msg = parseWeixinMessage(raw);
      expect(msg.id).toBe('msg_123');
      expect(msg.type).toBe('text');
      expect(msg.fromUser).toBe('wxid_abc');
      expect(msg.content).toBe('Hello World');
      expect(msg.timestamp).toBe(1709836800000); // 转换为毫秒
      expect(msg.isGroup).toBe(false);
    });

    it('应该解析群聊消息', () => {
      const raw = {
        msg_id: 'msg_456',
        msg_type: 1,
        from_user_id: 'wxid_def',
        content: '群聊消息',
        create_time: 1709836800,
        is_group: true,
        group_id: 'group_123',
      };

      const msg = parseWeixinMessage(raw);
      expect(msg.isGroup).toBe(true);
      expect(msg.groupId).toBe('group_123');
    });

    it('应该解析包含@的消息', () => {
      const raw = {
        msg_id: 'msg_789',
        msg_type: 1,
        from_user_id: 'wxid_ghi',
        content: '@张三 @李四 大家好',
        create_time: 1709836800,
      };

      const msg = parseWeixinMessage(raw);
      expect(msg.mentions).toContain('张三');
      expect(msg.mentions).toContain('李四');
    });

    it('应该解析图片消息', () => {
      const raw = {
        msg_id: 'msg_img',
        msg_type: 3,
        from_user_id: 'wxid_img',
        content: '[图片]',
        create_time: 1709836800,
        media_url: 'http://example.com/img.jpg',
      };

      const msg = parseWeixinMessage(raw);
      expect(msg.type).toBe('image');
    });

    it('应该在数据无效时抛出错误', () => {
      expect(() => parseWeixinMessage(null)).toThrow();
      expect(() => parseWeixinMessage({})).toThrow();
    });
  });

  describe('formatWeixinMessage', () => {
    it('应该格式化为发送格式', () => {
      const formatted = formatWeixinMessage({
        toUser: 'wxid_target',
        content: 'Test message',
      });

      expect(formatted).toEqual({
        to_user_id: 'wxid_target',
        content: 'Test message',
        msg_type: 1,
      });
    });

    it('应该支持自定义消息类型', () => {
      const formatted = formatWeixinMessage({
        toUser: 'wxid_target',
        content: 'Image',
        type: 'image',
      });

      expect(formatted.msg_type).toBe(3);
    });

    it('应该在缺少必需字段时抛出错误', () => {
      expect(() => formatWeixinMessage({ content: 'test' } as any)).toThrow();
      expect(() => formatWeixinMessage({ toUser: 'test' } as any)).toThrow();
    });
  });

  describe('extractMentions', () => {
    it('应该提取@用户名', () => {
      const text = '@张三 你好 @李四 在吗';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['张三', '李四']);
    });

    it('应该处理没有@的情况', () => {
      const text = '普通消息';
      const mentions = extractMentions(text);
      expect(mentions).toEqual([]);
    });

    it('应该处理连续的@', () => {
      const text = '@张三@李四 你好';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['张三', '李四']);
    });
  });

  describe('isGroupMessage', () => {
    it('应该识别群聊消息', () => {
      expect(isGroupMessage({ isGroup: true })).toBe(true);
      expect(isGroupMessage({ groupId: 'group_123' })).toBe(true);
    });

    it('应该识别私聊消息', () => {
      expect(isGroupMessage({ isGroup: false })).toBe(false);
      expect(isGroupMessage({})).toBe(false);
    });
  });

  describe('createTextMessage', () => {
    it('应该创建文本消息对象', () => {
      const msg = createTextMessage('Hello', 'wxid_sender');
      expect(msg.type).toBe('text');
      expect(msg.content).toBe('Hello');
      expect(msg.fromUser).toBe('wxid_sender');
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeGreaterThan(0);
      expect(msg.isGroup).toBe(false);
    });

    it('应该支持群聊选项', () => {
      const msg = createTextMessage('Hello', 'wxid_sender', { isGroup: true, groupId: 'g123' });
      expect(msg.isGroup).toBe(true);
      expect(msg.groupId).toBe('g123');
    });
  });

  describe('createReplyMessage', () => {
    it('应该创建引用回复', () => {
      const original = {
        id: 'orig_123',
        type: 'text',
        fromUser: 'wxid_from',
        content: 'Original',
        timestamp: 1709836800,
        isGroup: false,
      };

      const reply = createReplyMessage('Reply text', original, 'wxid_me');
      expect(reply.content).toBe('Reply text');
      expect(reply.fromUser).toBe('wxid_me');
    });
  });
});
