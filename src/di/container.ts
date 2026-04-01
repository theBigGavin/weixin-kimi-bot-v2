/**
 * 依赖注入容器
 * 
 * 替代单例模式的现代依赖管理方式
 */

import { Result, ok, err, DomainError } from '../types/result.js';

export type Token = string | symbol;

export type Factory<T, Deps extends Record<string, unknown> = {}> = (
  deps: Deps
) => T;

export interface Registration<T = unknown> {
  readonly token: Token;
  readonly factory: Factory<T>;
  readonly singleton: boolean;
  instance?: T;
}

export interface Container {
  register<T>(
    token: Token,
    factory: Factory<T, Record<string, unknown>>,
    options?: { singleton?: boolean }
  ): void;
  resolve<T>(token: Token): Result<T, ResolutionError>;
  has(token: Token): boolean;
  createScope(): Container;
}

export class ResolutionError extends DomainError {
  constructor(token: Token, cause?: Error) {
    const tokenName = typeof token === 'symbol' ? token.toString() : token;
    super(
      `Failed to resolve dependency: ${tokenName}`,
      'RESOLUTION_ERROR',
      cause
    );
    this.name = 'ResolutionError';
  }
}

class ContainerImpl implements Container {
  private registrations = new Map<Token, Registration>();
  private parent: ContainerImpl | null = null;
  private resolving = new Set<Token>();

  constructor(parent?: ContainerImpl) {
    this.parent = parent || null;
  }

  register<T>(
    token: Token,
    factory: Factory<T>,
    options: { singleton?: boolean } = {}
  ): void {
    this.registrations.set(token, {
      token,
      factory,
      singleton: options.singleton ?? true,
    });
  }

  resolve<T>(token: Token): Result<T, ResolutionError> {
    if (this.resolving.has(token)) {
      return err(new ResolutionError(token));
    }

    const registration = this.findRegistration(token);
    if (!registration) {
      return err(new ResolutionError(token));
    }

    if (registration.singleton && registration.instance !== undefined) {
      return ok(registration.instance as T);
    }

    this.resolving.add(token);
    try {
      const deps = this.createDependencyProxy();
      const instance = registration.factory(deps);
      
      if (registration.singleton) {
        registration.instance = instance;
      }
      
      return ok(instance as T);
    } catch (error) {
      return err(new ResolutionError(token, error as Error));
    } finally {
      this.resolving.delete(token);
    }
  }

  has(token: Token): boolean {
    return this.registrations.has(token) || (this.parent?.has(token) ?? false);
  }

  createScope(): Container {
    return new ContainerImpl(this);
  }

  private findRegistration(token: Token): Registration | undefined {
    return this.registrations.get(token) ?? this.parent?.findRegistration(token);
  }

  private createDependencyProxy(): Record<string, unknown> {
    return new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined;
        const result = this.resolve(prop);
        return result.ok ? result.value : undefined;
      },
    });
  }
}

export function createContainer(): Container {
  return new ContainerImpl();
}
