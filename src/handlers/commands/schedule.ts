/**
 * Schedule Command Handler
 * 
 * Handles /schedule command for managing scheduled tasks.
 */

import { SchedulerManager, ScheduleType, type ScheduledTask } from '../../scheduler/manager.js';
import type { Agent } from '../../agent/types.js';
import { CommandType, type CommandResult } from '../command-handler.js';

const HELP_TEXT = `📅 定时任务帮助

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

export async function handleSchedule(args: string[], agent: Agent): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      type: CommandType.SCHEDULE,
      success: false,
      response: '❌ 请指定操作。用法: /schedule <list|create|cancel|help>',
      error: 'Missing subcommand',
    };
  }

  const scheduler = SchedulerManager.getInstance();
  const subCommand = args[0].toLowerCase();

  switch (subCommand) {
    case 'help':
      return { type: CommandType.SCHEDULE, success: true, response: HELP_TEXT };

    case 'list':
      return handleScheduleList(scheduler);

    case 'create':
      return handleScheduleCreate(args, scheduler, agent);

    case 'cancel':
      return handleScheduleCancel(args, scheduler);

    default:
      return {
        type: CommandType.SCHEDULE,
        success: false,
        response: `❌ 未知操作: ${subCommand}。可用操作: list, create, cancel, help`,
        error: 'Unknown subcommand',
      };
  }
}

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

function handleScheduleList(scheduler: SchedulerManager): CommandResult {
  const tasks = scheduler.list();
  if (tasks.length === 0) {
    return {
      type: CommandType.SCHEDULE,
      success: true,
      response: '📅 当前没有定时任务',
    };
  }

  const taskList = tasks
    .map(t => `• ${t.id}\n  名称: ${t.name}\n  处理器: ${t.handler}\n  类型: ${formatSchedule(t)}\n  状态: ${t.status}`)
    .join('\n\n');

  return {
    type: CommandType.SCHEDULE,
    success: true,
    response: `📅 定时任务列表（共 ${tasks.length} 个）:\n\n${taskList}`,
  };
}

function handleScheduleCreate(
  args: string[],
  scheduler: SchedulerManager,
  agent: Agent
): CommandResult {
  if (args.length < 4) {
    return {
      type: CommandType.SCHEDULE,
      success: false,
      response: '❌ 参数不足。用法: /schedule create <类型> <时间> <处理器> [数据]',
      error: 'Insufficient arguments',
    };
  }

  const typeStr = args[1].toUpperCase();
  const scheduleValue = args[2];
  const handlerName = args[3];
  const dataValue = args.slice(4).join(' ') || undefined;

  let type: ScheduleType;
  let scheduleConfig: { delay?: number; interval?: number; cron?: string };

  switch (typeStr) {
    case 'ONCE': {
      type = ScheduleType.ONCE;
      const timestamp = Date.parse(scheduleValue);
      if (!isNaN(timestamp)) {
        scheduleConfig = { delay: timestamp - Date.now() };
      } else {
        const minutes = parseInt(scheduleValue, 10);
        if (isNaN(minutes) || minutes <= 0) {
          return {
            type: CommandType.SCHEDULE,
            success: false,
            response: `❌ 无效的时间格式: ${scheduleValue}。请使用 ISO 时间 (如 2026-04-01T10:00:00) 或分钟数`,
            error: 'Invalid time format',
          };
        }
        scheduleConfig = { delay: minutes * 60 * 1000 };
      }
      break;
    }
    case 'INTERVAL': {
      type = ScheduleType.INTERVAL;
      const ms = parseInt(scheduleValue, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          type: CommandType.SCHEDULE,
          success: false,
          response: `❌ 无效的间隔: ${scheduleValue}。请使用毫秒数`,
          error: 'Invalid interval',
        };
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
      return {
        type: CommandType.SCHEDULE,
        success: false,
        response: `❌ 无效的任务类型: ${typeStr}。可用类型: ONCE, INTERVAL, CRON`,
        error: 'Invalid schedule type',
      };
  }

  try {
    const task = scheduler.schedule({
      name: `${handlerName}_${Date.now()}`,
      type,
      schedule: scheduleConfig,
      handler: handlerName,
      data: dataValue ? { message: dataValue, agentId: agent.id } : { agentId: agent.id },
    });

    const timeDisplay = type === ScheduleType.ONCE 
      ? new Date(Date.now() + (scheduleConfig.delay || 0)).toLocaleString()
      : type === ScheduleType.INTERVAL
        ? `${scheduleConfig.interval}ms`
        : scheduleConfig.cron;

    return {
      type: CommandType.SCHEDULE,
      success: true,
      response: `✅ 定时任务已创建\n任务ID: ${task.id}\n处理器: ${handlerName}\n时间: ${timeDisplay}`,
      data: { taskId: task.id },
    };
  } catch (error) {
    return {
      type: CommandType.SCHEDULE,
      success: false,
      response: '❌ 创建任务失败: ' + (error as Error).message,
      error: (error as Error).message,
    };
  }
}

function handleScheduleCancel(args: string[], scheduler: SchedulerManager): CommandResult {
  if (args.length < 2) {
    return {
      type: CommandType.SCHEDULE,
      success: false,
      response: '❌ 请指定任务ID。用法: /schedule cancel <任务ID>',
      error: 'Missing task ID',
    };
  }

  const taskId = args[1];
  const success = scheduler.cancel(taskId);

  if (success) {
    return {
      type: CommandType.SCHEDULE,
      success: true,
      response: `✅ 任务 ${taskId} 已取消`,
    };
  } else {
    return {
      type: CommandType.SCHEDULE,
      success: false,
      response: `❌ 任务 ${taskId} 不存在或已执行完毕`,
      error: 'Task not found',
    };
  }
}
