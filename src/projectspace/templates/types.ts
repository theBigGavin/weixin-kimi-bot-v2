/**
 * 项目模板类型定义
 */

/**
 * 模板类型
 */
export enum TemplateType {
  TOOL = 'tool',
  LIBRARY = 'library',
  SERVICE = 'service',
  KNOWLEDGE = 'knowledge',
  CUSTOM = 'custom',
}

/**
 * 模板变量
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string;
  /** 描述 */
  description?: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  default?: string;
}

/**
 * 模板文件
 */
export interface TemplateFile {
  /** 文件路径 */
  path: string;
  /** 模板内容 */
  template: string;
  /** 是否可执行 */
  executable?: boolean;
  /** 条件函数 */
  condition?: (variables: Record<string, string>) => boolean;
}

/**
 * 项目模板
 */
export interface ProjectTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 类型 */
  type: TemplateType;
  /** 变量定义 */
  variables: TemplateVariable[];
  /** 文件模板 */
  files: TemplateFile[];
  /** 依赖列表 */
  dependencies?: string[];
  /** 建议标签 */
  suggestedTags?: string[];
}

/**
 * 创建结果
 */
export interface CreateFromTemplateResult {
  success: boolean;
  templateId: string;
  targetPath: string;
  createdFiles: string[];
  errors: string[];
}

/**
 * 变量验证结果
 */
export interface VariableValidationResult {
  valid: boolean;
  errors: string[];
  values: Record<string, string>;
}
