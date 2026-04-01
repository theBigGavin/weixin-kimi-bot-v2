/**
 * Result Type Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  unwrapOr,
  unwrapOrElse,
  tryCatch,
  all,
  partition,
  NotFoundError,
  ValidationError,
} from '../../../src/types/result.js';

describe('result', () => {
  describe('constructors', () => {
    it('should create ok result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should create err result', () => {
      const error = new Error('test');
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('type guards', () => {
    it('should identify ok result', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should identify err result', () => {
      const result = err(new Error('test'));
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('map', () => {
    it('should map ok value', () => {
      const result = map(ok(2), x => x * 2);
      expect(result.ok && result.value).toBe(4);
    });

    it('should pass through err', () => {
      const error = new Error('test');
      const result = map(err(error), x => x * 2);
      expect(!result.ok && result.error).toBe(error);
    });
  });

  describe('andThen', () => {
    it('should chain ok results', () => {
      const result = andThen(ok(2), x => ok(x * 2));
      expect(result.ok && result.value).toBe(4);
    });

    it('should short circuit on err', () => {
      const error = new Error('test');
      const result = andThen(err(error), () => ok(10));
      expect(!result.ok && result.error).toBe(error);
    });
  });

  describe('unwrapOr', () => {
    it('should return value for ok', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('should return default for err', () => {
      expect(unwrapOr(err(new Error()), 0)).toBe(0);
    });
  });

  describe('tryCatch', () => {
    it('should return ok for successful promise', async () => {
      const result = await tryCatch(Promise.resolve(42));
      expect(result.ok && result.value).toBe(42);
    });

    it('should return err for rejected promise', async () => {
      const result = await tryCatch(Promise.reject(new Error('fail')));
      expect(!result.ok && result.error).toBeInstanceOf(Error);
    });
  });

  describe('all', () => {
    it('should collect all ok values', () => {
      const results = [ok(1), ok(2), ok(3)];
      const result = all(results);
      expect(result.ok && result.value).toEqual([1, 2, 3]);
    });

    it('should return first err', () => {
      const error = new Error('second');
      const results = [ok(1), err(error), ok(3)];
      const result = all(results);
      expect(!result.ok && result.error).toBe(error);
    });
  });

  describe('domain errors', () => {
    it('should create NotFoundError', () => {
      const error = new NotFoundError('User', '123');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('User not found: 123');
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid input', ['email']);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fields).toEqual(['email']);
    });
  });
});
