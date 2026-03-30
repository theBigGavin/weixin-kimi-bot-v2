/**
 * 对话状态机
 * 
 * 管理对话状态的流转规则和验证
 */

import {
  ConversationState,
  IntentType,
  StateContext,
  Intent,
} from './types.js';

/**
 * 状态转移结果
 */
export interface StateTransitionResult {
  success: boolean;
  newState?: StateContext;
  error?: StateTransitionError;
}

/**
 * 状态转移错误
 */
export class StateTransitionError extends Error {
  fromState: ConversationState;
  intent: IntentType;

  constructor(fromState: ConversationState, intent: IntentType, message: string) {
    super(`State transition failed: ${fromState} + ${intent} -> ${message}`);
    this.name = 'StateTransitionError';
    this.fromState = fromState;
    this.intent = intent;
  }
}

/**
 * 状态转移矩阵
 * 定义从每个状态可以接受哪些意图，以及转移到的目标状态
 */
const TRANSITION_MATRIX: Record<ConversationState, Partial<Record<IntentType, ConversationState>>> = {
  [ConversationState.IDLE]: {
    [IntentType.ASK_INFO]: ConversationState.EXPLORING,
    [IntentType.EXECUTE]: ConversationState.PLANNING,
    [IntentType.GREETING]: ConversationState.IDLE,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.EXPLORING]: {
    [IntentType.ASK_INFO]: ConversationState.EXPLORING,
    [IntentType.EXECUTE]: ConversationState.PLANNING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.CLARIFYING]: {
    [IntentType.ASK_INFO]: ConversationState.CLARIFYING,
    [IntentType.CONFIRM]: ConversationState.PLANNING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.PROPOSING]: {
    [IntentType.SELECT_OPTION]: ConversationState.PLANNING,
    [IntentType.MODIFY]: ConversationState.REFINING,
    [IntentType.REJECT]: ConversationState.EXPLORING,
    [IntentType.ASK_INFO]: ConversationState.COMPARING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.COMPARING]: {
    [IntentType.SELECT_OPTION]: ConversationState.PLANNING,
    [IntentType.ASK_INFO]: ConversationState.COMPARING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.CONFIRMING]: {
    [IntentType.CONFIRM]: ConversationState.EXECUTINGT,
    [IntentType.REJECT]: ConversationState.REFINING,
    [IntentType.MODIFY]: ConversationState.REFINING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.REFINING]: {
    [IntentType.MODIFY]: ConversationState.REFINING,
    [IntentType.CONFIRM]: ConversationState.PLANNING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.PLANNING]: {
    [IntentType.CONFIRM]: ConversationState.EXECUTINGT,
    [IntentType.MODIFY]: ConversationState.REFINING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.EXECUTINGT]: {
    [IntentType.CONFIRM]: ConversationState.EXECUTINGD,
    [IntentType.PAUSE]: ConversationState.PAUSED,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.EXECUTINGD]: {
    [IntentType.CONFIRM]: ConversationState.EXECUTINGI,
    [IntentType.PAUSE]: ConversationState.PAUSED,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.EXECUTINGI]: {
    [IntentType.CONFIRM]: ConversationState.EXECUTINGE,
    [IntentType.PAUSE]: ConversationState.PAUSED,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.EXECUTINGE]: {
    [IntentType.CONFIRM]: ConversationState.REVIEWING,
    [IntentType.PAUSE]: ConversationState.PAUSED,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.REVIEWING]: {
    [IntentType.CONFIRM]: ConversationState.COMPLETED,
    [IntentType.REJECT]: ConversationState.REFINING,
    [IntentType.MODIFY]: ConversationState.REFINING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.COMPLETED]: {
    [IntentType.EXECUTE]: ConversationState.PLANNING,
    [IntentType.ASK_INFO]: ConversationState.EXPLORING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.PAUSED]: {
    [IntentType.RESUME]: ConversationState.EXECUTINGT,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.ERROR]: {
    [IntentType.EXECUTE]: ConversationState.PLANNING,
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
  [ConversationState.DESTROYED]: {
    [IntentType.CANCEL]: ConversationState.IDLE,
  },
};

/**
 * 对话状态机
 */
export class ConversationStateMachine {
  /**
   * 执行状态转移
   * @param currentState 当前状态
   * @param intent 意图
   * @returns 转移结果
   */
  transition(
    currentState: StateContext,
    intent: Intent
  ): StateTransitionResult {
    const transitions = TRANSITION_MATRIX[currentState.current];
    
    if (!transitions) {
      return {
        success: false,
        error: new StateTransitionError(
          currentState.current,
          intent.type,
          'Invalid state'
        ),
      };
    }

    const nextState = transitions[intent.type];
    
    if (!nextState) {
      return {
        success: false,
        error: new StateTransitionError(
          currentState.current,
          intent.type,
          `No transition defined for intent ${intent.type}`
        ),
      };
    }

    // 创建新状态上下文
    const newState: StateContext = {
      current: nextState,
      previous: currentState.current,
      topic: currentState.topic,
      pendingDecision: this.getPendingDecision(nextState, intent),
    };

    return {
      success: true,
      newState,
    };
  }

  /**
   * 获取新状态下的待决策信息
   * @param state 目标状态
   * @param intent 触发的意图
   * @returns 待决策信息或null
   */
  private getPendingDecision(
    state: ConversationState,
    intent: Intent
  ): StateContext['pendingDecision'] {
    switch (state) {
      case ConversationState.CONFIRMING:
        return {
          type: 'confirm',
          options: ['confirm', 'reject', 'modify'],
          prompt: '请确认是否继续执行',
        };
      case ConversationState.PROPOSING:
        return {
          type: 'select_option',
          options: [],
          prompt: '请从以下选项中选择一个',
        };
      case ConversationState.PLANNING:
        return {
          type: 'confirm_plan',
          options: ['confirm', 'modify', 'cancel'],
          prompt: '请确认执行计划',
        };
      default:
        return null;
    }
  }

  /**
   * 检查是否可以转移
   * @param currentState 当前状态
   * @param intent 意图
   * @returns 是否可以转移
   */
  canTransition(
    currentState: ConversationState,
    intent: IntentType
  ): boolean {
    const transitions = TRANSITION_MATRIX[currentState];
    return transitions !== undefined && intent in transitions;
  }

  /**
   * 获取所有可能的转移
   * @param currentState 当前状态
   * @returns 可接受的意图列表
   */
  getPossibleTransitions(currentState: ConversationState): IntentType[] {
    const transitions = TRANSITION_MATRIX[currentState];
    return transitions ? (Object.keys(transitions) as IntentType[]) : [];
  }
}

/**
 * 获取有效转移列表
 * @param state 当前状态
 * @returns 可接受的意图类型列表
 */
export function getValidTransitions(state: ConversationState): IntentType[] {
  const transitions = TRANSITION_MATRIX[state];
  return transitions ? (Object.keys(transitions) as IntentType[]) : [];
}

/**
 * 检查状态转移是否有效
 * @param fromState 起始状态
 * @param intent 意图
 * @returns 是否有效
 */
export function isValidTransition(
  fromState: ConversationState,
  intent: IntentType
): boolean {
  const transitions = TRANSITION_MATRIX[fromState];
  return transitions !== undefined && intent in transitions;
}

/**
 * 获取目标状态
 * @param fromState 起始状态
 * @param intent 意图
 * @returns 目标状态或undefined
 */
export function getTargetState(
  fromState: ConversationState,
  intent: IntentType
): ConversationState | undefined {
  const transitions = TRANSITION_MATRIX[fromState];
  return transitions?.[intent];
}
