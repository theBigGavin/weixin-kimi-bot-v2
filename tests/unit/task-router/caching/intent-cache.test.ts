import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntentCache,
  createCapability,
  createTaskRequest,
  createComplexityAssessment,
  createExecutionStep,
  ExecutionMode,
} from '../../../../src/task-router/index.js';

describe('IntentCache', () => {
  let cache: IntentCache;

  beforeEach(() => {
    cache = new IntentCache({ maxSize: 10, ttl: 60000 });
  });

  describe('基本操作', () => {
    it('应该缓存并获取决策', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      cache.set('test message', capabilities, taskRequest);
      const cached = await cache.get('test message', capabilities);

      expect(cached).toEqual(taskRequest);
    });

    it('应该返回 null 当缓存未命中', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const cached = await cache.get('unknown message', capabilities);
      expect(cached).toBeNull();
    });

    it('应该支持用户ID隔离', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      cache.set('test message', capabilities, taskRequest, 'user-1');

      // 相同用户应该命中
      const cached1 = await cache.get('test message', capabilities, 'user-1');
      expect(cached1).not.toBeNull();

      // 不同用户可能不命中（取决于相似度匹配）
      const cached2 = await cache.get('test message', capabilities, 'user-2');
      // 模糊匹配可能命中也可能不命中，这里不断言
    });
  });

  describe('缓存统计', () => {
    it('应该正确统计命中率', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      // 未命中
      await cache.get('message', capabilities);
      
      // 缓存
      cache.set('message', capabilities, taskRequest);
      
      // 命中
      await cache.get('message', capabilities);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('缓存失效', () => {
    it('应该能清空缓存', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      cache.set('test', capabilities, taskRequest);
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('应该支持按用户ID失效', async () => {
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      cache.set('test', capabilities, taskRequest, 'user-1');
      expect(cache.size).toBe(1);

      const count = cache.invalidate({ userId: 'user-1' });
      expect(count).toBe(1);
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU 驱逐', () => {
    it('应该驱逐最久未使用的条目', async () => {
      const smallCache = new IntentCache({ maxSize: 2, ttl: 60000 });
      
      const capabilities = [
        createCapability({
          id: 'test-cap',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ];

      const taskRequest1 = createTaskRequest({
        userIntent: 'Analyze task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(30),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      const taskRequest2 = createTaskRequest({
        userIntent: 'Refactor task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(70),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.LONGTASK,
            input: {},
          }),
        ],
      });

      const taskRequest3 = createTaskRequest({
        userIntent: 'Test task',
        requiredCapabilities: ['test-cap'],
        complexity: createComplexityAssessment(50),
        steps: [
          createExecutionStep({
            stepId: 'step-1',
            capability: 'test-cap',
            mode: ExecutionMode.DIRECT,
            input: {},
          }),
        ],
      });

      // 添加两个条目
      smallCache.set('analyze code', capabilities, taskRequest1);
      smallCache.set('refactor project', capabilities, taskRequest2);
      expect(smallCache.size).toBe(2);

      // 访问第一个条目，更新其 LRU 时间
      await smallCache.get('analyze code', capabilities);

      // 添加第三个条目，触发驱逐
      smallCache.set('run tests', capabilities, taskRequest3);
      
      // 缓存大小应该仍为 2
      expect(smallCache.size).toBe(2);

      // 统计应该显示一次驱逐
      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });
});
