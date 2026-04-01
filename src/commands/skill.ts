/**
 * Skill Command
 * 
 * 管理全局技能和 Agent 技能
 */

import { Command, CommandContext, CommandResult, ResponseBuilder, CommandType } from './framework.js';
import { getSkillManager } from '../init/managers.js';

/**
 * /skill 命令
 */
export class SkillCommand extends Command {
  constructor() {
    super({
      name: 'skill',
      description: '管理系统技能和 Agent 技能',
      usage: '/skill <subcommand> [args]',
      examples: [
        '/skill list - 列出可用技能',
        '/skill installed - 列出已安装的技能',
        '/skill install <skill-id> - 安装技能',
        '/skill uninstall <skill-id> - 卸载技能',
        '/skill enable <skill-id> - 启用技能',
        '/skill disable <skill-id> - 禁用技能',
        '/skill info <skill-id> - 查看技能详情',
      ],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const [subCommandName, ...args] = context.args;

    if (!subCommandName) {
      return this.showHelp();
    }

    switch (subCommandName) {
      case 'list':
        return this.handleList();
      case 'installed':
        return this.handleInstalled(context);
      case 'install':
        return this.handleInstall({ ...context, args });
      case 'uninstall':
        return this.handleUninstall({ ...context, args });
      case 'enable':
        return this.handleEnable({ ...context, args });
      case 'disable':
        return this.handleDisable({ ...context, args });
      case 'info':
        return this.handleInfo({ ...context, args });
      default:
        return ResponseBuilder.error(
          `未知子命令: ${subCommandName}。可用: list, installed, install, uninstall, enable, disable, info`
        );
    }
  }

  private showHelp(): CommandResult {
    const rb = ResponseBuilder.create()
      .icon('📦')
      .title('Skill 命令')
      .line('管理系统技能和 Agent 技能')
      .line()
      .section('可用子命令')
      .line('list - 列出所有可用的系统技能')
      .line('installed - 列出当前 Agent 已安装的技能')
      .line('install <skill-id> - 安装技能到当前 Agent')
      .line('uninstall <skill-id> - 从当前 Agent 卸载技能')
      .line('enable <skill-id> - 启用已安装的技能')
      .line('disable <skill-id> - 禁用已安装的技能')
      .line('info <skill-id> - 查看技能详情');

    return rb.toResult(CommandType.UNKNOWN);
  }

  // ========================================================================
  // Handlers
  // ========================================================================

  private async handleList(): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skills = await manager.listSkills();

    if (skills.length === 0) {
      return ResponseBuilder.info('暂无系统技能。');
    }

    const rb = ResponseBuilder.create()
      .icon('📦')
      .title('可用系统技能');

    // 按类别分组
    const byCategory = groupBy(skills, s => s.category);

    for (const [category, items] of Object.entries(byCategory)) {
      rb.section(getCategoryName(category));
      for (const skill of items) {
        rb.line(`• ${skill.name}`);
        rb.line(`  ID: ${skill.id}`);
        rb.line(`  ${skill.description.slice(0, 45)}...`);
      }
    }

    rb.line()
      .line(`共 ${skills.length} 个技能`)
      .line('使用: /skill install <skill-id>');

    return rb.toResult(CommandType.UNKNOWN);
  }

  private async handleInstalled(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const agentId = context.agent.config.id;
    const skills = await manager.listAgentSkills(agentId, false);

    if (skills.length === 0) {
      return ResponseBuilder.info('当前 Agent 尚未安装任何技能。\n使用 /skill list 查看可用技能，/skill install <skill-id> 安装。');
    }

    const rb = ResponseBuilder.create()
      .icon('🔧')
      .title('已安装的技能');

    for (const skill of skills) {
      const skillInfo = await manager.getSkill(skill.skillId);
      if (skillInfo.ok) {
        const status = skill.enabled ? '✅' : '⏸️';
        rb.line(`${status} ${skillInfo.value.name} (${skill.skillId})`);
        rb.line(`   使用次数: ${skill.usageCount} 次`);
        if (skill.lastUsedAt) {
          rb.line(`   最后使用: ${new Date(skill.lastUsedAt).toLocaleString()}`);
        }
      }
    }

    rb.line()
      .line('使用 /skill enable <skill-id> 或 /skill disable <skill-id> 切换状态');

    return rb.toResult(CommandType.UNKNOWN);
  }

  private async handleInstall(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skillId = context.args[0];
    if (!skillId) {
      return ResponseBuilder.error('请指定技能ID，例如: /skill install searxng-search', 'MISSING_SKILL_ID');
    }

    const agentId = context.agent.config.id;
    const result = await manager.installSkill({
      skillId,
      agentId,
      enabled: true,
    });

    if (!result.ok) {
      return ResponseBuilder.error(`安装失败: ${result.error.message}`);
    }

    return ResponseBuilder.success(`技能 '${skillId}' 已成功安装到当前 Agent。`);
  }

  private async handleUninstall(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skillId = context.args[0];
    if (!skillId) {
      return ResponseBuilder.error('请指定技能ID，例如: /skill uninstall searxng-search', 'MISSING_SKILL_ID');
    }

    const agentId = context.agent.config.id;
    const result = await manager.uninstallSkill(skillId, agentId);

    if (!result.ok) {
      return ResponseBuilder.error(`卸载失败: ${result.error.message}`);
    }

    return ResponseBuilder.success(`技能 '${skillId}' 已成功卸载。`);
  }

  private async handleEnable(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skillId = context.args[0];
    if (!skillId) {
      return ResponseBuilder.error('请指定技能ID，例如: /skill enable searxng-search', 'MISSING_SKILL_ID');
    }

    const agentId = context.agent.config.id;
    const result = await manager.enableSkill(skillId, agentId);

    if (!result.ok) {
      return ResponseBuilder.error(`启用失败: ${result.error.message}`);
    }

    return ResponseBuilder.success(`技能 '${skillId}' 已启用。`);
  }

  private async handleDisable(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skillId = context.args[0];
    if (!skillId) {
      return ResponseBuilder.error('请指定技能ID，例如: /skill disable searxng-search', 'MISSING_SKILL_ID');
    }

    const agentId = context.agent.config.id;
    const result = await manager.disableSkill(skillId, agentId);

    if (!result.ok) {
      return ResponseBuilder.error(`禁用失败: ${result.error.message}`);
    }

    return ResponseBuilder.success(`技能 '${skillId}' 已禁用。`);
  }

  private async handleInfo(context: CommandContext): Promise<CommandResult> {
    const manager = getSkillManager();
    if (!manager) {
      return ResponseBuilder.error('技能管理器未初始化', 'SKILL_MANAGER_NOT_INITIALIZED');
    }

    const skillId = context.args[0];
    if (!skillId) {
      return ResponseBuilder.error('请指定技能ID，例如: /skill info searxng-search', 'MISSING_SKILL_ID');
    }

    const result = await manager.getSkill(skillId);
    if (!result.ok) {
      return ResponseBuilder.error(`获取技能信息失败: ${result.error.message}`);
    }

    const skill = result.value;
    const rb = ResponseBuilder.create()
      .icon('📖')
      .title(skill.name)
      .line(`ID: ${skill.id}`)
      .line(`版本: ${skill.version}`)
      .line(`类别: ${getCategoryName(skill.category)}`);

    if (skill.author) {
      rb.line(`作者: ${skill.author}`);
    }

    if (skill.tags.length > 0) {
      rb.line(`标签: ${skill.tags.join(', ')}`);
    }

    rb.section('描述').line(skill.description);

    // 检查是否已安装
    const agentId = context.agent.config.id;
    const installed = await manager.getAgentSkill(skillId, agentId);
    if (installed.ok) {
      rb.section('状态')
        .line(`状态: ${installed.value.enabled ? '✅ 已启用' : '⏸️ 已禁用'}`)
        .line(`使用次数: ${installed.value.usageCount}`);
    } else {
      rb.section('状态')
        .line('未安装')
        .line(`使用 /skill install ${skillId} 安装此技能`);
    }

    return rb.toResult(CommandType.UNKNOWN);
  }
}

// ========================================================================
// Helpers
// ========================================================================

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of array) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    'search': '🔍 搜索',
    'analysis': '📊 分析',
    'generation': '✨ 生成',
    'utility': '🛠️ 工具',
    'integration': '🔗 集成',
    'custom': '📝 自定义',
  };
  return names[category] || category;
}
