/**
 * 意图识别器
 * 
 * 从用户输入文本中识别意图类型和提取实体
 */

import { IntentType, Intent, Entity, createIntent } from './types.js';

/**
 * 意图模式定义
 */
interface IntentPattern {
  type: IntentType;
  patterns: RegExp[];
  priority: number;
}

/**
 * 意图识别器
 */
export class IntentResolver {
  private patterns: IntentPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * 初始化意图模式
   */
  private initializePatterns(): IntentPattern[] {
    return [
      // 确认意图 - 高优先级
      {
        type: IntentType.CONFIRM,
        patterns: [
          /^(确认|好的?|可以|行|没问题|是的|对|同意|好|ok|yes|yep)$/i,
          /^(确认|好的?|可以).*执行/,
          /^(好|行|可以).*开始/,
        ],
        priority: 10,
      },
      // 拒绝意图
      {
        type: IntentType.REJECT,
        patterns: [
          /^(不行|不对|不要|拒绝|不好|算了|别|no|nope)$/i,
          /^(这个)?(不行|不对|不合适)/,
        ],
        priority: 10,
      },
      // 选择意图
      {
        type: IntentType.SELECT_OPTION,
        patterns: [
          /^(选|选择|用|采用|就)(这个|那个|第[一二两三五六七八九十\d]+个?)/,
          /^(选|选择|用|采用)?方案?[ABC一二三四五]/i,
          /^(选|选择|用|采用)?第?\d+个?/,
          /^(就|选)(这个|那个)$/,
          /^(第[一二两三五六七八九十]+|第\d+)个/,
        ],
        priority: 9,
      },
      // 执行意图
      {
        type: IntentType.EXECUTE,
        patterns: [
          /^(开始|执行|启动|实施|做|干|开工|动手|开干|go|execute|start)$/i,
          /^(开始|执行).*吧$/,
          /^(现在|马上|立刻)?(开始|执行)/,
        ],
        priority: 9,
      },
      // 取消意图
      {
        type: IntentType.CANCEL,
        patterns: [
          /^(取消|放弃|停止|终止|结束|退出|cancel|stop|abort)$/i,
          /^(取消|放弃).*任务/,
        ],
        priority: 10,
      },
      // 修改意图
      {
        type: IntentType.MODIFY,
        patterns: [
          /^(修改|更改|调整|换|改|变成|换成|改为|改成|edit|modify|change)$/i,
          /^(修改|更改|调整|换|改).*(一下|下)/,
          /^(能|可以)?(不能|不能|不要)?.*(修改|更改|调整|换)/,
        ],
        priority: 8,
      },
      // 询问意图
      {
        type: IntentType.ASK_INFO,
        patterns: [
          /^(什么|怎么|为什么|如何|哪里|谁|何时|多少|几|什么样|哪些)/,
          /^(请问|我想知道|能否告诉我|解释一下|说明一下)/,
          /^(什么是|怎么做|为什么|如何)/,
          /\?$/,
        ],
        priority: 7,
      },
      // 引用意图
      {
        type: IntentType.REFERENCE,
        patterns: [
          /^(这个|那个|刚才的|之前的|上面的|下面的)/,
          /^(这|那)(个|个)?(方案|选项|任务)/,
        ],
        priority: 6,
      },
      // 暂停意图
      {
        type: IntentType.PAUSE,
        patterns: [
          /^(暂停|等一下|等会|稍后|暂停一下|pause|wait|hold)$/i,
        ],
        priority: 8,
      },
      // 继续意图
      {
        type: IntentType.RESUME,
        patterns: [
          /^(继续|恢复|接着|往下|resume|continue|proceed)$/i,
          /^(继续|接着)(做|干|执行)/,
        ],
        priority: 8,
      },
      // 问候意图
      {
        type: IntentType.GREETING,
        patterns: [
          /^(你好|您好|嗨|hello|hi|hey|在吗|在?|有人吗)$/i,
          /^(早上好|下午好|晚上好)/,
        ],
        priority: 5,
      },
    ];
  }

