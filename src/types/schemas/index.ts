/**
 * Zod Schema Definitions - Phase 3
 * 
 * Runtime type validation for core domain types
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ExecutionModeSchema = z.enum(['direct', 'longtask', 'flowtask']);
export const TaskComplexitySchema = z.enum(['simple', 'moderate', 'complex', 'very_complex']);
export const ConversationStateSchema = z.enum([
  'idle', 'exploring', 'clarifying', 'proposing', 'comparing',
  'confirming', 'refining', 'planning', 'executingt', 'executingd',
  'executingi', 'executinge', 'reviewing', 'completed', 'paused',
  'error', 'destroyed'
]);
export const IntentTypeSchema = z.enum([
  'select_option', 'confirm', 'reject', 'modify', 'execute',
  'pause', 'resume', 'cancel', 'ask_info', 'reference'
]);

// ============================================================================
// Base Types
// ============================================================================

/**
 * JSON Schema 定义（简化版）
 * 注意：递归 schema 在 Zod v4 中需要特殊处理
 */
export type JSONSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, unknown>;
  items?: unknown;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
};

export const JSONSchemaSchema = z.object({
  type: z.enum(['object', 'array', 'string', 'number', 'boolean']),
  properties: z.record(z.string(), z.unknown()).optional(),
  items: z.unknown().optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  default: z.unknown().optional(),
});

// ============================================================================
// Agent Types
// ============================================================================

export const WechatAccountSchema = z.object({
  id: z.string(),
  wechatId: z.string(),
  nickname: z.string().optional(),
  avatar: z.string().optional(),
  createdAt: z.number(),
  lastLoginAt: z.number().optional(),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  wechat: z.object({
    accountId: z.string(),
    nickname: z.string().optional(),
  }),
  workspace: z.object({
    path: z.string(),
    createdAt: z.number(),
  }),
  ai: z.object({
    model: z.string(),
    templateId: z.string(),
    customSystemPrompt: z.string().optional(),
    maxTurns: z.number(),
    temperature: z.number().optional(),
  }),
  memory: z.object({
    enabledL: z.boolean(),
    enabledS: z.boolean(),
    maxItems: z.number(),
    autoExtract: z.boolean(),
  }),
  features: z.object({
    scheduledTasks: z.boolean(),
    notifications: z.boolean(),
    fileAccess: z.boolean(),
    shellExec: z.boolean(),
    webSearch: z.boolean(),
  }),
  visibility: z.enum(['private', 'shared', 'invite_only']),
  maxBindings: z.number(),
  currentBindingCount: z.number(),
  allowedWechatIds: z.array(z.string()),
  primaryWechatId: z.string(),
});

// ============================================================================
// Context Types
// ============================================================================

export const SessionContextSchema = z.object({
  id: z.string(),
  userId: z.string(),
  agentId: z.string(),
  state: ConversationStateSchema,
  data: z.record(z.string(), z.unknown()),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number(),
  })),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// ============================================================================
// Project Types
// ============================================================================

export const ProjectTypeSchema = z.enum(['tool', 'library', 'service', 'knowledge', 'other']);
export const ProjectStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);

export const ProjectSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  path: z.string(),
  status: ProjectStatusSchema,
  type: ProjectTypeSchema,
  capabilities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    entryPoint: z.object({
      type: z.enum(['cli', 'api', 'function', 'workflow']),
      command: z.string().optional(),
    }),
    enabled: z.boolean(),
    usageCount: z.number(),
  })),
  workspacePath: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  ownerId: z.string(),
  sharedWith: z.array(z.string()),
});

// ============================================================================
// Task Router Types
// ============================================================================

export const TaskRequestSchema = z.object({
  protocolVersion: z.literal('1.0'),
  analysis: z.object({
    userIntent: z.string(),
    requiredCapabilities: z.array(z.string()),
    complexity: z.object({
      score: z.number(),
      level: TaskComplexitySchema,
      factors: z.array(z.string()),
    }),
  }),
  plan: z.object({
    strategy: z.enum(['single', 'sequential', 'parallel', 'conditional']),
    steps: z.array(z.object({
      stepId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      capability: z.string(),
      mode: ExecutionModeSchema,
      input: z.unknown(),
      dependencies: z.array(z.string()).optional(),
      estimatedDuration: z.number().optional(),
    })),
  }),
  metadata: z.object({
    estimatedDuration: z.number(),
    priority: z.number(),
    confidence: z.number(),
  }),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate data against schema
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate with custom error message
 */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown, message?: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues.map(i => `${String(i.path)}: ${i.message}`).join(', ');
  throw new Error(message ? `${message}: ${issues}` : `Validation failed: ${issues}`);
}

// ============================================================================
// Type Exports
// ============================================================================

export type ValidatedAgentConfig = z.infer<typeof AgentConfigSchema>;
export type ValidatedSessionContext = z.infer<typeof SessionContextSchema>;
export type ValidatedProjectSpace = z.infer<typeof ProjectSpaceSchema>;
export type ValidatedTaskRequest = z.infer<typeof TaskRequestSchema>;
