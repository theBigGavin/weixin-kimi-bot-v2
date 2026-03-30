/**
 * 任务路由决策引擎
 * 
 * 根据任务分析结果决定执行模式
 */

import {
  TaskSubmission,
  TaskAnalysis,
  TaskDecision,
  ExecutionMode,
  TaskComplexity,
  createTaskDecision,
  DEFAULT_ROUTER_CONFIG,
} from './types.js';

/**
 * 路由决策引擎
 */
export class DecisionEngine {
  private config = DEFAULT_ROUTER_CONFIG;

  /**
   * 做出路由决策
   * @param submission 任务提交
   * @param analysis 任务分析
   * @returns 任务决策
   */
  decide(submission: TaskSubmission, analysis: TaskAnalysis): TaskDecision {
    // 1. 判断是否为直接执行模式
    if (this.shouldUseDirectMode(analysis)) {
      return createTaskDecision({
        mode: ExecutionMode.DIRECT,
        confidence: 0.9,
        analysis,
        suggestedModel: this.config.models.direct,
      });
    }

    // 2. 判断是否为流程任务模式
    if (this.shouldUseFlowTaskMode(analysis)) {
      return createTaskDecision({
        mode: ExecutionMode.FLOWTASK,
        confidence: 0.85,
        analysis,
        suggestedModel: this.config.models.flowtask,
      });
    }

    // 3. 默认为长任务模式
    return createTaskDecision({
      mode: ExecutionMode.LONGTASK,
      confidence: 0.8,
      analysis,
      suggestedModel: this.config.models.longtask,
    });
  }

  /**
   * 判断是否使用直接执行模式
   */
  private shouldUseDirectMode(analysis: TaskAnalysis): boolean {
    const { thresholds } = this.config;

    // 复杂度过高不使用直接模式
    if (analysis.complexity > thresholds.directMaxComplexity) {
      return false;
    }

    // 预估时长过长不使用直接模式
    if (analysis.estimatedDuration > thresholds.directMaxDuration) {
      return false;
    }

    // 需要确认的不使用直接模式
    if (analysis.requiresConfirmation) {
      return false;
    }

    // 批量处理不使用直接模式
    if (analysis.features.isBatchProcessing) {
      return false;
    }

    return true;
  }

  /**
   * 判断是否使用流程任务模式
   */
  private shouldUseFlowTaskMode(analysis: TaskAnalysis): boolean {
    // 非常高的复杂度使用流程模式
    if (analysis.complexity === TaskComplexity.VERY_COMPLEX) {
      return true;
    }

    // 需要确认的使用流程模式
    if (analysis.requiresConfirmation) {
      return true;
    }

    // 高风险的使用流程模式
    if (analysis.riskLevel === 'high') {
      return true;
    }

    return false;
  }
}

/**
 * 便捷的决策函数
 */
export function makeDecision(submission: TaskSubmission, analysis: TaskAnalysis): TaskDecision {
  const engine = new DecisionEngine();
  return engine.decide(submission, analysis);
}
