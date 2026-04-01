/**
 * Task Execution Module
 * 
 * Handles DIRECT, LONGTASK, and FLOWTASK execution modes.
 */

import type { ILinkClient } from 'weixin-ilink';
import {
  initACPManager,
  initMemoryExtractor,
  initMemoryManager,
  getAgent,
  getLongTaskManager,
  getFlowTaskManager,
} from '../init/managers.js';
import { dialogueCache } from '../init/state.js';
import { waitingFlowTasks, CONFIRM_KEYWORDS, CANCEL_KEYWORDS, SKIP_KEYWORDS } from '../init/state.js';
import { createTaskSubmission, TaskPriority } from '../task-router/index.js';
import { ProjectManager } from '../projectspace/manager.js';
import { createAgentLogger } from '../logging/index.js';

/**
 * 获取当前工作目录（考虑项目切换）
 */
async function getWorkingDirectory(agentId: string, baseWorkspacePath: string): Promise<string> {
  // 尝试加载项目配置
  const projectManager = new ProjectManager({
    agentId,
    agentWorkspacePath: baseWorkspacePath,
    defaultProjectsPath: `${process.env.HOME || '/tmp'}/projects`,
    configPath: `${baseWorkspacePath}/projects.json`,
  });

  const activeProject = projectManager.getActiveProject();
  if (activeProject) {
    return activeProject.workspacePath;
  }

  return baseWorkspacePath;
}

export async function executeDirect(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  createAgentLogger(agentId).info('🚀 DIRECT mode execution');
  
  const start = Date.now();
  
  let dialogue = dialogueCache.get(fromUser) || [];
  dialogue.push({
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });
  
  if (dialogue.length > 20) {
    dialogue = dialogue.slice(-20);
  }
  dialogueCache.set(fromUser, dialogue);
  
  try {
    const manager = await initACPManager();
    const agent = await getAgent(agentId, fromUser);
    const workspacePath = await getWorkingDirectory(agentId, agent.config.workspace.path);
    const response = await manager.prompt(fromUser, { text }, workspacePath, agentId);

    const duration = Date.now() - start;
    createAgentLogger(agentId).info(`✅ Kimi 响应完成 (${(duration / 1000).toFixed(1)}s)`);

    if (response.error) {
      // 打印完整错误对象用于诊断
      createAgentLogger(agentId).error(`ACP error details:`, JSON.stringify(response, null, 2));
      
      // 处理各种错误格式
      let errorMsg: string;
      if (typeof response.error === 'string') {
        errorMsg = response.error;
      } else if (response.error && typeof response.error === 'object') {
        // 尝试提取错误信息
        const errObj = response.error as Record<string, unknown>;
        errorMsg = (errObj.message as string) 
          || (errObj.error as string) 
          || JSON.stringify(response.error);
      } else {
        errorMsg = String(response.error);
      }
      createAgentLogger(agentId).error(`ACP error message:`, errorMsg);
      throw new Error(errorMsg);
    }

    dialogue.push({
      role: 'assistant',
      content: response.text,
      timestamp: Date.now(),
    });
    dialogueCache.set(fromUser, dialogue);

    const chunks = await client.sendTextChunked(
      fromUser,
      response.text,
      contextToken
    );
    createAgentLogger(agentId).info(
      `📤 已发送回复 (${response.text.length} chars, ${chunks} 条消息)`
    );

    if (response.toolCalls && response.toolCalls.length > 0) {
      createAgentLogger(agentId).info(`🔧 工具调用: ${response.toolCalls.length} 次`);
      for (const tool of response.toolCalls) {
        createAgentLogger(agentId).info(`     - ${tool.title} (${tool.status})`);
      }
    }

    await extractAndSaveMemory(fromUser, agentId);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    createAgentLogger(agentId).error(`❌ 处理失败:`, errorMsg);
    await client
      .sendText(fromUser, `处理消息时出错: ${errorMsg}`, contextToken)
      .catch(() => {});
  }
}

export async function extractAndSaveMemory(
  userId: string,
  agentId: string
): Promise<void> {
  try {
    const extractor = initMemoryExtractor();
    const memManager = initMemoryManager();
    
    const dialogue = dialogueCache.get(userId) || [];
    
    if (!extractor.shouldExtract(dialogue)) {
      return;
    }
    
    const agent = await getAgent(agentId, userId);
    if (!agent) {
      createAgentLogger(agentId).warn(`[Memory] Agent not found: ${agentId}`);
      return;
    }
    
    let memory = await memManager.loadMemory(agentId, agent.name);
    
    if (!memory.config.autoExtract) {
      return;
    }
    
    createAgentLogger(agentId).info(`[Memory] Extracting memory for ${agentId}...`);
    
    const extractionPrompt = extractor.buildExtractionPrompt(dialogue);
    
    try {
      const acp = await initACPManager();
      const workspacePath = await getWorkingDirectory(agentId, agent.config.workspace.path);
      const extractionResult = await acp.prompt(userId, { text: extractionPrompt }, workspacePath, agentId);
      
      if (extractionResult.error) {
        createAgentLogger(agentId).error('[Memory] Extraction failed:', extractionResult.error);
        return;
      }
      
      const extraction = extractor.parseExtractionResult(extractionResult.text);
      
      const totalExtracted = 
        (extraction.facts?.length || 0) + 
        (extraction.projects?.length || 0) + 
        (extraction.learnings?.length || 0);
      
      if (totalExtracted === 0) {
        createAgentLogger(agentId).info('[Memory] No new information to extract');
        return;
      }
      
      memory = extractor.mergeIntoMemory(memory, extraction);
      await memManager.saveMemory(memory);
      
      createAgentLogger(agentId).info(`[Memory] Saved: ${extraction.facts?.length || 0} facts, ${extraction.projects?.length || 0} projects`);
      dialogueCache.delete(userId);
      
    } catch (extractErr) {
      createAgentLogger(agentId).error('[Memory] Extraction error:', extractErr);
    }
    
  } catch (err) {
    createAgentLogger(agentId).error('[Memory] Failed to extract/save memory:', err);
  }
}

