# 现代 JavaScript/TypeScript 编程规范

## 核心理念

> **优先使用函数，其次使用类；优先使用组合，其次使用继承；优先使用不可变数据，其次使用可变状态。**

---

## 一、函数优先原则

### 1.1 使用纯函数替代类

❌ **禁止**：无状态类仅用于组织函数
```typescript
// 反模式 - 无状态类
class CapabilityDiscovery {
  async scanProject(path: string) { }
  generateSchema(cmd: string) { }
}
```

✅ **推荐**：纯函数 + 命名空间
```typescript
// 现代做法
export async function scanProject(path: string, options?: ScanOptions) { }
export function generateSchema(cmd: string) { }

// 需要组织时用命名空间
export * as CapabilityDiscovery from './capability-discovery.js';
```

### 1.2 使用工厂函数替代构造函数

❌ **禁止**：new Class() 创建实例
```typescript
const registry = new CapabilityRegistry(config);
```

✅ **推荐**：工厂函数
```typescript
const registry = createCapabilityRegistry(config);
```

---

## 二、依赖注入原则

### 2.1 禁止单例模式

❌ **禁止**：全局可变状态
```typescript
class XxxManager {
  private static instance: XxxManager;
  static getInstance() { return this.instance; }
}
```

✅ **推荐**：显式依赖注入
```typescript
// 使用函数闭包创建上下文
export function createXxxManager(config: Config) {
  const state = createInitialState();
  return { query, register, update };
}

// 或使用 DI 容器
const container = createContainer();
container.register('registry', createCapabilityRegistry(config));
```

### 2.2 依赖显式声明

❌ **禁止**：隐式全局依赖
```typescript
function processTask(task: Task) {
  const registry = CapabilityRegistry.getInstance(); // 隐式依赖
}
```

✅ **推荐**：参数注入
```typescript
function processTask(task: Task, deps: { registry: CapabilityRegistry }) {
  // 依赖显式
}
```

---

## 三、错误处理规范

### 3.1 使用 Result 类型替代抛出异常

❌ **禁止**：随意抛出异常
```typescript
function parseConfig(json: string): Config {
  if (!json) throw new Error('Invalid JSON');
  return JSON.parse(json);
}
```

✅ **推荐**：Result 类型
```typescript
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseConfig(json: string): Result<Config, ParseError> {
  if (!json) return { ok: false, error: new ParseError('Empty JSON') };
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, error: new ParseError('Invalid JSON', e) };
  }
}

// 使用
const result = parseConfig(json);
if (!result.ok) {
  handleError(result.error);
  return;
}
useConfig(result.value);
```

### 3.2 禁止空 catch 块

❌ **禁止**：静默吞错
```typescript
try {
  await process();
} catch {
  return null;  // 错误信息丢失！
}
```

✅ **推荐**：具体处理或转换
```typescript
try {
  await process();
} catch (error) {
  if (error instanceof FileNotFoundError) {
    return { ok: false, error: new NotFoundError('Config file missing') };
  }
  throw error; // 不处理的错误继续抛出
}
```

---

## 四、数据不可变性

### 4.1 禁止可变状态

❌ **禁止**：内部可变 Map/Array
```typescript
class Registry {
  private items = new Map<string, Item>();
  
  add(item: Item) {
    this.items.set(item.id, item);  // 副作用
  }
}
```

✅ **推荐**：返回新状态
```typescript
function addItem(
  registry: ReadonlyMap<string, Item>,
  item: Item
): ReadonlyMap<string, Item> {
  return new Map([...registry, [item.id, item]]);
}

// 或使用 Immer
import { produce } from 'immer';

const newRegistry = produce(registry, draft => {
  draft.set(item.id, item);
});
```

### 4.2 使用 Readonly 修饰

✅ **推荐**：所有返回数据加 Readonly
```typescript
function getConfig(): Readonly<Config> { }
function listItems(): ReadonlyArray<Item> { }
```

---

## 五、声明式编程

### 5.1 使用高阶函数替代循环

❌ **禁止**：命令式循环（除非性能关键）
```typescript
const results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].active) {
    results.push(items[i]);
  }
}
```

✅ **推荐**：声明式
```typescript
const results = items.filter(item => item.active);
```

### 5.2 使用 Async/Await 替代回调

❌ **禁止**：回调模式
```typescript
setCallbacks({ onProgress, onComplete });
```

✅ **推荐**：Async Iterator 或 Event Emitter
```typescript
// Async Iterator
for await (const event of task.events()) {
  if (event.type === 'progress') updateUI(event.data);
}

// 或 Event Emitter
const emitter = createTaskEmitter();
emitter.on('progress', updateUI);
```

---

## 六、类型安全

### 6.1 禁止裸的类型断言

❌ **禁止**：as 类型断言
```typescript
const data = JSON.parse(json) as Config;
```

✅ **推荐**：运行时验证（Zod）
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  name: z.string(),
  port: z.number().default(3000),
});

type Config = z.infer<typeof ConfigSchema>;

const result = ConfigSchema.safeParse(JSON.parse(json));
if (!result.success) {
  return { ok: false, error: result.error };
}
return { ok: true, value: result.data };
```

### 6.2 禁止 any 类型

❌ **禁止**：any
```typescript
function process(data: any) { }
```

✅ **推荐**：unknown + 类型守卫
```typescript
function process(data: unknown) {
  if (isValidInput(data)) {
    // data 被收窄为 ValidInput 类型
  }
}
```

---

## 七、配置管理

### 7.1 消除魔法值

❌ **禁止**：散布的魔法值
```typescript
maxDuration: 300000  // 什么单位？
```

✅ **推荐**：集中配置
```typescript
// config/durations.ts
export const DURATION = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
} as const;

maxDuration: 5 * DURATION.minute;
```

---

## 八、文件组织

### 8.1 单一职责

每个文件应只包含：
- 类型定义（types.ts）
- 纯函数逻辑（operations.ts）
- 副作用封装（effects.ts）

### 8.2 避免默认导出

❌ **禁止**：
```typescript
export default class Manager { }
```

✅ **推荐**：命名导出
```typescript
export { createManager, type Manager };
```

---

## 九、测试规范

### 9.1 纯函数易测试

纯函数只需测试输入输出：
```typescript
// 易于测试 - 无副作用
test('calculateTotal', () => {
  expect(calculateTotal([1, 2, 3])).toBe(6);
});
```

### 9.2 使用依赖注入测试

```typescript
test('process with mock registry', () => {
  const mockRegistry = createMockRegistry();
  const result = processTask(task, { registry: mockRegistry });
  expect(result.ok).toBe(true);
});
```

---

## 十、重构检查清单

重构代码前检查：

- [ ] 是否可用纯函数替代类？
- [ ] 依赖是否显式声明？
- [ ] 错误处理是否使用 Result 类型？
- [ ] 是否有空 catch 块？
- [ ] 数据是否不可变？
- [ ] 循环是否可用高阶函数替代？
- [ ] 类型断言是否有运行时验证？
- [ ] 是否有魔法值需要提取？

---

## 参考资源

- [Functional-Light JavaScript](https://github.com/getify/Functional-Light-JS)
- [Total TypeScript](https://www.totaltypescript.com/)
- [Zod Documentation](https://zod.dev/)
- [Immer Documentation](https://immerjs.github.io/immer/)
