/**
 * DI Container Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContainer, ResolutionError } from '../../../src/di/container.js';

describe('di container', () => {
  let container: ReturnType<typeof createContainer>;

  beforeEach(() => {
    container = createContainer();
  });

  describe('register and resolve', () => {
    it('should register and resolve simple value', () => {
      container.register('config', () => ({ port: 3000 }));
      
      const result = container.resolve('config');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ port: 3000 });
      }
    });

    it('should inject dependencies', () => {
      container.register('config', () => ({ port: 3000 }));
      container.register('service', ({ config }) => ({
        port: (config as { port: number }).port,
        start: () => 'started',
      }));
      
      const result = container.resolve('service');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.port).toBe(3000);
      }
    });

    it('should return error for unknown token', () => {
      const result = container.resolve('unknown');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ResolutionError);
      }
    });
  });

  describe('singleton', () => {
    it('should return same instance for singleton', () => {
      let counter = 0;
      container.register('counter', () => ({ id: ++counter }), { singleton: true });
      
      const first = container.resolve('counter');
      const second = container.resolve('counter');
      
      expect(first.ok && second.ok && first.value === second.value).toBe(true);
    });
  });

  describe('scopes', () => {
    it('should create child scope', () => {
      container.register('parent', () => 'parent-value');
      
      const child = container.createScope();
      child.register('child', ({ parent }) => `child-${parent}`);
      
      const result = child.resolve('child');
      
      expect(result.ok && result.value).toBe('child-parent-value');
    });

    it('should isolate scope registrations', () => {
      container.register('shared', () => 'shared');
      const child = container.createScope();
      child.register('local', () => 'local');
      
      expect(child.has('local')).toBe(true);
      expect(container.has('local')).toBe(false);
    });
  });
});
