# TDD 开发快速参考卡片

## 🔴 红-绿-重构循环

```
1. 写测试 → 2. 运行测试(红) → 3. 写实现 → 4. 运行测试(绿) → 5. 重构 → 重复
```

## 测试结构模板

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('模块名', () => {
  // 测试数据准备
  const testData = {
    valid: { /* 有效数据 */ },
    invalid: { /* 无效数据 */ },
  };

  beforeEach(() => {
    // 每个测试前的准备
  });

  afterEach(() => {
    // 每个测试后的清理
    vi.clearAllMocks();
  });

  describe('功能组', () => {
    it('应该[期望行为]', async () => {
      // Given (Arrange)
      const input = testData.valid;
      
      // When (Act)
      const result = await functionToTest(input);
      
      // Then (Assert)
      expect(result).toBe(expectedValue);
    });

    it('应该在[条件]时抛出错误', async () => {
      await expect(functionToTest(invalidInput))
        .rejects.toThrow('期望的错误信息');
    });
  });
});
```

## 常用断言速查

```typescript
// 相等性
expect(value).toBe(exactValue);           // 严格相等 ===
expect(value).toEqual(object);            // 深度相等
expect(value).toStrictEqual(object);      // 严格深度相等

// 真值判断
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// 数字
expect(value).toBeGreaterThan(10);
expect(value).toBeGreaterThanOrEqual(10);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(0.3, 1);        // 浮点数比较

// 字符串
expect(string).toContain('substring');
expect(string).toMatch(/regex/);
expect(string).toHaveLength(5);

// 数组
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(array).toContainEqual(object);
expect(array).toEqual(expect.arrayContaining([1, 2]));

// 对象
expect(object).toHaveProperty('key');
expect(object).toHaveProperty('key', value);
expect(object).toMatchObject({ partial: 'data' });

// 异常
expect(fn).toThrow();
expect(fn).toThrow('message');
expect(fn).toThrow(Error);
await expect(promise).rejects.toThrow();
await expect(promise).resolves.toBe(value);

// Mock
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg1);
```

## Mock 速查

```typescript
import { vi } from 'vitest';

// Mock 模块
vi.mock('../src/path/module.js', () => ({
  functionName: vi.fn(() => 'mocked value'),
  constant: 123,
}));

// Mock 函数
const mockFn = vi.fn();
const mockFn = vi.fn(() => 'return value');
const mockFn = vi.fn().mockResolvedValue('async value');
const mockFn = vi.fn().mockRejectedValue(new Error('error'));

// Mock 实现
mockFn.mockImplementation(() => 'new implementation');
mockFn.mockImplementationOnce(() => 'once');
mockFn.mockReturnValue('value');
mockFn.mockReturnValueOnce('once');
mockFn.mockResolvedValue('resolved');
mockFn.mockRejectedValue(new Error('rejected'));

// Mock 间谍
const spy = vi.spyOn(object, 'method');
spy.mockReturnValue('mocked');

// 重置 Mock
mockFn.mockClear();       // 清除调用记录
mockFn.mockReset();       // 清除并恢复实现
mockFn.mockRestore();     // 恢复原始实现 (仅 spy)
vi.clearAllMocks();
vi.resetAllMocks();
vi.restoreAllMocks();
```

## 异步测试

```typescript
// async/await
it('应该异步完成', async () => {
  const result = await asyncFunction();
  expect(result).toBe('done');
});

// Promise
it('应该返回 Promise', () => {
  return asyncFunction().then(result => {
    expect(result).toBe('done');
  });
});

// 超时等待
it('应该最终完成', async () => {
  await vi.waitFor(() => {
    expect(checkCondition()).toBe(true);
  }, { timeout: 5000 });
});

// 并发
it('应该并发执行', async () => {
  const results = await Promise.all([
    async1(),
    async2(),
  ]);
  expect(results).toHaveLength(2);
});
```

## 数据驱动测试

```typescript
const testCases = [
  { input: 1, expected: 'one' },
  { input: 2, expected: 'two' },
  { input: 3, expected: 'three' },
];

testCases.forEach(({ input, expected }) => {
  it(`应该将 ${input} 转换为 ${expected}`, () => {
    expect(convert(input)).toBe(expected);
  });
});
```

## 文件系统测试

```typescript
import { tmpdir } from 'os';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

// 创建临时目录
const testDir = mkdtempSync(join(tmpdir(), 'test-'));

// 写文件
writeFileSync(join(testDir, 'file.txt'), 'content');

// 清理
afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});
```

## 开发检查清单

### 开始新功能前
- [ ] 理解需求并拆解为最小功能点
- [ ] 确定测试范围和边界条件
- [ ] 创建测试文件

### 红阶段
- [ ] 编写失败的测试
- [ ] 运行测试确认失败
- [ ] 检查失败信息是否清晰

### 绿阶段
- [ ] 编写最简单的通过代码
- [ ] 运行测试确认通过
- [ ] 检查是否过度设计

### 重构阶段
- [ ] 消除重复代码
- [ ] 改善命名
- [ ] 检查代码异味
- [ ] 运行测试确保通过

### 提交前
- [ ] 所有测试通过
- [ ] 代码覆盖率达标
- [ ] 无 TypeScript 错误
- [ ] 代码已自审

## 常见测试模式

### 状态机测试
```typescript
describe('状态转移', () => {
  const transitions = [
    { from: State.A, event: Event.X, to: State.B },
    { from: State.B, event: Event.Y, to: State.C },
  ];

  transitions.forEach(({ from, event, to }) => {
    it(`${from} + ${event} → ${to}`, () => {
      const result = stateMachine.transition(from, event);
      expect(result.state).toBe(to);
    });
  });
});
```

### 边界值测试
```typescript
describe('边界值', () => {
  it('应该处理空输入', () => {});
  it('应该处理最小值', () => {});
  it('应该处理最大值', () => {});
  it('应该处理超长输入', () => {});
  it('应该处理特殊字符', () => {});
});
```

### 异常路径测试
```typescript
describe('异常处理', () => {
  it('应该在网络错误时重试', async () => {});
  it('应该在超时后失败', async () => {});
  it('应该在数据无效时抛出 ValidationError', () => {});
  it('应该在权限不足时抛出 AuthError', () => {});
});
```

## 运行测试命令

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# 特定文件
npm test -- tests/agent/manager.test.ts

# 特定测试
npm test -- -t "应该使用默认配置"

# 失败时停止
npm test -- --bail

# 并行运行
npm test -- --parallel

# UI 模式
npm run test:ui
```

## 覆盖率阈值

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

## 错误处理检查清单

- [ ] 所有异步操作有 try-catch
- [ ] 错误信息对用户友好
- [ ] 敏感信息不暴露
- [ ] 错误被正确记录
- [ ] 资源在错误时释放

## 性能测试提示

```typescript
// 基准测试
it('应该在 100ms 内完成', async () => {
  const start = performance.now();
  await operation();
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(100);
});

// 内存泄漏检查
it('不应该泄漏内存', async () => {
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 1000; i++) {
    await operation();
  }
  global.gc && global.gc(); // 强制垃圾回收
  const after = process.memoryUsage().heapUsed;
  expect(after - before).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

---

**核心原则：测试先行，小步快跑，持续重构！**
