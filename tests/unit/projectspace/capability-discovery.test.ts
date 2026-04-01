/**
 * 能力自动发现测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  CapabilityDiscovery,
  DiscoveredCapability,
  DiscoveryOptions,
  DiscoverySource,
} from '../../../src/projectspace/capability-discovery.js';

describe('capability-discovery', () => {
  let testDir: string;
  let discovery: CapabilityDiscovery;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cap-discovery-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    discovery = new CapabilityDiscovery();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('scanProject', () => {
    it('应该发现 package.json scripts 中的命令', async () => {
      // Given
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          analyze: 'node ./scripts/analyze.js',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      expect(capabilities).toHaveLength(3);
      expect(capabilities.map(c => c.name)).toContain('build');
      expect(capabilities.map(c => c.name)).toContain('test');
      expect(capabilities.map(c => c.name)).toContain('analyze');
    });

    it('应该发现 bin 目录中的可执行文件', async () => {
      // Given
      const binDir = join(testDir, 'bin');
      await mkdir(binDir, { recursive: true });
      await writeFile(join(binDir, 'quant-analyze'), '#!/usr/bin/env node\nconsole.log("analyze");');
      await writeFile(join(binDir, 'quant-backtest'), '#!/usr/bin/env node\nconsole.log("backtest");');

      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      const binCaps = capabilities.filter(c => c.source === DiscoverySource.BIN);
      expect(binCaps).toHaveLength(2);
      expect(binCaps.map(c => c.name)).toContain('quant-analyze');
    });

    it('应该发现 capability.json 中定义的能力', async () => {
      // Given
      const capabilityJson = {
        capabilities: [
          {
            id: 'custom-analyze',
            name: '数据分析',
            description: '执行数据分析任务',
            entryPoint: { type: 'cli', command: 'npm run analyze' },
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string' },
              },
            },
          },
        ],
      };
      await writeFile(
        join(testDir, 'capability.json'),
        JSON.stringify(capabilityJson, null, 2)
      );

      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].id).toBe('custom-analyze');
      expect(capabilities[0].name).toBe('数据分析');
    });

    it('应该发现 API 端点', async () => {
      // Given
      const apiDir = join(testDir, 'api');
      await mkdir(apiDir, { recursive: true });
      await writeFile(
        join(apiDir, 'routes.ts'),
        `
        export const routes = {
          'POST /api/analyze': { handler: 'analyzeHandler' },
          'GET /api/status': { handler: 'statusHandler' },
        };
        `
      );

      // When
      const capabilities = await discovery.scanProject(testDir, { detectApi: true });

      // Then
      const apiCaps = capabilities.filter(c => c.source === DiscoverySource.API);
      expect(apiCaps.length).toBeGreaterThan(0);
    });

    it('应该处理空项目目录', async () => {
      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      expect(capabilities).toEqual([]);
    });

    it('应该根据选项过滤发现的能力', async () => {
      // Given
      const packageJson = {
        name: 'test',
        scripts: {
          build: 'tsc',
          test: 'vitest',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When - 只包含特定来源
      const capabilities = await discovery.scanProject(testDir, {
        includeSources: [DiscoverySource.PACKAGE_JSON],
      });

      // Then
      expect(capabilities.every(c => c.source === DiscoverySource.PACKAGE_JSON)).toBe(true);
    });
  });

  describe('detectEntryPoint', () => {
    it('应该正确识别 CLI 入口点', async () => {
      // Given
      const packageJson = {
        name: 'test',
        bin: {
          'my-cli': './dist/cli.js',
        },
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      const cliCap = capabilities.find(c => c.name === 'my-cli');
      expect(cliCap).toBeDefined();
      expect(cliCap?.entryPoint.type).toBe('cli');
    });

    it('应该识别主入口文件', async () => {
      // Given
      const packageJson = {
        name: 'test',
        main: './dist/index.js',
      };
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // When
      const capabilities = await discovery.scanProject(testDir);

      // Then
      const mainCap = capabilities.find(c => c.name === 'test');
      expect(mainCap).toBeDefined();
      expect(mainCap?.entryPoint.type).toBe('function');
    });
  });

  describe('generateCapabilityId', () => {
    it('应该为发现的能力生成唯一ID', () => {
      // Given
      const discovered: DiscoveredCapability = {
        id: '',
        name: 'analyze-data',
        description: '分析数据',
        entryPoint: { type: 'cli', command: 'npm run analyze' },
        source: DiscoverySource.PACKAGE_JSON,
        projectPath: '/test/project',
      };

      // When
      const id = discovery.generateCapabilityId(discovered, 'my-project');

      // Then
      expect(id).toBe('project-my-project-analyze-data');
    });
  });

  describe('validateDiscoveredCapability', () => {
    it('应该验证能力定义的完整性', () => {
      // Given - 有效的能力
      const validCap: DiscoveredCapability = {
        id: 'test-cap',
        name: 'Test Capability',
        description: 'A test capability',
        entryPoint: { type: 'cli', command: 'npm test' },
        source: DiscoverySource.PACKAGE_JSON,
        projectPath: '/test',
      };

      // When
      const result = discovery.validateDiscoveredCapability(validCap);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺失的必填字段', () => {
      // Given - 缺少描述
      const invalidCap: DiscoveredCapability = {
        id: 'test-cap',
        name: 'Test',
        description: '',
        entryPoint: { type: 'cli', command: 'npm test' },
        source: DiscoverySource.PACKAGE_JSON,
        projectPath: '/test',
      };

      // When
      const result = discovery.validateDiscoveredCapability(invalidCap);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateInputSchema', () => {
    it('应该从命令行参数生成输入Schema', () => {
      // Given
      const command = 'npm run analyze -- --target <path> --depth <number>';

      // When
      const schema = discovery.generateInputSchema(command);

      // Then
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });
  });
});
