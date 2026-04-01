/**
 * Agent 自举测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  AgentBootstrap,
  BootstrapResult,
  BootstrapOptions,
} from '../../../src/projectspace/bootstrap.js';
import { CapabilityRegistry } from '../../../src/task-router/protocol/capability-registry.js';
import { ExecutionMode } from '../../../src/task-router/types.js';
import { DiscoveredCapability, DiscoverySource } from '../../../src/projectspace/capability-discovery.js';

describe('agent-bootstrap', () => {
  let testDir: string;
  let registry: CapabilityRegistry;
  let bootstrap: AgentBootstrap;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bootstrap-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    registry = CapabilityRegistry.getInstance({ registerBuiltins: false });
    bootstrap = new AgentBootstrap(registry);
  });

  afterEach(async () => {
    CapabilityRegistry.resetInstance();
    try {
      await rmdir(testDir, { recursive: true });
    } catch { /* ignore */ }
  });

  describe('bootstrapFromProject', () => {
    it('应该将项目能力注册到注册表', async () => {
      // Given
      const packageJson = {
        name: 'quant-system',
        scripts: {
          analyze: 'node ./analyze.js',
          backtest: 'node ./backtest.js',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When
      const result = await bootstrap.bootstrapFromProject('quant-system', testDir);

      // Then
      expect(result.success).toBe(true);
      expect(result.registeredCapabilities).toHaveLength(2);
      expect(registry.has('project-quant-system-script-analyze')).toBe(true);
      expect(registry.has('project-quant-system-script-backtest')).toBe(true);
    });

    it('应该生成正确的输入Schema', async () => {
      // Given
      const packageJson = {
        name: 'test-project',
        scripts: {
          greet: 'echo "Hello"',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When
      await bootstrap.bootstrapFromProject('test-project', testDir);

      // Then
      const capability = registry.tryGet('project-test-project-script-greet');
      expect(capability).toBeDefined();
      expect(capability?.inputSchema.type).toBe('object');
      expect(capability?.constraints.allowedModes).toContain(ExecutionMode.DIRECT);
    });

    it('应该处理无能力的项目', async () => {
      // Given - 空项目
      await writeFile(join(testDir, 'README.md'), '# Empty Project');

      // When
      const result = await bootstrap.bootstrapFromProject('empty-project', testDir);

      // Then
      expect(result.success).toBe(true);
      expect(result.registeredCapabilities).toHaveLength(0);
      expect(result.warnings).toContain('未发现可注册的能力');
    });

    it('应该跳过已注册的能力（不覆盖）', async () => {
      // Given
      const packageJson = {
        name: 'duplicate-test',
        scripts: { test: 'echo test' },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // 第一次注册
      await bootstrap.bootstrapFromProject('duplicate-test', testDir);
      
      // When - 第二次注册
      const result = await bootstrap.bootstrapFromProject('duplicate-test', testDir);

      // Then
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该支持强制覆盖模式', async () => {
      // Given
      const packageJson = {
        name: 'override-test',
        scripts: { cmd: 'echo v1' },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // 第一次注册
      await bootstrap.bootstrapFromProject('override-test', testDir);

      // When - 强制覆盖
      const result = await bootstrap.bootstrapFromProject('override-test', testDir, {
        force: true,
      });

      // Then
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0); // 覆盖时不应有警告
    });
  });

  describe('convertToCapability', () => {
    it('应该将发现的能力转换为标准Capability', () => {
      // Given
      const discovered: DiscoveredCapability = {
        id: 'test-cap',
        name: 'Test Capability',
        description: 'Test description',
        entryPoint: { type: 'cli', command: 'npm test' },
        source: DiscoverySource.PACKAGE_JSON,
        projectPath: testDir,
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string' },
          },
        },
      };

      // When
      const capability = bootstrap.convertToCapability(discovered, 'test-project');

      // Then
      expect(capability.id).toBe('project-test-project-test-cap');
      expect(capability.description).toBe('[test-project] Test description');
      expect(capability.constraints.allowedModes).toContain(ExecutionMode.DIRECT);
      expect(capability.metadata?.category).toBe('project');
      expect(capability.metadata?.tags).toContain('project-capability');
    });

    it('应该根据入口点类型设置执行模式', () => {
      // Given
      const discoveredLong: DiscoveredCapability = {
        id: 'long-cap',
        name: 'Long Running',
        description: 'Long task',
        entryPoint: { type: 'function', command: 'longRunning' },
        source: DiscoverySource.BIN,
        projectPath: testDir,
      };

      // When
      const capability = bootstrap.convertToCapability(discoveredLong, 'test');

      // Then
      expect(capability.constraints.allowedModes).toContain(ExecutionMode.LONGTASK);
    });
  });

  describe('executeProjectCapability', () => {
    it('应该支持执行项目能力', async () => {
      // Given
      const packageJson = {
        name: 'exec-test',
        scripts: { hello: 'echo "Hello World"' },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await bootstrap.bootstrapFromProject('exec-test', testDir);

      // When - 通过注册表获取并执行
      const capability = registry.tryGet('project-exec-test-script-hello');

      // Then
      expect(capability).toBeDefined();
      expect(capability?.constraints.maxDuration).toBeGreaterThan(0);
    });
  });

  describe('unbootstrapProject', () => {
    it('应该注销项目的所有能力', async () => {
      // Given
      const packageJson = {
        name: 'cleanup-test',
        scripts: {
          a: 'echo a',
          b: 'echo b',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await bootstrap.bootstrapFromProject('cleanup-test', testDir);
      expect(registry.getAll().length).toBe(2);

      // When
      const result = await bootstrap.unbootstrapProject('cleanup-test');

      // Then
      expect(result.success).toBe(true);
      expect(result.unregisteredCount).toBe(2);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('getProjectCapabilities', () => {
    it('应该获取特定项目的所有能力', async () => {
      // Given
      const packageJson = {
        name: 'list-test',
        scripts: { cmd1: 'echo 1', cmd2: 'echo 2' },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await bootstrap.bootstrapFromProject('list-test', testDir);

      // When
      const caps = bootstrap.getProjectCapabilities('list-test');

      // Then
      expect(caps).toHaveLength(2);
      expect(caps.every(c => c.id.startsWith('project-list-test'))).toBe(true);
    });
  });
});
