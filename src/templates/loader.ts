/**
 * 模板加载器
 * 
 * 从JSON文件和Markdown文件加载能力模板
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CapabilityTemplate } from '../types/index.js';

/**
 * 模板数据接口（来自JSON）
 */
interface TemplateData {
  id: string;
  name: string;
  description: string;
  icon: string;
  promptFile: string;
  welcomeMessage?: string;
  suggestions?: string[];
  defaults: {
    model: string;
    maxTurns: number;
    temperature: number;
  };
  tools: {
    fileOperations: boolean;
    codeExecution: boolean;
    webSearch: boolean;
    gitOperations: boolean;
  };
  behavior: {
    proactive: boolean;
    verbose: boolean;
    confirmDestructive: boolean;
  };
}

/**
 * 模板JSON结构
 */
interface TemplatesJson {
  templates: TemplateData[];
}

// 获取当前文件目录（ESM兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 加载模板JSON配置
 * @returns 模板JSON数据
 */
function loadTemplatesJson(): TemplatesJson {
  const jsonPath = join(__dirname, 'templates.json');
  const content = readFileSync(jsonPath, 'utf-8');
  return JSON.parse(content) as TemplatesJson;
}

/**
 * 加载系统提示词文件
 * @param promptFile 提示词文件名
 * @returns 提示词内容
 */
function loadSystemPrompt(promptFile: string): string {
  const promptPath = join(__dirname, 'prompts', promptFile);
  return readFileSync(promptPath, 'utf-8');
}

/**
 * 加载所有内置模板
 * @returns 能力模板数组
 */
export function loadBuiltinTemplates(): CapabilityTemplate[] {
  const json = loadTemplatesJson();
  
  return json.templates.map((data: TemplateData) => ({
    id: data.id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    systemPrompt: loadSystemPrompt(data.promptFile),
    welcomeMessage: data.welcomeMessage,
    suggestions: data.suggestions,
    defaults: data.defaults,
    tools: data.tools,
    behavior: data.behavior,
  }));
}

/**
 * 重新加载模板（用于热更新）
 * @returns 最新的模板数组
 */
export function reloadTemplates(): CapabilityTemplate[] {
  return loadBuiltinTemplates();
}

/**
 * 获取模板文件路径
 * @returns 模板目录路径
 */
export function getTemplatesDirectory(): string {
  return __dirname;
}
