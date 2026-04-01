/**
 * 项目模板系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rmdir, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ProjectTemplateEngine,
  ProjectTemplate,
  TemplateVariable,
  TemplateType,
  TemplateRegistry,
} from '../../../src/projectspace/templates/index.js';

describe('project-templates', () => {
  let testDir: string;
  let engine: ProjectTemplateEngine;
  let registry: TemplateRegistry;

  beforeEach(async () => {
    testDir = join(tmpdir(), `template-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    registry = new TemplateRegistry();
    engine = new ProjectTemplateEngine(registry);
  });

  afterEach(async () => {
    try {
      await rmdir(testDir, { recursive: true });
    } catch { /* ignore */ }
  });

  describe('TemplateRegistry', () => {
    it('应该注册内置模板', () => {
      // When
      const templates = registry.getAll();

      // Then
      expect(templates.length).toBeGreaterThan(0);
      expect(registry.get('tool')).toBeDefined();
      expect(registry.get('library')).toBeDefined();
      expect(registry.get('service')).toBeDefined();
    });

    it('应该支持自定义模板', () => {
      // Given
      const customTemplate: ProjectTemplate = {
        id: 'custom-template',
        name: 'Custom Template',
        description: 'A custom template',
        type: TemplateType.TOOL,
        variables: [
          { name: 'projectName', description: 'Project name', required: true },
        ],
        files: [
          { path: 'README.md', template: '# {{projectName}}' },
        ],
      };

      // When
      registry.register(customTemplate);

      // Then
      expect(registry.get('custom-template')).toEqual(customTemplate);
    });
  });

  describe('createProjectFromTemplate', () => {
    it('应该基于模板创建项目', async () => {
      // Given
      const targetDir = join(testDir, 'new-project');

      // When
      const result = await engine.createProjectFromTemplate('tool', targetDir, {
        projectName: 'My Tool',
        description: 'A test tool',
      });

      // Then
      expect(result.success).toBe(true);
      expect(result.createdFiles.length).toBeGreaterThan(0);
      
      // 验证文件创建
      const readmePath = join(targetDir, 'README.md');
      await expect(access(readmePath)).resolves.toBeUndefined();
    });

    it('应该替换模板变量', async () => {
      // Given
      const targetDir = join(testDir, 'var-project');

      // When
      await engine.createProjectFromTemplate('tool', targetDir, {
        projectName: 'AwesomeTool',
        description: 'Does awesome things',
      });

      // Then
      const readme = await readFile(join(targetDir, 'README.md'), 'utf-8');
      expect(readme).toContain('AwesomeTool');
      expect(readme).toContain('Does awesome things');
    });

    it('应该创建正确的目录结构', async () => {
      // Given
      const targetDir = join(testDir, 'struct-project');

      // When
      await engine.createProjectFromTemplate('tool', targetDir, {
        projectName: 'MyTool',
        description: 'A tool',
      });

      // Then
      const dirs = ['src'];
      for (const dir of dirs) {
        await expect(access(join(targetDir, dir))).resolves.toBeUndefined();
      }
      
      // 验证文件创建
      await expect(access(join(targetDir, 'src', 'index.ts'))).resolves.toBeUndefined();
      await expect(access(join(targetDir, 'src', 'cli.ts'))).resolves.toBeUndefined();
    });

    it('应该处理缺少必填变量的情况', async () => {
      // Given
      const targetDir = join(testDir, 'fail-project');

      // When - 缺少 projectName
      const result = await engine.createProjectFromTemplate('tool', targetDir, {
        description: 'Missing name',
      });

      // Then
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该支持条件文件', async () => {
      // Given
      const targetDir = join(testDir, 'cond-project');
      const customTemplate: ProjectTemplate = {
        id: 'conditional',
        name: 'Conditional Template',
        description: 'Template with conditional files',
        type: TemplateType.TOOL,
        variables: [
          { name: 'projectName', required: true },
          { name: 'includeTests', default: 'true' },
        ],
        files: [
          { path: 'main.js', template: '// main' },
          { 
            path: 'test.js', 
            template: '// test',
            condition: (vars) => vars.includeTests === 'true',
          },
        ],
      };
      registry.register(customTemplate);

      // When - includeTests = false
      await engine.createProjectFromTemplate('conditional', targetDir, {
        projectName: 'Test',
        includeTests: 'false',
      });

      // Then
      await expect(access(join(targetDir, 'main.js'))).resolves.toBeUndefined();
      await expect(access(join(targetDir, 'test.js'))).rejects.toThrow();
    });
  });

  describe('validateTemplateVariables', () => {
    it('应该验证变量值的合法性', () => {
      // Given
      const variables: TemplateVariable[] = [
        { name: 'name', required: true },
        { name: 'port', default: '3000' },
      ];

      // When - 缺少必填变量
      const result1 = engine.validateTemplateVariables(variables, {});
      
      // Then
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('缺少必填变量: name');

      // When - 完整变量
      const result2 = engine.validateTemplateVariables(variables, { name: 'Test' });
      
      // Then
      expect(result2.valid).toBe(true);
    });

    it('应该应用默认值', () => {
      // Given
      const variables: TemplateVariable[] = [
        { name: 'name', default: 'default-name' },
      ];

      // When
      const result = engine.validateTemplateVariables(variables, {});

      // Then
      expect(result.valid).toBe(true);
      expect(result.values.name).toBe('default-name');
    });
  });

  describe('renderTemplate', () => {
    it('应该渲染模板字符串', () => {
      // Given
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const variables = { name: 'Alice', project: 'MyApp' };

      // When
      const result = engine.renderTemplate(template, variables);

      // Then
      expect(result).toBe('Hello Alice, welcome to MyApp!');
    });

    it('应该处理未定义的变量', () => {
      // Given
      const template = 'Hello {{name}} and {{unknown}}!';
      const variables = { name: 'Alice' };

      // When
      const result = engine.renderTemplate(template, variables);

      // Then - 未定义变量保留原样或替换为空
      expect(result).not.toContain('{{name}}');
    });

    it('应该支持条件渲染', () => {
      // Given
      const template = '{{#if premium}}Premium Feature{{else}}Basic Feature{{/if}}';
      
      // When
      const result1 = engine.renderTemplate(template, { premium: 'true' });
      const result2 = engine.renderTemplate(template, { premium: 'false' });

      // Then
      expect(result1).toBe('Premium Feature');
      expect(result2).toBe('Basic Feature');
    });
  });

  describe('getTemplateVariables', () => {
    it('应该提取模板中的所有变量', () => {
      // Given
      const template: ProjectTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test template',
        type: TemplateType.TOOL,
        variables: [
          { name: 'var1', description: 'Variable 1', required: true },
          { name: 'var2', description: 'Variable 2' },
        ],
        files: [],
      };
      registry.register(template);

      // When
      const vars = engine.getTemplateVariables('test');

      // Then
      expect(vars).toHaveLength(2);
      expect(vars[0].name).toBe('var1');
      expect(vars[0].required).toBe(true);
    });
  });

  describe('listAvailableTemplates', () => {
    it('应该列出所有可用模板', () => {
      // When
      const templates = engine.listAvailableTemplates();

      // Then
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.id && t.name)).toBe(true);
    });

    it('应该支持按类型过滤', () => {
      // When
      const tools = engine.listAvailableTemplates(TemplateType.TOOL);
      const services = engine.listAvailableTemplates(TemplateType.SERVICE);

      // Then
      expect(tools.every(t => t.type === TemplateType.TOOL)).toBe(true);
      expect(services.every(t => t.type === TemplateType.SERVICE)).toBe(true);
    });
  });
});
