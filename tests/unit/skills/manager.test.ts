/**
 * Skill Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSkillManager } from '../../../src/skills/manager.js';
import { SkillNotFoundError, SkillAlreadyExistsError } from '../../../src/skills/errors.js';
import { Store } from '../../../src/store.js';

// 内存存储实现
class MemoryStore implements Store {
  private data = new Map<string, unknown>();
  private baseDir: string;

  constructor(baseDir: string = '/tmp/test') {
    this.baseDir = baseDir;
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

describe('skills/manager', () => {
  let store: MemoryStore;
  let manager: ReturnType<typeof createSkillManager>;

  beforeEach(() => {
    store = new MemoryStore();
    manager = createSkillManager(store);
  });

  describe('registerSkill', () => {
    it('should register a new skill', async () => {
      const result = await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        execution: {
          type: 'python',
          entry: 'script.py',
          timeout: 30000,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('test-skill');
        expect(result.value.name).toBe('Test Skill');
      }
    });

    it('should return error when skill already exists', async () => {
      await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        execution: {
          type: 'python',
          entry: 'script.py',
          timeout: 30000,
        },
      });

      const result = await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill 2',
        description: 'Another test skill',
        execution: {
          type: 'python',
          entry: 'script.py',
          timeout: 30000,
        },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SkillAlreadyExistsError);
      }
    });
  });

  describe('getSkill', () => {
    it('should return skill when it exists', async () => {
      await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        execution: {
          type: 'python',
          entry: 'script.py',
          timeout: 30000,
        },
      });

      const result = await manager.getSkill('test-skill');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('test-skill');
      }
    });

    it('should return error when skill not found', async () => {
      const result = await manager.getSkill('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SkillNotFoundError);
      }
    });
  });

  describe('installSkill', () => {
    it('should install skill for agent', async () => {
      // 先注册技能
      await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        execution: {
          type: 'python',
          entry: 'script.py',
          timeout: 30000,
        },
      });

      // 安装到 Agent
      const result = await manager.installSkill({
        skillId: 'test-skill',
        agentId: 'agent-1',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.skillId).toBe('test-skill');
        expect(result.value.agentId).toBe('agent-1');
        expect(result.value.enabled).toBe(true);
      }
    });

    it('should return error when skill does not exist', async () => {
      const result = await manager.installSkill({
        skillId: 'non-existent',
        agentId: 'agent-1',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SkillNotFoundError);
      }
    });
  });

  describe('listAgentSkills', () => {
    it('should return installed skills for agent', async () => {
      // 注册技能
      await manager.registerSkill({
        id: 'skill-1',
        name: 'Skill 1',
        description: 'First skill',
        execution: { type: 'python', entry: 's1.py', timeout: 30000 },
      });
      await manager.registerSkill({
        id: 'skill-2',
        name: 'Skill 2',
        description: 'Second skill',
        execution: { type: 'python', entry: 's2.py', timeout: 30000 },
      });

      // 安装
      await manager.installSkill({ skillId: 'skill-1', agentId: 'agent-1' });
      await manager.installSkill({ skillId: 'skill-2', agentId: 'agent-1' });

      const skills = await manager.listAgentSkills('agent-1');

      expect(skills).toHaveLength(2);
      expect(skills.map(s => s.skillId)).toContain('skill-1');
      expect(skills.map(s => s.skillId)).toContain('skill-2');
    });

    it('should return only enabled skills when enabledOnly is true', async () => {
      // 注册技能
      await manager.registerSkill({
        id: 'skill-1',
        name: 'Skill 1',
        description: 'First skill',
        execution: { type: 'python', entry: 's1.py', timeout: 30000 },
      });

      // 安装并禁用
      await manager.installSkill({ skillId: 'skill-1', agentId: 'agent-1', enabled: false });

      const allSkills = await manager.listAgentSkills('agent-1', false);
      const enabledSkills = await manager.listAgentSkills('agent-1', true);

      expect(allSkills).toHaveLength(1);
      expect(enabledSkills).toHaveLength(0);
    });
  });

  describe('enableSkill/disableSkill', () => {
    it('should enable and disable skill', async () => {
      // 注册并安装
      await manager.registerSkill({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        execution: { type: 'python', entry: 'script.py', timeout: 30000 },
      });
      await manager.installSkill({ skillId: 'test-skill', agentId: 'agent-1' });

      // 禁用
      const disableResult = await manager.disableSkill('test-skill', 'agent-1');
      expect(disableResult.ok).toBe(true);

      let skill = await manager.getAgentSkill('test-skill', 'agent-1');
      expect(skill.ok && skill.value.enabled).toBe(false);

      // 启用
      const enableResult = await manager.enableSkill('test-skill', 'agent-1');
      expect(enableResult.ok).toBe(true);

      skill = await manager.getAgentSkill('test-skill', 'agent-1');
      expect(skill.ok && skill.value.enabled).toBe(true);
    });
  });
});
