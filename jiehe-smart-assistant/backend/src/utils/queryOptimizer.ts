/**
 * 数据库查询优化器
 * 实现查询缓存、性能监控和优化建议
 */

import { LRUCache } from 'lru-cache'
import { logger } from './logger'

interface QueryCacheOptions {
  maxSize?: number
  ttl?: number // 缓存时间（毫秒）
}

interface QueryStats {
  query: string
  executionTime: number
  timestamp: number
  cacheHit: boolean
  rowCount?: number
}

interface QueryPerformance {
  averageTime: number
  totalExecutions: number
  cacheHitRate: number
  slowQueries: number
}

export class QueryOptimizer {
  private queryCache: LRUCache<string, any>
  private queryStats: QueryStats[] = []
  private performanceMetrics = new Map<string, QueryPerformance>()
  private slowQueryThreshold = 100 // 慢查询阈值（毫秒）

  constructor(options: QueryCacheOptions = {}) {
    this.queryCache = new LRUCache({
      max: options.maxSize || 1000,
      ttl: options.ttl || 5 * 60 * 1000, // 默认5分钟
    })
  }

  /**
   * 生成查询缓存键
   */
  private generateCacheKey(sql: string, params: any[]): string {
    const queryData = {
      sql: sql.trim().toLowerCase(),
      params: params || []
    }
    return Buffer.from(JSON.stringify(queryData)).toString('base64')
  }

  /**
   * 检查查询是否可缓存
   */
  private isCacheable(sql: string): boolean {
    const normalizedSql = sql.trim().toLowerCase()
    
    // 只缓存SELECT查询
    if (!normalizedSql.startsWith('select')) {
      return false
    }

    // 排除包含时间函数的查询
    const timeKeywords = ['now()', 'current_timestamp', 'datetime()', 'date()', 'time()']
    return !timeKeywords.some(keyword => normalizedSql.includes(keyword))
  }

  /**
   * 获取缓存的查询结果
   */
  getCachedResult(sql: string, params: any[]): any | null {
    if (!this.isCacheable(sql)) {
      return null
    }

    const cacheKey = this.generateCacheKey(sql, params)
    const cachedResult = this.queryCache.get(cacheKey)
    
    if (cachedResult) {
      this.recordQueryStats(sql, 0, true, Array.isArray(cachedResult) ? cachedResult.length : 1)
      return cachedResult
    }

    return null
  }

  /**
   * 缓存查询结果
   */
  cacheResult(sql: string, params: any[], result: any): void {
    if (!this.isCacheable(sql)) {
      return
    }

    const cacheKey = this.generateCacheKey(sql, params)
    this.queryCache.set(cacheKey, result)
  }

  /**
   * 记录查询统计信息
   */
  recordQueryStats(sql: string, executionTime: number, cacheHit: boolean, rowCount?: number): void {
    const stats: QueryStats = {
      query: sql,
      executionTime,
      timestamp: Date.now(),
      cacheHit,
      rowCount
    }

    this.queryStats.push(stats)
    this.updatePerformanceMetrics(sql, stats)

    // 保持统计数据在合理范围内
    if (this.queryStats.length > 10000) {
      this.queryStats.splice(0, 1000) // 删除最早的1000条记录
    }

    // 记录慢查询
    if (executionTime > this.slowQueryThreshold && !cacheHit) {
      logger.warn('检测到慢查询', {
        sql: sql.substring(0, 200),
        executionTime,
        rowCount
      })
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(sql: string, stats: QueryStats): void {
    const queryPattern = this.extractQueryPattern(sql)
    const existing = this.performanceMetrics.get(queryPattern) || {
      averageTime: 0,
      totalExecutions: 0,
      cacheHitRate: 0,
      slowQueries: 0
    }

    existing.totalExecutions++
    
    if (!stats.cacheHit) {
      existing.averageTime = (
        (existing.averageTime * (existing.totalExecutions - 1)) + stats.executionTime
      ) / existing.totalExecutions

      if (stats.executionTime > this.slowQueryThreshold) {
        existing.slowQueries++
      }
    }

    // 计算缓存命中率
    const recentStats = this.queryStats
      .filter(s => s.query === sql)
      .slice(-100) // 最近100次查询
    
    const cacheHits = recentStats.filter(s => s.cacheHit).length
    existing.cacheHitRate = cacheHits / recentStats.length

    this.performanceMetrics.set(queryPattern, existing)
  }

  /**
   * 提取查询模式（去除具体参数）
   */
  private extractQueryPattern(sql: string): string {
    return sql
      .replace(/\$\d+/g, '?') // 替换参数占位符
      .replace(/\d+/g, '?') // 替换数字
      .replace(/'[^']*'/g, '?') // 替换字符串字面量
      .replace(/\s+/g, ' ') // 标准化空白
      .trim()
  }

  /**
   * 优化查询建议
   */
  getOptimizationSuggestions(): any[] {
    const suggestions = []

    for (const [pattern, metrics] of this.performanceMetrics.entries()) {
      if (metrics.averageTime > this.slowQueryThreshold) {
        suggestions.push({
          type: 'slow_query',
          pattern,
          averageTime: metrics.averageTime,
          recommendation: '考虑添加索引或优化查询逻辑'
        })
      }

      if (metrics.cacheHitRate < 0.5 && metrics.totalExecutions > 10) {
        suggestions.push({
          type: 'low_cache_hit',
          pattern,
          cacheHitRate: metrics.cacheHitRate,
          recommendation: '查询结果变化频繁，考虑调整缓存策略'
        })
      }

      if (metrics.slowQueries / metrics.totalExecutions > 0.1) {
        suggestions.push({
          type: 'frequent_slow_queries',
          pattern,
          slowQueryRate: metrics.slowQueries / metrics.totalExecutions,
          recommendation: '频繁出现慢查询，建议优化查询或添加索引'
        })
      }
    }

    return suggestions
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    const totalQueries = this.queryStats.length
    const cachedQueries = this.queryStats.filter(s => s.cacheHit).length
    const slowQueries = this.queryStats.filter(s => s.executionTime > this.slowQueryThreshold).length
    
    const averageExecutionTime = this.queryStats
      .filter(s => !s.cacheHit)
      .reduce((sum, s) => sum + s.executionTime, 0) / (totalQueries - cachedQueries || 1)

    return {
      totalQueries,
      cacheHitRate: cachedQueries / totalQueries,
      averageExecutionTime,
      slowQueryCount: slowQueries,
      slowQueryRate: slowQueries / totalQueries,
      cacheSize: this.queryCache.size,
      topSlowQueries: this.getTopSlowQueries(10),
      optimizationSuggestions: this.getOptimizationSuggestions()
    }
  }

  /**
   * 获取最慢的查询
   */
  private getTopSlowQueries(limit: number): any[] {
    return this.queryStats
      .filter(s => !s.cacheHit)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit)
      .map(s => ({
        query: s.query.substring(0, 100) + (s.query.length > 100 ? '...' : ''),
        executionTime: s.executionTime,
        timestamp: s.timestamp
      }))
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.queryCache.clear()
    logger.info('查询缓存已清空')
  }

  /**
   * 清空统计信息
   */
  clearStats(): void {
    this.queryStats = []
    this.performanceMetrics.clear()
    logger.info('查询统计信息已清空')
  }
}

// 导出单例实例
export const queryOptimizer = new QueryOptimizer({
  maxSize: 1000,
  ttl: 5 * 60 * 1000 // 5分钟
})