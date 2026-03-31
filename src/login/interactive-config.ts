/**
 * 交互式配置向导
 * 
 * 提供命令行交互界面，引导用户配置 Agent
 */

import readline from 'node:readline';
import { AgentVisibility } from '../agent/types.js';
import { TemplateType } from '../agent/types.js';

/**
 * 交互式 Agent 配置结果
 */
export interface InteractiveAgentConfig {
  /** Agent 名称 */
  name: string;
  /** 模板ID */
  templateId: string;
  /** 模型 */
  model: string;
  /** 是否启用记忆 */
  enableMemory: boolean;
  /** 功能特性 */
  features: {
    shellExec: boolean;
    webSearch: boolean;
    fileAccess: boolean;
  };
  /** 可见性 */
  visibility: AgentVisibility;
  /** 最大绑定数 */
  maxBindings: number;
}

/**
 * 问题选项
 */
interface QuestionOptions {
  /** 默认值 */
  default?: string;
  /** 有效选项 */
  choices?: string[];
  /** 验证函数 */
  validate?: (input: string) => boolean | string;
}

/**
 * 创建 readline 接口
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 提问
 * @param rl readline 接口
 * @param prompt 提示文本
 * @param options 选项
 * @returns 用户输入
 */
async function question(
  rl: readline.Interface,
  prompt: string,
  options: QuestionOptions = {}
): Promise<string> {
  const defaultPrompt = options.default ? ` (默认: ${options.default})` : '';
  
  return new Promise((resolve) => {
    rl.question(`${prompt}${defaultPrompt}: `, (answer) => {
      const trimmed = answer.trim();
      const final = trimmed || options.default || '';
      
      if (options.choices && !options.choices.includes(final)) {
        console.log(`请输入有效选项: ${options.choices.join(', ')}`);
        resolve(question(rl, prompt, options));
        return;
      }
      
      if (options.validate) {
        const validation = options.validate(final);
        if (validation !== true) {
          console.log(typeof validation === 'string' ? validation : '输入无效');
          resolve(question(rl, prompt, options));
          return;
        }
      }
      
      resolve(final);
    });
  });
}

/**
 * 确认问题
 * @param rl readline 接口
 * @param prompt 提示文本
 * @param defaultYes 默认是否为是
 * @returns 是否确认
 */
