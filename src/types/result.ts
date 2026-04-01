/**
 * Result Type - 函数式错误处理
 * 
 * 替代 try/catch 的现代错误处理方式
 * 灵感来自 Rust Result<T, E> 和 fp-ts
 * 
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, DivisionError> {
 *   if (b === 0) return err(new DivisionError('Cannot divide by zero'));
 *   return ok(a / b);
 * }
 * 
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * 成功的结果
 */
export type Ok<T> = {
  readonly ok: true;
  readonly value: T;
};

/**
 * 失败的结果
 */
export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

/**
 * Result 类型 - 表示可能成功或失败的操作
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

// ============================================================================
// Constructors
// ============================================================================

/**
 * 创建成功结果
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * 创建失败结果
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否为成功结果
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * 检查是否为失败结果
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

// ============================================================================
// Transformations
// ============================================================================

/**
 * 映射成功值
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * 映射错误值
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

/**
 * 链式操作（flatMap）
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/**
 * 提供默认值
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * 获取值或抛出错误
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error 
    ? result.error 
    : new Error(String(result.error));
}

/**
 * 获取值或调用函数
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  return result.ok ? result.value : fn(result.error);
}

// ============================================================================
// Async Operations
// ============================================================================

/**
 * 异步映射
 */
export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  return result.ok ? ok(await fn(result.value)) : result;
}

/**
 * 异步链式操作
 */
export async function andThenAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  return result.ok ? await fn(result.value) : result;
}

/**
 * 将 Promise 转换为 Result
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
  onError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (error) {
    return err(onError ? onError(error) : error as E);
  }
}

// ============================================================================
// Collections
// ============================================================================

/**
 * 收集多个 Result，如果有任意失败则返回第一个失败
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

/**
 * 收集多个 Result，返回所有成功和失败
 */
export function partition<T, E>(
  results: Result<T, E>[]
): { ok: T[]; err: E[] } {
  const ok: T[] = [];
  const err: E[] = [];
  for (const result of results) {
    if (result.ok) ok.push(result.value);
    else err.push(result.error);
  }
  return { ok, err };
}

// ============================================================================
// Domain-Specific Errors
// ============================================================================

/**
 * 基础领域错误
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * 未找到错误
 */
export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends DomainError {
  constructor(message: string, public readonly fields?: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} already exists: ${identifier}`, 'CONFLICT');
    this.name = 'ConflictError';
  }
}
