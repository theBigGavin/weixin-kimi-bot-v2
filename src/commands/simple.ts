/**
 * Simple Commands
 * 
 * Basic commands that don't require complex logic:
 * - start: start new session
 * - status: show agent status
 * - reset: reset session
 * - test: test connection
 * - template: switch template (placeholder)
 */

import { Command, CommandContext, CommandResult, CommandType, ResponseBuilder } from './framework.js';

export class StartCommand extends Command {
  constructor() {
    super({
      name: 'start',
      description: '开始新会话',
      usage: '/start',
    });
  }

  execute(context: CommandContext): CommandResult {
    return {
      type: CommandType.START,
      success: true,
      response: `🚀 开始新会话！Agent "${context.agent.name}" 已准备就绪。`,
    };
  }
}

export class StatusCommand extends Command {
  constructor() {
    super({
      name: 'status',
      description: '查看当前Agent状态',
      usage: '/status',
    });
  }

  execute(context: CommandContext): CommandResult {
    const { agent } = context;
    return {
      type: CommandType.STATUS,
      success: true,
      response: ResponseBuilder.create()
        .title('📊 Agent 状态')
        .line(`名称: ${agent.name}`)
        .line(`模板: ${agent.ai.templateId}`)
        .line(`记忆: ${agent.memory.enabledL ? '开启' : '关闭'}`)
        .build(),
      data: {
        agentId: agent.id,
        name: agent.name,
        templateId: agent.ai.templateId,
      },
    };
  }
}

export class ResetCommand extends Command {
  constructor() {
    super({
      name: 'reset',
      description: '重置当前会话',
      usage: '/reset',
    });
  }

  execute(context: CommandContext): CommandResult {
    return {
      type: CommandType.RESET,
      success: true,
      response: `🔄 会话已重置。Agent "${context.agent.name}" 准备就绪。`,
    };
  }
}

export class TestCommand extends Command {
  constructor() {
    super({
      name: 'test',
      description: '测试Bot连接',
      usage: '/test',
    });
  }

  execute(context: CommandContext): CommandResult {
    const { agent } = context;
    return {
      type: CommandType.TEST,
      success: true,
      response: ResponseBuilder.create()
        .line(`🤖 Agent "${agent.name}" 连接正常！`)
        .line(`模板: ${agent.ai.templateId}`)
        .line(`记忆: ${agent.memory.enabledL ? '开启' : '关闭'}`)
        .build(),
    };
  }
}

export class TemplateCommand extends Command {
  constructor() {
    super({
      name: 'template',
      description: '切换能力模板',
      usage: '/template <template-id>',
      examples: ['/template programmer'],
    });
  }

  execute(context: CommandContext): CommandResult {
    const { args } = context;

    if (args.length === 0) {
      return ResponseBuilder.error(
        '请指定模板ID。用法: /template <template-id>',
        'Missing template ID',
        CommandType.TEMPLATE
      );
    }

    return {
      type: CommandType.TEMPLATE,
      success: true,
      response: `✅ 已切换到模板: ${args[0]}`,
      data: { templateId: args[0] },
    };
  }
}
