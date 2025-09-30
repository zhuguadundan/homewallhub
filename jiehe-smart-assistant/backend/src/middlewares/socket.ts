import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { JwtUtil } from '../utils/jwt'
import { Family } from '../models/Family'
import { logger } from '../utils/logger'

export interface AuthenticatedSocket extends Socket {
  userId: string
  username: string
  familyIds: string[]
}

class SocketManager {
  private io: SocketIOServer | null = null
  private userSockets = new Map<string, Set<string>>() // userId -> socketIds
  private familyRooms = new Map<string, Set<string>>() // familyId -> userIds

  init(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  private setupMiddleware() {
    if (!this.io) return

    // 身份验证中间件
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
        
        if (!token) {
          return next(new Error('未提供认证令牌'))
        }

        const decoded = JwtUtil.verifyAccessToken(token)
        if (!decoded) {
          return next(new Error('无效的认证令牌'))
        }

        // 获取用户的家庭ID列表
        const familyIds = await Family.getUserFamilyIds(decoded.userId)
        
        const authSocket = socket as AuthenticatedSocket
        authSocket.userId = decoded.userId
        authSocket.username = decoded.username
        authSocket.familyIds = familyIds

        next()
      } catch (error) {
        next(new Error('认证失败'))
      }
    })
  }
  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket
      logger.info('Socket 连接', { userId: authSocket.userId, username: authSocket.username })

      // 加入用户自己的房间
      socket.join(`user:${authSocket.userId}`)
      
      // 加入所有家庭房间
      authSocket.familyIds.forEach(familyId => {
        socket.join(`family:${familyId}`)
      })

      // 记录连接
      this.addUserSocket(authSocket.userId, socket.id)
      authSocket.familyIds.forEach(familyId => {
        this.addUserToFamilyRoom(familyId, authSocket.userId)
      })

      // 处理加入新家庭
      socket.on('join-family', (familyId: string) => {
        socket.join(`family:${familyId}`)
        this.addUserToFamilyRoom(familyId, authSocket.userId)
        logger.info('Socket 加入家庭', { userId: authSocket.userId, familyId })
      })

      // 处理离开家庭
      socket.on('leave-family', (familyId: string) => {
        socket.leave(`family:${familyId}`)
        this.removeUserFromFamilyRoom(familyId, authSocket.userId)
        logger.info('Socket 离开家庭', { userId: authSocket.userId, familyId })
      })

      // 处理断开连接
      socket.on('disconnect', () => {
        this.removeUserSocket(authSocket.userId, socket.id)
        authSocket.familyIds.forEach(familyId => {
          this.removeUserFromFamilyRoom(familyId, authSocket.userId)
        })
        logger.info('Socket 断开', { userId: authSocket.userId })
      })
    })
  }
  // 用户连接管理
  private addUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socketId)
  }

  private removeUserSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  // 家庭房间管理
  private addUserToFamilyRoom(familyId: string, userId: string) {
    if (!this.familyRooms.has(familyId)) {
      this.familyRooms.set(familyId, new Set())
    }
    this.familyRooms.get(familyId)!.add(userId)
  }

  private removeUserFromFamilyRoom(familyId: string, userId: string) {
    const users = this.familyRooms.get(familyId)
    if (users) {
      users.delete(userId)
      if (users.size === 0) {
        this.familyRooms.delete(familyId)
      }
    }
  }
  // 消息发送方法
  emitToUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data)
    }
  }

  emitToFamily(familyId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`family:${familyId}`).emit(event, data)
    }
  }

  emitToFamilyExcept(familyId: string, excludeUserId: string, event: string, data: any) {
    if (this.io) {
      const room = this.io.sockets.adapter.rooms.get(`family:${familyId}`)
      if (room) {
        room.forEach(socketId => {
          const socket = this.io!.sockets.sockets.get(socketId) as AuthenticatedSocket
          if (socket && socket.userId !== excludeUserId) {
            socket.emit(event, data)
          }
        })
      }
    }
  }

  // 获取在线状态
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
  }

  getFamilyOnlineUsers(familyId: string): string[] {
    const users = this.familyRooms.get(familyId)
    if (!users) return []
    
    return Array.from(users).filter(userId => this.isUserOnline(userId))
  }
}

export const socketManager = new SocketManager()