  /**
   * 解析意图
   * @param text 输入文本
   * @returns 意图对象
   */
  resolve(text: string): Intent {
    const normalizedText = text.trim();
    
    // 按优先级排序匹配
    const matches: Array<{ type: IntentType; confidence: number }> = [];

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedText)) {
          // 计算置信度：优先级越高，基础置信度越高
          const baseConfidence = 0.5 + (pattern.priority / 20);
          // 完全匹配增加置信度
          const matchBonus = regex.source.startsWith('^') && regex.source.endsWith('$') ? 0.2 : 0;
          matches.push({
            type: pattern.type,
            confidence: Math.min(baseConfidence + matchBonus, 1.0),
          });
          break;
        }
      }
    }

    // 提取实体
    const entities = extractEntities(normalizedText);

    // 如果没有匹配到，返回UNKNOWN
    if (matches.length === 0) {
      return createIntent(IntentType.UNKNOWN, 1.0, entities, [], normalizedText);
    }

    // 返回置信度最高的意图
    const bestMatch = matches.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return createIntent(bestMatch.type, bestMatch.confidence, entities, [], normalizedText);
  }

  /**
   * 获取所有可能的意图（用于调试）
   * @param text 输入文本
   * @returns 可能的意图列表
   */
  getAllPossibleIntents(text: string): Array<{ type: IntentType; confidence: number }> {
    const normalizedText = text.trim();
    const matches: Array<{ type: IntentType; confidence: number }> = [];

    for (const pattern of this.patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedText)) {
          const baseConfidence = 0.5 + (pattern.priority / 20);
          const matchBonus = regex.source.startsWith('^') && regex.source.endsWith('$') ? 0.2 : 0;
          matches.push({
            type: pattern.type,
            confidence: Math.min(baseConfidence + matchBonus, 1.0),
          });
          break;
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
   * 提取实体
   * @param text 输入文本
   * @returns 实体列表
   */
export function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // 提取数字
  const numberPatterns = [
    { regex: /第(\d+)个?/g, type: 'number' },
    { regex: /第([一二两三五六七八九十]+)个?/g, type: 'number', isChinese: true },
    { regex: /方案?([ABC])/gi, type: 'label' },
    { regex: /选项?([ABC])/gi, type: 'label' },
  ];

  for (const { regex, type, isChinese } of numberPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      let value = match[1];
      
      // 中文数字转换
      if (isChinese) {
        const num = chineseNumberToDigit(value);
        if (num !== null) {
          value = String(num);
        }
      }

      entities.push({
        type,
        value,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // 提取任务引用
  const taskPattern = /(刚才|之前|上面|下面)(的)?(任务|方案|选项|对话)/g;
  let taskMatch;
  while ((taskMatch = taskPattern.exec(text)) !== null) {
    entities.push({
      type: 'task_ref',
      value: taskMatch[1],
      start: taskMatch.index,
      end: taskMatch.index + taskMatch[0].length,
    });
  }

  return entities;
}

/**
 * 提取数字
 * @param text 输入文本
 * @returns 数字或null
 */
export function extractNumber(text: string): number | null {
  // 阿拉伯数字
  const arabicMatch = text.match(/(\d+)/);
  if (arabicMatch) {
    return parseInt(arabicMatch[1], 10);
  }

  // 中文数字
  const chineseMatch = text.match(/([一二两三五六七八九十]+)/);
  if (chineseMatch) {
    return chineseNumberToDigit(chineseMatch[1]);
  }

  return null;
}

/**
 * 中文数字转阿拉伯数字
 * @param chinese 中文数字
 * @returns 阿拉伯数字或null
 */
function chineseNumberToDigit(chinese: string): number | null {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };

  if (chinese in map) {
    return map[chinese];
  }

  // 处理"十几"、"二十"等
  if (chinese.startsWith('十')) {
    if (chinese.length === 1) return 10;
    const unit = map[chinese[1]];
    if (unit) return 10 + unit;
  }

  // 处理"十一"到"十九"之外的两位中文数字
  if (chinese.length === 2 && chinese[1] === '十') {
    const ten = map[chinese[0]];
    if (ten) return ten * 10;
  }

  return null;
}

/**
 * 解析意图的便捷函数
 * @param text 输入文本
 * @returns 意图对象
 */
export function resolveIntent(text: string): Intent {
  const resolver = new IntentResolver();
  return resolver.resolve(text);
}
