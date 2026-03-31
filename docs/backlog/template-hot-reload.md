# 特性提案：模板提示词热重载（Hot Reload）

## 状态
- **优先级**: P2（备选特性）
- **状态**: 待排期
- **标签**: enhancement, developer-experience, templates

## 问题描述

当前模板提示词（system prompt）在应用启动时加载并缓存：

```typescript
// src/templates/definitions.ts
export const BUILTIN_TEMPLATES: CapabilityTemplate[] = loadBuiltinTemplates();
```

这意味着：
- 修改提示词后需要重启整个应用才能生效
- 开发/调试提示词时迭代效率低
- 生产环境无法动态调整提示词

## 目标

实现模板提示词的**热重载能力**，允许在不重启服务的情况下更新提示词。

## 使用场景

1. **开发调试**：调整提示词后即时查看效果
2. **A/B 测试**：动态切换不同版本的提示词
3. **运营配置**：根据活动/季节调整助手人设
4. **紧急修复**：生产环境快速修复提示词问题

## 提案方案

### 方案 A：文件监听自动重载（推荐）

使用 Node.js `fs.watch` 监听提示词文件变化：

```typescript
// src/templates/loader.ts
import { watch } from 'fs/promises';

export function startTemplateWatcher(
  onReload: (templates: CapabilityTemplate[]) => void
): () => void {
  const watcher = watch(TEMPLATES_DIR, { recursive: true });
  
  (async () => {
    for await (const event of watcher) {
      if (event.filename?.endsWith('.md')) {
        console.log('[Templates] Detected change:', event.filename);
        const templates = reloadTemplates();
        onReload(templates);
      }
    }
  })();
  
  // 返回取消监听函数
  return () => watcher.close();
}
```

**优点**：
- 全自动，无需人工干预
- 开发体验最佳

**缺点**：
- 生产环境可能需要控制（避免误操作）
- 频繁修改可能触发多次重载

### 方案 B：Signal/命令触发重载

通过 Unix signal 或管理命令触发：

```typescript
// 方式1: Unix Signal
process.on('SIGUSR2', () => {
  console.log('[Templates] Reloading via SIGUSR2...');
  reloadTemplates();
});

// 方式2: CLI 命令
// npm run reload-templates
```

**优点**：
- 精确控制重载时机
- 适合生产环境

**缺点**：
- 需要手动触发

### 方案 C：Admin API 端点

提供 HTTP 接口供管理面板调用：

```typescript
// POST /api/admin/templates/reload
app.post('/api/admin/templates/reload', (req, res) => {
  reloadTemplates();
  res.json({ success: true, count: BUILTIN_TEMPLATES.length });
});
```

**优点**：
- 可集成到 Web 管理后台
- 可添加权限控制

**缺点**：
- 需要额外的接口和认证

## 建议实现

**Phase 1（MVP）**：方案 A + 开发模式开关

```typescript
// src/index.ts
if (process.env.NODE_ENV === 'development') {
  startTemplateWatcher((templates) => {
    // 更新全局模板缓存
    updateBuiltinTemplates(templates);
    console.log(`[Templates] Hot reloaded ${templates.length} templates`);
  });
}
```

**Phase 2（增强）**：添加方案 C 的 Admin API

## 影响范围

### 需要修改的文件
1. `src/templates/loader.ts` - 添加 watcher 和 reload 逻辑
2. `src/templates/definitions.ts` - 支持可变模板存储
3. `src/index.ts` - 启动时初始化 watcher

### 兼容性
- 向后兼容：现有 API 不变
- 性能影响：仅开发环境启用文件监听，生产环境可关闭

## 参考实现

类似功能在以下项目中有参考：
- **Nodemon**: 文件监听重启
- **Vite**: HMR (Hot Module Replacement)
- **PM2**: `pm2 reload` 信号处理

## 相关 Issue/PR

- 初始提示词重构: #phase-6

## 备注

- 提示词热重载只影响**新创建的会话**，已有会话继续使用旧提示词（这是合理的行为）
- 考虑添加版本号或时间戳标识当前加载的提示词版本
- 重载失败时保留旧版本，避免服务中断
