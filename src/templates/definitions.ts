/**
 * 能力模板定义
 * 
 * 定义预置的能力模板和相关工具函数
 */

import { CapabilityTemplate } from '../types/index.js';
import { loadBuiltinTemplates } from './loader.js';

/**
 * 内置能力模板（从JSON和Markdown文件加载）
 */
export const BUILTIN_TEMPLATES: CapabilityTemplate[] = loadBuiltinTemplates();

/**
 * 模板错误类
 */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

/**
 * 创建自定义模板参数
 */
export interface CreateCustomTemplateParams {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  welcomeMessage?: string;
  suggestions?: string[];
  defaults?: Partial<CapabilityTemplate['defaults']>;
  tools?: Partial<CapabilityTemplate['tools']>;
  behavior?: Partial<CapabilityTemplate['behavior']>;
}

/**
 * 模板验证结果
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 根据ID获取模板
 * @param id 模板ID
 * @returns 模板或undefined
 */
export function getTemplateById(id: string): CapabilityTemplate | undefined {
  const normalizedId = id.toLowerCase();
  return BUILTIN_TEMPLATES.find(t => t.id.toLowerCase() === normalizedId);
}

/**
 * 列出所有可用模板
 * @returns 模板列表
 */
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
}> {
  return BUILTIN_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
  }));
}

/**
 * 创建自定义模板
 * @param params 创建参数
 * @returns 模板对象
 */
export function createCustomTemplate(params: CreateCustomTemplateParams): CapabilityTemplate {
  return {
    id: params.id,
    name: params.name,
    description: params.description || params.name,
    icon: params.icon || '🤖',
    systemPrompt: params.systemPrompt,
    welcomeMessage: params.welcomeMessage,
    suggestions: params.suggestions || [],
    defaults: {
      model: params.defaults?.model || 'kimi',
      maxTurns: params.defaults?.maxTurns ?? 20,
      temperature: params.defaults?.temperature ?? 0.7,
    },
    tools: {
      fileOperations: params.tools?.fileOperations ?? false,
      codeExecution: params.tools?.codeExecution ?? false,
      webSearch: params.tools?.webSearch ?? false,
      gitOperations: params.tools?.gitOperations ?? false,
    },
    behavior: {
      proactive: params.behavior?.proactive ?? true,
      verbose: params.behavior?.verbose ?? false,
      confirmDestructive: params.behavior?.confirmDestructive ?? true,
    },
  };
}

/**
 * 验证模板
 * @param template 模板对象
 * @returns 验证结果
 */
export function validateTemplate(template: CapabilityTemplate): TemplateValidationResult {
  const errors: string[] = [];

  if (!template.id || template.id.trim() === '') {
    errors.push('模板ID不能为空');
  }

  if (!template.name || template.name.trim() === '') {
    errors.push('模板名称不能为空');
  }

  if (!template.systemPrompt || template.systemPrompt.trim() === '') {
    errors.push('系统提示词不能为空');
  }

  const maxTurns = template.defaults?.maxTurns ?? 20;
  if (maxTurns <= 0) {
    errors.push('maxTurns必须大于0');
  }

  if (template.defaults?.temperature !== undefined) {
    if (template.defaults.temperature < 0 || template.defaults.temperature > 2) {
      errors.push('temperature必须在0-2之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Agent配置部分类型
 */
interface AgentConfigPart {
  ai: {
    model?: string;
    templateId?: string;
    maxTurns?: number;
    temperature?: number;
    customSystemPrompt?: string;
  };
  features: {
    shellExec?: boolean;
    webSearch?: boolean;
    fileAccess?: boolean;
    notifications?: boolean;
    scheduledTasks?: boolean;
  };
}

/**
 * 通用模板默认值（用于判断是否是"默认"配置）
 */
const GENERAL_DEFAULTS = {
  model: 'kimi',
  maxTurns: 20,
  temperature: 0.7,
};

/**
 * 检查值是否是占位符或默认值
 * 如果是，应用模板值；否则保留用户自定义值
 */
function shouldApplyTemplateValue(
  configValue: unknown,
  _templateValue: unknown,
  field: string
): boolean {
  // 如果是undefined/null，应用模板值
  if (configValue === undefined || configValue === null) {
    return true;
  }

  // 特殊处理：'default' 是占位符
  if (configValue === 'default') {
    return true;
  }

  // 对于maxTurns，小于15视为占位符（默认是20）
  if (field === 'maxTurns' && typeof configValue === 'number' && configValue < 15) {
    return true;
  }

  // 如果值等于general模板的默认值，视为未自定义
  if (field === 'model' && configValue === GENERAL_DEFAULTS.model) {
    return true;
  }
  if (field === 'maxTurns' && configValue === GENERAL_DEFAULTS.maxTurns) {
    return true;
  }
  if (field === 'temperature' && configValue === GENERAL_DEFAULTS.temperature) {
    return true;
  }

  // 其他情况视为用户自定义，保留
  return false;
}

/**
 * 应用模板到配置
 * @param config 当前配置
 * @param template 要应用的模板
 * @returns 更新后的配置
 */
export function applyTemplateToConfig(
  config: AgentConfigPart,
  template: CapabilityTemplate
): AgentConfigPart {
  // 验证模板
  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new TemplateError(`无效的模板: ${validation.errors.join(', ')}`);
  }

  // 深拷贝配置以避免修改原对象
  const updatedConfig: AgentConfigPart = {
    ai: { ...config.ai },
    features: { ...config.features },
  };

  // 总是更新templateId
  updatedConfig.ai.templateId = template.id;

  // 智能应用模板值：保留明显的用户自定义，覆盖占位符/默认值
  if (shouldApplyTemplateValue(config.ai.model, template.defaults.model, 'model')) {
    updatedConfig.ai.model = template.defaults.model;
  }
  if (shouldApplyTemplateValue(config.ai.maxTurns, template.defaults.maxTurns, 'maxTurns')) {
    updatedConfig.ai.maxTurns = template.defaults.maxTurns;
  }
  if (shouldApplyTemplateValue(config.ai.temperature, template.defaults.temperature, 'temperature')) {
    updatedConfig.ai.temperature = template.defaults.temperature;
  }

  // 应用工具权限到特性
  updatedConfig.features.shellExec = template.tools.codeExecution;
  updatedConfig.features.webSearch = template.tools.webSearch;
  updatedConfig.features.fileAccess = template.tools.fileOperations;

  return updatedConfig;
}
