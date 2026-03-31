/**
 * Intent Cache
 * 
 * 意图缓存系统，用于缓存 LLM 路由决策结果
 * 实现相似意图的快速匹配，减少 LLM 调用成本
 */

import {
  TaskRequest,
  IntentSignature,
  CachedDecision,
  Capability,
} from '../protocol/index.js';

/**
 * 缓存配置
 */
export interface IntentCacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 缓存过期时间（毫秒） */
  ttl: number;
  /** 相似度阈值（0-1） */
  similarityThreshold: number;
  /** 是否启用模糊匹配 */
  enableFuzzyMatch: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_CACHE_CONFIG: IntentCacheConfig = {
  maxSize: 1000,
  ttl: 24 * 60 * 60 * 1000, // 24小时
  similarityThreshold: 0.85,
  enableFuzzyMatch: true,
};

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 驱逐次数 */
  evictions: number;
}

/**
 * 意图缓存
 * 
 * LRU 缓存策略，支持相似意图匹配
 */
export class IntentCache {
  private cache = new Map<string, CachedDecision>();
  private config: IntentCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: Partial<IntentCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * 获取缓存的决策
   * 
   * 1. 精确匹配（哈希匹配）
   * 2. 相似匹配（模糊匹配，可选）
   */
  async get(
    message: string,
    capabilities: Capability[],
    userId?: string
  ): Promise<TaskRequest | null> {
    const signature = this.computeSignature(message, capabilities, userId);

    // 1. 精确匹配
    const exactMatch = this.getExactMatch(signature);
    if (exactMatch) {
      this.stats.hits++;
      return exactMatch.taskRequest;
    }

    // 2. 模糊匹配（如果启用）
    if (this.config.enableFuzzyMatch) {
      const fuzzyMatch = this.findSimilarMatch(signature);
      if (fuzzyMatch) {
        this.stats.hits++;
        return fuzzyMatch.taskRequest;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 缓存决策结果
   */
  set(
    message: string,
    capabilities: Capability[],
    taskRequest: TaskRequest,
    userId?: string
  ): void {
    // 清理过期条目
    this.cleanup();

    // 如果缓存已满，驱逐最老的条目
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const signature = this.computeSignature(message, capabilities, userId);
    const cached: CachedDecision = {
      signature,
      taskRequest,
      cachedAt: Date.now(),
      hitCount: 0,
      lastHitAt: Date.now(),
    };

    this.cache.set(signature.intentHash, cached);
  }

  /**
   * 使缓存失效
   * 
   * 可以按用户ID或能力ID使缓存失效
   */
  invalidate(options?: { userId?: string; capabilityId?: string }): number {
    if (!options) {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }

    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      let shouldDelete = false;

      if (options.userId && cached.signature.userId === options.userId) {
        shouldDelete = true;
      }

      if (options.capabilityId) {
        const hasCapability = cached.taskRequest.analysis.requiredCapabilities.includes(
          options.capabilityId
        );
        if (hasCapability) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        keysToDelete.push(key);
        count++;
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    return count;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 计算意图签名
   */
  private computeSignature(
    message: string,
    capabilities: Capability[],
    userId?: string
  ): IntentSignature {
    // 标准化消息
    const normalizedMessage = this.normalizeMessage(message);
    
    // 计算意图哈希
    const intentHash = this.hashString(normalizedMessage);
    
    // 计算能力集合指纹
    const capabilitySet = capabilities
      .map(c => c.id)
      .sort()
      .join(',');
    
    // 计算复杂度指纹（基于消息特征）
    const complexityFingerprint = this.computeComplexityFingerprint(normalizedMessage);

    return {
      intentHash,
      capabilitySet,
      complexityFingerprint,
      userId,
    };
  }

  /**
   * 标准化消息
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')        // 合并多个空格
      .replace(/[，。？！,.?!]/g, '') // 移除标点
      .replace(/\d+/g, '#');        // 数字泛化
  }

  /**
   * 计算复杂度指纹
   */
  private computeComplexityFingerprint(message: string): string {
    const indicators = {
      hasCondition: /如果|假如|条件|when|if/i.test(message),
      hasMultiple: /多个|批量|all|every/i.test(message),
      hasTime: /时间|定时|每天|每周|schedule|cron/i.test(message),
      hasConfirm: /确认|批准|同意|approve|confirm/i.test(message),
      isComplex: /复杂|重构|设计|架构|complex|refactor/i.test(message),
    };

    return Object.entries(indicators)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join('|') || 'simple';
  }

  /**
   * 简单的字符串哈希
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `h${Math.abs(hash).toString(36)}`;
  }

  /**
   * 获取精确匹配
   */
  private getExactMatch(signature: IntentSignature): CachedDecision | null {
    const cached = this.cache.get(signature.intentHash);
    
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.cachedAt > this.config.ttl) {
      this.cache.delete(signature.intentHash);
      return null;
    }

    // 验证能力集合是否匹配
    if (cached.signature.capabilitySet !== signature.capabilitySet) {
      return null;
    }

    // 更新命中统计
    cached.hitCount++;
    cached.lastHitAt = Date.now();

    return cached;
  }

  /**
   * 查找相似匹配
   */
  private findSimilarMatch(signature: IntentSignature): CachedDecision | null {
    let bestMatch: CachedDecision | null = null;
    let bestScore = 0;

    for (const cached of this.cache.values()) {
      // 跳过过期的
      if (Date.now() - cached.cachedAt > this.config.ttl) {
        continue;
      }

      // 计算相似度
      const score = this.calculateSimilarity(signature, cached.signature);

      if (score > bestScore && score >= this.config.similarityThreshold) {
        bestScore = score;
        bestMatch = cached;
      }
    }

    if (bestMatch) {
      bestMatch.hitCount++;
      bestMatch.lastHitAt = Date.now();
    }

    return bestMatch;
  }

  /**
   * 计算签名相似度
   */
  private calculateSimilarity(
    sig1: IntentSignature,
    sig2: IntentSignature
  ): number {
    let score = 0;
    let weights = 0;

    // 能力集合匹配（权重最高）
    if (sig1.capabilitySet === sig2.capabilitySet) {
      score += 1.0;
    }
    weights += 1.0;

    // 复杂度指纹匹配
    if (sig1.complexityFingerprint === sig2.complexityFingerprint) {
      score += 0.5;
    }
    weights += 0.5;

    // 用户ID匹配（如果都有）
    if (sig1.userId && sig2.userId) {
      if (sig1.userId === sig2.userId) {
        score += 0.3;
      }
      weights += 0.3;
    }

    return weights > 0 ? score / weights : 0;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.cachedAt > this.config.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 驱逐最久未使用的条目（LRU）
   */
  private evictLRU(): void {
    let oldest: { key: string; lastHitAt: number } | null = null;

    for (const [key, cached] of this.cache.entries()) {
      if (!oldest || cached.lastHitAt < oldest.lastHitAt) {
        oldest = { key, lastHitAt: cached.lastHitAt };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
      this.stats.evictions++;
    }
  }
}

// 导出默认实例
export const intentCache = new IntentCache();
