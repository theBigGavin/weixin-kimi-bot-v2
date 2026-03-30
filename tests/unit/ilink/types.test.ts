import { describe, it, expect } from 'vitest';
import {
  WeixinMessageType,
  parseMessageType,
  isTextMessage,
  isMediaMessage,
} from '../../../src/ilink/types.js';

describe('ilink/types', () => {
  describe('WeixinMessageType 枚举', () => {
    it('应该定义所有消息类型', () => {
      expect(WeixinMessageType.TEXT).toBe(1);
      expect(WeixinMessageType.IMAGE).toBe(3);
      expect(WeixinMessageType.VOICE).toBe(34);
      expect(WeixinMessageType.VIDEO).toBe(43);
      expect(WeixinMessageType.EMOTION).toBe(47);
      expect(WeixinMessageType.LOCATION).toBe(48);
      expect(WeixinMessageType.LINK).toBe(49);
      expect(WeixinMessageType.VOIP).toBe(50);
      expect(WeixinMessageType.WECHAT_INIT).toBe(51);
      expect(WeixinMessageType.VOIP_NOTIFY).toBe(52);
      expect(WeixinMessageType.VOIP_INVITE).toBe(53);
      expect(WeixinMessageType.SHORTVIDEO).toBe(62);
      expect(WeixinMessageType.SYS_NOTICE).toBe(9999);
      expect(WeixinMessageType.SYSTEM).toBe(10000);
      expect(WeixinMessageType.RECALL).toBe(10002);
    });
  });

  describe('parseMessageType', () => {
    it('应该正确解析文本消息', () => {
      expect(parseMessageType(1)).toBe('text');
    });

    it('应该正确解析图片消息', () => {
      expect(parseMessageType(3)).toBe('image');
    });

    it('应该正确解析语音消息', () => {
      expect(parseMessageType(34)).toBe('voice');
    });

    it('应该正确解析视频消息', () => {
      expect(parseMessageType(43)).toBe('video');
      expect(parseMessageType(62)).toBe('video');
    });

    it('应该将未知类型解析为unknown', () => {
      expect(parseMessageType(99999)).toBe('unknown');
    });
  });

  describe('isTextMessage', () => {
    it('应该识别文本消息', () => {
      expect(isTextMessage({ type: 1 })).toBe(true);
      expect(isTextMessage({ type: 10000 })).toBe(true);
    });

    it('应该排除非文本消息', () => {
      expect(isTextMessage({ type: 3 })).toBe(false);
      expect(isTextMessage({ type: 34 })).toBe(false);
    });
  });

  describe('isMediaMessage', () => {
    it('应该识别媒体消息', () => {
      expect(isMediaMessage({ type: 3 })).toBe(true);  // image
      expect(isMediaMessage({ type: 34 })).toBe(true); // voice
      expect(isMediaMessage({ type: 43 })).toBe(true); // video
      expect(isMediaMessage({ type: 62 })).toBe(true); // shortvideo
    });

    it('应该排除非媒体消息', () => {
      expect(isMediaMessage({ type: 1 })).toBe(false);
      expect(isMediaMessage({ type: 10000 })).toBe(false);
    });
  });
});
