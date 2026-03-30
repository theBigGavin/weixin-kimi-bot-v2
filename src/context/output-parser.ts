/**
 * 输出解析器
 * 
 * 解析AI输出，提取结构化内容（选项、JSON、代码块等）
 */

import { Option, createOptionId } from './types.js';

/**
 * 解析结果
 */
export interface ParseResult {
  text: string;
  options?: Option[];
  json?: unknown;
  codeBlocks?: Array<{ language: string; code: string }>;
}

/**
 * 输出解析器
 */
export class OutputParser {
  /**
   * 解析AI输出
   * @param output AI输出的原始文本
   * @returns 解析结果
   */
  parse(output: string): ParseResult {
    const result: ParseResult = {
      text: output,
    };

    // 1. 提取选项
    const options = this.extractOptions(output);
    if (options.length > 0) {
      result.options = options;
    }

    // 2. 提取JSON
    const json = this.extractJson(output);
    if (json !== null) {
      result.json = json;
    }

    // 3. 提取代码块
    const codeBlocks = this.extractCodeBlocks(output);
    if (codeBlocks.length > 0) {
      result.codeBlocks = codeBlocks;
    }

    return result;
  }

  /**
   * 提取选项
   * 匹配格式：
   * 1. [opt_id] 选项标签 - 描述
   * 2. 选项A: 描述
   * 3. 1. 选项内容
   */
  private extractOptions(text: string): Option[] {
    const options: Option[] = [];

    // 模式1: [opt_id] 标签 - 描述
    const pattern1 = /^\[([a-z0-9_]+)\]\s*(.+?)(?:\s*-\s*(.+))?$/gim;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      options.push({
        id: match[1],
        label: match[2].trim(),
        description: match[3]?.trim(),
      });
    }

    // 模式2: 选项A/B/C: 描述 或 方案A: 描述
    const pattern2 = /(?:^|\s)(?:选项|方案)?([ABC])[:：]\s*(.+?)(?:\n|$)/gim;
    while ((match = pattern2.exec(text)) !== null) {
      options.push({
        id: createOptionId(),
        label: `选项${match[1]}`,
        description: match[2].trim(),
        metadata: { letter: match[1] },
      });
    }

    // 模式3: 1. / 2. / 3. 列表
    const pattern3 = /^(\d+)\.\s*(.+?)(?:\n|$)/gim;
    while ((match = pattern3.exec(text)) !== null) {
      // 检查是否已经是选项
      const index = parseInt(match[1], 10);
      if (index <= 10) { // 限制最多10个选项
        options.push({
          id: createOptionId(),
          label: match[2].trim().slice(0, 50), // 限制长度
          metadata: { index },
        });
      }
    }

    return options;
  }

  /**
   * 提取JSON
   */
  private extractJson(text: string): unknown | null {
    // 匹配 ```json ... ``` 代码块
    const codeBlockPattern = /```json\s*([\s\S]*?)```/;
    const codeMatch = text.match(codeBlockPattern);
    
    if (codeMatch) {
      try {
        return JSON.parse(codeMatch[1].trim());
      } catch {
        // 解析失败，继续尝试其他方式
      }
    }

    // 匹配 { ... } 或 [ ... ]
    const jsonPattern = /(\{[\s\S]*\}|\[[\s\S]*\])/;
    const match = text.match(jsonPattern);

    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * 提取代码块
   */
  private extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
    const blocks: Array<{ language: string; code: string }> = [];
    const pattern = /```(\w+)?\s*([\s\S]*?)```/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  /**
   * 提取思考过程（如果被标记）
   */
  extractThinking(text: string): string | null {
    // 匹配 <thinking>...</thinking> 或 [思考过程]...
    const patterns = [
      /<thinking>([\s\S]*?)<\/thinking>/,
      /\[思考过程\]([\s\S]*?)(?:\[\/思考过程\]|$)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * 清理输出（移除思考过程等）
   */
  cleanOutput(text: string): string {
    return text
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/\[思考过程\][\s\S]*?(?:\[\/思考过程\]|$)/g, '')
      .trim();
  }
}

/**
 * 便捷的解析函数
 */
export function parseOutput(text: string): ParseResult {
  const parser = new OutputParser();
  return parser.parse(text);
}

/**
 * 提取选项的便捷函数
 */
export function extractOptions(text: string): Option[] {
  const parser = new OutputParser();
  return parser.parse(text).options || [];
}

/**
 * 检查是否包含确认请求
 */
export function containsConfirmationRequest(text: string): boolean {
  const patterns = [
    /请确认/i,
    /是否继续/i,
    /确定要/i,
    /您确定/i,
    /按确认/i,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * 检查是否包含选项
 */
export function containsOptions(text: string): boolean {
  const patterns = [
    /\[\w+\]/,
    /选项[ABC]/,
    /^\d+\./m,
  ];
  return patterns.some(p => p.test(text));
}
