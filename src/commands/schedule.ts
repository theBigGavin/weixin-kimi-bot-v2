/**
 * Schedule Command
 * 
 * Manages scheduled tasks with sub-commands:
 * - list: list all tasks
 * - create: create a new task
 * - cancel: cancel a task
 * - help: show help
 */

import { 
  Command, 
  SubCommand, 
  CommandContext, 
  CommandResult, 
  CommandType,
  ResponseBuilder 
} from './framework.js';
import { SchedulerManager, ScheduleType, type ScheduledTask } from '../scheduler/manager.js';

export class ScheduleCommand extends Command {
  constructor() {
    super({
      name: 'schedule',
      description: '管理定时任务（创建、查看、取消）',
      usage: '/schedule <子命令>',
      examples: [
        '/schedule list',
        '/schedule create once 5 reminder 5分钟后提醒我',
        '/schedule create interval 3600000 health_check',
        '/schedule cancel <任务ID>',
      ],
    });

    this.registerSubCommand(new ScheduleListSubCommand());
    this.registerSubCommand(new ScheduleCreateSubCommand());
    this.registerSubCommand(new ScheduleCancelSubCommand());
  }

  generateHelp(): string {
    return `📅 定时任务帮助

用法：
• /schedule list - 列出所有定时任务
• /schedule create <类型> <时间> <处理器> [数据] - 创建任务
• /schedule cancel <任务ID> - 取消任务
• /schedule help - 显示此帮助

任务类型：
• once - 一次性任务（格式: ISO时间 或 延迟分钟数）
• interval - 间隔任务（格式: 毫秒数，如 60000=1分钟）
• cron - Cron表达式（格式: 标准cron如 0 9 * * *）

示例：
• /schedule create once 5 reminder 5分钟后提醒我
• /schedule create once 2026-04-01T10:00:00 reminder 早上好
• /schedule create interval 3600000 health_check
• /schedule create cron "0 9 * * *" daily_report

可用处理器: reminder, daily_report, health_check`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;

    // No args: return error
    if (args.length === 0) {
      return {
        type: CommandType.SCHEDULE,
        success: false,
        response: '❌ 请指定操作。用法: /schedule <list|create|cancel|help>',
        error: 'Missing subcommand',
      };
    }

    // Execute sub-command
    const subCommand = args[0].toLowerCase();
    if (subCommand === 'help') {
      return {
        type: CommandType.SCHEDULE,
        success: true,
        response: this.generateHelp(),
      };
    }

    const result = await this.executeSubCommand(subCommand, { ...context, args: args.slice(1) });
    // Ensure type is set
    if (!result.type) result.type = CommandType.SCHEDULE;
    return result;
  }
}

// ============================================================================
// Sub Commands
// ============================================================================

class ScheduleListSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'list',
      description: '列出所有定时任务',
      usage: '',
      examples: ['/schedule list'],
    });
  }

  execute(_context: CommandContext): CommandResult {
    const scheduler = SchedulerManager.getInstance();
    const tasks = scheduler.list();

    if (tasks.length === 0) {
      return {
        type: CommandType.SCHEDULE,
        success: true,
        response: '📅 当前没有定时任务',
      };
    }

    const rb = ResponseBuilder.create()
      .title(`📅 定时任务列表（共 ${tasks.length} 个）`);

    tasks.forEach(t => {
      rb.line();
      rb.line(`• ${t.id}`);
      rb.line(`  名称: ${t.name}`);
      rb.line(`  处理器: ${t.handler}`);
      rb.line(`  类型: ${formatSchedule(t)}`);
      rb.line(`  状态: ${t.status}`);
    });

    return rb.toResult(CommandType.SCHEDULE);
  }
}

class ScheduleCreateSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'create',
      description: '创建新的定时任务',
      usage: '<类型> <时间> <处理器> [数据]',
      examples: [
        '/schedule create once 5 reminder 5分钟后提醒我',
        '/schedule create once 2026-04-01T10:00:00 reminder 早上好',
        '/schedule create interval 3600000 health_check',
        '/schedule create cron "0 9 * * *" daily_report',
      ],
    });
  }

  execute(context: CommandContext): CommandResult {
    const { args, agent } = context;

    if (args.length < 3) {
      return ResponseBuilder.error(
        '参数不足。用法: /schedule create <类型> <时间> <处理器> [数据]',
        'Insufficient arguments',
        CommandType.SCHEDULE
      );
    }

    const typeStr = args[0].toUpperCase();
    const scheduleValue = args[1];
    const handlerName = args[2];
    const dataValue = args.slice(3).join(' ') || undefined;

    let type: ScheduleType;
    let scheduleConfig: { delay?: number; interval?: number; cron?: string };

    switch (typeStr) {
      case 'ONCE': {
        type = ScheduleType.ONCE;
        // Check if it's a pure number (treat as minutes)
        const isPureNumber = /^\d+$/.test(scheduleValue);
        if (isPureNumber) {
          const minutes = parseInt(scheduleValue, 10);
          if (minutes <= 0) {
            return ResponseBuilder.error(
              `无效的分钟数: ${scheduleValue}。请使用正整数表示分钟`,
              'InvalidTimeFormat',
              CommandType.SCHEDULE
            );
          }
          scheduleConfig = { delay: minutes * 60 * 1000 };
        } else {
          // Try parsing as ISO timestamp
          const timestamp = Date.parse(scheduleValue);
          if (isNaN(timestamp)) {
            return ResponseBuilder.error(
              `无效的时间格式: ${scheduleValue}。请使用 ISO 时间 (如 2026-04-01T10:00:00) 或分钟数`,
              'InvalidTimeFormat',
              CommandType.SCHEDULE
            );
          }
          scheduleConfig = { delay: timestamp - Date.now() };
        }
        break;
      }
      case 'INTERVAL': {
        type = ScheduleType.INTERVAL;
        const ms = parseInt(scheduleValue, 10);
        if (isNaN(ms) || ms <= 0) {
          return ResponseBuilder.error(
            `无效的间隔: ${scheduleValue}。请使用毫秒数`,
            'InvalidInterval',
            CommandType.SCHEDULE
          );
        }
        scheduleConfig = { interval: ms };
        break;
      }
      case 'CRON': {
        type = ScheduleType.CRON;
        scheduleConfig = { cron: scheduleValue };
        break;
      }
      default:
        return ResponseBuilder.error(
          `无效的任务类型: ${typeStr}。可用类型: ONCE, INTERVAL, CRON`,
          'Invalid schedule type',
          CommandType.SCHEDULE
        );
    }

    try {
      const scheduler = SchedulerManager.getInstance();
      const task = scheduler.schedule({
        name: `${handlerName}_${Date.now()}`,
        type,
        schedule: scheduleConfig,
        handler: handlerName,
        data: dataValue 
          ? { message: dataValue, agentId: agent.id, userId: agent.wechat.accountId }
          : { agentId: agent.id, userId: agent.wechat.accountId },
      });

      const timeDisplay = type === ScheduleType.ONCE 
        ? new Date(Date.now() + (scheduleConfig.delay || 0)).toLocaleString()
        : type === ScheduleType.INTERVAL
          ? `${scheduleConfig.interval}ms`
          : scheduleConfig.cron;

      return {
        type: CommandType.SCHEDULE,
        success: true,
        response: ResponseBuilder.create()
          .line('✅ 定时任务已创建')
          .line(`任务ID: ${task.id}`)
          .line(`处理器: ${handlerName}`)
          .line(`时间: ${timeDisplay}`)
          .build(),
        data: { taskId: task.id },
      };
    } catch (error) {
      return ResponseBuilder.error('创建任务失败: ' + (error as Error).message, undefined, CommandType.SCHEDULE);
    }
  }
}

class ScheduleCancelSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'cancel',
      description: '取消指定的定时任务',
      usage: '<任务ID>',
      examples: ['/schedule cancel task_123456'],
    });
  }

  execute(context: CommandContext): CommandResult {
    const { args } = context;

    if (args.length < 1) {
      return ResponseBuilder.error('请指定任务ID。用法: /schedule cancel <任务ID>', 'Missing task ID', CommandType.SCHEDULE);
    }

    const taskId = args[0];
    const scheduler = SchedulerManager.getInstance();
    const success = scheduler.cancel(taskId);

    if (success) {
      return ResponseBuilder.success(`任务 ${taskId} 已取消`, CommandType.SCHEDULE);
    } else {
      return ResponseBuilder.error(
        `任务 ${taskId} 不存在或已执行完毕`,
        'Task not found',
        CommandType.SCHEDULE
      );
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatSchedule(task: ScheduledTask): string {
  switch (task.type) {
    case ScheduleType.ONCE:
      return `一次性: ${task.schedule.delay ? new Date(Date.now() + task.schedule.delay).toLocaleString() : '未设置'}`;
    case ScheduleType.INTERVAL:
      return `间隔: ${task.schedule.interval}ms`;
    case ScheduleType.CRON:
      return `Cron: ${task.schedule.cron}`;
    default:
      return '未知';
  }
}
