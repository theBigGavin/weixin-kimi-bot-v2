/**
 * 项目模板系统
 */

export {
  TemplateType,
  type TemplateVariable,
  type TemplateFile,
  type ProjectTemplate,
  type CreateFromTemplateResult,
  type VariableValidationResult,
} from './types.js';

export {
  TOOL_TEMPLATE,
  LIBRARY_TEMPLATE,
  SERVICE_TEMPLATE,
  KNOWLEDGE_TEMPLATE,
} from './builtins.js';

export { TemplateRegistry } from './registry.js';
export { ProjectTemplateEngine } from './engine.js';

import { TemplateRegistry } from './registry.js';
import { ProjectTemplateEngine } from './engine.js';

export function createProjectTemplateEngine(registry?: TemplateRegistry): ProjectTemplateEngine {
  return new ProjectTemplateEngine(registry || new TemplateRegistry());
}
