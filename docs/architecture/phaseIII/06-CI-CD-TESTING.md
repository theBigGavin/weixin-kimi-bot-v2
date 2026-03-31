# CI/CD 与测试策略设计

## 1. 当前问题分析

### 1.1 现有测试问题

| 问题 | 影响 | 解决方案 |
|-----|------|---------|
| 缺乏 CI/CD 集成 | 手动测试，容易遗漏 | GitHub Actions 流水线 |
| 单元测试覆盖不足 | 遗留缺陷 | 提高覆盖率门槛 |
| 无自动化集成测试 | 集成问题发现晚 | E2E 测试自动化 |
| 测试环境隔离差 | 测试相互影响 | 完善的测试隔离 |
| 无性能测试 | 性能退化未知 | 性能基准测试 |

### 1.2 测试覆盖率现状

```
当前覆盖目标：
- 行覆盖率：≥80%
- 函数覆盖率：≥80%
- 分支覆盖率：≥75%

实际改进目标：
- 行覆盖率：≥90%
- 函数覆盖率：≥90%
- 分支覆盖率：≥85%
```

## 2. CI/CD 流水线设计

### 2.1 GitHub Actions 配置

```yaml
# .github/workflows/ci.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    # 每天凌晨运行完整测试
    - cron: '0 0 * * *'

jobs:
  # ========== 代码质量检查 ==========
  lint:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run lint

      - name: Check formatting
        run: npx prettier --check "src/**/*.ts" "tests/**/*.ts"

  # ========== 单元测试 ==========
  unit-test:
    name: Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq -r '.total.lines.pct')
          if (( $(echo "$COVERAGE < 85" | bc -l) )); then
            echo "Coverage $COVERAGE% is below threshold 85%"
            exit 1
          fi

  # ========== 集成测试 ==========
  integration-test:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [lint, unit-test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          WEIXIN_KIMI_BOT_HOME: /tmp/weixin-kimi-bot-test

      - name: Upload integration test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: integration-test-results
          path: test-results/

  # ========== E2E 测试 ==========
  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [integration-test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          WEIXIN_KIMI_BOT_HOME: /tmp/weixin-kimi-bot-e2e
          E2E_TEST_MODE: true

  # ========== 构建验证 ==========
  build:
    name: Build Verification
    runs-on: ubuntu-latest
    needs: [lint]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Verify build output
        run: |
          test -f dist/index.js
          test -f dist/index.d.ts

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/

  # ========== 发布 (仅 main 分支) ==========
  release:
    name: Release
    runs-on: ubuntu-latest
    needs: [unit-test, integration-test, e2e-test, build]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/

      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          draft: false
          prerelease: false
```

### 2.2 部署流水线

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  release:
    types: [published]

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run smoke tests
        run: npm run test:smoke

      - name: Deploy
        run: |
          # 部署脚本
          echo "Deploying to production..."
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

## 3. 测试策略增强

### 3.1 测试金字塔

```
        /\
       /  \     E2E 测试 (5%)
      /____\    - 完整用户流程
     /      \   - 需要真实环境
    /________\  
   /          \ 集成测试 (15%)
  /____________\ - 模块间交互
 /              \ - Mock 外部依赖
/________________\ 
/                  \ 单元测试 (80%)
/____________________\ - 纯函数测试
                       - 快速、独立
```

### 3.2 测试分类

```
tests/
├── unit/                           # 单元测试
│   ├── agent/
│   │   ├── id-generator.test.ts   # Agent ID 生成
│   │   ├── manager.test.ts
│   │   └── types.test.ts
│   ├── acp/
│   │   ├── client.test.ts
│   │   └── manager.test.ts
│   ├── wechat/
│   │   └── manager.test.ts
│   ├── context/
│   ├── store/
│   └── backup/
│
├── integration/                    # 集成测试
│   ├── agent-workflow.test.ts     # Agent 完整工作流
│   ├── wechat-binding.test.ts     # 微信绑定流程
│   ├── backup-restore.test.ts     # 备份恢复流程
│   └── founder-creation.test.ts   # 创世 Agent 创建
│
├── e2e/                           # E2E 测试
│   ├── login-flow.test.ts         # 登录流程
│   ├── message-handling.test.ts   # 消息处理
│   └── agent-switching.test.ts    # Agent 切换
│
├── fixtures/                      # 测试夹具
│   ├── agents/
│   ├── messages/
│   └── responses/
│
└── helpers/                       # 测试辅助函数
    ├── setup.ts
    ├── mocks.ts
    └── assertions.ts
```

### 3.3 单元测试增强

