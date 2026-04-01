/**
 * 全局技能管理器
 * 
 * 管理系统级技能和 Agent 技能实例
 */

import { Store } from '../store.js';
import { Result, ok, err, isOk } from '../types/result.js';
import {
  Skill,
  AgentSkill,
  RegisterSkillParams,
  InstallSkillParams,
  ExecuteSkillParams,
  SkillExecutionResult,
  SkillFilter,
  createSkill,
  createAgentSkill,
} from './types.js';
import { SkillNotFoundError, SkillExecutionError, SkillAlreadyExistsError } from './errors.js';
import { executeSkillScript } from './executor.js';
import { parseSkillManifest } from './parser.js';

// ============================================================================
// 配置
// ============================================================================

/** 全局技能存储命名空间 */
const GLOBAL_SKILLS_NAMESPACE = 'global-skills';

/** Agent 技能存储命名空间 - 使用 : 分隔符与 FileStore 一致 */
const AGENT_SKILLS_NAMESPACE = (agentId: string) => `agents:${agentId}:skills`;

// ============================================================================
// 技能管理器
// ============================================================================

export interface SkillManager {
  // 全局技能管理
  registerSkill(params: RegisterSkillParams): Promise<Result<Skill, SkillAlreadyExistsError>>;
  unregisterSkill(skillId: string): Promise<Result<void, SkillNotFoundError>>;
  getSkill(skillId: string): Promise<Result<Skill, SkillNotFoundError>>;
  listSkills(filter?: SkillFilter): Promise<Skill[]>;
  loadSkillFromDirectory(skillPath: string): Promise<Result<Skill, Error>>;

  // Agent 技能管理
  installSkill(params: InstallSkillParams): Promise<Result<AgentSkill, Error>>;
  uninstallSkill(skillId: string, agentId: string): Promise<Result<void, SkillNotFoundError>>;
  getAgentSkill(skillId: string, agentId: string): Promise<Result<AgentSkill, SkillNotFoundError>>;
  listAgentSkills(agentId: string, enabledOnly?: boolean): Promise<AgentSkill[]>;
  enableSkill(skillId: string, agentId: string): Promise<Result<void, SkillNotFoundError>>;
  disableSkill(skillId: string, agentId: string): Promise<Result<void, SkillNotFoundError>>;
  updateSkillConfig(skillId: string, agentId: string, config: Record<string, unknown>): Promise<Result<AgentSkill, Error>>;

  // 执行
  executeSkill(params: ExecuteSkillParams): Promise<Result<SkillExecutionResult, SkillExecutionError>>;
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createSkillManager(store: Store): SkillManager {
  // ========================================================================
  // 全局技能操作
  // ========================================================================

  async function registerSkill(
    params: RegisterSkillParams
  ): Promise<Result<Skill, SkillAlreadyExistsError>> {
    // 检查是否已存在
    const existing = await store.get<Skill>(`${GLOBAL_SKILLS_NAMESPACE}/${params.id}`);
    if (existing) {
      return err(new SkillAlreadyExistsError(params.id));
    }

    const skill = createSkill(params);
    await store.set(`${GLOBAL_SKILLS_NAMESPACE}/${skill.id}`, skill);
    return ok(skill);
  }

  async function unregisterSkill(skillId: string): Promise<Result<void, SkillNotFoundError>> {
    const skill = await store.get<Skill>(`${GLOBAL_SKILLS_NAMESPACE}/${skillId}`);
    if (!skill) {
      return err(new SkillNotFoundError(skillId));
    }

    await store.delete(`${GLOBAL_SKILLS_NAMESPACE}/${skillId}`);
    return ok(undefined);
  }

  async function getSkill(skillId: string): Promise<Result<Skill, SkillNotFoundError>> {
    const skill = await store.get<Skill>(`${GLOBAL_SKILLS_NAMESPACE}/${skillId}`);
    if (!skill) {
      return err(new SkillNotFoundError(skillId));
    }
    return ok(skill);
  }

  async function listSkills(filter?: SkillFilter): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    // 获取所有技能键（通过尝试读取已知技能ID或扫描存储）
    // 注意：Store 接口没有 list 方法，我们使用键模式来获取
    const skillKeys = await store.keys();
    const globalSkillKeys = skillKeys.filter(k => 
      k.startsWith(`${GLOBAL_SKILLS_NAMESPACE}:`) || k.startsWith(`${GLOBAL_SKILLS_NAMESPACE}/`)
    );

    for (const key of globalSkillKeys) {
      const skill = await store.get<Skill>(key);
      if (skill) {
        // 应用过滤器
        if (filter && !matchesFilter(skill, filter)) {
          continue;
        }
        skills.push(skill);
      }
    }

    return skills;
  }

