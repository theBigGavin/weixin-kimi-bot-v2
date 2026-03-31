/**
 * Task Command Handlers
 * 
 * Handles /task list, status, cancel commands.
 */

import { getLongTaskManager, getFlowTaskManager } from '../init/managers.js';

interface TaskCommandResult {
  type: string;
  success: boolean;
  response: string;
}

export async function handleTaskCommand(
  args: string[],
  _userId: string
): Promise<TaskCommandResult> {
  const action = args[0] || 'list';

  switch (action) {
    case 'list':
      return handleTaskList();
    case 'status':
      return handleTaskStatus(args[1]);
    case 'cancel':
      return await handleTaskCancel(args[1]);
    default:
      return {
        type: 'task',
        success: false,
        response: `未知操作: ${action}\n可用操作: list, status <id>, cancel <id>`,
      };
  }
}

function handleTaskList(): TaskCommandResult {
  const ltManager = getLongTaskManager();
  const ftManager = getFlowTaskManager();
  
  let response = '📋 任务列表\n================\n\n';
  
  if (ltManager) {
    const longTasks = ltManager.getAllTasks();
    if (longTasks.length > 0) {
      response += `【长任务】(${longTasks.length})\n`;
      longTasks.slice(0, 5).forEach(task => {
        const status = task.status === 'completed' ? '✅' : 
                       task.status === 'running' ? '🔄' : 
                       task.status === 'failed' ? '❌' : '⏳';
        response += `${status} ${task.id.substring(0, 16)}... ${task.status} (${task.progress}%)\n`;
      });
      if (longTasks.length > 5) {
        response += `... 还有 ${longTasks.length - 5} 个任务\n`;
      }
      response += '\n';
    }
  }
  
  if (ftManager) {
    const flowTasks = ftManager.getAllTasks();
    if (flowTasks.length > 0) {
      response += `【流程任务】(${flowTasks.length})\n`;
      flowTasks.slice(0, 5).forEach(task => {
        const status = task.status === 'completed' ? '✅' : 
                       task.status === 'running' ? '🔄' :
                       task.status === 'waiting_confirm' ? '⏸️' :
                       task.status === 'failed' ? '❌' : '⏳';
        const progress = `${task.currentStep}/${task.plan.length}`;
        response += `${status} ${task.id.substring(0, 16)}... ${task.status} (${progress})\n`;
      });
      if (flowTasks.length > 5) {
        response += `... 还有 ${flowTasks.length - 5} 个任务\n`;
      }
      response += '\n';
    }
  }
  
  if (response === '📋 任务列表\n================\n\n') {
    response += '暂无任务\n';
  }
  
  response += '\n使用 /task status <id> 查看详情';
  
  return { type: 'task', success: true, response };
}

function handleTaskStatus(taskId: string): TaskCommandResult {
  if (!taskId) {
    return {
      type: 'task',
      success: false,
      response: '请提供任务ID: /task status <task-id>',
    };
  }

  const ltManager = getLongTaskManager();
  if (ltManager) {
    const task = ltManager.getTask(taskId);
    if (task) {
      let response = `📋 长任务详情\n================\n\n`;
      response += `任务ID: ${task.id}\n`;
      response += `状态: ${task.status}\n`;
      response += `进度: ${task.progress}%\n`;
      response += `创建时间: ${new Date(task.createdAt).toLocaleString()}\n`;
      if (task.startedAt) {
        response += `开始时间: ${new Date(task.startedAt).toLocaleString()}\n`;
      }
      if (task.completedAt) {
        response += `完成时间: ${new Date(task.completedAt).toLocaleString()}\n`;
      }
      
      if (task.progressLogs.length > 0) {
        response += `\n最近进度:\n`;
        task.progressLogs.slice(-5).forEach(log => {
          response += `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}\n`;
        });
      }
      
      if (task.result) {
        response += `\n📄 执行结果:\n${task.result.substring(0, 1000)}`;
        if (task.result.length > 1000) {
          response += '\n... (内容已截断)';
        }
      }
      if (task.error) {
        response += `\n❌ 错误: ${task.error}`;
      }
      
      return { type: 'task', success: true, response };
    }
  }

  const ftManager = getFlowTaskManager();
  if (ftManager) {
    const task = ftManager.getTask(taskId);
    if (task) {
      const report = ftManager.generateReport(taskId);
      return { type: 'task', success: true, response: report };
    }
  }

  return {
    type: 'task',
    success: false,
    response: `未找到任务: ${taskId}`,
  };
}

async function handleTaskCancel(taskId: string): Promise<TaskCommandResult> {
  if (!taskId) {
    return {
      type: 'task',
      success: false,
      response: '请提供任务ID: /task cancel <task-id>',
    };
  }

  const ltManager = getLongTaskManager();
  if (ltManager) {
    const task = await ltManager.cancel(taskId);
    if (task) {
      return {
        type: 'task',
        success: true,
        response: `✅ 已取消长任务: ${taskId}`,
      };
    }
  }

  const ftManager = getFlowTaskManager();
  if (ftManager) {
    const task = await ftManager.cancel(taskId);
    if (task) {
      return {
        type: 'task',
        success: true,
        response: `✅ 已取消流程任务: ${taskId}`,
      };
    }
  }

  return {
    type: 'task',
    success: false,
    response: `未找到可取消的任务: ${taskId}`,
  };
}
