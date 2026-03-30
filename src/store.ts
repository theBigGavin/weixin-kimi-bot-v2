/**
 * 数据持久化模块
 * 
 * 提供基于 JSON 文件的简单键值存储，支持命名空间隔离
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

/**
 * 存储接口
 */
export interface Store {
  /**
   * 获取值
   * @param key 键
   * @returns 值，不存在返回 null
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * 设置值
   * @param key 键
   * @param value 值
   */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * 删除键
   * @param key 键
   */
  delete(key: string): Promise<void>;

  /**
   * 检查键是否存在
   * @param key 键
   */
  has(key: string): Promise<boolean>;

  /**
   * 获取所有键
   */
  keys(): Promise<string[]>;

  /**
   * 清空所有数据
   */
  clear(): Promise<void>;

  /**
   * 创建命名空间子存储
   * @param namespace 命名空间名称
   */
  namespace(namespace: string): Store;

  /**
   * 获取存储统计信息
   */
  stats(): Promise<{ count: number; totalSize: number }>;
}

/**
 * 文件存储实现
 */
class FileStore implements Store {
  private basePath: string;
  private nsPrefix: string;

  constructor(basePath: string, nsPrefix: string = '') {
    this.basePath = basePath;
    this.nsPrefix = nsPrefix;
  }

  /**
   * 获取完整的键名（包含命名空间前缀）
   */
  private getFullKey(key: string): string {
    return this.nsPrefix ? `${this.nsPrefix}:${key}` : key;
  }

  /**
   * 获取文件路径
   */
  private getFilePath(key: string): string {
    const fullKey = this.getFullKey(key);
    // 将命名空间分隔符替换为目录分隔符
    const relativePath = fullKey.replace(/:/g, '/');
    return join(this.basePath, `${relativePath}.json`);
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    if (!key) {
      throw new Error('Key cannot be empty');
    }

    const filePath = this.getFilePath(key);
    await this.ensureDir(filePath);
    
    const content = JSON.stringify(value, null, 2);
    await writeFile(filePath, content, 'utf-8');
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    
    try {
      await unlink(filePath);
    } catch {
      // 文件不存在时静默失败
    }
  }

  async has(key: string): Promise<boolean> {
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
          // 移除 .json 后缀
          let key = entry.slice(0, -5).replace(/\\/g, '/');
          
          // 如果有命名空间前缀，移除它
          if (prefix && key.startsWith(prefix)) {
            key = key.slice(prefix.length);
          }
          
          // 将路径分隔符转换回命名空间分隔符
          key = key.replace(/\//g, ':');
          
          keys.push(key);
        }
      }
    } catch {
      // 目录不存在时返回空数组
    }

    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    await Promise.all(keys.map(key => this.delete(key)));
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

    for (const key of keys) {
      const filePath = this.getFilePath(key);
      try {
        const fileStat = await stat(filePath);
        totalSize += fileStat.size;
      } catch {
        // 忽略统计失败的文件
      }
    }

    return {
      count: keys.length,
      totalSize,
    };
  }
}

/**
 * 创建存储实例
 * @param basePath 存储基础路径
 * @returns Store 实例
 */
export function createStore(basePath: string): Store {
  // 确保基础目录存在
  if (!existsSync(basePath)) {
    // 同步创建，因为这是构造函数
    const { mkdirSync } = require('fs');
    mkdirSync(basePath, { recursive: true });
  }
  
  return new FileStore(basePath);
}

// 默认导出
export { FileStore };
export default createStore;