```typescript
// tests/unit/agent/id-generator.test.ts

import { describe, it, expect } from 'vitest';
import {
  generateAgentId,
  parseAgentId,
  isValidAgentId,
  isAgentBoundToWechat,
} from '../../../src/agent/id-generator.js';

describe('Agent ID Generation', () => {
  describe('generateAgentId', () => {
    it('should generate ID with correct format', () => {
      const id = generateAgentId('小助手', 'wxid_a1b2c3d4e5f6');
      expect(id).toMatch(/^小助手_a1b2c3d4_[a-z0-9]{4}$/);
    });

    it('should sanitize special characters', () => {
      const id = generateAgentId('My Agent!', 'wxid_test12345');
      expect(id).toMatch(/^my_agent_test12345_[a-z0-9]{4}$/);
    });

    it('should truncate long names', () => {
      const id = generateAgentId('这是一个非常长的名称超过了二十个字符', 'wxid_a1b2c3d4');
      expect(id.split('_')[0].length).toBeLessThanOrEqual(20);
    });

    it('should generate unique IDs for same name and wechatId', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateAgentId('test', 'wxid_a1b2c3d4'));
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('parseAgentId', () => {
    it('should parse valid ID', () => {
      const parsed = parseAgentId('小助手_a1b2c3d4_x7k9');
      expect(parsed).toEqual({
        name: '小助手',
        wechatIdPrefix: 'a1b2c3d4',
        randomSuffix: 'x7k9',
      });
    });

    it('should return null for invalid ID', () => {
      expect(parseAgentId('invalid')).toBeNull();
      expect(parseAgentId('name_123_abc')).toBeNull();
      expect(parseAgentId('name_12345678_abc_extra')).toBeNull();
    });
  });

  describe('isAgentBoundToWechat', () => {
    it('should return true for matching wechat ID', () => {
      const result = isAgentBoundToWechat('小助手_a1b2c3d4_x7k9', 'wxid_a1b2c3d4xyz');
      expect(result).toBe(true);
    });

    it('should return false for non-matching wechat ID', () => {
      const result = isAgentBoundToWechat('小助手_a1b2c3d4_x7k9', 'wxid_z9y8x7w6');
      expect(result).toBe(false);
    });
  });
});
```

### 3.4 集成测试

```typescript
// tests/integration/founder-creation.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FounderManager } from '../../src/founder/manager.js';
import { AgentManager } from '../../src/agent/manager.js';
import { WechatAccountManager } from '../../src/wechat/manager.js';
import { createTestStore, cleanupTestData } from '../helpers/setup.js';

describe('Founder Agent Creation Flow', () => {
  let founderManager: FounderManager;
  let agentManager: AgentManager;
  let wechatManager: WechatAccountManager;

  beforeEach(() => {
    const store = createTestStore();
    founderManager = new FounderManager(store);
    agentManager = new AgentManager(store);
    wechatManager = new WechatAccountManager(store);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('should create founder agent on first login', async () => {
    const wechatId = 'wxid_testuser123';

    // 1. 检查没有创世 Agent
    expect(await founderManager.hasFounder()).toBe(false);

    // 2. 创建 Agent
    const agent = await agentManager.createAgent({
      name: '创世助手',
      wechatId,
      isFounder: true,
    });

    // 3. 绑定到微信账号
    await wechatManager.bindAgent(wechatId, agent.id, true);

    // 4. 标记为创世 Agent
    await founderManager.setFounder(agent.id, wechatId);

    // 5. 验证
    expect(await founderManager.hasFounder()).toBe(true);
    expect(await founderManager.getFounderAgentId()).toBe(agent.id);
    expect(await founderManager.isFounderAgent(agent.id)).toBe(true);

    // 6. 验证权限
    const isFounder = await agentManager.isFounderAgent(agent.id);
    expect(isFounder).toBe(true);
  });

  it('should not allow duplicate founder', async () => {
    const wechatId = 'wxid_testuser123';

    // 创建第一个创世 Agent
    const agent1 = await agentManager.createAgent({
      name: '创世助手1',
      wechatId,
      isFounder: true,
    });
    await founderManager.setFounder(agent1.id, wechatId);

    // 尝试创建第二个创世 Agent
    await expect(
      founderManager.setFounder('another_agent_id', wechatId)
    ).rejects.toThrow('创世 Agent 已存在');
  });
});
```

### 3.5 E2E 测试

