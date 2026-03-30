/**
 * Workflow Engine
 * 
 * Deterministic workflow execution engine with step-by-step processing.
 */

export enum WorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'wait' | 'condition';
  handler?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  context: Record<string, unknown>;
  currentStepId: string | null;
  stepStatus: Map<string, StepStatus>;
  stepOutputs: Map<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export type StepHandler = (
  context: Record<string, unknown>,
  input: unknown
) => Promise<StepResult> | StepResult;

export class WorkflowEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private instances = new Map<string, WorkflowInstance>();
  private handlers = new Map<string, StepHandler>();
  private cancelledInstances = new Set<string>();

  /**
   * Register a workflow definition
   */
  register(definition: WorkflowDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Workflow ${definition.id} is already registered`);
    }
    this.definitions.set(definition.id, definition);
  }

  /**
   * Get a workflow definition
   */
  getDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Register a step handler
   */
  registerHandler(name: string, handler: StepHandler): void {
    this.handlers.set(name, handler);
  }

  /**
   * Create a workflow instance
   */
  createInstance(workflowId: string, context: Record<string, unknown> = {}): WorkflowInstance {
    const definition = this.definitions.get(workflowId);
    if (!definition) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const instance: WorkflowInstance = {
      id: this.generateId(),
      workflowId,
      status: WorkflowStatus.PENDING,
      context,
      currentStepId: null,
      stepStatus: new Map(definition.steps.map(s => [s.id, StepStatus.PENDING])),
      stepOutputs: new Map(),
      createdAt: Date.now(),
    };

    this.instances.set(instance.id, instance);
    return instance;
  }

  /**
   * Get a workflow instance
   */
  getInstance(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Start workflow execution
   */
  async start(instanceId: string): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const definition = this.definitions.get(instance.workflowId)!;
    instance.status = WorkflowStatus.RUNNING;
    instance.startedAt = Date.now();

    try {
      for (const step of definition.steps) {
        // Check if cancelled
        if (this.cancelledInstances.has(instanceId)) {
          instance.status = WorkflowStatus.CANCELLED;
          this.cancelledInstances.delete(instanceId);
          return instance;
        }

        instance.currentStepId = step.id;

        // Handle wait step
        if (step.type === 'wait') {
          instance.status = WorkflowStatus.WAITING;
          return instance;
        }

        // Execute action step
        if (step.type === 'action' && step.handler) {
          instance.stepStatus.set(step.id, StepStatus.RUNNING);
          
          const handler = this.handlers.get(step.handler);
          if (!handler) {
            throw new Error(`Handler ${step.handler} not found`);
          }

          const previousOutput = instance.currentStepId 
            ? instance.stepOutputs.get(this.getPreviousStepId(definition, step.id) || '')
            : undefined;

          const result = await handler(instance.context, previousOutput);

          if (!result.success) {
            throw new Error(result.error || `Step ${step.id} failed`);
          }

          instance.stepStatus.set(step.id, StepStatus.COMPLETED);
          if (result.output !== undefined) {
            instance.stepOutputs.set(step.id, result.output);
          }
        }
      }

      instance.status = WorkflowStatus.COMPLETED;
      instance.completedAt = Date.now();
      instance.currentStepId = null;
    } catch (error) {
      instance.status = WorkflowStatus.FAILED;
      instance.error = error instanceof Error ? error.message : String(error);
      if (instance.currentStepId) {
        instance.stepStatus.set(instance.currentStepId, StepStatus.FAILED);
      }
    }

    return instance;
  }

  /**
   * Resume a waiting workflow
   */
  async resume(instanceId: string, input?: unknown): Promise<WorkflowInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status !== WorkflowStatus.WAITING) {
      throw new Error(`Instance ${instanceId} is not in WAITING status`);
    }

    // Store the resume input
    if (instance.currentStepId && input !== undefined) {
      instance.stepOutputs.set(instance.currentStepId, input);
      instance.stepStatus.set(instance.currentStepId, StepStatus.COMPLETED);
    }

    // Continue execution
    instance.status = WorkflowStatus.RUNNING;
    
    const definition = this.definitions.get(instance.workflowId)!;
    const currentStepIndex = definition.steps.findIndex(s => s.id === instance.currentStepId);
    
    try {
      for (let i = currentStepIndex + 1; i < definition.steps.length; i++) {
        const step = definition.steps[i];

        // Check if cancelled
        if (this.cancelledInstances.has(instanceId)) {
          instance.status = WorkflowStatus.CANCELLED;
          this.cancelledInstances.delete(instanceId);
          return instance;
        }

        instance.currentStepId = step.id;

        // Handle wait step
        if (step.type === 'wait') {
          instance.status = WorkflowStatus.WAITING;
          return instance;
        }

        // Execute action step
        if (step.type === 'action' && step.handler) {
          instance.stepStatus.set(step.id, StepStatus.RUNNING);
          
          const handler = this.handlers.get(step.handler);
          if (!handler) {
            throw new Error(`Handler ${step.handler} not found`);
          }

          const previousOutput = instance.stepOutputs.get(definition.steps[i - 1]?.id || '');
          const result = await handler(instance.context, previousOutput);

          if (!result.success) {
            throw new Error(result.error || `Step ${step.id} failed`);
          }

          instance.stepStatus.set(step.id, StepStatus.COMPLETED);
          if (result.output !== undefined) {
            instance.stepOutputs.set(step.id, result.output);
          }
        }
      }

      instance.status = WorkflowStatus.COMPLETED;
      instance.completedAt = Date.now();
      instance.currentStepId = null;
    } catch (error) {
      instance.status = WorkflowStatus.FAILED;
      instance.error = error instanceof Error ? error.message : String(error);
      if (instance.currentStepId) {
        instance.stepStatus.set(instance.currentStepId, StepStatus.FAILED);
      }
    }

    return instance;
  }

  /**
   * Cancel a workflow instance
   */
  async cancel(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status === WorkflowStatus.RUNNING) {
      this.cancelledInstances.add(instanceId);
    } else {
      instance.status = WorkflowStatus.CANCELLED;
    }
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getPreviousStepId(definition: WorkflowDefinition, currentStepId: string): string | null {
    const index = definition.steps.findIndex(s => s.id === currentStepId);
    if (index <= 0) return null;
    return definition.steps[index - 1].id;
  }
}
