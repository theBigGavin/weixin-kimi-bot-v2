/**
 * 技能清单解析器
 * 
 * 解析 SKILL.md 文件并提取技能元数据
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Result, ok, err } from '../types/result.js';
import { RegisterSkillParams, SkillCategory } from './types.js';
import { SkillParseError } from './errors.js';

/**
 * 解析技能目录
 */
export async function parseSkillManifest(
  skillPath: string
): Promise<Result<RegisterSkillParams, Error>> {
  try {
    const skillMdPath = resolve(skillPath, 'SKILL.md');
    const content = await readFile(skillMdPath, 'utf-8');

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter.ok) {
      return err(frontmatter.error);
    }

    const meta = frontmatter.value;

    // 验证必需字段
    const requiredFields = ['name', 'description'];
    const missingFields = requiredFields.filter(f => !meta[f]);
    if (missingFields.length > 0) {
      return err(new SkillParseError(
        `Missing required fields: ${missingFields.join(', ')}`,
        skillPath
      ));
    }

    // 推断执行配置
    const execution = await inferExecutionConfig(skillPath, meta);

    return ok({
      id: String(meta.id || String(meta.name).toLowerCase().replace(/\s+/g, '-')),
      name: String(meta.name),
      description: String(meta.description),
      version: String(meta.version || '1.0.0'),
      author: meta.author ? String(meta.author) : undefined,
      tags: meta.tags ? parseTags(meta.tags) : [],
      category: parseCategory(meta.category),
      execution,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return err(new SkillParseError('SKILL.md not found', skillPath));
    }
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 解析 YAML Frontmatter
 */
function parseFrontmatter(content: string): Result<Record<string, unknown>, SkillParseError> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) {
    return err(new SkillParseError('No YAML frontmatter found', ''));
  }

  const yaml = match[1];
  const meta: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // 去除引号
    if (typeof value === 'string') {
      value = value.replace(/^["']|["']$/g, '');

      // 尝试解析数组
      const strValue = value as string;
      if (strValue.startsWith('[') && strValue.endsWith(']')) {
        try {
          value = JSON.parse(strValue);
        } catch {
          // 保持字符串
        }
      }
    }

    meta[key] = value;
  }

  return ok(meta);
}

/**
 * 推断执行配置
 */
async function inferExecutionConfig(
  skillPath: string,
  meta: Record<string, unknown>
): Promise<{ type: 'python' | 'shell' | 'node'; entry: string; timeout: number }> {
  // 默认配置
  const config: { type: 'python' | 'shell' | 'node'; entry: string; timeout: number } = {
    type: 'python',
    entry: 'script.py',
    timeout: 30000,
  };

  // 检查 scripts 目录
  if (meta.entry) {
    config.entry = meta.entry as string;
  } else {
    // 自动检测入口文件
    // 优先顺序: scripts/*.py -> *.py -> scripts/*.sh -> *.sh
    try {
      const { readdir } = await import('fs/promises');
      const { resolve } = await import('path');
      const scriptsDir = resolve(skillPath, 'scripts');
      const files = await readdir(scriptsDir).catch(() => readdir(skillPath));

      const pyFile = files.find(f => f.endsWith('.py'));
      const shFile = files.find(f => f.endsWith('.sh'));
      const jsFile = files.find(f => f.endsWith('.js'));

      if (pyFile) {
        config.type = 'python';
        config.entry = `scripts/${pyFile}`;
      } else if (jsFile) {
        config.type = 'node';
        config.entry = `scripts/${jsFile}`;
      } else if (shFile) {
        config.type = 'shell';
        config.entry = `scripts/${shFile}`;
      }
    } catch {
      // 使用默认配置
    }
  }

  // 解析超时
  if (meta.timeout) {
    const timeout = parseInt(meta.timeout as string, 10);
    if (!isNaN(timeout)) {
      config.timeout = timeout;
    }
  }

  return config;
}

/**
 * 解析标签
 */
function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map(String);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 解析类别
 */
function parseCategory(category: unknown): SkillCategory {
  const validCategories: SkillCategory[] = [
    'search', 'analysis', 'generation', 'utility', 'integration', 'custom'
  ];

  if (typeof category === 'string' && validCategories.includes(category as SkillCategory)) {
    return category as SkillCategory;
  }

  return 'custom';
}
