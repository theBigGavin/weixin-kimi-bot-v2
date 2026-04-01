/**
 * 内置项目模板定义
 */

import { TemplateType, ProjectTemplate } from './types.js';

export const TOOL_TEMPLATE: ProjectTemplate = {
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
        bin: { '{{projectName}}': './dist/cli.js' },
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
      template: `export interface Options { verbose?: boolean; }
export function main(args: string[], options: Options = {}): void {
  console.log('{{projectName}} is running!');
  console.log('Args:', args);
  if (options.verbose) console.log('Verbose mode enabled');
}`,
    },
    {
      path: 'src/cli.ts',
      template: `#!/usr/bin/env node
import { main } from './index.js';
const args = process.argv.slice(2);
main(args.filter(a => !a.startsWith('-')), { verbose: args.includes('-v') });`,
    },
    {
      path: 'README.md',
      template: `# {{projectName}}

{{description}}

## Usage

\`\`\`bash
{{projectName}} [options] <command>
\`\`\`

### Options

- -v, --verbose  Enable verbose output
`,
    },
    {
      path: '.gitignore',
      template: `node_modules/\ndist/\n*.log\n.env\n.DS_Store\n`,
    },
    {
      path: 'capability.json',
      template: JSON.stringify({
        capabilities: [{
          id: '{{projectName}}',
          name: '{{projectName}}',
          description: '{{description}}',
          entryPoint: { type: 'cli', command: 'npm start' },
        }],
      }, null, 2),
    },
  ],
};

export const LIBRARY_TEMPLATE: ProjectTemplate = {
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
        scripts: { build: 'tsc', test: 'vitest', prepublishOnly: 'npm run build && npm test' },
        keywords: ['library'],
        author: '{{author}}',
        license: 'MIT',
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      template: JSON.stringify({
        compilerOptions: {
          target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
          outDir: './dist', rootDir: './src', strict: true,
          esModuleInterop: true, declaration: true, declarationMap: true,
        },
        include: ['src/**/*'],
      }, null, 2),
    },
    { path: 'src/index.ts', template: `export * from './core.js';` },
    {
      path: 'src/core.ts',
      template: `export interface Config { enabled?: boolean; }
export function createClient(config: Config = {}) {
  return { config, connect: () => Promise.resolve(true) };
}`,
    },
    {
      path: 'tests/core.test.ts',
      template: `import { describe, it, expect } from 'vitest';
import { createClient } from '../src/core.js';
describe('core', () => {
  it('should create client', () => {
    expect(createClient()).toBeDefined();
  });
});`,
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
`,
    },
    { path: '.gitignore', template: `node_modules/\ndist/\n*.log\n.env\n` },
  ],
};

export const SERVICE_TEMPLATE: ProjectTemplate = {
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
        scripts: { build: 'tsc', dev: 'tsx src/server.ts', start: 'node dist/server.js', test: 'vitest' },
        keywords: ['service', 'api'],
        author: '{{author}}',
        license: 'MIT',
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0', tsx: '^4.0.0', '@types/node': '^20.0.0' },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      template: JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', outDir: './dist', rootDir: './src', strict: true, esModuleInterop: true },
        include: ['src/**/*'],
      }, null, 2),
    },
    {
      path: 'src/server.ts',
      template: `import { createServer } from './app.js';
const PORT = parseInt(process.env.PORT || '{{port}}', 10);
createServer().listen(PORT, () => console.log(\`🚀 {{projectName}} on port \${PORT}\`));`,
    },
    {
      path: 'src/app.ts',
      template: `import http from 'http';
export function createServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: '{{projectName}}' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from {{projectName}}' }));
  });
}`,
    },
    { path: 'src/routes/index.ts', template: `export const routes = { 'GET /api/status': { handler: 'getStatus' } };` },
    { path: 'README.md', template: `# {{projectName}}\n\n{{description}}\n\n## API\n\n- GET /health - Health check\n` },
    { path: '.gitignore', template: `node_modules/\ndist/\n*.log\n.env\n` },
  ],
};

export const KNOWLEDGE_TEMPLATE: ProjectTemplate = {
  id: 'knowledge',
  name: '知识库',
  description: '结构化知识管理，包含文档和索引',
  type: TemplateType.KNOWLEDGE,
  variables: [
    { name: 'projectName', description: '知识库名', required: true },
    { name: 'description', description: '描述', default: 'A knowledge base' },
  ],
  files: [
    { path: 'README.md', template: `# {{projectName}}\n\n{{description}}\n\n## Structure\n\n- concepts/ - Core concepts\n- guides/ - How-to guides\n` },
    { path: 'concepts/README.md', template: `# Concepts\n\nCore concepts of {{projectName}}.` },
    { path: 'guides/README.md', template: `# Guides\n\nHow-to guides for {{projectName}}.` },
    { path: 'reference/README.md', template: `# Reference\n\nReference materials.` },
    { path: 'notes/README.md', template: `# Notes\n\nWorking notes.` },
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
