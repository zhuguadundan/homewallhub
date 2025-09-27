/**
 * 数据库优化中间件
 * 集成查询缓存和性能监控到数据库操作中
 */

import { dbGet, dbAll, dbRun } from '../config/database'
import { queryOptimizer } from '../utils/queryOptimizer'
import { logger } from '../utils/logger'

/**
 * 优化的查询函数（单行）
 */
export async function optimizedDbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  // 尝试从缓存获取结果
  const cachedResult = queryOptimizer.getCachedResult(sql, params)
  if (cachedResult !== null) {
    return cachedResult
  }

  // 执行查询并记录性能
  const startTime = Date.now()
  try {
    const result = await dbGet<T>(sql, params)
    const executionTime = Date.now() - startTime
    
    // 记录统计信息
    queryOptimizer.recordQueryStats(sql, executionTime, false, result ? 1 : 0)
    
    // 缓存结果
    queryOptimizer.cacheResult(sql, params, result)
    
    return result
  } catch (error) {
    const executionTime = Date.now() - startTime
    queryOptimizer.recordQueryStats(sql, executionTime, false, 0)
    throw error
  }
}

/**
 * 优化的查询函数（多行）
 */
export async function optimizedDbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // 尝试从缓存获取结果
  const cachedResult = queryOptimizer.getCachedResult(sql, params)
  if (cachedResult !== null) {
    return cachedResult
  }

  // 执行查询并记录性能
  const startTime = Date.now()
  try {
    const result = await dbAll<T>(sql, params)
    const executionTime = Date.now() - startTime
    
    // 记录统计信息
    queryOptimizer.recordQueryStats(sql, executionTime, false, result.length)
    
    // 缓存结果
    queryOptimizer.cacheResult(sql, params, result)
    
    return result
  } catch (error) {
    const executionTime = Date.now() - startTime
    queryOptimizer.recordQueryStats(sql, executionTime, false, 0)
    throw error
  }
}

/**
 * 优化的更新函数
 */
export async function optimizedDbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
  const startTime = Date.now()
  
  try {
    const result = await dbRun(sql, params)
    const executionTime = Date.now() - startTime
    
    // 记录统计信息
    queryOptimizer.recordQueryStats(sql, executionTime, false, result.changes)
    
    // 清理相关缓存
    invalidateRelatedCache(sql)
    
    return result
  } catch (error) {
    const executionTime = Date.now() - startTime
    queryOptimizer.recordQueryStats(sql, executionTime, false, 0)
    throw error
  }
}

/**
 * 清理相关缓存
 */
function invalidateRelatedCache(sql: string): void {
  const normalizedSql = sql.trim().toLowerCase()
  
  // 提取表名
  const tableMatches = normalizedSql.match(/(?:insert\s+into|update|delete\s+from|alter\s+table)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
  
  if (tableMatches && tableMatches[1]) {
    const tableName = tableMatches[1]
    
    // 清理涉及该表的查询缓存
    // 这里可以实现更精细的缓存失效策略
    queryOptimizer.clearCache()
    
    logger.debug(`已清理表 ${tableName} 相关的查询缓存`)
  }
}

/**
 * 批量查询优化
 */
export async function batchQuery<T = any>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]> {
  const results: T[] = []
  const startTime = Date.now()
  
  try {
    for (const query of queries) {
      const result = await optimizedDbAll<T>(query.sql, query.params)
      results.push(...result)
    }
    
    const executionTime = Date.now() - startTime
    logger.info(`批量查询完成`, {
      queryCount: queries.length,
      resultCount: results.length,
      executionTime
    })
    
    return results
  } catch (error) {
    logger.error('批量查询失败', { queries, error })
    throw error
  }
}

/**
 * 分页查询优化
 */
export async function paginatedQuery<T = any>(
  sql: string,
  params: any[] = [],
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
  // 计算偏移量
  const offset = (page - 1) * pageSize
  
  // 构建计数查询
  const countSql = `SELECT COUNT(*) as total FROM (${sql})`
  const dataSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`
  
  try {
    // 并行执行计数和数据查询
    const [countResult, dataResult] = await Promise.all([
      optimizedDbGet<{ total: number }>(countSql, params),
      optimizedDbAll<T>(dataSql, params)
    ])
    
    const total = countResult?.total || 0
    const totalPages = Math.ceil(total / pageSize)
    
    return {
      data: dataResult,
      total,
      page,
      pageSize,
      totalPages
    }
  } catch (error) {
    logger.error('分页查询失败', { sql, params, page, pageSize, error })
    throw error
  }
}

/**
 * 获取查询性能报告
 */
export function getQueryPerformanceReport(): any {
  return queryOptimizer.getPerformanceReport()
}

/**
 * 清空查询缓存
 */
export function clearQueryCache(): void {
  queryOptimizer.clearCache()
}

/**
 * 重置查询统计
 */
export function resetQueryStats(): void {
  queryOptimizer.clearStats()
}