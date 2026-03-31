/**
 * Task Router 统一入口
 * 
 * 整合任务分析、决策和执行，提供三种执行模式：
 * - DIRECT: 直接执行，同步返回
 * - LONGTASK: 长任务，后台异步执行
 * - FLOWTASK: 流程任务，结构化多步骤
 * 
 * Phase IV: Intelligent Task Router (ITR)
 * - Capability Protocol
 * - Intent Cache
 * - LLM Decision Engine
 */

// 基础类型
export * from './types.js';

// 传统路由（基于规则）
export { TaskAnalyzer, analyzeTask } from './analyzer.js';
export { DecisionEngine, makeDecision } from './decision.js';

// Phase IV: Capability Protocol
export * from './protocol/index.js';

// Phase IV: Caching
export * from './caching/index.js';

import { TaskAnalyzer } from './analyzer.js';
import { DecisionEngine } from './decision.js';
import { TaskSubmission, TaskDecision, TaskAnalysis, TaskPriority } from './types.js';

/**
 * 任务路由器
 * 整合分析和决策，提供统一的路由接口
 */
export class TaskRouter {
  private analyzer = new TaskAnalyzer();
  private decisionEngine = new DecisionEngine();

  /**
   * 分析任务并做出路由决策
   * @param submission 任务提交
   * @returns 决策结果（包含分析详情）
   */
  route(submission: TaskSubmission): TaskDecision {
    const analysis = this.analyzer.analyze(submission);
    return this.decisionEngine.decide(submission, analysis);
  }

  /**
   * 仅分析任务（不决策）
   * @param submission 任务提交
   * @returns 任务分析
   */
  analyze(submission: TaskSubmission): TaskAnalysis {
    return this.analyzer.analyze(submission);
  }

  /**
   * 快速路由（使用默认分析）
   * 用于简单的模式判断场景
   * @param prompt 用户输入
   * @returns 执行模式
   */
  quickRoute(prompt: string): TaskDecision {
    const submission = {
      id: 'quick_' + Date.now(),
      prompt,
      userId: 'quick',
      contextId: 'quick',
      priority: TaskPriority.NORMAL,
      createdAt: Date.now(),
    };
    return this.route(submission);
  }
}

/**
 * 便捷的路由函数
 */
export function routeTask(submission: TaskSubmission): TaskDecision {
  const router = new TaskRouter();
  return router.route(submission);
}
