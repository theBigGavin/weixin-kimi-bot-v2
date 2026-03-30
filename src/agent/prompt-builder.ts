/**
 * 提示词构建器
 * 
 * 负责构建和格式化系统提示词、上下文信息等
 */

import { AgentConfig, CapabilityTemplate, Memory } from '../types/index.js';

/**
 * 提示词上下文选项
 */
export interface PromptBuildOptions {
  minImportance?: number;
  maxMemories?: number;
  includeTimestamp?: boolean;
}

/**
 * 提示词上下文
 */
export interface PromptContext {
  currentProject?: string;
  recentTopics?: string[];
  activeOptions?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}

/**
 * 完整提示词上下文结果
 */
export interface PromptContextResult {
  systemPrompt: string;
  memoryContext: string;
  workspacePath: string;
  currentProject?: string;
  availableTools: string[];
}

/**
 * 构建系统提示词
 * @param config Agent 配置
 * @param template 能力模板
 * @param memories 长期记忆
 * @param options 构建选项
 * @returns 系统提示词
 */
export function buildSystemPrompt(
  config: AgentConfig,
  template: CapabilityTemplate,
  memories?: Memory['facts'],
  options: PromptBuildOptions = {}
): string {
  const parts: string[] = [];

  // 1. 基础系统提示词（来自模板）
  parts.push(template.systemPrompt);

  // 2. 长期记忆（如果启用）
  if (config.memory.enabledL && memories && memories.length > 0) {
    const minImportance = options.minImportance ?? 1;
    const maxMemories = options.maxMemories ?? 10;

    const relevantMemories = memories
      .filter(m => m.importance >= minImportance)
      .slice(0, maxMemories);

    if (relevantMemories.length > 0) {
      const memorySection = formatMemoryForPrompt(relevantMemories);
      if (memorySection) {
        parts.push('## 相关背景信息\n' + memorySection);
      }
    }
  }

  // 3. 当前项目上下文（如果有）
  // 这部分通常由调用方动态传入，这里预留位置

  // 4. 用户自定义提示词
  if (config.ai.customSystemPrompt && config.ai.customSystemPrompt.trim()) {
    parts.push('## 额外指令\n' + config.ai.customSystemPrompt.trim());
  }

  // 5. 工作目录信息
  parts.push(`## 工作目录\n${config.workspace.path}`);

  // 6. 工具权限说明
  const availableTools: string[] = [];
  if (config.features.fileAccess) availableTools.push('文件操作');
  if (config.features.shellExec) availableTools.push('命令执行');
  if (config.features.webSearch) availableTools.push('网络搜索');
  if (availableTools.length > 0) {
    parts.push(`## 可用工具\n${availableTools.join('、')}`);
  }

  return parts.join('\n\n');
}

/**
 * 构建欢迎消息
 * @param template 能力模板
 * @returns 欢迎消息
 */
export function buildWelcomeMessage(template: CapabilityTemplate): string {
  if (template.welcomeMessage) {
    return template.welcomeMessage;
  }

  // 默认欢迎消息
  return `你好！我是${template.name}。${template.description}。有什么可以帮你的吗？`;
}

/**
 * 格式化记忆用于提示词
 * @param memories 记忆列表
 * @returns 格式化后的记忆字符串
 */
export function formatMemoryForPrompt(memories: Memory['facts']): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  // 去重
  const seen = new Set<string>();
  const uniqueMemories = memories.filter(m => {
    if (seen.has(m.content)) return false;
    seen.add(m.content);
    return true;
  });

  // 按类别分组
  const byCategory: Record<string, Memory['facts']> = {};
  uniqueMemories.forEach(m => {
    if (!byCategory[m.category]) {
      byCategory[m.category] = [];
    }
    byCategory[m.category].push(m);
  });

  // 格式化
  const lines: string[] = [];
  const categoryNames: Record<string, string> = {
    personal: '个人偏好',
    work: '工作相关',
    project: '项目信息',
    tech: '技术偏好',
  };

  for (const [category, items] of Object.entries(byCategory)) {
    const categoryName = categoryNames[category] || category;
    lines.push(`- [${categoryName}]`);
    items.forEach(item => {
      lines.push(`  - ${item.content}`);
    });
  }

  return lines.join('\n');
}

/**
 * 格式化上下文用于提示词
 * @param context 提示词上下文
 * @returns 格式化后的上下文字符串
 */
export function formatContextForPrompt(context: PromptContext): string {
  const parts: string[] = [];

  if (context.currentProject) {
    parts.push(`当前项目: ${context.currentProject}`);
  }

  if (context.recentTopics && context.recentTopics.length > 0) {
    parts.push(`最近话题: ${context.recentTopics.join(', ')}`);
  }

  if (context.activeOptions && context.activeOptions.length > 0) {
    parts.push('当前可选项:');
    context.activeOptions.forEach((option, index) => {
      parts.push(`  ${index + 1}. [${option.id}] ${option.label}`);
      if (option.description) {
        parts.push(`     ${option.description}`);
      }
    });
  }

  return parts.join('\n');
}

/**
 * 构建完整的提示词上下文
 * @param config Agent 配置
 * @param template 能力模板
 * @param memories 长期记忆
 * @param context 提示词上下文
 * @param options 构建选项
 * @returns 完整上下文结果
 */
export function buildPromptContext(
  config: AgentConfig,
  template: CapabilityTemplate,
  memories?: Memory['facts'],
  context?: PromptContext,
  options: PromptBuildOptions = {}
): PromptContextResult {
  // 构建系统提示词
  const systemPrompt = buildSystemPrompt(config, template, memories, options);

  // 格式化记忆上下文
  const memoryContext = config.memory.enabledL && memories
    ? formatMemoryForPrompt(memories)
    : '';

  // 格式化动态上下文
  const formattedContext = context ? formatContextForPrompt(context) : '';

  // 可用工具列表
  const availableTools: string[] = [];
  if (config.features.fileAccess) availableTools.push('fileAccess');
  if (config.features.shellExec) availableTools.push('shellExec');
  if (config.features.webSearch) availableTools.push('webSearch');

  return {
    systemPrompt,
    memoryContext,
    workspacePath: config.workspace.path,
    currentProject: context?.currentProject,
    availableTools,
  };
}

/**
 * 为特定任务构建系统提示词
 * @param basePrompt 基础提示词
 * @param task 任务描述
 * @param constraints 约束条件
 * @returns 任务特定的系统提示词
 */
export function buildTaskSystemPrompt(
  basePrompt: string,
  task: string,
  constraints?: string[]
): string {
  const parts = [basePrompt];

  parts.push(`## 当前任务\n${task}`);

  if (constraints && constraints.length > 0) {
    parts.push('## 约束条件');
    constraints.forEach(constraint => {
      parts.push(`- ${constraint}`);
    });
  }

  return parts.join('\n\n');
}