async function confirm(
  rl: readline.Interface,
  prompt: string,
  defaultYes: boolean = true
): Promise<boolean> {
  const defaultStr = defaultYes ? 'Y/n' : 'y/N';
  const answer = await question(rl, `${prompt} [${defaultStr}]`);
  
  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * 运行交互式配置向导
 * @param wechatId 微信用户ID
 * @param isFirstLogin 是否为首次登录
 * @returns 配置结果
 */
export async function runInteractiveConfig(
  wechatId: string,
  isFirstLogin: boolean
): Promise<InteractiveAgentConfig> {
  const rl = createInterface();

  try {
    console.log('\n========================================');
    console.log('       Agent 配置向导');
    console.log('========================================\n');

    if (isFirstLogin) {
      console.log('👋 欢迎使用 weixin-kimi-bot！');
      console.log('这是首次登录，我们将为您创建创世 Agent。\n');
    }

    console.log(`微信账号: ${wechatId}\n`);

    // 1. Agent 名称
    const name = await question(rl, '请输入 Agent 名称', {
      default: '小助手',
      validate: (input) => input.length > 0 || '名称不能为空',
    });

    // 2. 选择模板
    console.log('\n--- 选择模板 ---');
    console.log('1. 通用助手 (general) - 日常问答和助手功能');
    console.log('2. 程序员 (programmer) - 编程辅助和代码审查');
    console.log('3. 作家 (writer) - 写作辅助和内容创作');
    console.log('4. Vlog创作者 (vlog-creator) - 视频脚本和创作');
    console.log('5. 加密货币交易员 (crypto-trader) - 加密市场分析');
    console.log('6. A股交易员 (a-stock-trader) - 股票分析');
    
    const templateChoice = await question(rl, '请选择模板编号', {
      default: '1',
      choices: ['1', '2', '3', '4', '5', '6'],
    });
    
    const templateMap: Record<string, string> = {
      '1': TemplateType.GENERAL,
      '2': TemplateType.PROGRAMMER,
      '3': TemplateType.WRITER,
      '4': TemplateType.VLOG_CREATOR,
      '5': TemplateType.CRYPTO_TRADER,
      '6': TemplateType.A_STOCK_TRADER,
    };
    const templateId = templateMap[templateChoice];

    // 3. 模型选择
    console.log('\n--- 选择模型 ---');
    console.log('1. kimi-k1.5 (默认，速度快)');
    console.log('2. kimi-k1.5-long (长上下文)');
    
    const modelChoice = await question(rl, '请选择模型编号', {
      default: '1',
      choices: ['1', '2'],
    });
    const model = modelChoice === '2' ? 'kimi-k1.5-long' : 'kimi-k1.5';

    // 4. 功能特性
    console.log('\n--- 功能配置 ---');
    const shellExec = await confirm(rl, '允许执行命令? (危险操作会要求确认)', false);
    const webSearch = await confirm(rl, '允许网络搜索?', true);
    const fileAccess = await confirm(rl, '允许文件操作?', true);

    // 5. 记忆功能
    console.log('\n--- 记忆功能 ---');
    const enableMemory = await confirm(rl, '启用长期记忆? (推荐)', true);

    // 6. 共享设置（非首次登录可选）
    let visibility = AgentVisibility.PRIVATE;
    let maxBindings = 1;

    if (!isFirstLogin) {
      console.log('\n--- 共享设置 ---');
      console.log('1. 私有 (仅自己使用)');
      console.log('2. 共享 (任何人可绑定)');
      console.log('3. 邀请制 (仅邀请用户可绑定)');
      
      const visibilityChoice = await question(rl, '请选择可见性', {
        default: '1',
        choices: ['1', '2', '3'],
      });

      switch (visibilityChoice) {
        case '2':
          visibility = AgentVisibility.SHARED;
          maxBindings = parseInt(await question(rl, '最大绑定用户数', {
            default: '5',
            validate: (input) => {
              const num = parseInt(input);
              return (num > 0 && num <= 100) || '请输入 1-100 之间的数字';
            },
          }));
          break;
        case '3':
          visibility = AgentVisibility.INVITE_ONLY;
          maxBindings = parseInt(await question(rl, '最大绑定用户数', {
            default: '5',
            validate: (input) => {
              const num = parseInt(input);
              return (num > 0 && num <= 100) || '请输入 1-100 之间的数字';
            },
          }));
          break;
        default:
          visibility = AgentVisibility.PRIVATE;
          maxBindings = 1;
      }
    }

    // 配置摘要
    console.log('\n========================================');
    console.log('       配置摘要');
    console.log('========================================');
    console.log(`名称: ${name}`);
    console.log(`模板: ${templateId}`);
    console.log(`模型: ${model}`);
    console.log(`执行命令: ${shellExec ? '是' : '否'}`);
    console.log(`网络搜索: ${webSearch ? '是' : '否'}`);
    console.log(`文件操作: ${fileAccess ? '是' : '否'}`);
    console.log(`长期记忆: ${enableMemory ? '是' : '否'}`);
    console.log(`可见性: ${visibility}`);
    if (visibility !== AgentVisibility.PRIVATE) {
      console.log(`最大绑定数: ${maxBindings}`);
    }
    console.log('========================================\n');

    const confirmed = await confirm(rl, '确认创建?', true);
    
    if (!confirmed) {
      console.log('已取消创建');
      throw new Error('用户取消');
    }

    return {
      name,
      templateId,
      model,
      enableMemory,
      features: {
        shellExec,
        webSearch,
        fileAccess,
      },
      visibility,
      maxBindings,
    };
  } finally {
    rl.close();
  }
}

/**
 * 询问绑定选择
 * @param existingAgents 已绑定的Agent列表
 * @returns 选择：create / bind / existing
 */
export async function askBindingChoice(
  existingAgents: Array<{ agentId: string; name: string; isDefault: boolean }>
): Promise<'create' | 'bind' | 'existing'> {
  const rl = createInterface();

  try {
    console.log('\n========================================');
    console.log('       选择操作');
    console.log('========================================\n');

    console.log(`您已有 ${existingAgents.length} 个绑定的 Agent:`);
    for (const agent of existingAgents) {
      const marker = agent.isDefault ? ' [默认]' : '';
      console.log(`  - ${agent.name}${marker}`);
    }

    console.log('\n1. 使用现有 Agent');
    console.log('2. 创建新 Agent');
    console.log('3. 绑定他人的 Agent');

    const choice = await question(rl, '请选择', {
      default: '1',
      choices: ['1', '2', '3'],
    });

    switch (choice) {
      case '2':
        return 'create';
      case '3':
        return 'bind';
      default:
        return 'existing';
    }
  } finally {
    rl.close();
  }
}

/**
 * 询问 Agent ID 绑定
 * @returns Agent ID
 */
export async function askAgentIdToBind(): Promise<string> {
  const rl = createInterface();

  try {
    console.log('\n请输入要绑定的 Agent ID');
    console.log('格式: 名称_微信前缀_随机码 (例如: 小助手_a1b2c3d4_x7k9)');

    const agentId = await question(rl, 'Agent ID', {
      validate: (input) => {
        if (!input) return 'Agent ID 不能为空';
        const parts = input.split('_');
        if (parts.length !== 3) return '格式不正确，应为: 名称_前缀_随机码';
        return true;
      },
    });

    return agentId;
  } finally {
    rl.close();
  }
}

/**
 * 选择现有 Agent
 * @param agents Agent列表
 * @returns 选择的 Agent ID
 */
export async function selectExistingAgent(
  agents: Array<{ agentId: string; name: string; isDefault: boolean }>
): Promise<string> {
  const rl = createInterface();

  try {
    console.log('\n========================================');
    console.log('       选择 Agent');
    console.log('========================================\n');

    for (let i = 0; i < agents.length; i++) {
      const marker = agents[i].isDefault ? ' [默认]' : '';
      console.log(`${i + 1}. ${agents[i].name}${marker}`);
    }

    const choice = await question(rl, '请选择', {
      default: '1',
      validate: (input) => {
        const num = parseInt(input);
        return (num > 0 && num <= agents.length) || `请输入 1-${agents.length} 之间的数字`;
      },
    });

    return agents[parseInt(choice) - 1].agentId;
  } finally {
    rl.close();
  }
}
