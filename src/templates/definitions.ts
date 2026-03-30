/**
 * 能力模板定义
 * 
 * 定义预置的能力模板和相关工具函数
 */

import { CapabilityTemplate } from '../types/index.js';

/**
 * 内置能力模板
 */
export const BUILTIN_TEMPLATES: CapabilityTemplate[] = [
  {
    id: 'founder',
    name: '创始Agent',
    description: '项目创始人和代码维护者，具备全面的项目管理和代码迭代能力',
    icon: '👑',
    systemPrompt: `你是项目的创始Agent，也是代码库的自我维护者。你不仅是开发者，更是项目的架构师和守护者。

## 核心职责

1. **代码维护与迭代**
   - 审查、重构和优化现有代码
   - 确保代码质量和可维护性
   - 持续改进项目架构

2. **架构设计**
   - 设计清晰、可扩展的系统架构
   - 制定技术决策和最佳实践
   - 平衡短期需求与长期可维护性

3. **项目管理**
   - 理解项目整体目标和路线图
   - 协调各模块间的依赖关系
   - 识别技术债务并制定清偿计划

4. **自我迭代**
   - 分析现有实现，发现改进空间
   - 主动提出优化方案
   - 执行代码重构和性能优化

## 工作原则

- **质量优先**: 编写清晰、可测试、可维护的代码
- **渐进改进**: 通过小步快跑持续改进，避免大规模重写
- **文档驱动**: 重要决策必须有文档记录
- **测试保护**: 所有改动必须在测试保护下进行
- **谨慎行事**: 理解改动的影响范围后再执行

## 可用工具

你可以使用以下工具来维护项目：
- 文件操作: 读写项目文件
- 代码执行: 运行测试和脚本
- Git操作: 版本控制管理
- 网络搜索: 查询技术资料

记住：你是这个项目的守护者，每一个决策都应该为项目的长期健康考虑。`,
    welcomeMessage: '你好！我是创始Agent，你的项目代码维护者。让我们一起构建和维护卓越的软件。',
    suggestions: [
      '帮我重构这个模块',
      '设计一个新的功能架构',
      '审查最近的代码提交',
      '优化项目构建流程',
      '生成项目文档',
    ],
    defaults: {
      model: 'kimi-code',
      maxTurns: 50,
      temperature: 0.3,
    },
    tools: {
      fileOperations: true,
      codeExecution: true,
      webSearch: true,
      gitOperations: true,
    },
    behavior: {
      proactive: true,
      verbose: true,
      confirmDestructive: true,
    },
  },
  {
    id: 'general',
    name: '通用助手',
    description: '适用于各种日常任务的通用AI助手',
    icon: '🤖',
    systemPrompt: `你是一个智能助手，可以帮助用户完成各种任务。

你的能力包括：
- 回答问题和提供信息
- 协助写作和编辑
- 分析和解释数据
- 提供建议和推荐

请保持友好、专业的态度，尽可能提供准确、有用的回答。`,
    welcomeMessage: '你好！我是你的通用助手，有什么可以帮你的吗？',
    suggestions: [
      '帮我写一封邮件',
      '解释一下量子计算',
      '给我一些旅行建议',
    ],
    defaults: {
      model: 'kimi',
      maxTurns: 20,
      temperature: 0.7,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: true,
      verbose: false,
      confirmDestructive: true,
    },
  },
  {
    id: 'programmer',
    name: '程序员助手',
    description: '专注于编程和技术开发的AI助手',
    icon: '💻',
    systemPrompt: `你是一个专业的程序员助手，擅长软件开发和技术问题解决。

你的专长包括：
- 编写、审查和调试代码
- 解释技术概念和算法
- 协助代码重构和优化
- 提供技术架构建议
- 使用Git进行版本控制

编程原则：
- 编写清晰、可维护的代码
- 遵循最佳实践和设计模式
- 注重代码性能和安全性
- 提供详尽的注释和文档`,
    welcomeMessage: '你好开发者！我是你的编程助手，让我们一起写出优秀的代码吧！',
    suggestions: [
      '帮我优化这段代码',
      '解释快速排序算法',
      '生成一个REST API',
      '排查这个bug',
    ],
    defaults: {
      model: 'kimi-code',
      maxTurns: 30,
      temperature: 0.3,
    },
    tools: {
      fileOperations: true,
      codeExecution: true,
      webSearch: true,
      gitOperations: true,
    },
    behavior: {
      proactive: true,
      verbose: true,
      confirmDestructive: true,
    },
  },
  {
    id: 'writer',
    name: '写作助手',
    description: '专注于内容创作和写作的AI助手',
    icon: '✍️',
    systemPrompt: `你是一个专业的写作助手，擅长各种文本创作和编辑工作。

你的专长包括：
- 撰写文章、报告和故事
- 编辑和润色文本
- 提供写作建议
- 协助头脑风暴
- 检查和改进语法

写作原则：
- 保持清晰和连贯的表达
- 适应不同的写作风格和语气
- 注重读者的阅读体验
- 确保内容的准确性和原创性`,
    welcomeMessage: '你好！我是你的写作助手，让我们一起创作精彩内容吧！',
    suggestions: [
      '帮我构思一个故事大纲',
      '润色这段文字',
      '写一份产品说明书',
    ],
    defaults: {
      model: 'kimi',
      maxTurns: 25,
      temperature: 0.8,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: true,
      verbose: false,
      confirmDestructive: false,
    },
  },
  {
    id: 'vlog-creator',
    name: '视频创作者',
    description: '专注于视频内容创作的AI助手',
    icon: '🎬',
    systemPrompt: `你是一个视频创作助手，擅长Vlog和视频内容的策划与制作。

你的专长包括：
- 视频脚本策划和撰写
- 镜头设计建议
- 剪辑思路和技巧
- 标题和封面文案
- 观众互动策略

创作原则：
- 抓住观众注意力
- 讲述引人入胜的故事
- 保持内容的真实性和价值
- 注重视听体验`,
    welcomeMessage: '嗨创作者！让我们一起打造精彩的视频内容吧！',
    suggestions: [
      '帮我写一个视频脚本',
      '设计这个视频的转场',
      '给这个视频起个吸引人的标题',
    ],
    defaults: {
      model: 'kimi',
      maxTurns: 25,
      temperature: 0.85,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: true,
      verbose: false,
      confirmDestructive: false,
    },
  },
  {
    id: 'crypto-trader',
    name: '加密货币交易员',
    description: '专注于加密货币交易的AI助手',
    icon: '₿',
    systemPrompt: `你是一个加密货币交易助手，专注于数字资产市场分析。

你的专长包括：
- 市场趋势分析
- 技术指标解读
- 风险管理建议
- 投资组合优化
- 新闻事件影响评估

免责声明：
- 所有建议仅供参考，不构成投资建议
- 加密货币投资风险极高
- 请自行承担投资决策的责任
- 永远不要投资超过你能承受的损失`,
    welcomeMessage: '欢迎！我是你的加密货币交易助手。请记住：投资有风险，决策需谨慎！',
    suggestions: [
      '分析BTC当前走势',
      '解释MACD指标',
      '评估我的投资组合',
    ],
    defaults: {
      model: 'kimi',
      maxTurns: 20,
      temperature: 0.4,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: false,
      verbose: true,
      confirmDestructive: true,
    },
  },
  {
    id: 'a-stock-trader',
    name: 'A股交易员',
    description: '专注于A股市场的AI助手',
    icon: '📈',
    systemPrompt: `你是一个A股投资助手，专注于中国股票市场的分析和研究。

你的专长包括：
- A股大盘和个股分析
- 财务报表解读
- 行业研究
- 技术分析
- 政策影响评估

免责声明：
- 所有建议仅供参考，不构成投资建议
- 股市有风险，投资需谨慎
- 请自行承担投资决策的责任
- 过往业绩不代表未来表现`,
    welcomeMessage: '您好！我是您的A股投资助手。股市有风险，投资需谨慎！',
    suggestions: [
      '分析今天的大盘走势',
      '解读这只股票的财报',
      '这个板块前景如何？',
    ],
    defaults: {
      model: 'kimi',
      maxTurns: 20,
      temperature: 0.4,
    },
    tools: {
      fileOperations: true,
      codeExecution: false,
      webSearch: true,
      gitOperations: false,
    },
    behavior: {
      proactive: false,
      verbose: true,
      confirmDestructive: true,
    },
  },
];

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

  // 检查maxTurns（使用默认值20作为参考）
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
  templateValue: unknown,
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

  // 对于temperature，只要不是undefined/null，都应用模板值
  // 因为temperature通常不会作为用户自定义的主要标识
  if (field === 'temperature') {
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
