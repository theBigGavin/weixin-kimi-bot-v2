# 开发环境搭建指南

本文档指导开发者搭建 weixin-kimi-bot 的开发环境。

## 📋 前置要求

### 必需

- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Git**: 2.x 或更高版本
- **Kimi CLI**: 已安装并配置

### 推荐

- **VS Code**: 配合 TypeScript 插件
- **nvm**: Node.js 版本管理
- **PM2**: 生产环境进程管理

## 🔧 环境搭建

### 1. 安装 Node.js

```bash
# 使用 nvm (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 验证安装
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 2. 安装 Kimi CLI

```bash
# 安装 Kimi CLI
pip install kimi-cli

# 验证安装
kimi --version

# 配置 API Key
kimi config set api_key your-api-key
```

### 3. 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd weixin-kimi-bot

# 安装依赖
npm install
```

### 4. 配置开发环境

```bash
# 创建本地配置
cp config.example.json config.json

# 编辑配置
vim config.json
```

开发配置示例：

```json
{
  "environment": "development",
  "kimi": {
    "apiKey": "your-dev-api-key",
    "model": "kimi-latest",
    "timeout": 30000
  },
  "wechat": {
    "enabled": false,
    "pollingInterval": 5000
  },
  "logging": {
    "level": "debug",
    "console": true,
    "file": "logs/dev.log"
  }
}
```

### 5. 验证环境

```bash
# 运行类型检查
npm run typecheck

# 运行测试
npm test

# 运行测试覆盖率
npm run test:coverage
```

## 🛠️ VS Code 配置

### 推荐插件

- **TypeScript Importer** - 自动导入
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **Vitest** - 测试运行器
- **Markdown All in One** - Markdown 支持

### 工作区设置

创建 `.vscode/settings.json`：

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "vitest.enable": true,
  "vitest.commandLine": "npx vitest",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
```

### 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Current Test",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "-t", "${selectedText}", "${relativeFile}"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 📁 目录说明

```
weixin-kimi-bot/
├── src/              # 源代码
│   ├── *.ts          # 模块实现
│   └── types/        # 类型定义
├── tests/            # 测试文件
│   ├── unit/         # 单元测试
│   └── e2e/          # E2E 测试
├── docs/             # 文档
├── scripts/          # 脚本工具
├── config.json       # 配置文件
└── package.json      # 项目配置
```

## 🔨 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 编译 TypeScript
npm run watch            # 监视模式编译

# 测试
npm test                 # 运行所有测试
npm run test:watch       # 监视模式测试
npm run test:coverage    # 生成覆盖率报告
npm run test:ui          # UI 模式测试

# 代码质量
npm run lint             # ESLint 检查
npm run lint:fix         # 自动修复问题
npm run format           # Prettier 格式化
npm run typecheck        # TypeScript 类型检查

# 部署
npm run pm2:start        # PM2 启动
npm run pm2:stop         # PM2 停止
npm run pm2:restart      # PM2 重启
```

## 🐛 常见问题

### 1. 测试失败

```bash
# 清除缓存
npm run clean
rm -rf node_modules
npm install

# 重新运行测试
npm test
```

### 2. 类型错误

```bash
# 检查 TypeScript 配置
npx tsc --noEmit

# 更新类型定义
npm update @types/node
```

### 3. 模块导入错误

```bash
# 检查 tsconfig.json
# 确保 "moduleResolution": "node"
# 确保 "esModuleInterop": true
```

## 📚 下一步

- 阅读 [TDD 开发指南](./tdd-guide.md) 了解开发流程
- 阅读 [贡献指南](./contributing.md) 了解如何提交代码
- 阅读 [架构文档](../architecture/architecture-overview.md) 了解系统设计
