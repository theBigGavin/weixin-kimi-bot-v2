import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProtocolValidator,
  ValidationErrorCode,
  CapabilityRegistry,
  createTaskRequest,
  createComplexityAssessment,
  createExecutionStep,
  createCapability,
  ExecutionMode,
  TaskComplexity,
} from '../../../../src/task-router/protocol/index.js';

describe('ProtocolValidator', () => {
  let validator: ProtocolValidator;
  let registry: CapabilityRegistry;

  beforeEach(() => {
    CapabilityRegistry.resetInstance();
    registry = CapabilityRegistry.getInstance({ registerBuiltins: false });
    validator = new ProtocolValidator({}, registry);

    // 注册测试能力
    registry.registerMany([
      createCapability({
        id: 'test-capability',
        description: 'Test capability',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
        maxDuration: 300000, // 5分钟
      }),
      createCapability({
        id: 'flow-capability',
        description: 'Flow capability',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.FLOWTASK],
        maxDuration: 600000, // 10分钟
      }),
    ]);
  });

  afterEach(() => {
    CapabilityRegistry.resetInstance();
  });

  describe('基础结构验证', () => {
    it('应该拒绝非对象输入', () => {
      const result = validator.validate(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_TYPE);
    });

    it('应该检测缺少必需字段', () => {
      const result = validator.validate({
        protocolVersion: '1.0',
        // missing analysis, plan, metadata
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === ValidationErrorCode.MISSING_FIELD)).toBe(true);
    });
  });

  describe('版本验证', () => {
    it('应该验证协议版本', () => {
      const request = createValidRequest();
      (request as unknown as Record<string, string>).protocolVersion = '2.0';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_VERSION);
    });
  });

  describe('分析部分验证', () => {
    it('应该拒绝空意图', () => {
      const request = createValidRequest();
      request.analysis.userIntent = '';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.EMPTY_INTENT);
    });

    it('应该检测空能力列表', () => {
      const request = createValidRequest();
      request.analysis.requiredCapabilities = [];

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.NO_CAPABILITIES);
    });

    it('应该检测不存在的能力', () => {
      const request = createValidRequest();
      request.analysis.requiredCapabilities = ['non-existent-capability'];

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.UNKNOWN_CAPABILITY);
    });

    it('应该验证复杂度分数范围', () => {
      const request = createValidRequest();
      request.analysis.complexity.score = 150;

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_COMPLEXITY);
    });

    it('应该验证复杂度等级', () => {
      const request = createValidRequest();
      (request.analysis.complexity.level as string) = 'invalid_level';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_COMPLEXITY);
    });

    it('应该警告分数和等级不匹配', () => {
      const request = createValidRequest();
      request.analysis.complexity.score = 10; // 应该是 simple
      request.analysis.complexity.level = TaskComplexity.COMPLEX;

      const result = validator.validate(request);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('计划部分验证', () => {
    it('应该检测空步骤列表', () => {
      const request = createValidRequest();
      request.plan.steps = [];

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.NO_STEPS);
    });

    it('应该验证策略类型', () => {
      const request = createValidRequest();
      (request.plan.strategy as string) = 'invalid_strategy';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_STRATEGY);
    });

    it('应该检测步骤数量超限', () => {
      const request = createValidRequest();
      request.plan.steps = Array(25).fill(null).map((_, i) =>
        createExecutionStep({
          stepId: `step-${i}`,
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
        })
      );

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.NO_STEPS);
    });

    it('应该检测重复的步骤ID', () => {
      const request = createValidRequest();
      request.plan.steps.push(
        createExecutionStep({
          stepId: 'step-1', // 重复
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
        })
      );

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_STEP_REFERENCE);
    });
  });

  describe('步骤验证', () => {
    it('应该验证能力存在性', () => {
      const request = createValidRequest();
      request.plan.steps[0].capability = 'non-existent';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.UNKNOWN_CAPABILITY);
    });

    it('应该验证执行模式支持', () => {
      const request = createValidRequest();
      request.plan.steps[0].capability = 'flow-capability';
      request.plan.steps[0].mode = ExecutionMode.DIRECT; // flow-capability 不支持 DIRECT

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.UNSUPPORTED_MODE);
    });

    it('应该检测超时预估时长', () => {
      const request = createValidRequest();
      request.plan.steps[0].estimatedDuration = 600000; // 超过 test-capability 的 5分钟限制

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.DURATION_EXCEEDED);
    });

    it('应该验证依赖步骤存在性', () => {
      const request = createValidRequest();
      request.plan.steps.push(
        createExecutionStep({
          stepId: 'step-2',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['non-existent-step'],
        })
      );

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_STEP_REFERENCE);
    });

    it('应该验证条件引用的步骤存在性', () => {
      const request = createValidRequest();
      request.plan.steps.push(
        createExecutionStep({
          stepId: 'step-2',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          condition: {
            if: '${step-1.output.status} === "success"',
            then: 'non-existent-step',
          },
        })
      );

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_STEP_REFERENCE);
    });
  });

  describe('循环依赖检测', () => {
    it('应该检测简单的循环依赖', () => {
      const request = createValidRequest();
      request.plan.steps = [
        createExecutionStep({
          stepId: 'step-a',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-b'],
        }),
        createExecutionStep({
          stepId: 'step-b',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-a'], // 循环
        }),
      ];

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.CYCLIC_DEPENDENCIES);
    });

    it('应该检测复杂的循环依赖', () => {
      const request = createValidRequest();
      request.plan.steps = [
        createExecutionStep({
          stepId: 'step-a',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-b'],
        }),
        createExecutionStep({
          stepId: 'step-b',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-c'],
        }),
        createExecutionStep({
          stepId: 'step-c',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-a'], // 循环回到 a
        }),
      ];

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.CYCLIC_DEPENDENCIES);
    });

    it('应该允许有效的依赖链', () => {
      const request = createValidRequest();
      request.plan.steps = [
        createExecutionStep({
          stepId: 'step-a',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
        }),
        createExecutionStep({
          stepId: 'step-b',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-a'],
        }),
        createExecutionStep({
          stepId: 'step-c',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['step-b'],
        }),
      ];

      const result = validator.validate(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('元数据验证', () => {
    it('应该验证置信度范围', () => {
      const request = createValidRequest();
      request.metadata.confidence = 1.5;

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_CONFIDENCE);
    });

    it('应该验证优先级是数字', () => {
      const request = createValidRequest();
      (request.metadata.priority as unknown) = 'high';

      const result = validator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationErrorCode.INVALID_PRIORITY);
    });

    it('应该警告优先级超出推荐范围', () => {
      const request = createValidRequest();
      request.metadata.priority = 15;

      const result = validator.validate(request);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('快速验证', () => {
    it('应该快速通过有效请求', () => {
      const result = validator.validateQuick(createValidRequest());
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该快速返回关键错误', () => {
      const result = validator.validateQuick({
        protocolVersion: '1.0',
        // missing fields
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('严格模式', () => {
    it('应该将警告转为错误', () => {
      const strictValidator = new ProtocolValidator(
        { strictMode: true },
        registry
      );

      const request = createValidRequest();
      request.metadata.priority = 15; // 会触发警告

      const result = strictValidator.validate(request);
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('配置选项', () => {
    it('validateCapabilities=false 应该跳过能力验证', () => {
      const lenientValidator = new ProtocolValidator(
        { validateCapabilities: false },
        registry
      );

      const request = createValidRequest();
      request.analysis.requiredCapabilities = ['non-existent'];

      const result = lenientValidator.validate(request);
      expect(result.valid).toBe(true);
    });

    it('validateDependencies=false 应该跳过依赖验证', () => {
      const lenientValidator = new ProtocolValidator(
        { validateDependencies: false },
        registry
      );

      const request = createValidRequest();
      request.plan.steps.push(
        createExecutionStep({
          stepId: 'step-2',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          dependencies: ['non-existent'], // 无效依赖
        })
      );

      const result = lenientValidator.validate(request);
      expect(result.valid).toBe(true);
    });
  });

  // 辅助函数
  function createValidRequest() {
    return createTaskRequest({
      userIntent: 'Test task',
      requiredCapabilities: ['test-capability'],
      complexity: createComplexityAssessment(50),
      strategy: 'single',
      steps: [
        createExecutionStep({
          stepId: 'step-1',
          capability: 'test-capability',
          mode: ExecutionMode.DIRECT,
          input: {},
          estimatedDuration: 60000,
        }),
      ],
      confidence: 0.9,
      priority: 5,
    });
  }
});