  async function loadSkillFromDirectory(skillPath: string): Promise<Result<Skill, Error>> {
    try {
      const result = await parseSkillManifest(skillPath);
      if (!isOk(result)) {
        return err(result.error);
      }

      const skill = createSkill(result.value);
      await store.set(`${GLOBAL_SKILLS_NAMESPACE}/${skill.id}`, skill);
      return ok(skill);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ========================================================================
  // Agent 技能操作
  // ========================================================================

  async function installSkill(
    params: InstallSkillParams
  ): Promise<Result<AgentSkill, Error>> {
    // 验证全局技能存在
    const skillResult = await getSkill(params.skillId);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }

    // 检查是否已安装
    const existing = await store.get<AgentSkill>(
      `${AGENT_SKILLS_NAMESPACE(params.agentId)}:${params.skillId}`
    );
    if (existing) {
      return ok(existing); // 已安装，直接返回
    }

    const agentSkill = createAgentSkill(
      params.skillId,
      params.agentId,
      params.config,
      params.enabled ?? true
    );

    await store.set(
      `${AGENT_SKILLS_NAMESPACE(params.agentId)}:${params.skillId}`,
      agentSkill
    );

    return ok(agentSkill);
  }

  async function uninstallSkill(
    skillId: string,
    agentId: string
  ): Promise<Result<void, SkillNotFoundError>> {
    const key = `${AGENT_SKILLS_NAMESPACE(agentId)}:${skillId}`;
    const existing = await store.get<AgentSkill>(key);
    if (!existing) {
      return err(new SkillNotFoundError(skillId));
    }

    await store.delete(key);
    return ok(undefined);
  }

  async function getAgentSkill(
    skillId: string,
    agentId: string
  ): Promise<Result<AgentSkill, SkillNotFoundError>> {
    const key = `${AGENT_SKILLS_NAMESPACE(agentId)}:${skillId}`;
    const agentSkill = await store.get<AgentSkill>(key);
    if (!agentSkill) {
      return err(new SkillNotFoundError(skillId));
    }
    return ok(agentSkill);
  }

  async function listAgentSkills(agentId: string, enabledOnly = false): Promise<AgentSkill[]> {
    const skills: AgentSkill[] = [];
    
    // 获取所有 Agent 技能键
    const skillKeys = await store.keys();
    const agentSkillKeys = skillKeys.filter(k => 
      k.startsWith(`${AGENT_SKILLS_NAMESPACE(agentId)}:`)
    );

    for (const key of agentSkillKeys) {
      const skill = await store.get<AgentSkill>(key);
      if (skill && (!enabledOnly || skill.enabled)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  async function enableSkill(
    skillId: string,
    agentId: string
  ): Promise<Result<void, SkillNotFoundError>> {
    return updateAgentSkillField(skillId, agentId, 'enabled', true);
  }

  async function disableSkill(
    skillId: string,
    agentId: string
  ): Promise<Result<void, SkillNotFoundError>> {
    return updateAgentSkillField(skillId, agentId, 'enabled', false);
  }

  async function updateSkillConfig(
    skillId: string,
    agentId: string,
    config: Record<string, unknown>
  ): Promise<Result<AgentSkill, Error>> {
    const key = `${AGENT_SKILLS_NAMESPACE(agentId)}/${skillId}`;
    const existing = await store.get<AgentSkill>(key);
    if (!existing) {
      return err(new SkillNotFoundError(skillId));
    }

    const updated: AgentSkill = {
      ...existing,
      config: { ...existing.config, ...config },
    };

    await store.set(key, updated);
    return ok(updated);
  }

  // ========================================================================
  // 执行
  // ========================================================================

  async function executeSkill(
    params: ExecuteSkillParams
  ): Promise<Result<SkillExecutionResult, SkillExecutionError>> {
    // 获取技能定义
    const skillResult = await getSkill(params.skillId);
    if (!isOk(skillResult)) {
      return err(new SkillExecutionError(params.skillId, 'Skill not found'));
    }
    const skill = skillResult.value;

    // 获取 Agent 技能实例
    const agentSkillResult = await getAgentSkill(params.skillId, params.agentId);
    if (!isOk(agentSkillResult)) {
      return err(new SkillExecutionError(params.skillId, 'Skill not installed for this agent'));
    }
    const agentSkill = agentSkillResult.value;

    if (!agentSkill.enabled) {
      return err(new SkillExecutionError(params.skillId, 'Skill is disabled'));
    }

    // 执行技能脚本
    const execResult = await executeSkillScript(skill, agentSkill, params.input, params.timeout);

    // 更新使用统计
    if (isOk(execResult)) {
      const updated: AgentSkill = {
        ...agentSkill,
        usageCount: agentSkill.usageCount + 1,
        lastUsedAt: Date.now(),
      };
      await store.set(`${AGENT_SKILLS_NAMESPACE(params.agentId)}:${params.skillId}`, updated);
      return execResult;
    }

    return err(execResult.error);
  }

  // ========================================================================
  // 辅助函数
  // ========================================================================

  async function updateAgentSkillField<K extends keyof AgentSkill>(
    skillId: string,
    agentId: string,
    field: K,
    value: AgentSkill[K]
  ): Promise<Result<void, SkillNotFoundError>> {
    const key = `${AGENT_SKILLS_NAMESPACE(agentId)}:${skillId}`;
    const existing = await store.get<AgentSkill>(key);
    if (!existing) {
      return err(new SkillNotFoundError(skillId));
    }

    const updated: AgentSkill = { ...existing, [field]: value };
    await store.set(key, updated);
    return ok(undefined);
  }

  function matchesFilter(skill: Skill, filter: SkillFilter): boolean {
    if (filter.category && skill.category !== filter.category) {
      return false;
    }
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag => skill.tags.includes(tag));
      if (!hasTag) return false;
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const matches =
        skill.name.toLowerCase().includes(search) ||
        skill.description.toLowerCase().includes(search) ||
        skill.id.toLowerCase().includes(search);
      if (!matches) return false;
    }
    return true;
  }

  // ========================================================================
  // 返回接口
  // ========================================================================

  return {
    registerSkill,
    unregisterSkill,
    getSkill,
    listSkills,
    loadSkillFromDirectory,
    installSkill,
    uninstallSkill,
    getAgentSkill,
    listAgentSkills,
    enableSkill,
    disableSkill,
    updateSkillConfig,
    executeSkill,
  };
}
