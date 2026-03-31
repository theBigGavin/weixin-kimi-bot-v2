# TDD 开发指南

本文档介绍在 weixin-kimi-bot 项目中使用 TDD（测试驱动开发）的最佳实践。

## 🎯 TDD 核心理念

> "测试先行，代码随后"

TDD 遵循 **红-绿-重构** 循环：

```
编写测试 → 运行测试（红）→ 编写代码（绿）→ 重构 → 重复
```

## 🔄 开发循环

### 1. 🔴 红阶段 - 编写失败的测试

```typescript
// tests/unit/calculator.test.ts
import { describe, it, expect } from 'vitest';
import { Calculator } from '../src/calculator';

describe('Calculator', () => {
  describe('add', () => {
    it('should add two numbers', () => {
      // Given
      const calc = new Calculator();
      
      // When
      const result = calc.add(2, 3);
      
      // Then
      expect(result).toBe(5);
    });
  });
});
```

运行测试确认失败：

```bash
npm test -- tests/unit/calculator.test.ts
# FAIL: Cannot find module
```

### 2. 🟢 绿阶段 - 编写最简单的代码

```typescript
// src/calculator.ts
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
```

### 3. 🔵 重构阶段 - 优化代码

在测试保护下改进代码结构和可读性。

## 📝 测试规范

### 测试文件组织

```
src/agent/manager.ts           → tests/unit/agent/manager.test.ts
src/context/state-machine.ts   → tests/unit/context/state-machine.test.ts
```

### Given-When-Then 结构

```typescript
describe('AgentManager', () => {
  describe('createAgent', () => {
    it('should use default config', async () => {
      // Given
      const wechatId = 'wxid_test123';
      
      // When
      const agent = await manager.createAgent(wechatId);
      
      // Then
      expect(agent.wechat.accountId).toBe(wechatId);
    });
  });
});
```

## 📊 覆盖率要求

| 层级 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 |
|------|----------|------------|------------|
| 单元测试 | >=80% | >=80% | >=75% |
| 集成测试 | >=60% | >=60% | >=50% |
| **整体** | **>=80%** | **>=80%** | **>=75%** |

## 🚨 TDD 禁止行为

- 禁止先写实现再补测试
- 禁止不验证测试失败就写实现
- 禁止提交未通过的测试
- 禁止覆盖率低于阈值提交

## ✅ TDD 检查清单

```markdown
□ 新功能是否先写测试（红阶段验证失败）
□ 测试文件路径是否正确
□ 新增模块覆盖率是否 >80%
□ 错误处理是否有对应测试用例
□ 所有测试是否通过
```
