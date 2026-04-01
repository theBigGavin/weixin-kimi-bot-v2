/**
 * 任务分析器
 * 
 * 分析任务复杂度、预估执行时间和提取特征
 */

import {
  TaskSubmission,
  TaskAnalysis,
  TaskComplexity,
  createTaskAnalysis,
} from './types.js';

/**
 * 任务分析器
 */
export class TaskAnalyzer {
  // 复杂度关键词映射
  private complexityKeywords: Record<TaskComplexity, string[]> = {
    [TaskComplexity.SIMPLE]: ['查询', '查看', '显示', '简单', 'hello', 'hi', '你好', '在吗'],
    [TaskComplexity.MODERATE]: [
      '修改', '更新', '添加', '删除', '创建', '写', '编写',
      '学习', '了解', '看看', '查一下', '搜一下', // 新增：研究类入门
    ],
    [TaskComplexity.COMPLEX]: [
      '重构', '优化', '设计', '实现', '开发', '迁移', '集成',
      '分析', '评估', '调研', '研究', '对比', '比较', // 新增：研究分析类
      '应用到', '用在', '结合', '适用于', // 新增：跨领域应用
      '深入研究', '详细分析', '全面评估', // 新增：深度研究
    ],
    [TaskComplexity.VERY_COMPLEX]: [
      '架构', ' redesign', '重写', '大规模', '系统级', '全流程',
      '重新设计', '整体改造', '全面重构', // 新增：大型改造
    ],
  };

  // 技术关键词列表
  private techKeywords = [
    'React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust',
    'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Linux', 'Git', 'SQL', 'MongoDB', 'Redis',
    'API', 'REST', 'GraphQL', 'gRPC', 'WebSocket', '微服务', 'Serverless',
    '重构', '测试', 'CI/CD', 'DevOps', '敏捷', 'TDD', 'DDD',
  ];

  /**
   * 分析任务
   * @param submission 任务提交
   * @returns 任务分析结果
   */
  analyze(submission: TaskSubmission): TaskAnalysis {
    const prompt = submission.prompt;

    // 1. 估算复杂度
    const complexity = this.estimateComplexity(submission);

    // 2. 提取特征
    const features = this.extractFeatures(prompt);

    // 3. 估算时长
    const estimatedDuration = this.estimateDuration(complexity, features);

    // 4. 提取关键词
    const keywords = this.extractKeywords(prompt);

    // 5. 确定风险等级和确认需求
    const riskLevel = this.assessRisk(complexity, features);
    const requiresConfirmation = complexity === TaskComplexity.VERY_COMPLEX ||
      (complexity === TaskComplexity.COMPLEX && features.hasFileOperations);

    return createTaskAnalysis({
      complexity,
      estimatedDuration,
      requiresConfirmation,
      riskLevel,
      keywords,
      features,
    });
  }

  /**
   * 估算任务复杂度
   * @param submission 任务提交
   * @returns 复杂度等级
   */
  estimateComplexity(submission: TaskSubmission): TaskComplexity {
    const prompt = submission.prompt.toLowerCase();
    const length = prompt.length;

    // 基于关键词判断（优先级高于长度）
    let score = 0;

    for (const [level, keywords] of Object.entries(this.complexityKeywords)) {
      for (const keyword of keywords) {
        if (prompt.includes(keyword.toLowerCase())) {
          const levelNum = parseInt(level, 10);
          switch (levelNum) {
            case TaskComplexity.VERY_COMPLEX:
              score += 4;
              break;
            case TaskComplexity.COMPLEX:
              score += 3;
              break;
            case TaskComplexity.MODERATE:
              score += 2;
              break;
            case TaskComplexity.SIMPLE:
              score += 1;
              break;
          }
        }
      }
    }

    // 检测到外部资源链接（研究类任务）
    if (/https?:\/\/github\.com/.test(prompt)) {
      score += 3; // GitHub 项目研究 = MODERATE 起步
    } else if (/https?:\/\//.test(prompt)) {
      score += 1; // 有外部链接
    }

    // 基于长度调整（短消息如果没有复杂关键词则降低复杂度）
    if (length < 20 && score === 0) {
      return TaskComplexity.SIMPLE;
    }
    if (length > 200) score += 1;
    if (length > 500) score += 2;

    // 返回对应复杂度
    if (score >= 6) return TaskComplexity.VERY_COMPLEX;
    if (score >= 4) return TaskComplexity.COMPLEX;
    if (score >= 2) return TaskComplexity.MODERATE;
    return TaskComplexity.SIMPLE;
  }

