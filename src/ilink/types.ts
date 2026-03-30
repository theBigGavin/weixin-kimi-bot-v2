/**
 * 微信 iLink 协议类型定义
 * 
 * 定义微信消息类型和相关的类型工具
 */

import { MessageType } from '../types/index.js';

/**
 * 微信消息类型（iLink协议数值）
 */
export enum WeixinMessageType {
  TEXT = 1,
  IMAGE = 3,
  VOICE = 34,
  VIDEO = 43,
  EMOTION = 47,
  LOCATION = 48,
  LINK = 49,
  VOIP = 50,
  WECHAT_INIT = 51,
  VOIP_NOTIFY = 52,
  VOIP_INVITE = 53,
  SHORTVIDEO = 62,
  SYS_NOTICE = 9999,
  SYSTEM = 10000,
  RECALL = 10002,
}

/**
 * 原始微信消息（来自iLink API）
 */
export interface RawWeixinMessage {
  msg_id: string;
  msg_type: number;
  from_user_id: string;
  to_user_id?: string;
  content: string;
  create_time: number;
  is_group?: boolean;
  group_id?: string;
  media_url?: string;
  extra?: Record<string, unknown>;
}

/**
 * 标准化的微信消息
 */
export interface ParsedWeixinMessage {
  id: string;
  type: MessageType | 'unknown';
  fromUser: string;
  toUser?: string;
  content: string;
  timestamp: number;
  isGroup: boolean;
  groupId?: string;
  mentions?: string[];
  mediaUrl?: string;
  rawType: number;
}

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  toUser: string;
  content: string;
  type?: MessageType;
}

/**
 * 发送消息格式（给iLink API）
 */
export interface SendMessageFormat {
  to_user_id: string;
  content: string;
  msg_type: number;
}

/**
 * 解析消息类型数值为字符串类型
 * @param typeNum iLink消息类型数值
 * @returns 标准化的消息类型字符串
 */
export function parseMessageType(typeNum: number): MessageType | 'unknown' {
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
 * 检查是否为文本消息
 * @param message 消息对象
 * @returns 是否为文本消息
 */
export function isTextMessage(message: { type: number }): boolean {
  return message.type === WeixinMessageType.TEXT || 
         message.type === WeixinMessageType.SYSTEM;
}

/**
 * 检查是否为媒体消息
 * @param message 消息对象
 * @returns 是否为媒体消息
 */
export function isMediaMessage(message: { type: number }): boolean {
  return [
    WeixinMessageType.IMAGE,
    WeixinMessageType.VOICE,
    WeixinMessageType.VIDEO,
    WeixinMessageType.SHORTVIDEO,
    WeixinMessageType.EMOTION,
  ].includes(message.type);
}
