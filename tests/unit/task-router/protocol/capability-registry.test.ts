import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CapabilityRegistry,
  CapabilityRegistrationError,
  CapabilityNotFoundError,
  createCapability,
  ExecutionMode,
} from '../../../../src/task-router/protocol/index.js';

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    CapabilityRegistry.resetInstance();
    registry = CapabilityRegistry.getInstance({ registerBuiltins: false });
  });

  afterEach(() => {
    CapabilityRegistry.resetInstance();
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = CapabilityRegistry.getInstance();
      const instance2 = CapabilityRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('resetInstance 应该创建新实例', () => {
      const instance1 = CapabilityRegistry.getInstance();
      CapabilityRegistry.resetInstance();
      const instance2 = CapabilityRegistry.getInstance({ registerBuiltins: false });
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('register', () => {
    it('应该成功注册能力', () => {
      const capability = createCapability({
        id: 'test-capability',
        description: 'Test capability',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      registry.register(capability);

      expect(registry.has('test-capability')).toBe(true);
      expect(registry.get('test-capability')).toEqual(capability);
    });

    it('重复注册应该抛出错误', () => {
      const capability = createCapability({
        id: 'test-capability',
        description: 'Test capability',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      registry.register(capability);

      expect(() => registry.register(capability)).toThrow(CapabilityRegistrationError);
    });

    it('allowOverride=true 时应该允许覆盖', () => {
      // 需要resetInstance以创建新的带配置的实例
      CapabilityRegistry.resetInstance();
      registry = CapabilityRegistry.getInstance({
        allowOverride: true,
        registerBuiltins: false,
      });

      const capability1 = createCapability({
        id: 'test-capability',
        description: 'Version 1',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      const capability2 = createCapability({
        id: 'test-capability',
        description: 'Version 2',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
      });

      registry.register(capability1);
      registry.register(capability2);

      expect(registry.get('test-capability').description).toBe('Version 2');
    });

    it('无效的能力定义应该抛出错误', () => {
      const invalidCapability = {
        id: '',
        description: '',
        inputSchema: {},
        constraints: {},
      } as unknown as ReturnType<typeof createCapability>;

      expect(() => registry.register(invalidCapability)).toThrow(CapabilityRegistrationError);
    });
  });

  describe('registerMany', () => {
    it('应该批量注册能力', () => {
      const capabilities = [
        createCapability({
          id: 'cap-1',
          description: 'Capability 1',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
        }),
        createCapability({
          id: 'cap-2',
          description: 'Capability 2',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.LONGTASK],
        }),
      ];

      registry.registerMany(capabilities);

      expect(registry.size).toBe(2);
      expect(registry.has('cap-1')).toBe(true);
      expect(registry.has('cap-2')).toBe(true);
    });
  });

  describe('createAndRegister', () => {
    it('应该创建并注册能力', () => {
      const capability = registry.createAndRegister({
        id: 'test-cap',
        description: 'Test',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      expect(capability.id).toBe('test-cap');
      expect(registry.has('test-cap')).toBe(true);
    });
  });

  describe('get / tryGet', () => {
    beforeEach(() => {
      registry.createAndRegister({
        id: 'existing-cap',
        description: 'Existing',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });
    });

    it('get 应该返回能力', () => {
      const cap = registry.get('existing-cap');
      expect(cap.id).toBe('existing-cap');
    });

    it('get 不存在的能力应该抛出错误', () => {
      expect(() => registry.get('non-existent')).toThrow(CapabilityNotFoundError);
    });

    it('tryGet 应该安全返回能力或 undefined', () => {
      expect(registry.tryGet('existing-cap')).toBeDefined();
      expect(registry.tryGet('non-existent')).toBeUndefined();
    });
  });

  describe('unregister', () => {
    it('应该成功取消注册', () => {
      registry.createAndRegister({
        id: 'to-remove',
        description: 'To remove',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      const result = registry.unregister('to-remove');

      expect(result).toBe(true);
      expect(registry.has('to-remove')).toBe(false);
    });

    it('取消注册不存在的能力应该返回 false', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      registry.registerMany([
        createCapability({
          id: 'code-analyzer',
          description: 'Analyze code quality',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
          maxDuration: 600000,
        }),
        createCapability({
          id: 'file-reader',
          description: 'Read file content',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.DIRECT],
          maxDuration: 5000,
        }),
        createCapability({
          id: 'code-refactorer',
          description: 'Refactor code',
          inputSchema: { type: 'object', properties: {} },
          allowedModes: [ExecutionMode.LONGTASK, ExecutionMode.FLOWTASK],
          maxDuration: 3600000,
        }),
      ]);
    });

    it('应该返回所有能力', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('应该按执行模式过滤', () => {
      const directCaps = registry.getByMode(ExecutionMode.DIRECT);
      expect(directCaps).toHaveLength(2);
      expect(directCaps.map(c => c.id)).toContain('code-analyzer');
      expect(directCaps.map(c => c.id)).toContain('file-reader');
    });

    it('应该支持文本搜索', () => {
      const results = registry.query({ search: 'code' });
      expect(results).toHaveLength(2);
      expect(results.map(c => c.id)).toContain('code-analyzer');
      expect(results.map(c => c.id)).toContain('code-refactorer');
    });
  });

  describe('validateConstraints', () => {
    beforeEach(() => {
      registry.createAndRegister({
        id: 'limited-cap',
        description: 'Limited capability',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
        maxDuration: 60000, // 1分钟
      });
    });

    it('应该验证通过有效的约束', () => {
      const result = registry.validateConstraints('limited-cap', ExecutionMode.DIRECT, 30000);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测不支持的模式', () => {
      const result = registry.validateConstraints('limited-cap', ExecutionMode.LONGTASK, 30000);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('应该检测超时的时长', () => {
      const result = registry.validateConstraints('limited-cap', ExecutionMode.DIRECT, 120000);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds');
    });

    it('应该处理不存在的能力', () => {
      const result = registry.validateConstraints('non-existent', ExecutionMode.DIRECT);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('LLM Manifest', () => {
    beforeEach(() => {
      registry.registerMany([
        createCapability({
          id: 'simple-cap',
          description: 'A simple capability',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
          },
          allowedModes: [ExecutionMode.DIRECT],
        }),
      ]);
    });

    it('应该生成LLM可用的清单', () => {
      const manifest = registry.getManifestForLLM();

      expect(manifest).toHaveLength(1);
      expect(manifest[0]).toMatchObject({
        id: 'simple-cap',
        description: 'A simple capability',
        allowedModes: [ExecutionMode.DIRECT],
      });
    });

    it('应该生成LLM Prompt文本', () => {
      const prompt = registry.generateLLMPromptManifest();

      expect(prompt).toContain('simple-cap');
      expect(prompt).toContain('A simple capability');
      expect(prompt).toContain('direct');
    });
  });

  describe('内置能力', () => {
    it('registerBuiltins=true 应该自动注册内置能力', () => {
      CapabilityRegistry.resetInstance();
      const reg = CapabilityRegistry.getInstance({ registerBuiltins: true });

      expect(reg.has('code-analyzer')).toBe(true);
      expect(reg.has('code-refactorer')).toBe(true);
      expect(reg.has('test-runner')).toBe(true);
      expect(reg.has('file-operator')).toBe(true);
      expect(reg.has('search-provider')).toBe(true);
      expect(reg.has('notification-sender')).toBe(true);
      expect(reg.has('scheduler')).toBe(true);
    });
  });

  describe('clear', () => {
    it('应该清空所有能力', () => {
      registry.createAndRegister({
        id: 'cap-1',
        description: 'Cap 1',
        inputSchema: { type: 'object', properties: {} },
        allowedModes: [ExecutionMode.DIRECT],
      });

      expect(registry.size).toBe(1);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.has('cap-1')).toBe(false);
    });
  });
});