  /**
   * 估算执行时长
   * @param complexity 复杂度
   * @param features 特征
   * @returns 预估时长（毫秒）
   */
  estimateDuration(
    complexity: TaskComplexity,
    features: TaskAnalysis['features']
  ): number {
    const baseDuration: Record<TaskComplexity, number> = {
      [TaskComplexity.SIMPLE]: 60 * 1000,        // 1分钟
      [TaskComplexity.MODERATE]: 10 * 60 * 1000, // 10分钟
      [TaskComplexity.COMPLEX]: 30 * 60 * 1000,  // 30分钟
      [TaskComplexity.VERY_COMPLEX]: 60 * 60 * 1000, // 1小时
    };

    let duration = baseDuration[complexity];

    // 根据特征调整
    if (features.isBatchProcessing) duration *= 2;
    if (features.hasExternalCalls) duration *= 1.3;
    if (features.hasCodeExecution) duration *= 1.2;

    return Math.round(duration);
  }

  /**
   * 提取任务特征
   * @param prompt 提示词
   * @returns 特征对象
   */
  private extractFeatures(prompt: string): TaskAnalysis['features'] {
    const lowerPrompt = prompt.toLowerCase();

    return {
      hasFileOperations: this.hasKeywords(lowerPrompt, [
        '文件', '读取', '写入', '保存', '打开', 'file', 'read', 'write', 'save',
      ]),
      hasCodeExecution: this.hasKeywords(lowerPrompt, [
        '运行', '执行', '测试', 'npm', 'node', 'python', 'run', 'execute', 'test',
      ]),
      hasExternalCalls: this.hasKeywords(lowerPrompt, [
        'API', '调用', '请求', 'http', 'fetch', 'axios', 'call', 'request',
      ]) || /https?:\/\//.test(lowerPrompt), // 检测 URL 链接
      isRefactoring: this.hasKeywords(lowerPrompt, [
        '重构', '优化', '改进', '清理', 'refactor', 'optimize', 'improve',
      ]),
      isBatchProcessing: this.hasKeywords(lowerPrompt, [
        '批量', '所有', '多个', '100', '1000', 'batch', 'all', 'multiple',
      ]),
    };
  }

  /**
   * 提取关键词
   * @param prompt 提示词
   * @returns 关键词列表
   */
  extractKeywords(prompt: string): string[] {
    const keywords: string[] = [];

    for (const keyword of this.techKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(prompt)) {
        keywords.push(keyword);
      }
    }

    return [...new Set(keywords)]; // 去重
  }

  /**
   * 评估风险等级
   * @param complexity 复杂度
   * @param features 特征
   * @returns 风险等级
   */
  private assessRisk(
    complexity: TaskComplexity,
    features: TaskAnalysis['features']
  ): TaskAnalysis['riskLevel'] {
    if (complexity === TaskComplexity.VERY_COMPLEX) return 'high';
    if (complexity === TaskComplexity.COMPLEX && features.hasFileOperations) return 'high';
    if (complexity === TaskComplexity.COMPLEX) return 'medium';
    return 'low';
  }

  /**
   * 检查是否包含关键词
   */
  private hasKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k.toLowerCase()));
  }
}

/**
 * 便捷的分析函数
 */
export function analyzeTask(submission: TaskSubmission): TaskAnalysis {
  const analyzer = new TaskAnalyzer();
  return analyzer.analyze(submission);
}
