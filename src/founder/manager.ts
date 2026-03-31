/**
 * 创世 Agent 管理器
 * 
 * 管理创世 Agent 的创建、验证和查询
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Paths } from '../paths.js';
import { FounderInfo, SYSTEM_VERSION } from './types.js';

/**
 * 创世 Agent 管理器
 */
export class FounderManager {
  /**
   * 获取 founder.json 文件路径
   */
  private getFounderPath(): string {
    return Paths.founderFile;
  }

  /**
   * 检查是否已设置创世 Agent
   */
  async hasFounder(): Promise<boolean> {
    const founder = await this.getFounderInfo();
    return founder !== null;
  }

  /**
   * 获取创世 Agent ID
   */
  async getFounderAgentId(): Promise<string | null> {
    const founder = await this.getFounderInfo();
    return founder?.agentId || null;
  }

  /**
   * 设置创世 Agent
   * 只能在首次登录时调用一次
   * @param agentId Agent ID
   * @param creatorWechatId 创建者微信ID
   */
  async setFounder(agentId: string, creatorWechatId: string): Promise<void> {
    // 检查是否已存在
    if (await this.hasFounder()) {
      throw new Error('创世 Agent 已存在，不能重复设置');
    }

    const founder: FounderInfo = {
      agentId,
      creatorWechatId,
      createdAt: Date.now(),
      systemVersion: SYSTEM_VERSION,
    };

    await writeFile(this.getFounderPath(), JSON.stringify(founder, null, 2), 'utf-8');
  }

  /**
   * 验证指定 Agent 是否为创世 Agent
   * @param agentId Agent ID
   * @returns 是否为创世 Agent
   */
  async isFounderAgent(agentId: string): Promise<boolean> {
    const founderId = await this.getFounderAgentId();
    return founderId === agentId;
  }

  /**
   * 验证指定微信用户是否为创世 Agent 创建者
   * @param wechatId 微信用户ID
   * @returns 是否为创世者
   */
  async isFounderCreator(wechatId: string): Promise<boolean> {
    const creatorId = await this.getFounderWechatId();
    return creatorId === wechatId;
  }

  /**
   * 获取创世 Agent 信息
   * @returns FounderInfo 或 null
   */
  async getFounderInfo(): Promise<FounderInfo | null> {
    const path = this.getFounderPath();
    
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content) as FounderInfo;
    } catch {
      return null;
    }
  }

  /**
   * 获取创世 Agent 绑定的微信用户
   * @returns 微信ID 或 null
   */
  async getFounderWechatId(): Promise<string | null> {
    const info = await this.getFounderInfo();
    return info?.creatorWechatId || null;
  }

  /**
   * 获取创世 Agent 创建时间
   * @returns 时间戳 或 null
   */
  async getFounderCreatedAt(): Promise<number | null> {
    const info = await this.getFounderInfo();
    return info?.createdAt || null;
  }

  /**
   * 强制更新创世 Agent（仅用于特殊场景，如数据恢复）
   * @param agentId Agent ID
   * @param creatorWechatId 创建者微信ID
   */
  async forceUpdateFounder(agentId: string, creatorWechatId: string): Promise<void> {
    const founder: FounderInfo = {
      agentId,
      creatorWechatId,
      createdAt: Date.now(),
      systemVersion: SYSTEM_VERSION,
    };

    await writeFile(this.getFounderPath(), JSON.stringify(founder, null, 2), 'utf-8');
  }
}

export default FounderManager;
