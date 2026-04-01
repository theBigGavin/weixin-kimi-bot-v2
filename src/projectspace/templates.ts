/**
 * 项目模板系统
 * 
 * 提供预定义的项目模板，支持快速创建标准化的项目结构
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * 模板类型
 */
export enum TemplateType {
  TOOL = 'tool',
  LIBRARY = 'library',
  SERVICE = 'service',
  KNOWLEDGE = 'knowledge',
  CUSTOM = 'custom',
}

/**
 * 模板变量
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string;
  /** 描述 */
  description?: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  default?: string;
}

/**
 * 模板文件
 */
export interface TemplateFile {
  /** 文件路径 */
  path: string;
  /** 模板内容 */
  template: string;
  /** 是否可执行 */
  executable?: boolean;
  /** 条件函数 */
  condition?: (variables: Record<string, string>) => boolean;
}

/**
 * 项目模板
 */
export interface ProjectTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 类型 */
  type: TemplateType;
  /** 变量定义 */
  variables: TemplateVariable[];
  /** 文件模板 */
  files: TemplateFile[];
  /** 依赖列表 */
  dependencies?: string[];
  /** 建议标签 */
  suggestedTags?: string[];
}

/**
 * 创建结果
 */
export interface CreateFromTemplateResult {
  success: boolean;
  templateId: string;
  targetPath: string;
  createdFiles: string[];
  errors: string[];
}

/**
 * 变量验证结果
 */
export interface VariableValidationResult {
  valid: boolean;
  errors: string[];
  values: Record<string, string>;
}

// ============================================================================
// 内置模板
// ============================================================================

const TOOL_TEMPLATE: ProjectTemplate = {
  id: 'tool',
  name: '可执行工具',
  description: '命令行工具项目，包含 CLI 入口和基本配置',
  type: TemplateType.TOOL,
  variables: [
    { name: 'projectName', description: '项目名称', required: true },
    { name: 'description', description: '项目描述', default: 'A CLI tool' },
    { name: 'author', description: '作者', default: '' },
  ],
  files: [
    {
      path: 'package.json',
      template: JSON.stringify({
        name: '{{projectName}}',
        version: '1.0.0',
        description: '{{description}}',
        main: 'dist/index.js',
        bin: {
          '{{projectName}}': './dist/cli.js',
        },
        scripts: {
          build: 'tsc',
          dev: 'tsx src/cli.ts',
          start: 'node dist/cli.js',
          test: 'vitest',
        },
        keywords: ['cli', 'tool'],
        author: '{{author}}',
        license: 'MIT',
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
          tsx: '^4.0.0',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      template: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          declaration: true,
        },
        include: ['src/**/*'],
      }, null, 2),
    },
    {
      path: 'src/index.ts',
      template: `/**
 * {{projectName}} - {{description}}
 */

export interface Options {
  verbose?: boolean;
}

export function main(args: string[], options: Options = {}): void {
  console.log('{{projectName}} is running!');
  console.log('Args:', args);
  
  if (options.verbose) {
    console.log('Verbose mode enabled');
  }
}
`,
    },
    {
      path: 'src/cli.ts',
      template: `#!/usr/bin/env node
/**
 * {{projectName}} CLI
 */

import { main } from './index.js';

const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
};

main(args.filter(a => !a.startsWith('-')), options);
`,
    },
    {
      path: 'README.md',
      template: `# {{projectName}}

{{description}}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`bash
{{projectName}} [options] <command>
\`\`\`

### Options

- -v, --verbose  Enable verbose output

## Development

\`\`\`bash
npm run dev    # Run in development mode
npm test       # Run tests
\`\`\`
`,
    },
    {
      path: '.gitignore',
      template: `node_modules/
dist/
*.log
.env
.DS_Store
`,
    },
    {
      path: 'capability.json',
      template: JSON.stringify({
        capabilities: [
          {
            id: '{{projectName}}',
            name: '{{projectName}}',
            description: '{{description}}',
            entryPoint: { type: 'cli', command: 'npm start' },
          },
        ],
      }, null, 2),
    },
  ],
};