```typescript
// tests/e2e/login-flow.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

describe('Login Flow E2E', () => {
  const testHome = '/tmp/weixin-kimi-bot-e2e-test';

  beforeAll(async () => {
    // 清理测试环境
    await cleanupTestEnvironment(testHome);
  });

  afterAll(async () => {
    await cleanupTestEnvironment(testHome);
  });

  it('should complete login and create founder agent', async () => {
    // 启动登录进程
    const loginProcess = spawn('npm', ['run', 'login', '--', '--test-mode'], {
      env: {
        ...process.env,
        WEIXIN_KIMI_BOT_HOME: testHome,
        TEST_MOCK_LOGIN: 'true',
      },
      stdio: 'pipe',
    });

    let output = '';
    loginProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    // 等待进程完成
    const exitCode = await new Promise<number>((resolve) => {
      loginProcess.on('close', resolve);
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('创世 Agent 创建成功');

    // 验证文件创建
    const fs = await import('node:fs/promises');
    const founderExists = await fs
      .access(`${testHome}/founder.json`)
      .then(() => true)
      .catch(() => false);
    expect(founderExists).toBe(true);
  }, 30000);
});
```

## 4. 测试工具与配置

### 4.1 Vitest 配置增强

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**'], // E2E 测试单独运行
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.ts',
        'scripts/',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    setupFiles: ['./tests/helpers/setup.ts'],
    deps: {
      interopDefault: true,
    },
  },
});
```

### 4.2 测试辅助函数

```typescript
// tests/helpers/setup.ts

import { vi } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { createStore } from '../../src/store.js';

const TEST_BASE_DIR = process.env.WEIXIN_KIMI_BOT_HOME || '/tmp/weixin-kimi-bot-test';

/**
 * 创建测试用的 Store
 */
export function createTestStore() {
  return createStore(`${TEST_BASE_DIR}/test-${Date.now()}`);
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(): Promise<void> {
  try {
    await rm(TEST_BASE_DIR, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

/**
 * 创建 Mock Agent 配置
 */
export function createMockAgentConfig(overrides = {}) {
  return {
    id: 'test_agent_wxid1234_abcd',
    name: 'Test Agent',
    wechatId: 'wxid_test1234',
    isFounder: false,
    ...overrides,
  };
}

/**
 * 全局测试设置
 */
beforeAll(async () => {
  await mkdir(TEST_BASE_DIR, { recursive: true });
});

afterAll(async () => {
  await cleanupTestData();
});

// 自动清理每个测试后的数据
afterEach(async () => {
  // 清理逻辑
});
```

### 4.3 Mock 工具

```typescript
// tests/helpers/mocks.ts

import { vi } from 'vitest';

/**
 * Mock ACP 客户端
 */
export function createMockACPClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue('mock-session-id'),
    prompt: vi.fn().mockResolvedValue({
      text: 'Mock response',
      toolCalls: [],
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mock iLink 客户端
 */
export function createMockILinkClient() {
  return {
    poll: vi.fn().mockResolvedValue({ msgs: [] }),
    sendText: vi.fn().mockResolvedValue(undefined),
    sendTextChunked: vi.fn().mockResolvedValue(1),
    sendTyping: vi.fn().mockResolvedValue(undefined),
    cursor: '',
  };
}

/**
 * Mock 微信消息
 */
export function createMockWeixinMessage(overrides = {}) {
  return {
    id: `msg_${Date.now()}`,
    from_user_id: 'wxid_test1234',
    message_type: 'user',
    item_list: [{
      type: 'text',
      text_item: { text: 'Hello' },
    }],
    context_token: 'mock-token',
    ...overrides,
  };
}
```

## 5. 性能测试

```typescript
// tests/performance/agent-creation.perf.ts

import { describe, it, expect } from 'vitest';
import { AgentManager } from '../../src/agent/manager.js';
import { createTestStore } from '../helpers/setup.js';

describe('Agent Creation Performance', () => {
  it('should create 100 agents within 5 seconds', async () => {
    const store = createTestStore();
    const manager = new AgentManager(store);

    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await manager.createAgent({
        name: `Agent ${i}`,
        wechatId: `wxid_test${i.toString().padStart(4, '0')}`,
      });
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  it('should list 1000 agents within 1 second', async () => {
    const store = createTestStore();
    const manager = new AgentManager(store);

    // 创建 1000 个 Agent
    for (let i = 0; i < 1000; i++) {
      await manager.createAgent({
        name: `Agent ${i}`,
        wechatId: `wxid_test${i.toString().padStart(4, '0')}`,
      });
    }

    const start = Date.now();
    const agents = await manager.listAgents();
    const duration = Date.now() - start;

    expect(agents.length).toBe(1000);
    expect(duration).toBeLessThan(1000);
  });
});
```

## 6. 命令参考

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行性能测试
npm run test:perf

# 生成覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch

# 特定文件测试
npm test -- tests/unit/agent/manager.test.ts

# 特定测试
npm test -- -t "should create agent"
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
