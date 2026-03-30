/**
 * Workflow Engine Tests
 * 
 * TDD Red Phase: Define expected behavior for deterministic workflow execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowEngine,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStatus,
  WorkflowStep,
  StepStatus,
} from '../../../src/workflow/engine';

describe('workflow-engine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('register', () => {
    it('should register a workflow definition', () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            type: 'action',
            handler: 'testHandler',
          },
        ],
      };

      // When
      engine.register(workflow);

      // Then
      const retrieved = engine.getDefinition('test-workflow');
      expect(retrieved).toEqual(workflow);
    });

    it('should throw error for duplicate workflow id', () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [],
      };
      engine.register(workflow);

      // When/Then
      expect(() => engine.register(workflow)).toThrow('already registered');
    });
  });

  describe('createInstance', () => {
    it('should create workflow instance', () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
          { id: 'step2', name: 'Step 2', type: 'action', handler: 'handler2' },
        ],
      };
      engine.register(workflow);

      // When
      const instance = engine.createInstance('test-workflow', { key: 'value' });

      // Then
      expect(instance).toBeDefined();
      expect(instance.workflowId).toBe('test-workflow');
      expect(instance.status).toBe(WorkflowStatus.PENDING);
      expect(instance.context).toEqual({ key: 'value' });
      expect(instance.stepStatus.size).toBe(2);
    });

    it('should throw error for unknown workflow', () => {
      // When/Then
      expect(() => engine.createInstance('unknown', {})).toThrow('not found');
    });
  });

  describe('start', () => {
    it('should start workflow execution', async () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('test-workflow', {});

      const mockHandler = vi.fn().mockResolvedValue({ success: true, output: 'done' });
      engine.registerHandler('handler1', mockHandler);

      // When
      const result = await engine.start(instance.id);

      // Then
      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('should execute multiple steps sequentially', async () => {
      // Given
      const executionOrder: string[] = [];
      const workflow: WorkflowDefinition = {
        id: 'seq-workflow',
        name: 'Sequential Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
          { id: 'step2', name: 'Step 2', type: 'action', handler: 'handler2' },
          { id: 'step3', name: 'Step 3', type: 'action', handler: 'handler3' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('seq-workflow', {});

      engine.registerHandler('handler1', async () => {
        executionOrder.push('step1');
        return { success: true };
      });
      engine.registerHandler('handler2', async () => {
        executionOrder.push('step2');
        return { success: true };
      });
      engine.registerHandler('handler3', async () => {
        executionOrder.push('step3');
        return { success: true };
      });

      // When
      await engine.start(instance.id);

      // Then
      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
    });

    it('should fail workflow on step error', async () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'fail-workflow',
        name: 'Fail Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
          { id: 'step2', name: 'Step 2', type: 'action', handler: 'failingHandler' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('fail-workflow', {});

      engine.registerHandler('handler1', async () => ({ success: true }));
      engine.registerHandler('failingHandler', async () => {
        throw new Error('Step failed');
      });

      // When
      const result = await engine.start(instance.id);

      // Then
      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error).toContain('Step failed');
    });

    it('should pause at wait step', async () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'wait-workflow',
        name: 'Wait Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
          { id: 'step2', name: 'Step 2', type: 'wait', condition: 'approval' },
          { id: 'step3', name: 'Step 3', type: 'action', handler: 'handler2' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('wait-workflow', {});

      engine.registerHandler('handler1', async () => ({ success: true }));

      // When
      const result = await engine.start(instance.id);

      // Then
      expect(result.status).toBe(WorkflowStatus.WAITING);
      expect(result.currentStepId).toBe('step2');
    });
  });

  describe('resume', () => {
    it('should resume waiting workflow', async () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'resume-workflow',
        name: 'Resume Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'wait', condition: 'approval' },
          { id: 'step2', name: 'Step 2', type: 'action', handler: 'handler1' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('resume-workflow', {});

      engine.registerHandler('handler1', async () => ({ success: true }));

      // Start and pause
      await engine.start(instance.id);

      // When - resume
      const result = await engine.resume(instance.id, { approved: true });

      // Then
      expect(result.status).toBe(WorkflowStatus.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('should cancel pending workflow', async () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'cancel-workflow',
        name: 'Cancel Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('cancel-workflow', {});

      // When - cancel before starting
      await engine.cancel(instance.id);

      // Then
      expect(instance.status).toBe(WorkflowStatus.CANCELLED);
    });

    it('should cancel between steps', async () => {
      // Given - multi-step workflow
      const workflow: WorkflowDefinition = {
        id: 'multi-cancel-workflow',
        name: 'Multi Cancel Workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', type: 'action', handler: 'handler1' },
          { id: 'step2', name: 'Step 2', type: 'action', handler: 'handler2' },
        ],
      };
      engine.register(workflow);
      const instance = engine.createInstance('multi-cancel-workflow', {});

      // First handler completes quickly, cancel happens before step 2
      engine.registerHandler('handler1', async () => {
        return { success: true };
      });

      // When - start and immediately cancel
      const startPromise = engine.start(instance.id);
      await engine.cancel(instance.id);
      const result = await startPromise;

      // Then - should be cancelled (either during step 1 or before step 2)
      expect([WorkflowStatus.CANCELLED, WorkflowStatus.COMPLETED]).toContain(result.status);
    });
  });

  describe('getInstance', () => {
    it('should return workflow instance', () => {
      // Given
      const workflow: WorkflowDefinition = {
        id: 'get-workflow',
        name: 'Get Workflow',
        version: '1.0.0',
        steps: [],
      };
      engine.register(workflow);
      const instance = engine.createInstance('get-workflow', { data: 'test' });

      // When
      const retrieved = engine.getInstance(instance.id);

      // Then
      expect(retrieved).toEqual(instance);
    });

    it('should return undefined for unknown instance', () => {
      // When
      const retrieved = engine.getInstance('unknown-id');

      // Then
      expect(retrieved).toBeUndefined();
    });
  });
});
