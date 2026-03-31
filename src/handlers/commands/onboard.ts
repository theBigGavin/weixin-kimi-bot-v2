/**
 * Onboard Command Handler
 * 
 * Handles /onboard command for founder agent initialization.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Agent } from '../../agent/types.js';
import { CommandType, type CommandResult, type ProgressCallback } from '../command-handler.js';

const FILES_TO_READ = [
  { path: 'README.md', desc: '项目概览', priority: 'high', maxLength: 2000 },
  { path: 'AGENTS.md', desc: '项目指南', priority: 'high', maxLength: 2000 },
  { path: 'package.json', desc: '依赖配置', priority: 'medium', maxLength: 1000 },
  { path: 'docs/architecture/architecture-overview.md', desc: '架构文档', priority: 'high', maxLength: 1500 },
];

export async function handleOnboard(
  agent: Agent,
  onProgress?: ProgressCallback
): Promise<CommandResult> {
  if (agent.ai.templateId !== 'founder') {
    return {
      type: CommandType.ONBOARD,
      success: false,
      response: '⚠️ /onboard 命令专为创始者Agent设计，用于初始化项目交接。当前Agent模板: ' + agent.ai.templateId,
    };
  }

  try {
    const cwd = process.cwd();
    
    if (onProgress) {
      await onProgress(
        `🚀 开始项目初始化\n` +
        `Agent: ${agent.name}\n` +
        `共 ${FILES_TO_READ.length} 个文件（精简版）\n\n` +
        `开始学习...`
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    let projectContext = `📋 项目交接文档\n================\n\n`;
    projectContext += `Agent: ${agent.name}\n`;
    projectContext += `工作目录: ${cwd}\n`;
    projectContext += `初始化时间: ${new Date().toLocaleString()}\n\n`;

    let loadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < FILES_TO_READ.length; i++) {
      const file = FILES_TO_READ[i];
      const progress = `[${i + 1}/${FILES_TO_READ.length}]`;
      
      try {
        if (onProgress) {
          await onProgress(`${progress} 📖 正在学习: ${file.desc} (${file.path})...`);
        }

        const content = await readFile(join(cwd, file.path), 'utf-8');
        loadedCount++;
        
        const maxLen = file.maxLength || 1500;
        const truncated = content.length > maxLen 
          ? content.substring(0, maxLen) + '\n\n...[内容已截断，完整内容请查看文件]' 
          : content;
        
        projectContext += `\n---\n## ${file.desc} (${file.path})\n\n${truncated}\n`;

        const remaining = FILES_TO_READ.length - i - 1;
        if (onProgress) {
          const statusMsg = remaining > 0 
            ? `${progress} ✅ 已完成: ${file.desc}（还剩 ${remaining} 个文件）`
            : `${progress} ✅ 已完成: ${file.desc}`;
          await onProgress(statusMsg);
        }
      } catch (err) {
        failedCount++;
        projectContext += `\n---\n## ${file.desc} (${file.path})\n\n⚠️ 无法读取: ${(err as Error).message}\n`;
        
        if (onProgress) {
          await onProgress(`${progress} ⚠️ 跳过: ${file.desc}（读取失败）`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    projectContext += `\n---\n\n✅ 项目交接完成！\n\n作为创始者Agent，你的职责：\n`;
    projectContext += `1. 熟悉项目架构和技术栈\n`;
    projectContext += `2. 理解TDD开发流程\n`;
    projectContext += `3. 维护代码质量和文档\n`;
    projectContext += `4. 协助项目演进和重构\n\n`;
    projectContext += `可以使用 /status 查看状态，开始维护项目吧！`;

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (onProgress) {
      await onProgress(
        `🎉 初始化完成！\n` +
        `成功: ${loadedCount} | 失败: ${failedCount}\n` +
        `正在发送完整文档...`
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      type: CommandType.ONBOARD,
      success: true,
      response: projectContext,
      data: { 
        agentId: agent.id,
        workspace: cwd,
        filesLoaded: loadedCount,
        filesFailed: failedCount,
        totalFiles: FILES_TO_READ.length,
      },
    };
  } catch (error) {
    return {
      type: CommandType.ONBOARD,
      success: false,
      response: '❌ 项目初始化失败: ' + (error as Error).message,
      error: (error as Error).message,
    };
  }
}
