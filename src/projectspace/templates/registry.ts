/**
 * 模板注册表
 */

import { ProjectTemplate, TemplateType } from './types.js';
import { TOOL_TEMPLATE, LIBRARY_TEMPLATE, SERVICE_TEMPLATE, KNOWLEDGE_TEMPLATE } from './builtins.js';

export class TemplateRegistry {
  private templates = new Map<string, ProjectTemplate>();

  constructor() {
    // Register built-in templates
    this.register(TOOL_TEMPLATE);
    this.register(LIBRARY_TEMPLATE);
    this.register(SERVICE_TEMPLATE);
    this.register(KNOWLEDGE_TEMPLATE);
  }

  register(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  getAll(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  getByType(type: TemplateType): ProjectTemplate[] {
    return this.getAll().filter(t => t.type === type);
  }
}
