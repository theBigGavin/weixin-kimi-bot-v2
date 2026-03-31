/**
 * Message Extraction Module
 * 
 * Handles text extraction from WeChat messages.
 */

import { MessageItemType, type WeixinMessage } from 'weixin-ilink';

export function extractText(msg: WeixinMessage): string {
  if (!msg.item_list?.length) return '';

  for (const item of msg.item_list) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text) {
      const ref = item.ref_msg;
      if (ref?.title) {
        return `[引用: ${ref.title}]\n${item.text_item.text}`;
      }
      return item.text_item.text;
    }
    // Voice ASR transcript
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return '';
}
