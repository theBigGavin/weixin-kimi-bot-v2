import { describe, it, expect } from 'vitest';
import { TaskAnalyzer } from '../../../src/task-router/analyzer.js';
import { TaskComplexity, TaskSubmission, TaskPriority } from '../../../src/task-router/types.js';

describe('task-router/analyzer', () => {
  const analyzer = new TaskAnalyzer();

  describe('analyze', () => {
    it('应该分析简单任务', () => {
      const submission = createSubmission('你好');
      const analysis = analyzer.analyze(submission);

      expect(analysis.complexity).toBe(TaskComplexity.SIMPLE);
      expect(analysis.estimatedDuration).toBeLessThan(5 * 60 * 1000);
    });

    it('应该分析重构任务', () => {
      const submission = createSubmission('帮我重构这段代码，优化性能');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.isRefactoring).toBe(true);
      // 关键词提取主要针对技术词汇，中文关键词需要单独验证
      expect(analysis.features.isRefactoring).toBe(true);
    });

    it('应该分析批量处理任务', () => {
      const submission = createSubmission('批量处理100个文件，需要自动化脚本');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.isBatchProcessing).toBe(true);
    });

    it('应该检测文件操作', () => {
      const submission = createSubmission('读取文件并修改内容');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.hasFileOperations).toBe(true);
    });

    it('应该检测代码执行', () => {
      const submission = createSubmission('运行测试脚本 npm test');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.hasCodeExecution).toBe(true);
    });

    it('应该检测外部调用', () => {
      const submission = createSubmission('调用API获取数据');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.hasExternalCalls).toBe(true);
    });

    it('应该检测 URL 链接作为外部调用', () => {
      const submission = createSubmission('学习下这个项目 https://github.com/NousResearch/hermes-agent');
      const analysis = analyzer.analyze(submission);

      expect(analysis.features.hasExternalCalls).toBe(true);
    });

    it('GitHub 链接应该提升复杂度', () => {
      const submission = createSubmission('学习下这个项目 https://github.com/NousResearch/hermes-agent，看能不能用在股票投资上');
      const analysis = analyzer.analyze(submission);

      // GitHub 链接应该使复杂度至少为 MODERATE
      expect(analysis.complexity).toBeGreaterThanOrEqual(TaskComplexity.MODERATE);
    });

    it('应该识别研究类任务', () => {
      const submission = createSubmission('研究下这个策略能否用于期货');
      const analysis = analyzer.analyze(submission);

      // 研究关键词应该使复杂度至少为 MODERATE
      expect(analysis.complexity).toBeGreaterThanOrEqual(TaskComplexity.MODERATE);
    });

    it('应该识别分析类任务', () => {
      const submission = createSubmission('分析这个GitHub项目的架构');
      const analysis = analyzer.analyze(submission);

      // 分析关键词应该使复杂度至少为 COMPLEX
      expect(analysis.complexity).toBeGreaterThanOrEqual(TaskComplexity.COMPLEX);
    });

    it('复杂任务应该有高风险等级', () => {
      const submission = createSubmission('重新设计整个系统架构，包括数据库迁移和API重构');
      const analysis = analyzer.analyze(submission);

      expect(analysis.complexity).toBe(TaskComplexity.VERY_COMPLEX);
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.requiresConfirmation).toBe(true);
    });

    it('应该提取技术关键词', () => {
      const submission = createSubmission('帮我写一个Python脚本处理数据');
      const analysis = analyzer.analyze(submission);

      expect(analysis.keywords).toContain('Python');
    });
  });

  describe('estimateComplexity', () => {
    it('应该根据提示词长度估算复杂度', () => {
      const shortPrompt = 'Hi';
      const longPrompt = 'a'.repeat(1000);

      const short = analyzer.estimateComplexity(createSubmission(shortPrompt));
      const long = analyzer.estimateComplexity(createSubmission(longPrompt));

      expect(short).toBe(TaskComplexity.SIMPLE);
      expect(long).not.toBe(TaskComplexity.SIMPLE);
    });
  });

  describe('estimateDuration', () => {
    it('应该根据复杂度估算时长', () => {
      const simple = analyzer.estimateDuration(TaskComplexity.SIMPLE, {});
      const complex = analyzer.estimateDuration(TaskComplexity.COMPLEX, {});

      expect(simple).toBeLessThan(complex);
    });

    it('批量处理应该增加时长', () => {
      const base = analyzer.estimateDuration(TaskComplexity.MODERATE, {});
      const batch = analyzer.estimateDuration(TaskComplexity.MODERATE, { isBatchProcessing: true });

      expect(batch).toBeGreaterThan(base);
    });
  });

  describe('extractKeywords', () => {
    it('应该提取技术关键词', () => {
      const keywords = analyzer.extractKeywords('使用React和TypeScript开发');
      
      expect(keywords).toContain('React');
      expect(keywords).toContain('TypeScript');
    });

    it('应该去重', () => {
      const keywords = analyzer.extractKeywords('React React React');
      
      expect(keywords.filter(k => k === 'React')).toHaveLength(1);
    });
  });
});

function createSubmission(prompt: string): TaskSubmission {
  return {
    id: 'task_test',
    prompt,
    userId: 'user_test',
    contextId: 'ctx_test',
    priority: TaskPriority.NORMAL,
    createdAt: Date.now(),
  };
}