const LIBRARY_TEMPLATE: ProjectTemplate = {
  id: 'library',
  name: '代码库/包',
  description: '可复用的代码库，包含类型定义和单元测试',
  type: TemplateType.LIBRARY,
  variables: [
    { name: 'projectName', description: '包名', required: true },
    { name: 'description', description: '包描述', default: 'A library' },
    { name: 'author', description: '作者', default: '' },
  ],
  files: [
    {
      path: 'package.json',
      template: JSON.stringify({
        name: '{{projectName}}',
        version: '1.0.0',
        description: '{{description}}',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        files: ['dist/'],
        scripts: {
          build: 'tsc',
          test: 'vitest',
          prepublishOnly: 'npm run build && npm test',
        },
        keywords: ['library'],
        author: '{{author}}',
        license: 'MIT',
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      template: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          declaration: true,
          declarationMap: true,
        },
        include: ['src/**/*'],
      }, null, 2),
    },
    {
      path: 'src/index.ts',
      template: `/**
 * {{projectName}} - {{description}}
 */

export * from './core.js';
`,
    },
    {
      path: 'src/core.ts',
      template: `/**
 * Core functionality
 */

export interface Config {
  enabled?: boolean;
}

export function createClient(config: Config = {}) {
  return {
    config,
    connect: () => Promise.resolve(true),
  };
}
`,
    },
    {
      path: 'tests/core.test.ts',
      template: `import { describe, it, expect } from 'vitest';
import { createClient } from '../src/core.js';

describe('core', () => {
  it('should create client', () => {
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.config).toEqual({});
  });
});
`,
    },
    {
      path: 'README.md',
      template: `# {{projectName}}

{{description}}

## Installation

\`\`\`bash
npm install {{projectName}}
\`\`\`

## Usage

\`\`\`typescript
import { createClient } from '{{projectName}}';

const client = createClient({ enabled: true });
await client.connect();
\`\`\`

## Development

\`\`\`bash
npm run build
npm test
\`\`\`
`,
    },
    {
      path: '.gitignore',
      template: `node_modules/
dist/
*.log
.env
.DS_Store
`,
    },
  ],
};

const SERVICE_TEMPLATE: ProjectTemplate = {
  id: 'service',
  name: '服务',
  description: '后台服务，包含 API 和健康检查',
  type: TemplateType.SERVICE,
  variables: [
    { name: 'projectName', description: '服务名', required: true },
    { name: 'description', description: '服务描述', default: 'A service' },
    { name: 'port', description: '端口', default: '3000' },
    { name: 'author', description: '作者', default: '' },
  ],
  files: [
    {
      path: 'package.json',
      template: JSON.stringify({
        name: '{{projectName}}',
        version: '1.0.0',
        description: '{{description}}',
        main: 'dist/server.js',
        scripts: {
          build: 'tsc',
          dev: 'tsx src/server.ts',
          start: 'node dist/server.js',
          test: 'vitest',
        },
        keywords: ['service', 'api'],
        author: '{{author}}',
        license: 'MIT',
        dependencies: {},
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
          tsx: '^4.0.0',
          '@types/node': '^20.0.0',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      template: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
        },
        include: ['src/**/*'],
      }, null, 2),
    },
    {
      path: 'src/server.ts',
      template: `/**
 * {{projectName}} - {{description}}
 */

import { createServer } from './app.js';

const PORT = parseInt(process.env.PORT || '{{port}}', 10);

const server = createServer();

server.listen(PORT, () => {
  console.log(\`🚀 {{projectName}} running on port \${PORT}\`);
});
`,
    },
    {
      path: 'src/app.ts',
      template: `import http from 'http';

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: '{{projectName}}' }));
      return;
    }

    // Default handler
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from {{projectName}}' }));
  });
}
`,
    },
    {
      path: 'src/routes/index.ts',
      template: `/**
 * API Routes
 */

export const routes = {
  'GET /api/status': { handler: 'getStatus' },
  'POST /api/action': { handler: 'postAction' },
};
`,
    },
    {
      path: 'README.md',
      template: `# {{projectName}}

{{description}}

## Running

\`\`\`bash
npm install
npm run dev    # Development
npm start      # Production
\`\`\`

## API

- GET /health - Health check
- GET /api/status - Service status

## Configuration

Environment variables:
- PORT - Server port (default: {{port}})
`,
    },
    {
      path: '.gitignore',
      template: `node_modules/
dist/
*.log
.env
.DS_Store
`,
    },
  ],
};

