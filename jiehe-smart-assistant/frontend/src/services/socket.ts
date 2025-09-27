import { io, Socket } from 'socket.io-client'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'

export interface SocketEvents {
  // 任务相关
  'task-created': (data: any) => void
  'task-updated': (data: any) => void
  'task-assigned': (data: any) => void
  'task-completed': (data: any) => void
  
  // 家庭成员相关
  'member-joined': (data: any) => void
  'member-left': (data: any) => void
  'member-updated': (data: any) => void
  
  // 消息相关
  'new-message': (data: any) => void
  'message-read': (data: any) => void
  
  // 库存相关
  'inventory-updated': (data: any) => void
  'inventory-low-stock': (data: any) => void
  
  // 日历相关
  'event-created': (data: any) => void
  'event-updated': (data: any) => void
  'event-reminder': (data: any) => void
  
  // 系统通知
  'notification': (data: { type: string; title: string; message: string }) => void
}

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private eventListeners = new Map<string, Set<Function>>()

  // 初始化连接
  connect() {
    const userStore = useUserStore()
    
    if (!userStore.token) {
      console.warn('No token available, cannot connect to socket')
      return
    }

    if (this.socket?.connected) {
      console.log('Socket already connected')
      return
    }

    try {
      this.socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080', {
        auth: {
          token: userStore.token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      })

      this.setupEventHandlers()
      
    } catch (error) {
      console.error('Socket connection error:', error)
      this.handleReconnect()
    }
  }  // 设置事件处理器
  private setupEventHandlers() {
    if (!this.socket) return

    // 连接成功
    this.socket.on('connect', () => {
      console.log('Socket connected successfully')
      this.reconnectAttempts = 0
      showToast('已连接到服务器')
    })

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      showToast('连接服务器失败')
      this.handleReconnect()
    })

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要重连
        this.handleReconnect()
      }
    })

    // 认证错误
    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      if (error.message?.includes('认证')) {
        showToast('身份验证失败，请重新登录')
        const userStore = useUserStore()
        userStore.logout()
      }
    })

    // 设置业务事件监听
    this.setupBusinessEvents()
  }

  // 设置业务事件监听
  private setupBusinessEvents() {
    if (!this.socket) return

    // 通用通知处理
    this.socket.on('notification', (data) => {
      const { type, title, message } = data
      switch (type) {
        case 'info':
          showToast(message)
          break
        case 'success':
          showToast(message)
          break
        case 'warning':
          showToast(message)
          break
        case 'error':
          showToast(message)
          break
        default:
          showToast(message)
      }
      
      // 触发自定义监听器
      this.emit('notification', data)
    })
  }  // 重连处理
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      showToast('无法连接到服务器，请检查网络')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.connect()
    }, delay)
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.reconnectAttempts = 0
    this.eventListeners.clear()
    console.log('Socket disconnected manually')
  }

  // 事件监听
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)

    // 如果socket已连接，立即添加监听
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  // 移除事件监听
  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      if (callback) {
        listeners.delete(callback)
        if (this.socket) {
          this.socket.off(event, callback)
        }
      } else {
        listeners.clear()
        if (this.socket) {
          this.socket.removeAllListeners(event)
        }
      }
    }
  }

  // 触发自定义事件
  private emit<K extends keyof SocketEvents>(event: K, data: any) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          (callback as any)(data)
        } catch (error) {
          console.error(`Error in socket event listener for ${event}:`, error)
        }
      })
    }
  }

  // 发送消息到服务器
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit event:', event)
    }
  }

  // 加入家庭房间
  joinFamily(familyId: string) {
    this.emit('join-family', familyId)
  }

  // 离开家庭房间
  leaveFamily(familyId: string) {
    this.emit('leave-family', familyId)
  }

  // 获取连接状态
  get connected() {
    return this.socket?.connected || false
  }

  // 获取socket实例
  get instance() {
    return this.socket
  }
}

// 创建单例实例
export const socketService = new SocketService()