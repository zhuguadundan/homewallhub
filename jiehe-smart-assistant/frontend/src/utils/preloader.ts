/**
 * 组件预加载器
 * 在空闲时间预加载可能需要的组件
 */

type ComponentLoader = () => Promise<any>

export class ComponentPreloader {
  private loadQueue: ComponentLoader[] = []
  private loaded = new Set<string>()
  private isLoading = false

  /**
   * 添加组件到预加载队列
   */
  addToQueue(componentName: string, loader: ComponentLoader) {
    if (this.loaded.has(componentName)) {
      return
    }

    this.loadQueue.push(loader)
    
    // 如果当前没有在加载，开始处理队列
    if (!this.isLoading) {
      this.processQueue()
    }
  }

  /**
   * 预加载常用组件
   */
  preloadCriticalComponents() {
    // 主要功能组件
    this.addToQueue('Home', () => import('@/views/Home.vue'))
    this.addToQueue('Family', () => import('@/views/family/Index.vue'))
    this.addToQueue('Tasks', () => import('@/views/Tasks/Index.vue'))
    this.addToQueue('Inventory', () => import('@/views/Inventory/Index.vue'))
  }

  /**
   * 预加载次要组件
   */
  preloadSecondaryComponents() {
    // 用户可能访问的页面
    this.addToQueue('Calendar', () => import('@/views/Calendar/Index.vue'))
    this.addToQueue('AI', () => import('@/views/AI/Index.vue'))
    this.addToQueue('Analytics', () => import('@/views/Analytics/Index.vue'))
    this.addToQueue('Messages', () => import('@/views/Message/Index.vue'))
  }

  /**
   * 基于路由预加载相关组件
   */
  preloadByRoute(currentRoute: string) {
    const preloadMap: Record<string, ComponentLoader[]> = {
      '/family': [
        () => import('@/views/family/Create.vue'),
        () => import('@/views/family/Join.vue'),
        () => import('@/views/family/Settings.vue')
      ],
      '/tasks': [
        () => import('@/views/Tasks/Create.vue'),
        () => import('@/views/Tasks/Detail.vue')
      ],
      '/ai': [
        () => import('@/views/AI/RecipeRecommendation.vue'),
        () => import('@/views/AI/TaskSuggestion.vue'),
        () => import('@/views/AI/SmartShopping.vue')
      ],
      '/analytics': [
        () => import('@/views/Analytics/InventoryAnalysis.vue')
      ]
    }

    const loadersToAdd = preloadMap[currentRoute]
    if (loadersToAdd) {
      loadersToAdd.forEach((loader, index) => {
        this.addToQueue(`${currentRoute}_${index}`, loader)
      })
    }
  }

  /**
   * 处理预加载队列
   */
  private async processQueue() {
    if (this.isLoading || this.loadQueue.length === 0) {
      return
    }

    this.isLoading = true

    // 使用 requestIdleCallback 在空闲时间加载
    const loadNextComponent = () => {
      if (this.loadQueue.length === 0) {
        this.isLoading = false
        return
      }

      const loader = this.loadQueue.shift()!
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(async (deadline) => {
          if (deadline.timeRemaining() > 0) {
            try {
              await loader()
              this.loaded.add(loader.toString())
            } catch (error) {
              console.warn('组件预加载失败:', error)
            }
          }
          
          // 继续加载下一个组件
          loadNextComponent()
        })
      } else {
        // 降级处理：使用 setTimeout
        setTimeout(async () => {
          try {
            await loader()
            this.loaded.add(loader.toString())
          } catch (error) {
            console.warn('组件预加载失败:', error)
          }
          
          // 继续加载下一个组件
          loadNextComponent()
        }, 100)
      }
    }

    loadNextComponent()
  }

  /**
   * 清空加载队列
   */
  clearQueue() {
    this.loadQueue = []
    this.isLoading = false
  }

  /**
   * 获取已加载的组件数量
   */
  getLoadedCount() {
    return this.loaded.size
  }
}

// 导出单例实例
export const preloader = new ComponentPreloader()