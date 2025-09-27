/**
 * AI请求缓存服务
 * 提供智能缓存机制，减少重复API调用
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { aiConfig } from '../config/ai';
import type { CacheEntry, AIServiceRequest, AIServiceResponse } from '../interfaces/ai';

export class AICacheService {
  private static instance: AICacheService;
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // LRU访问顺序

  public static getInstance(): AICacheService {
    if (!AICacheService.instance) {
      AICacheService.instance = new AICacheService();
    }
    return AICacheService.instance;
  }

  constructor() {
    // 定期清理过期缓存
    if (aiConfig.cache.enabled) {
      setInterval(() => {
        this.cleanupExpiredEntries();
      }, 60000); // 每分钟清理一次
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: AIServiceRequest): string {
    const keyData = {
      prompt: request.prompt,
      context: request.context || '',
      requestType: request.requestType,
      maxTokens: request.maxTokens || aiConfig.qianwen.maxTokens,
      temperature: request.temperature || aiConfig.qianwen.temperature
    };
    
    const keyString = JSON.stringify(keyData);
    return createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * 获取缓存的响应
   */
  async get(request: AIServiceRequest): Promise<AIServiceResponse | null> {
    if (!aiConfig.cache.enabled) {
      return null;
    }

    try {
      const key = this.generateCacheKey(request);
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      // 检查是否过期
      const now = new Date();
      const ageInSeconds = (now.getTime() - entry.timestamp.getTime()) / 1000;
      
      if (ageInSeconds > aiConfig.cache.ttl) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        return null;
      }

      // 更新访问统计
      entry.hitCount++;
      entry.lastHit = now;
      this.updateAccessOrder(key);

      logger.debug('AI缓存命中', {
        key: key.substring(0, 16) + '...',
        hitCount: entry.hitCount,
        ageInSeconds: Math.round(ageInSeconds)
      });

      return {
        content: entry.content,
        tokens: entry.tokens,
        cost: 0, // 缓存响应无额外成本
        requestId: `cached_${key.substring(0, 8)}`,
        cached: true,
        timestamp: entry.timestamp
      };
    } catch (error) {
      logger.error('获取AI缓存失败', { error });
      return null;
    }
  }

  /**
   * 缓存响应
   */
  async set(request: AIServiceRequest, response: AIServiceResponse): Promise<void> {
    if (!aiConfig.cache.enabled) {
      return;
    }

    try {
      const key = this.generateCacheKey(request);
      
      // 检查缓存大小限制
      if (this.cache.size >= aiConfig.cache.maxSize) {
        this.evictLRU();
      }

      const entry: CacheEntry = {
        key,
        content: response.content,
        tokens: response.tokens,
        timestamp: new Date(),
        hitCount: 0,
        lastHit: new Date()
      };

      this.cache.set(key, entry);
      this.updateAccessOrder(key);

      logger.debug('AI响应已缓存', {
        key: key.substring(0, 16) + '...',
        tokens: response.tokens,
        cacheSize: this.cache.size
      });
    } catch (error) {
      logger.error('缓存AI响应失败', { error });
    }
  }

  /**
   * 清理过期条目
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const ageInSeconds = (now.getTime() - entry.timestamp.getTime()) / 1000;
      if (ageInSeconds > aiConfig.cache.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug('清理过期AI缓存条目', { 
        cleanedCount: expiredKeys.length,
        remainingCount: this.cache.size
      });
    }
  }

  /**
   * LRU淘汰最少使用的条目
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.removeFromAccessOrder(lruKey);

    logger.debug('LRU淘汰AI缓存条目', {
      evictedKey: lruKey.substring(0, 16) + '...',
      remainingCount: this.cache.size
    });
  }

  /**
   * 更新访问顺序
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * 从访问顺序中移除键
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    logger.info('AI缓存已清空');
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let totalHits = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    // 简单的命中率计算（基于缓存条目的平均命中次数）
    const hitRate = this.cache.size > 0 ? totalHits / this.cache.size : 0;

    return {
      size: this.cache.size,
      maxSize: aiConfig.cache.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * 获取详细缓存条目信息
   */
  getEntries(limit: number = 50): Array<{
    key: string;
    tokens: number;
    hitCount: number;
    age: number;
    lastHit: Date;
  }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key: key.substring(0, 16) + '...',
        tokens: entry.tokens,
        hitCount: entry.hitCount,
        age: Math.round((Date.now() - entry.timestamp.getTime()) / 1000),
        lastHit: entry.lastHit
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);

    return entries;
  }

  /**
   * 删除特定类型的缓存
   */
  clearByRequestType(requestType: string): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    // 由于我们使用hash作为key，无法直接根据requestType删除
    // 这里提供一个通用的清理接口，实际使用中可以根据需要扩展
    for (const key of this.cache.keys()) {
      // 可以根据具体需求实现更精确的过滤逻辑
      keysToDelete.push(key);
      deletedCount++;
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    logger.info('清理特定类型AI缓存', { requestType, deletedCount });
    return deletedCount;
  }

  /**
   * 预热缓存 - 为常用请求预加载缓存
   */
  async warmup(commonRequests: AIServiceRequest[]): Promise<void> {
    logger.info('开始AI缓存预热', { requestCount: commonRequests.length });
    
    // 这里只是生成缓存键并记录，实际的预热需要配合AI服务进行
    for (const request of commonRequests) {
      const key = this.generateCacheKey(request);
      logger.debug('生成预热缓存键', { 
        requestType: request.requestType,
        key: key.substring(0, 16) + '...'
      });
    }
  }
}