export async function executeLongTask(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  createAgentLogger(agentId).info(`⏳ LONGTASK mode execution`);
  
  const ltManager = getLongTaskManager()!;
  const agent = await getAgent(agentId, fromUser);
  const workspacePath = await getWorkingDirectory(agentId, agent.config.workspace.path);
  
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.NORMAL,
  });
  
  const task = ltManager.submit(submission, workspacePath, fromUser, agentId, contextToken);
  
  const ackMessage = 
    `📋 任务已提交（长任务模式）\n` +
    `任务ID: ${task.id}\n` +
    `状态: 等待执行...\n\n` +
    `任务完成后会自动通知您，也可通过 /task status ${task.id} 查询。`;
  
  await client.sendText(fromUser, ackMessage, contextToken);
  
  const started = await ltManager.start(task.id, fromUser);
  if (started) {
    createAgentLogger(agentId).info(`✅ LongTask ${task.id} started`);
  } else {
    await client.sendText(
      fromUser, 
      `任务已排队，当前有 ${ltManager.getActiveCount()} 个任务正在执行。`,
      contextToken
    );
  }
}

export async function executeFlowTask(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  createAgentLogger(agentId).info(`🔄 FLOWTASK mode execution`);
  
  const ftManager = getFlowTaskManager()!;
  const agent = await getAgent(agentId, fromUser);
  const workspacePath = agent.config.workspace.path;
  
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.HIGH,
  });
  
  const plan = ftManager.createPlan(text);
  const task = ftManager.create(submission, plan, workspacePath);
  
  let planMessage = `📋 流程任务已创建\n任务ID: ${task.id}\n\n执行计划:\n`;
  plan.forEach((step, index) => {
    const confirmIcon = step.requiresConfirmation ? '⚠️' : '⏵';
    const duration = Math.round(step.estimatedDuration / 60000);
    planMessage += `${index + 1}. ${confirmIcon} ${step.description} (~${duration}分钟)\n`;
  });
  planMessage += `\n总步骤: ${plan.length} | 预估耗时: ${Math.round(plan.reduce((sum, s) => sum + s.estimatedDuration, 0) / 60000)}分钟\n\n`;
  planMessage += `发送 "确认" 开始执行，或发送 "取消" 放弃任务。`;
  
  await client.sendText(fromUser, planMessage, contextToken);
  
  waitingFlowTasks.set(fromUser, { taskId: task.id, agentId });
  
  createAgentLogger(agentId).info(`⏳ FlowTask ${task.id} waiting for confirmation`);
}

export async function handleFlowTaskConfirmation(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  _agentId: string
): Promise<boolean> {
  const waitingInfo = waitingFlowTasks.get(fromUser);
  if (!waitingInfo) return false;
  
  const { taskId } = waitingInfo;
  const ftManager = getFlowTaskManager()!;
  const task = ftManager.getTask(taskId);
  
  if (!task) {
    waitingFlowTasks.delete(fromUser);
    return false;
  }
  
  const lowerText = text.toLowerCase().trim();
  const isConfirm = CONFIRM_KEYWORDS.has(lowerText);
  const isCancel = CANCEL_KEYWORDS.has(lowerText);
  const isSkip = SKIP_KEYWORDS.has(lowerText);
  
  if (isCancel) {
    await ftManager.cancel(taskId);
    waitingFlowTasks.delete(fromUser);
    await client.sendText(fromUser, `❌ 任务已取消`, contextToken);
    return true;
  }
  
  if (isSkip && task.status === 'waiting_confirm') {
    await client.sendText(fromUser, `⏭️ 跳过当前步骤...`, contextToken);
    await ftManager.skipStep(taskId, fromUser);
    return true;
  }
  
  if (isConfirm) {
    if (task.status === 'pending') {
      await client.sendText(fromUser, `🚀 开始执行流程任务...`, contextToken);
      await ftManager.start(taskId, fromUser);
      
      const currentStep = ftManager.getCurrentStep(taskId);
      if (currentStep?.requiresConfirmation) {
        await client.sendText(
          fromUser,
          `⏳ 步骤 ${currentStep.order}: ${currentStep.description}\n发送 "确认" 继续执行此步骤。`,
          contextToken
        );
      }
      return true;
    } else if (task.status === 'waiting_confirm') {
      await client.sendText(fromUser, `▶️ 继续执行...`, contextToken);
      await ftManager.confirmAndContinue(taskId, fromUser);
      
      const nextStep = ftManager.getCurrentStep(taskId);
      if (nextStep?.requiresConfirmation) {
        await client.sendText(
          fromUser,
          `⏳ 步骤 ${nextStep.order}: ${nextStep.description}\n发送 "确认" 继续执行此步骤。`,
          contextToken
        );
      }
      
      const updatedTask = ftManager.getTask(taskId);
      if (updatedTask?.status === 'completed') {
        waitingFlowTasks.delete(fromUser);
        const report = ftManager.generateReport(taskId);
        await client.sendText(fromUser, report, contextToken);
      }
      return true;
    }
  }
  
  if (task.status === 'waiting_confirm') {
    const currentStep = ftManager.getCurrentStep(taskId);
    if (currentStep) {
      await client.sendText(
        fromUser,
        `⏳ 等待确认: 步骤 ${currentStep.order} - ${currentStep.description}\n发送 "确认" 继续，或 "跳过" 跳过此步骤。`,
        contextToken
      );
      return true;
    }
  }
  
  return false;
}
