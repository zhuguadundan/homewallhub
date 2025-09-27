/**
 * 离线数据管理器
 * 处理离线状态下的数据存储、同步和冲突解决
 */

import { openDB } from 'idb'

interface OfflineDB {
  offline_actions: {
    key: string
    value: {
      id: string
      type: 'create' | 'update' | 'delete'
      entity: string
      data: any
      timestamp: number
      status: 'pending' | 'synced' | 'failed'
      retryCount: number
    }
  }
  cached_data: {
    key: string
    value: {
      key: string
      data: any
      timestamp: number
      expires: number
    }
  }
  offline_queue: {
    key: string
    value: {
      id: string
      url: string
      method: string
      data: any
      headers: any
      timestamp: number
      retryCount: number
    }
  }
}

export class OfflineManager {
  private db: any | null = null
  private isOnline = navigator.onLine
  private syncInProgress = false
  private maxRetries = 3

  constructor() {
    this.init()
    this.setupNetworkListeners()
  }

  /**
   * 初始化IndexedDB
   */
  private async init() {
    try {
      this.db = await openDB<OfflineDB>('jiehe-offline', 1, {
        upgrade(db) {
          // 离线操作存储
          if (!db.objectStoreNames.contains('offline_actions')) {
            const actionStore = db.createObjectStore('offline_actions', { keyPath: 'id' })
            actionStore.createIndex('status', 'status')
            actionStore.createIndex('entity', 'entity')
          }

          // 缓存数据存储
          if (!db.objectStoreNames.contains('cached_data')) {
            db.createObjectStore('cached_data', { keyPath: 'key' })
          }

          // 离线请求队列
          if (!db.objectStoreNames.contains('offline_queue')) {
            const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id' })
            queueStore.createIndex('timestamp', 'timestamp')
          }
        }
      })
    } catch (error) {
      console.error('离线数据库初始化失败:', error)
    }
  }

  /**
   * 设置网络状态监听器
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncOfflineActions()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  /**
   * 检查是否在线
   */
  isConnected(): boolean {
    return this.isOnline
  }

  /**
   * 存储离线操作
   */
  async storeOfflineAction(
    type: 'create' | 'update' | 'delete',
    entity: string,
    data: any
  ): Promise<string> {
    if (!this.db) await this.init()
    
    const action = {
      id: this.generateId(),
      type,
      entity,
      data,
      timestamp: Date.now(),
      status: 'pending' as const,
      retryCount: 0
    }

    await this.db!.add('offline_actions', action)
    return action.id
  }

  /**
   * 缓存数据
   */
  async cacheData(key: string, data: any, ttl: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init()
    
    const cacheItem = {
      key,
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    }

    await this.db!.put('cached_data', cacheItem)
  }

  /**
   * 获取缓存数据
   */
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.init()
    
    const cacheItem = await this.db!.get('cached_data', key)
    
    if (!cacheItem) return null
    
    // 检查是否过期
    if (Date.now() > cacheItem.expires) {
      await this.db!.delete('cached_data', key)
      return null
    }

    return cacheItem.data
  }

  /**
   * 添加到离线请求队列
   */
  async addToOfflineQueue(
    url: string,
    method: string,
    data: any,
    headers: any
  ): Promise<void> {
    if (!this.db) await this.init()
    
    const queueItem = {
      id: this.generateId(),
      url,
      method,
      data,
      headers,
      timestamp: Date.now(),
      retryCount: 0
    }

    await this.db!.add('offline_queue', queueItem)
  }

  /**
   * 同步离线操作
   */
  async syncOfflineActions(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return
    
    this.syncInProgress = true
    
    try {
      // 同步离线请求队列
      await this.syncOfflineQueue()
      
      // 同步离线操作
      await this.syncPendingActions()
      
    } catch (error) {
      console.error('离线同步失败:', error)
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 同步离线请求队列
   */
  private async syncOfflineQueue(): Promise<void> {
    if (!this.db) return
    
    const queueItems = await this.db.getAll('offline_queue')
    
    for (const item of queueItems) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.data ? JSON.stringify(item.data) : undefined
        })

        if (response.ok) {
          // 请求成功，从队列中移除
          await this.db.delete('offline_queue', item.id)
        } else if (item.retryCount < this.maxRetries) {
          // 重试
          item.retryCount++
          await this.db.put('offline_queue', item)
        } else {
          // 超过最大重试次数，移除
          await this.db.delete('offline_queue', item.id)
        }
      } catch (error) {
        if (item.retryCount < this.maxRetries) {
          item.retryCount++
          await this.db.put('offline_queue', item)
        } else {
          await this.db.delete('offline_queue', item.id)
        }
      }
    }
  }

  /**
   * 同步待处理的操作
   */
  private async syncPendingActions(): Promise<void> {
    if (!this.db) return
    
    const pendingActions = await this.db.getAllFromIndex('offline_actions', 'status', 'pending')
    
    for (const action of pendingActions) {
      try {
        const success = await this.syncAction(action)
        
        if (success) {
          action.status = 'synced'
          await this.db.put('offline_actions', action)
        } else if (action.retryCount < this.maxRetries) {
          action.retryCount++
          await this.db.put('offline_actions', action)
        } else {
          action.status = 'failed'
          await this.db.put('offline_actions', action)
        }
      } catch (error) {
        console.error('同步操作失败:', error)
        
        if (action.retryCount < this.maxRetries) {
          action.retryCount++
          await this.db.put('offline_actions', action)
        } else {
          action.status = 'failed'
          await this.db.put('offline_actions', action)
        }
      }
    }
  }

  /**
   * 同步单个操作
   */
  private async syncAction(action: any): Promise<boolean> {
    const { type, entity, data } = action
    
    try {
      let url = `/api/${entity}`
      let method = 'POST'
      
      switch (type) {
        case 'create':
          method = 'POST'
          break
        case 'update':
          method = 'PUT'
          url += `/${data.id}`
          break
        case 'delete':
          method = 'DELETE'
          url += `/${data.id}`
          break
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: type !== 'delete' ? JSON.stringify(data) : undefined
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * 获取离线统计信息
   */
  async getOfflineStats(): Promise<{
    pendingActions: number
    queuedRequests: number
    cachedItems: number
    failedActions: number
  }> {
    if (!this.db) await this.init()
    
    const [pendingActions, queuedRequests, cachedItems, failedActions] = await Promise.all([
      this.db!.countFromIndex('offline_actions', 'status', 'pending'),
      this.db!.count('offline_queue'),
      this.db!.count('cached_data'),
      this.db!.countFromIndex('offline_actions', 'status', 'failed')
    ])

    return {
      pendingActions,
      queuedRequests,
      cachedItems,
      failedActions
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(): Promise<void> {
    if (!this.db) return
    
    const now = Date.now()
    const cacheItems = await this.db.getAll('cached_data')
    
    for (const item of cacheItems) {
      if (now > item.expires) {
        await this.db.delete('cached_data', item.key)
      }
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 清空所有离线数据
   */
  async clearAllOfflineData(): Promise<void> {
    if (!this.db) return
    
    await Promise.all([
      this.db.clear('offline_actions'),
      this.db.clear('cached_data'),
      this.db.clear('offline_queue')
    ])
  }
}

// 导出单例实例
export const offlineManager = new OfflineManager()