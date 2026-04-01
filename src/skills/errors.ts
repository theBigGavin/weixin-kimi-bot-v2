/**
 * 技能系统错误类
 */

export class SkillNotFoundError extends Error {
  constructor(public readonly skillId: string) {
    super(`Skill not found: ${skillId}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillAlreadyExistsError extends Error {
  constructor(public readonly skillId: string) {
    super(`Skill already exists: ${skillId}`);
    this.name = 'SkillAlreadyExistsError';
  }
}

export class SkillExecutionError extends Error {
  constructor(
    public readonly skillId: string,
    public readonly reason: string
  ) {
    super(`Skill execution failed for '${skillId}': ${reason}`);
    this.name = 'SkillExecutionError';
  }
}

export class SkillParseError extends Error {
  constructor(
    message: string,
    public readonly path: string
  ) {
    super(`Failed to parse skill at '${path}': ${message}`);
    this.name = 'SkillParseError';
  }
}

export class SkillValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(`Skill validation failed: ${message}`);
    this.name = 'SkillValidationError';
  }
}
