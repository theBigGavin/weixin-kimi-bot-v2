/**
 * 项目模板引擎
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import {
  TemplateVariable,
  CreateFromTemplateResult,
  VariableValidationResult,
} from './types.js';
import { TemplateRegistry } from './registry.js';

export class ProjectTemplateEngine {
  constructor(private registry: TemplateRegistry) {}

  async createProjectFromTemplate(
    templateId: string,
    targetPath: string,
    variables: Record<string, string>
  ): Promise<CreateFromTemplateResult> {
    const result: CreateFromTemplateResult = {
      success: true, templateId, targetPath, createdFiles: [], errors: [],
    };

    const template = this.registry.get(templateId);
    if (!template) {
      result.success = false;
      result.errors.push(`模板不存在: ${templateId}`);
      return result;
    }

    const validation = this.validateTemplateVariables(template.variables, variables);
    if (!validation.valid) {
      result.success = false;
      result.errors.push(...validation.errors);
      return result;
    }

    for (const file of template.files) {
      if (file.condition && !file.condition(validation.values)) continue;

      try {
        const filePath = join(targetPath, file.path);
        const content = this.renderTemplate(file.template, validation.values);
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

  validateTemplateVariables(
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

  renderTemplate(template: string, variables: Record<string, string>): string {
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

  getTemplateVariables(templateId: string): TemplateVariable[] {
    return this.registry.get(templateId)?.variables || [];
  }

  listAvailableTemplates(type?: string) {
    if (type) {
      return this.registry.getByType(type as import('./types.js').TemplateType);
    }
    return this.registry.getAll();
  }
}
