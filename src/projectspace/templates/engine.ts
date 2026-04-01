/**
 * 项目模板引擎 - Functional Programming Version
 * 
 * Phase 1 Refactoring: Convert class to factory function + pure functions
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import {
  TemplateVariable,
  CreateFromTemplateResult,
  VariableValidationResult,
  ProjectTemplate,
} from './types.js';
import { TemplateRegistry } from './registry.js';

// ============================================================================
// Pure Functions
// ============================================================================

export function validateTemplateVariables(
  variables: TemplateVariable[],
  values: Record<string, string>
): VariableValidationResult {
  const errors: string[] = [];
  const result: Record<string, string> = {};

  for (const variable of variables) {
    const value = values[variable.name];
    if (value === undefined || value === '') {
      if (variable.required) errors.push(`缺少必填变量: ${variable.name}`);
      else if (variable.default !== undefined) result[variable.name] = variable.default;
    } else {
      result[variable.name] = value;
    }
  }

  return { valid: errors.length === 0, errors, values: result };
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;

  // Simple variable replacement
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Simple if/else
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, trueContent, falseContent) => variables[varName] === 'true' ? trueContent : falseContent);

  // Simple if
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => variables[varName] === 'true' ? content : '');

  return result;
}

export async function createProjectFromTemplate(
  registry: TemplateRegistry,
  templateId: string,
  targetPath: string,
  variables: Record<string, string>
): Promise<CreateFromTemplateResult> {
  const result: CreateFromTemplateResult = {
    success: true, templateId, targetPath, createdFiles: [], errors: [],
  };

  const template = registry.get(templateId);
  if (!template) {
    result.success = false;
    result.errors.push(`模板不存在: ${templateId}`);
    return result;
  }

  const validation = validateTemplateVariables(template.variables, variables);
  if (!validation.valid) {
    result.success = false;
    result.errors.push(...validation.errors);
    return result;
  }

  for (const file of template.files) {
    if (file.condition && !file.condition(validation.values)) continue;

    try {
      const filePath = join(targetPath, file.path);
      const content = renderTemplate(file.template, validation.values);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, { mode: file.executable ? 0o755 : 0o644 });
      result.createdFiles.push(file.path);
    } catch (error) {
      result.errors.push(`创建文件失败 ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

export function getTemplateVariables(
  registry: TemplateRegistry,
  templateId: string
): TemplateVariable[] {
  return registry.get(templateId)?.variables || [];
}

export function listAvailableTemplates(registry: TemplateRegistry, type?: string) {
  if (type) {
    return registry.getByType(type as import('./types.js').TemplateType);
  }
  return registry.getAll();
}

// ============================================================================
// Factory Function
// ============================================================================

export interface ProjectTemplateEngine {
  createProjectFromTemplate(
    templateId: string,
    targetPath: string,
    variables: Record<string, string>
  ): Promise<CreateFromTemplateResult>;
  validateTemplateVariables(
    variables: TemplateVariable[],
    values: Record<string, string>
  ): VariableValidationResult;
  renderTemplate(template: string, variables: Record<string, string>): string;
  getTemplateVariables(templateId: string): TemplateVariable[];
  listAvailableTemplates(type?: string): ProjectTemplate[];
}

export function createProjectTemplateEngine(registry: TemplateRegistry): ProjectTemplateEngine {
  return {
    createProjectFromTemplate: (templateId: string, targetPath: string, variables: Record<string, string>) =>
      createProjectFromTemplate(registry, templateId, targetPath, variables),
    validateTemplateVariables,
    renderTemplate,
    getTemplateVariables: (templateId: string) => getTemplateVariables(registry, templateId),
    listAvailableTemplates: (type?: string) => listAvailableTemplates(registry, type),
  } as unknown as ProjectTemplateEngine;
}

// ============================================================================
// Backward Compatibility - Class Wrapper
// ============================================================================

/**
 * @deprecated Use createProjectTemplateEngine() for new code
 */
export class ProjectTemplateEngine {
  constructor(private registry: TemplateRegistry) {}

  async createProjectFromTemplate(
    templateId: string,
    targetPath: string,
    variables: Record<string, string>
  ): Promise<CreateFromTemplateResult> {
    return createProjectFromTemplate(this.registry, templateId, targetPath, variables);
  }

  validateTemplateVariables(
    variables: TemplateVariable[],
    values: Record<string, string>
  ): VariableValidationResult {
    return validateTemplateVariables(variables, values);
  }

  renderTemplate(template: string, variables: Record<string, string>): string {
    return renderTemplate(template, variables);
  }

  getTemplateVariables(templateId: string): TemplateVariable[] {
    return getTemplateVariables(this.registry, templateId);
  }

  listAvailableTemplates(type?: string) {
    return listAvailableTemplates(this.registry, type);
  }
}
