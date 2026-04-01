# 全局技能系统

全局技能系统允许将常用技能（如搜索、分析等）定义为系统级技能，所有 Agent 都可以安装和使用。

## 概述

- **系统技能目录**: `~/.weixin-kimi-bot/skills/`
- **技能定义**: 每个技能包含 `SKILL.md` 和可执行脚本
- **Agent 技能**: 每个 Agent 可以独立安装、启用/禁用系统技能

## 系统技能列表

### searxng-search

- **ID**: `searxng-search`
- **类别**: 🔍 搜索
- **描述**: 使用本地 SearXNG 实例进行网络搜索
- **默认 URL**: `http://127.0.0.1:17890`
- **环境变量**: `SEARXNG_URL`（可覆盖默认 URL）

## 使用命令管理技能

### 列出可用技能
```
/skill list
```

### 查看已安装的技能
```
/skill installed
```

### 安装技能
```
/skill install searxng-search
```

### 卸载技能
```
/skill uninstall searxng-search
```

### 启用/禁用技能
```
/skill enable searxng-search
/skill disable searxng-search
```

### 查看技能详情
```
/skill info searxng-search
```

## 创建自定义技能

### 技能目录结构
```
~/.weixin-kimi-bot/skills/
└── your-skill/
    ├── SKILL.md
    └── scripts/
        └── your_script.py
```

### SKILL.md 格式
```yaml
---
name: your-skill-name
description: 技能的简要描述
version: 1.0.0
category: utility
tags: [tag1, tag2]
---

# 技能名称

## 配置

- **参数1**: 说明
- **参数2**: 说明

## 使用

```bash
python .agents/skills/your-skill/scripts/your_script.py <参数>
```
```

### 脚本要求

1. 脚本需要能够接受命令行参数
2. 返回 JSON 格式结果（推荐）
3. 处理错误并返回非零退出码

### 示例 Python 脚本

```python
#!/usr/bin/env python3
import argparse
import json
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="查询参数")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    
    try:
        # 执行业务逻辑
        result = process_query(args.query, args.limit)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

def process_query(query, limit):
    # 实现逻辑
    return {"results": []}

if __name__ == "__main__":
    sys.exit(main())
```

## 自动安装

新创建的 Agent 会自动安装所有系统技能（默认启用）。你也可以手动为新 Agent 安装技能：

```typescript
import { installSystemSkillsForAgent } from './skills/system-skills.js';

await installSystemSkillsForAgent(skillManager, agentId, true);
```

## API 使用

```typescript
import { createSkillManager } from './skills/manager.js';

const manager = createSkillManager(store);

// 列出系统技能
const skills = await manager.listSkills();

// 为 Agent 安装技能
await manager.installSkill({
  skillId: 'searxng-search',
  agentId: 'agent-id',
  enabled: true,
});

// 执行技能
const result = await manager.executeSkill({
  skillId: 'searxng-search',
  agentId: 'agent-id',
  input: { query: '搜索关键词' },
});
```

## 技能类别

- `search` - 🔍 搜索类
- `analysis` - 📊 分析类
- `generation` - ✨ 生成类
- `utility` - 🛠️ 工具类
- `integration` - 🔗 集成类
- `custom` - 📝 自定义
