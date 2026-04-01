/**
 * 系统技能管理
 * 
 * 初始化和管理系统级技能
 */

import { mkdir, cp, access } from 'fs/promises';
import { resolve, join } from 'path';
import { Store } from '../store.js';
import { SkillManager, createSkillManager } from './manager.js';
import { Result, ok, err } from '../types/result.js';
import { getDefaultLogger, createAgentLogger } from '../logging/index.js';

// ============================================================================
// 配置
// ============================================================================

/** 系统技能目录 */
export function getSystemSkillsDir(): string {
  return resolve(process.env.HOME || '', '.weixin-kimi-bot', 'skills');
}

/** 内置技能列表 */
export const BUILTIN_SKILLS = [
  {
    id: 'searxng-search',
    name: 'SearXNG Search',
    description: 'Search the web using a local SearXNG instance. Use when the user needs to search for information on the internet, find current events, look up facts, or gather information from web sources.',
    category: 'search' as const,
    source: 'builtin',
  },
];

// ============================================================================
// 初始化
// ============================================================================

/**
 * 初始化系统技能
 * 
 * 1. 创建系统技能目录
 * 2. 复制内置技能到系统目录
 * 3. 注册技能到管理器
 */
export async function initializeSystemSkills(
  store: Store
): Promise<Result<SkillManager, Error>> {
  const skillsDir = getSystemSkillsDir();

  try {
    // 1. 创建目录
    await mkdir(skillsDir, { recursive: true });

    // 2. 初始化内置技能
    for (const builtin of BUILTIN_SKILLS) {
      await initializeBuiltinSkill(builtin.id, skillsDir);
    }

    // 3. 创建管理器并加载技能
    const manager = createSkillManager(store);
    await loadSystemSkillsIntoManager(manager, skillsDir);

    return ok(manager);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 初始化单个内置技能
 */
async function initializeBuiltinSkill(
  skillId: string,
  skillsDir: string
): Promise<void> {
  const skillPath = join(skillsDir, skillId);

  // 检查是否已存在
  try {
    await access(skillPath);
    return; // 已存在，跳过
  } catch {
    // 不存在，继续初始化
  }

  // 查找源文件
  const possibleSources = [
    // 从创始者 Agent 复制
    resolve(process.env.HOME || '', '.weixin-kimi-bot', 'agents', '创始者_6265403e_i5dq', '.agents', 'skills', skillId),
    // 从项目模板复制
    resolve(process.cwd(), 'templates', 'skills', skillId),
    // 从内置资源复制
    resolve(__dirname, '..', '..', 'resources', 'skills', skillId),
  ];

  for (const source of possibleSources) {
    try {
      await access(source);
      // 复制到系统目录
      await mkdir(skillPath, { recursive: true });
      await cp(source, skillPath, { recursive: true });
      return;
    } catch {
      continue;
    }
  }

  // 如果找不到源文件，创建默认的 searxng-search 技能
  if (skillId === 'searxng-search') {
    await createDefaultSearxngSkill(skillPath);
  }
}

/**
 * 加载系统技能到管理器
 */
async function loadSystemSkillsIntoManager(
  manager: SkillManager,
  skillsDir: string
): Promise<void> {
  const { readdir } = await import('fs/promises');

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const skillId of skillDirs) {
      const skillPath = join(skillsDir, skillId);
      const result = await manager.loadSkillFromDirectory(skillPath);
      
      if (!result.ok) {
        getDefaultLogger().warn(`[Skills] Failed to load skill '${skillId}': ${result.error.message}`);
      } else {
        getDefaultLogger().info(`[Skills] Loaded system skill: ${skillId}`);
      }
    }
  } catch (error) {
    getDefaultLogger().warn('[Skills] Failed to load system skills:', error);
  }
}

// ============================================================================
// 默认技能创建
// ============================================================================

/**
 * 创建默认的 SearXNG 搜索技能
 */
async function createDefaultSearxngSkill(skillPath: string): Promise<void> {
  await mkdir(skillPath, { recursive: true });
  await mkdir(join(skillPath, 'scripts'), { recursive: true });

  // 创建 SKILL.md
  const skillMd = `---
name: searxng-search
description: Search the web using a local SearXNG instance running at 127.0.0.1:17890. Use when the user needs to search for information on the internet, find current events, look up facts, or gather information from web sources.
version: 1.0.0
category: search
tags: [search, web, internet]
---

# SearXNG Search

This skill provides web search capability using a local SearXNG instance.

## Configuration

- **Default URL**: \`http://127.0.0.1:17890\`
- **Override URL**: Set \`SEARXNG_URL\` environment variable

## Usage

### Method 1: Use the Python script (Recommended)

\`\`\`bash
# Search with text output
python .agents/skills/searxng-search/scripts/searxng_search.py "your search query"

# Search with JSON output
python .agents/skills/searxng-search/scripts/searxng_search.py "query" --format json

# Limit results
python .agents/skills/searxng-search/scripts/searxng_search.py "query" --limit 5
\`\`\`

### Method 2: Direct API call

See the Python script for implementation details.

## Response Format

The SearXNG API returns JSON with these key fields:

- \`results\`: List of search results
- \`query\`: The search query
- \`number_of_results\`: Total result count
`;

  await import('fs/promises').then(fs => fs.writeFile(join(skillPath, 'SKILL.md'), skillMd));

  // 创建默认的 Python 脚本（简化版）
  const pythonScript = `#!/usr/bin/env python3
"""SearXNG Search Script"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

def search(query, base_url="http://127.0.0.1:17890", limit=10):
    params = {"q": query, "format": "json", "language": "zh-CN"}
    url = f"{base_url}/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    if "results" in data:
        data["results"] = data["results"][:limit]
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="Search query")
    parser.add_argument("--limit", "-l", type=int, default=10)
    parser.add_argument("--format", "-f", choices=["json", "text"], default="text")
    parser.add_argument("--url", "-u", default=os.getenv("SEARXNG_URL", "http://127.0.0.1:17890"))
    args = parser.parse_args()
    
    try:
        data = search(args.query, base_url=args.url, limit=args.limit)
        print(json.dumps(data, ensure_ascii=False, indent=2) if args.format == "json" else format_text(data))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def format_text(data):
    lines = [f"Found {len(data.get('results', []))} results:\\n"]
    for i, r in enumerate(data.get("results", []), 1):
        lines.append(f"[{i}] {r.get('title', 'N/A')}")
        lines.append(f"    URL: {r.get('url', '')}")
        if r.get('content'):
            content = r['content'][:200] + "..." if len(r['content']) > 200 else r['content']
            lines.append(f"    {content}")
        lines.append("")
    return "\\n".join(lines)

if __name__ == "__main__":
    main()
`;

  await import('fs/promises').then(fs =>
    fs.writeFile(join(skillPath, 'scripts', 'searxng_search.py'), pythonScript)
  );
}

// ============================================================================
// Agent 技能同步
// ============================================================================

/**
 * 为 Agent 安装所有系统技能
 */
export async function installSystemSkillsForAgent(
  manager: SkillManager,
  agentId: string,
  enabledByDefault = true
): Promise<void> {
  const skills = await manager.listSkills();

  for (const skill of skills) {
    const result = await manager.installSkill({
      skillId: skill.id,
      agentId,
      enabled: enabledByDefault,
    });

    if (!result.ok) {
      createAgentLogger(agentId).warn(`[Skills] Failed to install skill '${skill.id}': ${result.error.message}`);
    }
  }

  createAgentLogger(agentId).info(`[Skills] Installed ${skills.length} system skills`);
}
