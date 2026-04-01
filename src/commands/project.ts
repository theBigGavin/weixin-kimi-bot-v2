/**
 * Project Command
 * 
 * 项目空间管理命令
 * /project create|use|list|status|delete
 */

import { 
  Command, 
  SubCommand, 
  CommandContext, 
  CommandResult, 
  CommandType,
  ResponseBuilder 
} from './framework.js';
import {
  ProjectType,
  ProjectStatus,
  getProjectTypeDisplay,
  getProjectStatusDisplay,
  hasEnabledCapabilities,
  getEnabledCapabilities,
} from '../projectspace/types.js';
import { ProjectManager } from '../projectspace/manager.js';

export class ProjectCommand extends Command {
  constructor() {
    super({
      name: 'project',
      description: '项目空间管理 - 创建、切换、管理多项目',
      usage: '/project <子命令>',
      examples: [
        '/project list',
        '/project create 量化交易系统 --type tool',
        '/project use 量化交易系统',
        '/project status',
        '/project delete 旧项目',
      ],
    });

    this.registerSubCommand(new ProjectCreateSubCommand());
    this.registerSubCommand(new ProjectUseSubCommand());
    this.registerSubCommand(new ProjectListSubCommand());
    this.registerSubCommand(new ProjectDeleteSubCommand());
  }

  generateHelp(): string {
    return `📁 项目空间帮助

用法：
• /project list - 列出所有项目
• /project create <名称> [选项] - 创建新项目
• /project use <名称> - 切换到指定项目
• /project status - 查看当前项目状态
• /project delete <名称> - 删除项目

创建项目选项：
• --type <tool|library|service|knowledge> - 项目类型
• --desc <描述> - 项目描述

示例：
• /project create 量化交易系统 --type tool --desc "A股量化投资工具"
• /project use 量化交易系统
• /project list

项目类型：
• tool - 可执行工具
• library - 代码库/包
• service - 服务
• knowledge - 知识库`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;

    if (args.length === 0) {
      // 无参数时显示当前项目状态
      return this.showStatus(context);
    }

    const subCommand = args[0].toLowerCase();
    if (subCommand === 'help') {
      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: this.generateHelp(),
      };
    }

    const result = await this.executeSubCommand(subCommand, { ...context, args: args.slice(1) });
    if (!result.type) result.type = CommandType.UNKNOWN;
    return result;
  }

  private async showStatus(context: CommandContext): Promise<CommandResult> {
    const agent = context.agent;
    const projectManager = await getProjectManager(agent.id, agent.config.workspace.path);
    const activeProject = projectManager.getActiveProject();

    if (!activeProject) {
      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: ResponseBuilder.create()
          .title('📁 项目空间')
          .line('当前没有活跃项目')
          .line('')
          .line('可用命令:')
          .line('  /project list - 查看所有项目')
          .line('  /project create <名称> - 创建新项目')
          .line('  /project use <名称> - 切换到项目')
          .build(),
      };
    }

    const response = ResponseBuilder.create()
      .title('📁 当前项目')
      .line(`名称: ${activeProject.name}`)
      .line(`类型: ${getProjectTypeDisplay(activeProject.type)}`)
      .line(`状态: ${getProjectStatusDisplay(activeProject.status)}`)
      .line(`代码目录: ${activeProject.path}`)
      .line(`工作目录: ${activeProject.workspacePath}`)
      .line('');

    if (hasEnabledCapabilities(activeProject)) {
      response.line('💡 可用能力:');
      for (const cap of getEnabledCapabilities(activeProject)) {
        response.line(`  • ${cap.name} - ${cap.description}`);
      }
    }

    response.line('')
      .line('提示:')
      .line('  • 源码修改 → ./project/')
      .line('  • 临时文件 → ./workspace/tmp/')
      .line('  • 项目知识 → ./PARA/Projects/');

    return {
      type: CommandType.UNKNOWN,
      success: true,
      response: response.build(),
    };
  }
}

// ============================================================================
// Sub Commands
// ============================================================================

class ProjectCreateSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'create',
      description: '创建新项目',
      usage: '<名称> [--type tool|library|service|knowledge] [--desc 描述]',
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const name = args[0];

    if (!name) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '❌ 请提供项目名称: /project create <名称>',
      };
    }

    let type = ProjectType.TOOL;
    let description: string | undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) {
        type = args[i + 1] as ProjectType;
        i++;
      } else if (args[i] === '--desc' && args[i + 1]) {
        description = args[i + 1];
        i++;
      }
    }

    try {
      const projectManager = await getProjectManager(agent.id, agent.config.workspace.path);
      
      const existing = projectManager.getProjectByName(name);
      if (existing) {
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: `❌ 项目 "${name}" 已存在 (ID: ${existing.id})`,
        };
      }

      const project = await projectManager.createProject({
        name,
        description,
        type,
        switchTo: true,
      });

      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: ResponseBuilder.create()
          .title('✅ 项目已创建')
          .line(`名称: ${project.name}`)
          .line(`类型: ${getProjectTypeDisplay(project.type)}`)
          .line(`ID: ${project.id}`)
          .line('')
          .line('目录结构:')
          .line(`  代码: ${project.path}`)
          .line(`  工作: ${project.workspacePath}`)
          .line('')
          .line('项目已通过软链接绑定到 workspace')
          .line('现在你可以:')
          .line('  • 在 ./project/ 下修改源码')
          .line('  • 在 ./workspace/tmp/ 存放临时文件')
          .line('  • 在 ./PARA/ 整理项目知识')
          .build(),
      };
    } catch (error) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: `❌ 创建项目失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

class ProjectUseSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'use',
      description: '切换到指定项目',
      usage: '<项目名称或ID>',
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const identifier = args[0];

    if (!identifier) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '❌ 请提供项目名称或ID: /project use <名称>',
      };
    }

    try {
      const projectManager = await getProjectManager(agent.id, agent.config.workspace.path);
      
      let project = projectManager.getProjectByName(identifier);
      if (!project) {
        project = projectManager.getProjectById(identifier);
      }

      if (!project) {
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: `❌ 未找到项目: ${identifier}\n使用 /project list 查看所有项目`,
        };
      }

      const result = await projectManager.switchToProject(project.id);

      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: ResponseBuilder.create()
          .title('✅ 已切换项目')
          .line(`当前项目: ${project.name}`)
          .line(`类型: ${getProjectTypeDisplay(project.type)}`)
          .line('')
          .line('工作目录已更新:')
          .line(`  ${result.workspacePath}`)
          .line('')
          .line('你可以通过以下方式访问项目:')
          .line('  • ./project/ - 项目源码目录')
          .line('  • ./workspace/ - 项目工作空间')
          .line('  • ./PARA/ - 项目知识管理')
          .build(),
      };
    } catch (error) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: `❌ 切换项目失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

class ProjectListSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'list',
      description: '列出所有项目',
      usage: '[--all|--active|--paused|--completed|--archived]',
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const filter = args[0];

    try {
      const projectManager = await getProjectManager(agent.id, agent.config.workspace.path);
      const projects = projectManager.getProjects();
      const activeProject = projectManager.getActiveProject();

      if (projects.length === 0) {
        return {
          type: CommandType.UNKNOWN,
          success: true,
          response: '暂无项目\n使用 /project create <名称> 创建新项目',
        };
      }

      const response = ResponseBuilder.create().title('📁 项目列表');
      const grouped = projectManager.getProjectsByStatus();

      for (const [status, list] of Object.entries(grouped)) {
        if (list.length === 0) continue;
        if (filter && filter !== `--${status}` && filter !== '--all') continue;

        response.line('').line(`${getProjectStatusDisplay(status as ProjectStatus)}:`);

        for (const project of list) {
          const isActive = activeProject?.id === project.id;
          const activeMark = isActive ? ' ⭐' : '';
          const caps = hasEnabledCapabilities(project) 
            ? ` (${getEnabledCapabilities(project).length}个能力)` 
            : '';
          
          response.line(`  • ${project.name}${activeMark} [${project.type}]${caps}`);
          if (project.description) {
            response.line(`    ${project.description}`);
          }
        }
      }

      response.line('')
        .line('提示:')
        .line('  /project use <名称> - 切换项目')
        .line('  /project status - 查看当前项目详情');

      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: response.build(),
      };
    } catch (error) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: `❌ 获取项目列表失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

class ProjectDeleteSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'delete',
      description: '删除项目',
      usage: '<项目名称> [--force]',
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, agent } = context;
    const name = args[0];

    if (!name) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: '❌ 请提供项目名称: /project delete <名称>',
      };
    }

    const force = args.includes('--force');

    try {
      const projectManager = await getProjectManager(agent.id, agent.config.workspace.path);
      const project = projectManager.getProjectByName(name);

      if (!project) {
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: `❌ 未找到项目: ${name}`,
        };
      }

      if (!force) {
        return {
          type: CommandType.UNKNOWN,
          success: false,
          response: ResponseBuilder.create()
            .title('⚠️ 确认删除')
            .line(`即将删除项目: ${project.name}`)
            .line(`代码目录: ${project.path}`)
            .line('')
            .line('此操作不会删除代码文件，仅从项目中移除。')
            .line('确认删除请发送: /project delete ' + name + ' --force')
            .build(),
        };
      }

      await projectManager.deleteProject(project.id, false);

      return {
        type: CommandType.UNKNOWN,
        success: true,
        response: `✅ 项目 "${project.name}" 已删除`,
      };
    } catch (error) {
      return {
        type: CommandType.UNKNOWN,
        success: false,
        response: `❌ 删除项目失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ============================================================================
// Helper
// ============================================================================

const projectManagerCache = new Map<string, ProjectManager>();

async function getProjectManager(
  agentId: string,
  workspacePath: string
): Promise<ProjectManager> {
  const cacheKey = `${agentId}:projectmanager`;
  
  if (projectManagerCache.has(cacheKey)) {
    return projectManagerCache.get(cacheKey)!;
  }

  const { ProjectManager } = await import('../projectspace/manager.js');
  const defaultProjectsPath = `${process.env.HOME || '/tmp'}/projects`;
  
  const manager = new ProjectManager({
    agentId,
    agentWorkspacePath: workspacePath,
    defaultProjectsPath,
    configPath: `${workspacePath}/projects.json`,
  });

  projectManagerCache.set(cacheKey, manager);
  return manager;
}