const KNOWLEDGE_TEMPLATE: ProjectTemplate = {
  id: 'knowledge',
  name: '知识库',
  description: '结构化知识管理，包含文档和索引',
  type: TemplateType.KNOWLEDGE,
  variables: [
    { name: 'projectName', description: '知识库名', required: true },
    { name: 'description', description: '描述', default: 'A knowledge base' },
  ],
  files: [
    {
      path: 'README.md',
      template: `# {{projectName}}

{{description}}

## Structure

- concepts/ - Core concepts
- guides/ - How-to guides
- reference/ - Reference materials
- notes/ - Working notes
`,
    },
    {
      path: 'concepts/README.md',
      template: `# Concepts

Core concepts of {{projectName}}.
`,
    },
    {
      path: 'guides/README.md',
      template: `# Guides

How-to guides for {{projectName}}.
`,
    },
    {
      path: 'reference/README.md',
      template: `# Reference

Reference materials for {{projectName}}.
`,
    },
    {
      path: 'notes/README.md',
      template: `# Notes

Working notes for {{projectName}}.
`,
    },
    {
      path: 'index.json',
      template: JSON.stringify({
        name: '{{projectName}}',
        description: '{{description}}',
        categories: ['concepts', 'guides', 'reference', 'notes'],
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      }, null, 2),
    },
  ],
};

// ============================================================================
// 模板注册表
// ============================================================================

export class TemplateRegistry {
  private templates = new Map<string, ProjectTemplate>();

  constructor() {
    // 注册内置模板
    this.register(TOOL_TEMPLATE);
    this.register(LIBRARY_TEMPLATE);
    this.register(SERVICE_TEMPLATE);
    this.register(KNOWLEDGE_TEMPLATE);
  }

  /**
   * 注册模板
   */
  register(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取模板
   */
  get(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 获取所有模板
   */
  getAll(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 检查模板是否存在
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * 按类型获取模板
   */
  getByType(type: TemplateType): ProjectTemplate[] {
    return this.getAll().filter(t => t.type === type);
  }
}

// ============================================================================
// 模板引擎
// ============================================================================

export class ProjectTemplateEngine {
  constructor(private registry: TemplateRegistry) {}

  /**
   * 从模板创建项目
   */
  async createProjectFromTemplate(
    templateId: string,
    targetPath: string,
    variables: Record<string, string>
  ): Promise<CreateFromTemplateResult> {
    const result: CreateFromTemplateResult = {
      success: true,
      templateId,
      targetPath,
      createdFiles: [],
      errors: [],
    };

    // 获取模板
    const template = this.registry.get(templateId);
    if (!template) {
      result.success = false;
      result.errors.push(`模板不存在: ${templateId}`);
      return result;
    }

    // 验证变量
    const validation = this.validateTemplateVariables(template.variables, variables);
    if (!validation.valid) {
      result.success = false;
      result.errors.push(...validation.errors);
      return result;
    }

    const vars = validation.values;

    // 创建文件
    for (const file of template.files) {
      // 检查条件
      if (file.condition && !file.condition(vars)) {
        continue;
      }

      try {
        const filePath = join(targetPath, file.path);
        const content = this.renderTemplate(file.template, vars);

        // 创建目录
        await mkdir(dirname(filePath), { recursive: true });
        
        // 写入文件
        await writeFile(filePath, content, { mode: file.executable ? 0o755 : 0o644 });
        result.createdFiles.push(file.path);
      } catch (error) {
        result.errors.push(
          `创建文件失败 ${file.path}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * 验证模板变量
   */
  validateTemplateVariables(
    variables: TemplateVariable[],
    values: Record<string, string>
  ): VariableValidationResult {
    const errors: string[] = [];
    const result: Record<string, string> = {};

    for (const variable of variables) {
      const value = values[variable.name];

      if (value === undefined || value === '') {
        if (variable.required) {
          errors.push(`缺少必填变量: ${variable.name}`);
        } else if (variable.default !== undefined) {
          result[variable.name] = variable.default;
        }
      } else {
        result[variable.name] = value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      values: result,
    };
  }

  /**
   * 渲染模板
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template;

    // 简单变量替换 {{varName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }

    // 简单的 if/else 条件
    const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifPattern, (_match, varName, trueContent, falseContent) => {
      return variables[varName] === 'true' ? trueContent : falseContent;
    });

    // 简单的 if（无else）
    const simpleIfPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(simpleIfPattern, (_match, varName, content) => {
      return variables[varName] === 'true' ? content : '';
    });

    return result;
  }

  /**
   * 获取模板变量
   */
  getTemplateVariables(templateId: string): TemplateVariable[] {
    const template = this.registry.get(templateId);
    return template?.variables || [];
  }

  /**
   * 列出所有可用模板
   */
  listAvailableTemplates(type?: TemplateType): ProjectTemplate[] {
    if (type) {
      return this.registry.getByType(type);
    }
    return this.registry.getAll();
  }
}

// 导出工厂函数
export function createProjectTemplateEngine(registry?: TemplateRegistry): ProjectTemplateEngine {
  return new ProjectTemplateEngine(registry || new TemplateRegistry());
}
