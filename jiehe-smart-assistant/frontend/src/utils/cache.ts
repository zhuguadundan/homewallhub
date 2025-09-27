/**
 * API响应缓存系统
 * 支持内存缓存、LocalStorage持久化和智能过期策略
 */

interface CacheItem {
  data: any
  timestamp: number
  expires: number
  etag?: string
  lastModified?: string
}

interface CacheOptions {
  ttl?: number // 缓存时间（毫秒）
  maxAge?: number // 最大存活时间
  persistent?: boolean // 是否持久化到 localStorage
  prefix?: string // 缓存key前缀
}

export class ApiCache {
  private memoryCache = new Map<string, CacheItem>()
  private readonly prefix: string
  private readonly maxMemoryItems = 100

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || 'jiehe_cache_'
    
    // 清理过期的localStorage缓存
    this.cleanExpiredPersistentCache()
  }

  /**
   * 设置缓存
   */
  set(
    key: string, 
    data: any, 
    options: { ttl?: number; persistent?: boolean; etag?: string; lastModified?: string } = {}
  ) {
    const ttl = options.ttl || 5 * 60 * 1000 // 默认5分钟
    const cacheItem: CacheItem = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
      etag: options.etag,
      lastModified: options.lastModified
    }

    // 内存缓存
    this.memoryCache.set(key, cacheItem)
    
    // 清理内存缓存大小
    this.cleanMemoryCache()

    // 持久化缓存
    if (options.persistent) {
      try {
        localStorage.setItem(
          this.prefix + key, 
          JSON.stringify(cacheItem)
        )
      } catch (error) {
        console.warn('缓存持久化失败:', error)
      }
    }
  }

  /**
   * 获取缓存
   */
  get(key: string): any | null {
    // 先检查内存缓存
    let cacheItem = this.memoryCache.get(key)
    
    // 如果内存中没有，检查持久化缓存
    if (!cacheItem) {
      cacheItem = this.getPersistentCache(key)
      if (cacheItem) {
        // 将持久化缓存加载到内存
        this.memoryCache.set(key, cacheItem)
      }
    }

    if (!cacheItem) {
      return null
    }

    // 检查是否过期
    if (Date.now() > cacheItem.expires) {
      this.delete(key)
      return null
    }

    return cacheItem.data
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * 删除缓存
   */
  delete(key: string) {
    this.memoryCache.delete(key)
    localStorage.removeItem(this.prefix + key)
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.memoryCache.clear()
    
    // 清空localStorage中的缓存
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key)
      }
    })
  }

  /**
   * 获取缓存的ETag
   */
  getETag(key: string): string | undefined {
    const cacheItem = this.memoryCache.get(key) || this.getPersistentCache(key)
    return cacheItem?.etag
  }

  /**
   * 获取缓存的Last-Modified
   */
  getLastModified(key: string): string | undefined {
    const cacheItem = this.memoryCache.get(key) || this.getPersistentCache(key)
    return cacheItem?.lastModified
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const memorySize = this.memoryCache.size
    const persistentKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
    
    return {
      memoryItems: memorySize,
      persistentItems: persistentKeys.length,
      totalSize: this.calculateStorageSize()
    }
  }

  /**
   * 从持久化存储获取缓存
   */
  private getPersistentCache(key: string): CacheItem | null {
    try {
      const cached = localStorage.getItem(this.prefix + key)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.warn('读取持久化缓存失败:', error)
      localStorage.removeItem(this.prefix + key)
    }
    return null
  }

  /**
   * 清理过期的持久化缓存
   */
  private cleanExpiredPersistentCache() {
    const keys = Object.keys(localStorage)
    const now = Date.now()
    
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const cacheItem: CacheItem = JSON.parse(cached)
            if (now > cacheItem.expires) {
              localStorage.removeItem(key)
            }
          }
        } catch (error) {
          // 删除损坏的缓存项
          localStorage.removeItem(key)
        }
      }
    })
  }

  /**
   * 清理内存缓存大小
   */
  private cleanMemoryCache() {
    if (this.memoryCache.size <= this.maxMemoryItems) {
      return
    }

    // 按时间戳排序，删除最旧的项
    const entries = Array.from(this.memoryCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const itemsToRemove = entries.slice(0, this.memoryCache.size - this.maxMemoryItems)
    itemsToRemove.forEach(([key]) => {
      this.memoryCache.delete(key)
    })
  }

  /**
   * 计算存储空间使用
   */
  private calculateStorageSize(): number {
    let totalSize = 0
    const keys = Object.keys(localStorage)
    
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += new Blob([value]).size
        }
      }
    })
    
    return totalSize
  }
}

// 创建不同场景的缓存实例
export const apiCache = new ApiCache({
  prefix: 'jiehe_api_',
  ttl: 5 * 60 * 1000 // 5分钟
})

export const staticCache = new ApiCache({
  prefix: 'jiehe_static_',
  ttl: 30 * 60 * 1000 // 30分钟
})

export const userCache = new ApiCache({
  prefix: 'jiehe_user_',
  ttl: 10 * 60 * 1000 // 10分钟
})