/**
 * 指代消解器
 * 
 * 解析用户消息中的指代引用（如"方案1"、"这个"、"刚才的"等）
 */

import { ReferenceType, ResolvedReference, SessionContext } from './types.js';

/**
 * 指代消解结果
 */
export interface ReferenceResolutionResult {
  success: boolean;
  references: ResolvedReference[];
  resolvedText?: string;
}

/**
 * 指代消解器
 */
export class ReferenceResolver {
  /**
   * 解析文本中的引用
   * @param text 输入文本
   * @param context 会话上下文
   * @returns 消解结果
   */
  resolve(text: string, context: SessionContext): ReferenceResolutionResult {
    const references: ResolvedReference[] = [];
    let resolvedText = text;

    // 1. 解析数字索引（方案1、第2个、第三个）
    const numberRefs = this.resolveNumberReferences(text, context);
    references.push(...numberRefs);

    // 2. 解析字母标签（方案A、选B）
    const labelRefs = this.resolveLabelReferences(text, context);
    references.push(...labelRefs);

    // 3. 解析指代词（这个、那个）
    const anaphoraRefs = this.resolveAnaphoraReferences(text, context);
    references.push(...anaphoraRefs);

    // 4. 解析时间指代（刚才的、之前的）
    const temporalRefs = this.resolveTemporalReferences(text, context);
    references.push(...temporalRefs);

    // 生成消解后的文本
    if (references.length > 0) {
      resolvedText = this.generateResolvedText(text, references);
    }

    return {
      success: references.length > 0,
      references,
      resolvedText,
    };
  }

  /**
   * 解析数字索引引用
   */
  private resolveNumberReferences(
    text: string,
    context: SessionContext
  ): ResolvedReference[] {
    const references: ResolvedReference[] = [];
    const options = Object.values(context.activeOptions);

    // 匹配模式：方案1、第2个、第三个
    const patterns = [
      { regex: /方案?([一二三四五六七八九十])/g, type: ReferenceType.OPTION_INDEX },
      { regex: /第([一二三四五六七八九十])个?/g, type: ReferenceType.OPTION_INDEX },
      { regex: /方案?(\d+)/g, type: ReferenceType.OPTION_INDEX },
      { regex: /第(\d+)个?/g, type: ReferenceType.OPTION_INDEX },
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const index = this.parseNumber(match[1]);
        if (index !== null && index > 0 && index <= options.length) {
          const targetOption = options[index - 1];
          if (targetOption) {
            references.push({
              type,
              target: targetOption.id,
              confidence: 0.9,
              originalText: match[0],
            });
          }
        }
      }
    }

    return references;
  }

  /**
   * 解析字母标签引用
   */
  private resolveLabelReferences(
    text: string,
    context: SessionContext
  ): ResolvedReference[] {
    const references: ResolvedReference[] = [];
    const options = Object.values(context.activeOptions);

    // 匹配模式：方案A、选B
    const pattern = /方案?([ABC])|选([ABC])/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const label = (match[1] || match[2]).toUpperCase();
      const index = label.charCodeAt(0) - 'A'.charCodeAt(0);

      if (index >= 0 && index < options.length) {
        references.push({
          type: ReferenceType.OPTION_LABEL,
          target: options[index].id,
          confidence: 0.85,
          originalText: match[0],
        });
      }
    }

    return references;
  }

  /**
   * 解析指代词引用
   */
  private resolveAnaphoraReferences(
    text: string,
    context: SessionContext
  ): ResolvedReference[] {
    const references: ResolvedReference[] = [];
    const options = Object.values(context.activeOptions);

    if (options.length === 0) return references;

    // 匹配"这个"、"那个"
    const patterns = [
      { regex: /这个(方案|选项)?/, target: options[0] },
      { regex: /那个(方案|选项)?/, target: options[options.length - 1] },
    ];

    for (const { regex, target } of patterns) {
      if (regex.test(text) && target) {
        references.push({
          type: ReferenceType.OPTION_ANAPHORA,
          target: target.id,
          confidence: 0.7,
          originalText: regex.source.replace('(方案|选项)?', ''),
        });
      }
    }

    return references;
  }

  /**
   * 解析时间指代引用
   */
  private resolveTemporalReferences(
    text: string,
    context: SessionContext
  ): ResolvedReference[] {
    const references: ResolvedReference[] = [];

    // 匹配"刚才的"、"之前的"
    const pattern = /(刚才|之前|上面)(的)?(任务|方案|对话|那个)?/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // 获取最近的消息作为目标
      const recentMessage = context.messages[context.messages.length - 2];
      if (recentMessage) {
        references.push({
          type: ReferenceType.TEMPORAL_ANAPHORA,
          target: recentMessage.id,
          confidence: 0.6,
          originalText: match[0],
        });
      }
    }

    return references;
  }

  /**
   * 生成消解后的文本
   */
  private generateResolvedText(
    originalText: string,
    references: ResolvedReference[]
  ): string {
    let resolved = originalText;

    for (const ref of references) {
      // 将引用替换为明确的选项标识
      const optionLabel = `[${ref.target}]`;
      resolved = resolved.replace(ref.originalText, optionLabel);
    }

    return resolved;
  }

  /**
   * 解析数字
   */
  private parseNumber(str: string): number | null {
    // 阿拉伯数字
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    // 中文数字
    const chineseMap: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    };

    return chineseMap[str] || null;
  }
}

/**
 * 便捷的指代消解函数
 */
export function resolveReferences(
  text: string,
  context: SessionContext
): ReferenceResolutionResult {
  const resolver = new ReferenceResolver();
  return resolver.resolve(text, context);
}
