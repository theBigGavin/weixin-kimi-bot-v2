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

export async function executeDirect(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  console.log(`[${agentId}] 🚀 DIRECT mode execution`);
  
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
    const manager = initACPManager();
    const agent = await getAgent(agentId, fromUser);
    const workspacePath = agent.config.workspace.path;
    const response = await manager.prompt(fromUser, { text }, workspacePath);

    const duration = Date.now() - start;
    console.log(`[${agentId}] ✅ Kimi 响应完成 (${(duration / 1000).toFixed(1)}s)`);

    if (response.error) {
      throw new Error(response.error);
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
    console.log(
      `[${agentId}] 📤 已发送回复 (${response.text.length} chars, ${chunks} 条消息)`
    );

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`[${agentId}] 🔧 工具调用: ${response.toolCalls.length} 次`);
      for (const tool of response.toolCalls) {
        console.log(`     - ${tool.title} (${tool.status})`);
      }
    }

    await extractAndSaveMemory(fromUser, agentId);

  } catch (err) {
    console.error(`[${agentId}] ❌ 处理失败:`, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
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
      console.log(`[Memory] Agent not found: ${agentId}`);
      return;
    }
    
    let memory = await memManager.loadMemory(agentId, agent.name);
    
    if (!memory.config.autoExtract) {
      return;
    }
    
    console.log(`[Memory] Extracting memory for ${agentId}...`);
    
    const extractionPrompt = extractor.buildExtractionPrompt(dialogue);
    
    try {
      const acp = initACPManager();
      const workspacePath = agent.config.workspace.path;
      const extractionResult = await acp.prompt(userId, { text: extractionPrompt }, workspacePath);
      
      if (extractionResult.error) {
        console.error('[Memory] Extraction failed:', extractionResult.error);
        return;
      }
      
      const extraction = extractor.parseExtractionResult(extractionResult.text);
      
      const totalExtracted = 
        (extraction.facts?.length || 0) + 
        (extraction.projects?.length || 0) + 
        (extraction.learnings?.length || 0);
      
      if (totalExtracted === 0) {
        console.log('[Memory] No new information to extract');
        return;
      }
      
      memory = extractor.mergeIntoMemory(memory, extraction);
      await memManager.saveMemory(memory);
      
      console.log(`[Memory] Saved: ${extraction.facts?.length || 0} facts, ${extraction.projects?.length || 0} projects`);
      dialogueCache.delete(userId);
      
    } catch (extractErr) {
      console.error('[Memory] Extraction error:', extractErr);
    }
    
  } catch (err) {
    console.error('[Memory] Failed to extract/save memory:', err);
  }
}

export async function executeLongTask(
  client: ILinkClient,
  fromUser: string,
  text: string,
  contextToken: string,
  agentId: string
): Promise<void> {
  console.log(`[${agentId}] ⏳ LONGTASK mode execution`);
  
  const ltManager = getLongTaskManager()!;
  const agent = await getAgent(agentId, fromUser);
  const workspacePath = agent.config.workspace.path;
  
  const submission = createTaskSubmission({
    prompt: text,
    userId: fromUser,
    contextId: contextToken,
    agentId,
    priority: TaskPriority.NORMAL,
  });
  
  const task = ltManager.submit(submission, workspacePath);
  
  const ackMessage = 
    `📋 任务已提交（长任务模式）\n` +
    `任务ID: ${task.id}\n` +
    `状态: 等待执行...\n\n` +
    `任务将在后台执行，完成后可通过 /task status ${task.id} 查看结果。`;
  
  await client.sendText(fromUser, ackMessage, contextToken);
  
  const started = await ltManager.start(task.id, fromUser);
  if (started) {
    console.log(`[${agentId}] ✅ LongTask ${task.id} started`);
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
  console.log(`[${agentId}] 🔄 FLOWTASK mode execution`);
  
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
  
  console.log(`[${agentId}] ⏳ FlowTask ${task.id} waiting for confirmation`);
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
