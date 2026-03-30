/**
 * 微信 iLink 客户端
 * 
 * 提供消息解析和格式化功能
 */

import {
  WeixinMessageType,
  RawWeixinMessage,
  ParsedWeixinMessage,
  SendMessageParams,
  SendMessageFormat,
} from './types.js';
import { MessageType } from '../types/index.js';
import { createContextId } from '../types/index.js';

/**
 * 解析原始微信消息为标准化格式
 * @param raw 原始消息数据
 * @returns 标准化的微信消息
 */
export function parseWeixinMessage(raw: unknown): ParsedWeixinMessage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid message: must be an object');
  }

  const rawMsg = raw as RawWeixinMessage;

  if (!rawMsg.msg_id) {
    throw new Error('Invalid message: missing msg_id');
  }

  const type = parseMessageType(rawMsg.msg_type);
  const mentions = extractMentions(rawMsg.content || '');

  return {
    id: rawMsg.msg_id,
    type,
    fromUser: rawMsg.from_user_id,
    toUser: rawMsg.to_user_id,
    content: rawMsg.content || '',
    timestamp: rawMsg.create_time * 1000, // 转换为毫秒
    isGroup: rawMsg.is_group || false,
    groupId: rawMsg.group_id,
    mentions: mentions.length > 0 ? mentions : undefined,
    mediaUrl: rawMsg.media_url,
    rawType: rawMsg.msg_type,
  };
}

/**
 * 解析消息类型
 * @param typeNum iLink 消息类型数值
 * @returns 标准化的消息类型
 */
function parseMessageType(typeNum: number): MessageType | 'unknown' {
  switch (typeNum) {
    case WeixinMessageType.TEXT:
    case WeixinMessageType.SYSTEM:
      return MessageType.TEXT;
    case WeixinMessageType.IMAGE:
      return MessageType.IMAGE;
    case WeixinMessageType.VOICE:
      return MessageType.VOICE;
    case WeixinMessageType.VIDEO:
    case WeixinMessageType.SHORTVIDEO:
      return MessageType.VIDEO;
    default:
      return 'unknown';
  }
}

/**
 * 将标准化消息类型转换为 iLink 消息类型数值
 * @param type 标准化的消息类型
 * @returns iLink 消息类型数值
 */
function toWeixinMessageType(type: MessageType): number {
  switch (type) {
    case MessageType.TEXT:
      return WeixinMessageType.TEXT;
    case MessageType.IMAGE:
      return WeixinMessageType.IMAGE;
    case MessageType.VOICE:
      return WeixinMessageType.VOICE;
    case MessageType.VIDEO:
      return WeixinMessageType.VIDEO;
    case MessageType.FILE:
      return WeixinMessageType.LINK;
    default:
      return WeixinMessageType.TEXT;
  }
}

/**
 * 格式化发送消息参数为 iLink API 格式
 * @param params 发送消息参数
 * @returns iLink API 格式的消息
 */
export function formatWeixinMessage(params: SendMessageParams): SendMessageFormat {
  if (!params.toUser) {
    throw new Error('toUser is required');
  }
  if (!params.content) {
    throw new Error('content is required');
  }

  const msgType = params.type ? toWeixinMessageType(params.type) : WeixinMessageType.TEXT;

  return {
    to_user_id: params.toUser,
    content: params.content,
    msg_type: msgType,
  };
}

/**
 * 从消息内容中提取@提及的用户名
 * @param content 消息内容
 * @returns 提及的用户名列表
 */
export function extractMentions(content: string): string[] {
  if (!content) return [];
  
  const mentions: string[] = [];
  const regex = /@([^\s@]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

/**
 * 检查消息是否为群聊消息
 * @param message 消息对象
 * @returns 是否为群聊消息
 */
export function isGroupMessage(message: { isGroup?: boolean; groupId?: string }): boolean {
  return message.isGroup === true || !!message.groupId;
}

/**
 * 创建文本消息对象（用于测试或模拟）
 * @param content 消息内容
 * @param fromUser 发送者ID
 * @param options 可选配置
 * @returns 标准化的微信消息
 */
export function createTextMessage(
  content: string,
  fromUser: string,
  options?: { isGroup?: boolean; groupId?: string }
): ParsedWeixinMessage {
  return {
    id: `msg_${createContextId()}`,
    type: MessageType.TEXT,
    fromUser,
    content,
    timestamp: Date.now(),
    isGroup: options?.isGroup || false,
    groupId: options?.groupId,
    rawType: WeixinMessageType.TEXT,
  };
}

/**
 * 创建回复消息
 * @param content 回复内容
 * @param originalMessage 原始消息
 * @param fromUser 回复者ID
 * @returns 标准化的微信消息
 */
export function createReplyMessage(
  content: string,
  originalMessage: ParsedWeixinMessage,
  fromUser: string
): ParsedWeixinMessage {
  return {
    id: `msg_${createContextId()}`,
    type: MessageType.TEXT,
    fromUser,
    toUser: originalMessage.fromUser,
    content,
    timestamp: Date.now(),
    isGroup: originalMessage.isGroup,
    groupId: originalMessage.groupId,
    rawType: WeixinMessageType.TEXT,
  };
}
