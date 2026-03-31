/**
 * Task Command
 * 
 * Manages long-running and flow tasks:
 * - list: list all tasks
 * - status <id>: show task status
 * - cancel <id>: cancel a task
 */

import { 
  Command, 
  SubCommand, 
  CommandContext, 
  CommandResult, 
  CommandType,
  ResponseBuilder 
} from './framework.js';
import { getLongTaskManager, getFlowTaskManager } from '../init/managers.js';

export class TaskCommand extends Command {
  constructor() {
    super({
      name: 'task',
      description: '管理长任务和流程任务',
      usage: '/task <子命令>',
      examples: ['/task list', '/task status <id>', '/task cancel <id>'],
    });

    this.registerSubCommand(new TaskListSubCommand());
    this.registerSubCommand(new TaskStatusSubCommand());
    this.registerSubCommand(new TaskCancelSubCommand());
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;
    const action = args[0] || 'list';

    // Execute sub-command
    const result = await this.executeSubCommand(action, { ...context, args: args.slice(1) });
    // Ensure type is set
    if (!result.type) result.type = CommandType.TASK;
    return result;
  }
}

// ============================================================================
// Sub Commands
// ============================================================================

class TaskListSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'list',
      description: '列出所有任务',
      usage: '',
      examples: ['/task list'],
    });
  }

  execute(_context: CommandContext): CommandResult {
    const ltManager = getLongTaskManager();
    const ftManager = getFlowTaskManager();

    const rb = ResponseBuilder.create().title('📋 任务列表');

    // Long tasks
    if (ltManager) {
      const longTasks = ltManager.getAllTasks();
      if (longTasks.length > 0) {
        rb.section(`长任务 (${longTasks.length})`);
        longTasks.slice(0, 5).forEach(task => {
          const status = getStatusIcon(task.status);
          rb.line(`${status} ${task.id.substring(0, 16)}... ${task.status} (${task.progress}%)`);
        });
        if (longTasks.length > 5) {
          rb.line(`... 还有 ${longTasks.length - 5} 个任务`);
        }
        rb.line();
      }
    }

    // Flow tasks
    if (ftManager) {
      const flowTasks = ftManager.getAllTasks();
      if (flowTasks.length > 0) {
        rb.section(`流程任务 (${flowTasks.length})`);
        flowTasks.slice(0, 5).forEach(task => {
          const status = getStatusIcon(task.status);
          const progress = `${task.currentStep}/${task.plan.length}`;
          rb.line(`${status} ${task.id.substring(0, 16)}... ${task.status} (${progress})`);
        });
        if (flowTasks.length > 5) {
          rb.line(`... 还有 ${flowTasks.length - 5} 个任务`);
        }
        rb.line();
      }
    }

    // Check if empty
    const hasTasks = (ltManager && ltManager.getAllTasks().length > 0) ||
                     (ftManager && ftManager.getAllTasks().length > 0);
    
    if (!hasTasks) {
      rb.line('暂无任务');
    }

    rb.line().line('使用 /task status <id> 查看详情');

    return rb.toResult(CommandType.TASK);
  }
}

class TaskStatusSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'status',
      description: '查看任务详情',
      usage: '<任务ID>',
      examples: ['/task status abc123'],
    });
  }

  execute(context: CommandContext): CommandResult {
    const { args } = context;
    const taskId = args[0];

    if (!taskId) {
      return ResponseBuilder.error('请提供任务ID: /task status <task-id>', 'MissingTaskId', CommandType.TASK);
    }

    // Check long tasks
    const ltManager = getLongTaskManager();
    if (ltManager) {
      const task = ltManager.getTask(taskId);
      if (task) {
        return this.formatLongTask(task);
      }
    }

    // Check flow tasks
    const ftManager = getFlowTaskManager();
    if (ftManager) {
      const task = ftManager.getTask(taskId);
      if (task) {
        return {
          type: CommandType.TASK,
          success: true,
          response: ftManager.generateReport(taskId),
        };
      }
    }

    return ResponseBuilder.error(`未找到任务: ${taskId}`, 'TaskNotFound', CommandType.TASK);
  }

  private formatLongTask(task: ReturnType<LongTaskManager['getTask']>): CommandResult {
    const rb = ResponseBuilder.create().title('📋 长任务详情');
    
    rb.line(`任务ID: ${task!.id}`);
    rb.line(`状态: ${task!.status}`);
    rb.line(`进度: ${task!.progress}%`);
    rb.line(`创建时间: ${new Date(task!.createdAt).toLocaleString()}`);
    
    if (task!.startedAt) {
      rb.line(`开始时间: ${new Date(task!.startedAt).toLocaleString()}`);
    }
    if (task!.completedAt) {
      rb.line(`完成时间: ${new Date(task!.completedAt).toLocaleString()}`);
    }

    if (task!.progressLogs.length > 0) {
      rb.section('最近进度');
      task!.progressLogs.slice(-5).forEach(log => {
        rb.line(`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`);
      });
    }

    if (task!.result) {
      rb.section('执行结果');
      rb.line(task!.result.substring(0, 1000));
      if (task!.result.length > 1000) {
        rb.line('... (内容已截断)');
      }
    }

    if (task!.error) {
      rb.section('错误');
      rb.line(`❌ ${task!.error}`);
    }

    return rb.toResult(CommandType.TASK);
  }
}

class TaskCancelSubCommand extends SubCommand {
  constructor() {
    super({
      name: 'cancel',
      description: '取消任务',
      usage: '<任务ID>',
      examples: ['/task cancel abc123'],
    });
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;
    const taskId = args[0];

    if (!taskId) {
      return ResponseBuilder.error('请提供任务ID: /task cancel <task-id>', 'MissingTaskId', CommandType.TASK);
    }

    // Try long tasks
    const ltManager = getLongTaskManager();
    if (ltManager) {
      const task = await ltManager.cancel(taskId);
      if (task) {
        return ResponseBuilder.success(`已取消长任务: ${taskId}`, CommandType.TASK);
      }
    }

    // Try flow tasks
    const ftManager = getFlowTaskManager();
    if (ftManager) {
      const task = await ftManager.cancel(taskId);
      if (task) {
        return ResponseBuilder.success(`已取消流程任务: ${taskId}`, CommandType.TASK);
      }
    }

    return ResponseBuilder.error(`未找到可取消的任务: ${taskId}`, 'TaskNotFound', CommandType.TASK);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '🔄';
    case 'waiting_confirm': return '⏸️';
    case 'failed': return '❌';
    default: return '⏳';
  }
}

// Type imports for the formatter
type LongTaskManager = NonNullable<ReturnType<typeof getLongTaskManager>>;
