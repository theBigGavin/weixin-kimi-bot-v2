# 现代 JavaScript 重构路线图

## 概述

本路线图分3个阶段将代码库从面向对象/命令式风格迁移到现代函数式风格。

---

## 当前问题统计

| 反模式 | 数量 | 影响文件 |
|--------|------|----------|
| 过度使用 Class | 19个Manager/Registry/Engine | 19个文件 |
| 单例模式 | 2处 | capability-registry, scheduler |
| 空 catch 块 | 30+处 | 多个文件 |
| 可变状态 | 15+处 | 多个文件 |
| 回调模式 | 2处 | longtask, flowtask |
| 命令式循环 | 20+处 | 多个文件 |

---

## Phase 1: 核心架构重构（优先级：P0）

**目标**：函数式改造、移除单例、引入 Result 类型

**预计影响**：约20个文件，400行代码变更

### 1.1 将类转换为工厂函数

**文件列表**：
- `src/projectspace/capability-discovery.ts` → 纯函数
- `src/projectspace/bootstrap.ts` → 工厂函数
- `src/projectspace/templates/engine.ts` → 工厂函数
- `src/projectspace/share.ts` → 工厂函数

**重构示例**：
```typescript
// Before
class CapabilityDiscovery {
  async scanProject(path: string) { }
}

// After
export async function scanProject(path: string, options?: ScanOptions) { }
export function createCapabilityScanner(config: Config) {
  return { scanProject, generateSchema };
}
```

**测试策略**：
- 保留原有测试作为回归测试
- 添加新工厂函数的单元测试
- 验证功能等价性

### 1.2 移除单例模式

**文件列表**：
- `src/task-router/protocol/capability-registry.ts`
- `src/scheduler/manager.ts`

**重构示例**：
```typescript
// Before
class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  static getInstance() { return this.instance; }
}

// After
export function createCapabilityRegistry(config: RegistryConfig) {
  const capabilities = new Map<string, Capability>();
  return { register, get, query };
}
```

### 1.3 引入 Result 类型

**文件列表**：
- `src/store.ts` - load/save 操作
- `src/config/session.ts` - 配置解析
- `src/context/persistence.ts` - 持久化操作

**重构示例**：
```typescript
// Before
function loadConfig(): Config | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// After
function loadConfig(): Result<Config, ParseError> {
  return tryCatch(
    () => ConfigSchema.parse(JSON.parse(content)),
    e => new ParseError('Failed to load config', e)
  );
}
```

### Phase 1 完成标准
- [ ] 所有单例模式移除
- [ ] 核心类转为工厂函数
- [ ] 新增 Result 类型用于错误处理
- [ ] 所有测试通过
- [ ] 性能无回归

---

## Phase 2: 质量提升（优先级：P1）

**目标**：错误处理规范化、不可变数据、Schema 验证

**预计影响**：约15个文件，300行代码变更

### 2.1 规范化错误处理

**消除空 catch 块**：
```typescript
// Before
try {
  await process();
} catch {
  return null;
}

// After
try {
  await process();
} catch (error) {
  if (error instanceof FileNotFoundError) {
    return { ok: false, error: new NotFoundError('File not found') };
  }
  throw error; // 不处理的错误继续抛出
}
```

### 2.2 不可变数据

**添加 Readonly 修饰**：
```typescript
// Before
function getConfig(): Config { }

// After
function getConfig(): Readonly<Config> { }
function updateConfig(config: Config): Readonly<Config> { }
```

### 2.3 引入 Schema 验证（Zod）

**配置解析**：
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
});

type Config = z.infer<typeof ConfigSchema>;
```

### Phase 2 完成标准
- [ ] 所有空 catch 块消除
- [ ] 核心数据类型添加 Readonly
- [ ] 引入 Zod Schema 验证
- [ ] 新增类型安全测试

---

## Phase 3: 代码风格优化（优先级：P2）

**目标**：声明式编程、消除魔法值

**预计影响**：约10个文件，200行代码变更

### 3.1 声明式重构

**高阶函数替代循环**：
```typescript
// Before
const results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].active) {
    results.push(items[i]);
  }
}

// After
const results = items.filter(item => item.active);
```

### 3.2 配置集中管理

**消除魔法值**：
```typescript
// config/constants.ts
export const DURATION = {
  second: 1000,
  minute: 60 * 1000,
  hour: 3600000,
} as const;

export const DEFAULTS = {
  port: 3000,
  maxRetries: 3,
} as const;
```

### Phase 3 完成标准
- [ ] 命令式循环转为声明式
- [ ] 所有魔法值提取到配置
- [ ] 代码风格一致性检查通过

---

## 测试策略

### TDD 流程

每个重构任务遵循：
1. **红**：编写新API的测试（基于工厂函数/Result类型）
2. **绿**：实现新API
3. **重构**：逐步替换旧实现
4. **验证**：确保原有测试仍然通过

### 测试覆盖要求

| 阶段 | 新增测试 | 回归测试 |
|------|----------|----------|
| Phase 1 | 工厂函数测试（40+） | 全部原有测试 |
| Phase 2 | Result类型集成（30+） | 全部原有测试 |
| Phase 3 | 配置/工具测试（20+） | 全部原有测试 |

---

## 时间规划

| 阶段 | 预计工期 | 负责人 |
|------|----------|--------|
| Phase 1 | 2-3天 | Agent |
| Phase 2 | 2天 | Agent |
| Phase 3 | 1天 | Agent |
| 总计 | 5-6天 | - |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构引入bug | 高 | 100%测试覆盖，小步提交 |
| 性能回归 | 中 | 基准测试对比 |
| 代码审查困难 | 中 | 分阶段PR，详细说明 |
| 团队适应成本 | 低 | 提供培训文档 |

---

## 成功指标

- [ ] 类数量减少50%（19→10）
- [ ] 单例模式数量减少100%（2→0）
- [ ] 空 catch 块减少100%（30+→0）
- [ ] 测试覆盖率保持≥80%
- [ ] 代码复杂度（cyclomatic）降低20%
- [ ] 新代码符合 Modern JS Guidelines

---

## 参考文档

- [Modern JS Guidelines](./MODERN_JS_GUIDELINES.md)
- [Functional-Light JavaScript](https://github.com/getify/Functional-Light-JS)
- [Refactoring Guru](https://refactoring.guru/)
