/**
 * 数据持久化模块 - Phase 2 Refactoring
 * 
 * 改进点：
 * - 内部使用 Result 类型处理错误
 * - 消除空 catch 块，记录错误原因
 * - 保持向后兼容的 API
 */

import {
  readFile,
  writeFile,
  unlink,
  readdir,
  stat,
  mkdir,
} from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getDefaultLogger } from './logging/index.js';

// ============================================================================
// Error Types
// ============================================================================

export class StoreError extends Error {
  constructor(
    message: string,
    public readonly key?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

// ============================================================================
// Store Interface
// ============================================================================

export interface Store {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  namespace(namespace: string): Store;
  stats(): Promise<{ count: number; totalSize: number }>;
}

// ============================================================================
// File Store Implementation
// ============================================================================

class FileStore implements Store {
  private basePath: string;
  private nsPrefix: string;

  constructor(basePath: string, nsPrefix: string = '') {
    this.basePath = basePath;
    this.nsPrefix = nsPrefix;
  }

  private getFullKey(key: string): string {
    return this.nsPrefix ? `${this.nsPrefix}:${key}` : key;
  }

  private getFilePath(key: string): string {
    const fullKey = this.getFullKey(key);
    const relativePath = fullKey.replace(/:/g, '/');
    return join(this.basePath, `${relativePath}.json`);
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        throw new StoreError(
          `Failed to create directory: ${dir}`,
          undefined,
          error as Error
        );
      }
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!key) {
      throw new StoreError('Key cannot be empty');
    }

    const filePath = this.getFilePath(key);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        // JSON 解析错误也返回 null（与旧行为兼容）
        getDefaultLogger().warn(`Store: Corrupted JSON for key '${key}': ${(parseError as Error).message}`);
        return null;
      }
    } catch (error) {
      // 只有文件不存在时返回 null，其他错误抛出
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new StoreError(
        `Failed to read key: ${key}`,
        key,
        error as Error
      );
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    if (!key) {
      throw new StoreError('Key cannot be empty');
    }

    const filePath = this.getFilePath(key);
    await this.ensureDir(filePath);
    
    const content = JSON.stringify(value, null, 2);
    try {
      await writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new StoreError(
        `Failed to write key: ${key}`,
        key,
        error as Error
      );
    }
  }

  async delete(key: string): Promise<void> {
    if (!key) {
      throw new StoreError('Key cannot be empty');
    }

    const filePath = this.getFilePath(key);
    
    try {
      await unlink(filePath);
    } catch (error) {
      // 文件不存在时静默失败（幂等性）
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new StoreError(
          `Failed to delete key: ${key}`,
          key,
          error as Error
        );
      }
    }
  }

  async has(key: string): Promise<boolean> {
    if (!key) return false;
    const filePath = this.getFilePath(key);
    return existsSync(filePath);
  }

  async keys(): Promise<string[]> {
    const keys: string[] = [];
    const prefix = this.nsPrefix ? `${this.nsPrefix}/` : '';

    try {
      const entries = await readdir(this.basePath, { recursive: true });
      
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          let key = entry.slice(0, -5).replace(/\\/g, '/');
          
          if (prefix && key.startsWith(prefix)) {
            key = key.slice(prefix.length);
          }
          
          key = key.replace(/\//g, ':');
          keys.push(key);
        }
      }
    } catch (error) {
      // 目录不存在时返回空数组
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new StoreError(
          `Failed to read directory: ${this.basePath}`,
          undefined,
          error as Error
        );
      }
    }

    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    const errors: StoreError[] = [];
    
    for (const key of keys) {
      try {
        await this.delete(key);
      } catch (error) {
        errors.push(error as StoreError);
      }
    }

    if (errors.length > 0) {
      throw new StoreError(
        `Failed to clear ${errors.length} items`,
        undefined,
        errors[0]
      );
    }
  }

  namespace(namespace: string): Store {
    const newPrefix = this.nsPrefix 
      ? `${this.nsPrefix}:${namespace}` 
      : namespace;
    return new FileStore(this.basePath, newPrefix);
  }

  async stats(): Promise<{ count: number; totalSize: number }> {
    const keys = await this.keys();
    let totalSize = 0;
    const errors: StoreError[] = [];

    for (const key of keys) {
      const filePath = this.getFilePath(key);
      try {
        const fileStat = await stat(filePath);
        totalSize += fileStat.size;
      } catch (error) {
        // 记录错误但继续统计
        errors.push(new StoreError(
          `Failed to stat file: ${filePath}`,
          key,
          error as Error
        ));
      }
    }

    // 如果有错误，记录警告但不抛出
    if (errors.length > 0) {
      getDefaultLogger().warn(`Store.stats: ${errors.length} files could not be stat'd`);
    }

    return {
      count: keys.length,
      totalSize,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createStore(basePath: string): Store {
  if (!existsSync(basePath)) {
    const { mkdirSync } = require('fs');
    mkdirSync(basePath, { recursive: true });
  }
  
  return new FileStore(basePath);
}

export { FileStore };
export default createStore;
