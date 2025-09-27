import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtUtil } from '../utils/jwt';
import { logger } from '../utils/logger';
import { dbGet } from '../config/database';

// 连接的用户映射
const connectedUsers = new Map<string, Socket>();
const userFamilies = new Map<string, string[]>();

// Socket.IO事件类型
interface SocketEvents {
  // 连接相关
  'user:join': (data: { familyId: string }) => void;
  'user:leave': (data: { familyId: string }) => void;
  'user:online': (data: { userId: string; userName: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  
  // 任务相关
  'task:created': (data: any) => void;
  'task:updated': (data: any) => void;
  'task:assigned': (data: any) => void;
  
  // 库存相关
  'inventory:expired': (data: any) => void;
  'inventory:low_stock': (data: any) => void;
  
  // 留言板相关
  'message:new': (data: any) => void;
  'message:updated': (data: any) => void;
  'message:deleted': (data: any) => void;
  'message:mention': (data: any) => void;
  'message:typing': (data: { userId: string; userName: string }) => void;
  'message:stop_typing': (data: { userId: string }) => void;
  'message:read': (data: { messageId: string; userId: string; readAt: Date }) => void;
  'message:reaction': (data: { messageId: string; emoji: string; action: 'add' | 'remove'; userId: string }) => void;
  'comment:new': (data: any) => void;
  'comment:updated': (data: any) => void;
  'comment:deleted': (data: any) => void;
  
  // 日历相关
  'calendar:event_created': (data: any) => void;
  'calendar:reminder': (data: any) => void;
}

/**
 * 初始化Socket.IO服务
 */
export function initSocketIO(io: SocketIOServer): void {
  // 认证中间件
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('未提供认证令牌'));
      }

      // 验证JWT令牌
      const payload = JwtUtil.verifyAccessToken(token);
      
      // 验证用户是否存在
      const user = await dbGet(
        'SELECT id, username, is_active FROM users WHERE id = ? AND is_active = 1 AND is_deleted = 0',
        [payload.userId]
      );
      
      if (!user) {
        return next(new Error('用户不存在或已被禁用'));
      }

      // 将用户信息附加到socket
      socket.data.user = {
        id: user.id,
        username: user.username
      };

      next();
    } catch (error: any) {
      logger.warn('Socket.IO认证失败', { error: error.message });
      next(new Error('认证失败'));
    }
  });

  // 处理连接
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    
    logger.info('用户连接Socket.IO', { 
      userId: user.id, 
      username: user.username,
      socketId: socket.id
    });

    // 存储用户连接
    connectedUsers.set(user.id, socket);

    // 获取用户的家庭列表并加入房间
    getUserFamiliesAndJoinRooms(socket, user.id);

    // 监听家庭房间加入
    socket.on('user:join', async (data: { familyId: string }) => {
      await joinFamilyRoom(socket, user.id, data.familyId);
    });

    // 监听家庭房间离开
    socket.on('user:leave', (data: { familyId: string }) => {
      socket.leave(`family:${data.familyId}`);
      logger.info('用户离开家庭房间', { userId: user.id, familyId: data.familyId });
    });

    // 留言板实时事件监听
    setupMessageEvents(socket, user);

    // 处理断开连接
    socket.on('disconnect', (reason) => {
      logger.info('用户断开Socket.IO连接', { 
        userId: user.id, 
        username: user.username,
        reason 
      });
      
      // 通知家庭成员用户离线
      const families = userFamilies.get(user.id) || [];
      families.forEach(familyId => {
        socket.to(`family:${familyId}`).emit('user:offline', {
          userId: user.id,
          timestamp: new Date()
        });
      });
      
      connectedUsers.delete(user.id);
      userFamilies.delete(user.id);
    });
  });

  logger.info('Socket.IO服务初始化完成');
}/**
 * 获取用户家庭并加入房间
 */
async function getUserFamiliesAndJoinRooms(socket: Socket, userId: string): Promise<void> {
  try {
    // 查询用户的家庭列表
    const families = await dbGet(
      `SELECT f.id FROM families f
       JOIN family_members fm ON f.id = fm.family_id
       WHERE fm.user_id = ? AND fm.is_active = 1 AND f.is_active = 1`,
      [userId]
    );

    if (families) {
      const familyIds = Array.isArray(families) ? families.map(f => f.id) : [families.id];
      userFamilies.set(userId, familyIds);

      // 加入所有家庭房间
      for (const familyId of familyIds) {
        await joinFamilyRoom(socket, userId, familyId);
      }
    }
  } catch (error) {
    logger.error('获取用户家庭失败', { userId, error });
  }
}

/**
 * 加入家庭房间
 */
async function joinFamilyRoom(socket: Socket, userId: string, familyId: string): Promise<void> {
  try {
    // 验证用户是否为家庭成员
    const membership = await dbGet(
      'SELECT id FROM family_members WHERE family_id = ? AND user_id = ? AND is_active = 1',
      [familyId, userId]
    );

    if (membership) {
      socket.join(`family:${familyId}`);
      logger.info('用户加入家庭房间', { userId, familyId });
      
      // 通知家庭其他成员用户上线
      socket.to(`family:${familyId}`).emit('user:online', {
        userId: userId,
        userName: socket.data.user.username,
        timestamp: new Date()
      });
    } else {
      logger.warn('用户尝试加入非成员家庭房间', { userId, familyId });
    }
  } catch (error) {
    logger.error('加入家庭房间失败', { userId, familyId, error });
  }
}

/**
 * 广播消息到家庭房间
 */
export function broadcastToFamily(io: SocketIOServer, familyId: string, event: string, data: any): void {
  io.to(`family:${familyId}`).emit(event, data);
  logger.debug('广播消息到家庭', { familyId, event });
}

/**
 * 发送消息给特定用户
 */
export function sendToUser(userId: string, event: string, data: any): void {
  const socket = connectedUsers.get(userId);
  if (socket) {
    socket.emit(event, data);
    logger.debug('发送消息给用户', { userId, event });
  }
}

/**
 * 批量发送通知
 */
export function sendNotifications(io: SocketIOServer, notifications: Array<{ userId: string; event: string; data: any }>): void {
  notifications.forEach(({ userId, event, data }) => {
    sendToUser(userId, event, data);
  });
}

/**
 * 获取在线用户列表
 */
export function getOnlineUsers(): string[] {
  return Array.from(connectedUsers.keys());
}

/**
 * 检查用户是否在线
 */
export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId);
}

/**
 * 设置留言板相关事件监听
 */
function setupMessageEvents(socket: Socket, user: any): void {
  // 用户正在输入留言
  socket.on('message:typing', (data: { familyId: string }) => {
    socket.to(`family:${data.familyId}`).emit('message:typing', {
      userId: user.id,
      userName: user.username,
      timestamp: new Date()
    });
  });

  // 用户停止输入留言
  socket.on('message:stop_typing', (data: { familyId: string }) => {
    socket.to(`family:${data.familyId}`).emit('message:stop_typing', {
      userId: user.id,
      timestamp: new Date()
    });
  });

  // 留言已读状态更新
  socket.on('message:read', (data: { messageId: string, familyId: string }) => {
    socket.to(`family:${data.familyId}`).emit('message:read', {
      messageId: data.messageId,
      userId: user.id,
      readAt: new Date()
    });
  });

  // 留言反应更新
  socket.on('message:reaction', (data: { 
    messageId: string, 
    familyId: string, 
    emoji: string, 
    action: 'add' | 'remove' 
  }) => {
    socket.to(`family:${data.familyId}`).emit('message:reaction', {
      messageId: data.messageId,
      userId: user.id,
      emoji: data.emoji,
      action: data.action,
      timestamp: new Date()
    });
  });

  // 用户在线状态更新
  socket.on('user:presence', (data: { familyId: string, status: 'online' | 'away' | 'busy' }) => {
    socket.to(`family:${data.familyId}`).emit('user:presence', {
      userId: user.id,
      status: data.status,
      timestamp: new Date()
    });
  });
}

/**
 * 发送新留言通知
 */
export function sendNewMessageNotification(io: SocketIOServer, familyId: string, messageData: {
  id: string;
  title: string;
  content: string;
  userId: string;
  userName: string;
  mentionedUsers?: string[];
  category: string;
  isPinned: boolean;
}): void {
  // 发送给家庭所有成员
  broadcastToFamily(io, familyId, 'message:new', {
    ...messageData,
    timestamp: new Date()
  });

  // 如果有@提醒用户，发送特定通知
  if (messageData.mentionedUsers && messageData.mentionedUsers.length > 0) {
    messageData.mentionedUsers.forEach(userId => {
      sendToUser(userId, 'message:mention', {
        messageId: messageData.id,
        title: messageData.title,
        content: messageData.content.substring(0, 100),
        fromUserId: messageData.userId,
        fromUserName: messageData.userName,
        timestamp: new Date()
      });
    });
  }
}

/**
 * 发送留言更新通知
 */
export function sendMessageUpdateNotification(io: SocketIOServer, familyId: string, messageData: {
  id: string;
  title: string;
  content: string;
  userId: string;
  action: 'updated' | 'deleted' | 'pinned' | 'unpinned';
}): void {
  broadcastToFamily(io, familyId, 'message:updated', {
    ...messageData,
    timestamp: new Date()
  });
}

/**
 * 发送评论通知
 */
export function sendCommentNotification(io: SocketIOServer, familyId: string, commentData: {
  messageId: string;
  commentId: string;
  content: string;
  userId: string;
  userName: string;
  messageOwnerId: string;
  action: 'new' | 'updated' | 'deleted';
}): void {
  // 通知留言作者（如果不是自己评论）
  if (commentData.userId !== commentData.messageOwnerId && commentData.action === 'new') {
    sendToUser(commentData.messageOwnerId, 'comment:mention', {
      messageId: commentData.messageId,
      commentId: commentData.commentId,
      content: commentData.content.substring(0, 100),
      fromUserId: commentData.userId,
      fromUserName: commentData.userName,
      timestamp: new Date()
    });
  }

  // 通知家庭其他成员
  broadcastToFamily(io, familyId, `comment:${commentData.action}`, {
    messageId: commentData.messageId,
    commentId: commentData.commentId,
    userId: commentData.userId,
    userName: commentData.userName,
    timestamp: new Date()
  });
}

/**
 * 获取家庭在线成员
 */
export async function getFamilyOnlineMembers(familyId: string): Promise<string[]> {
  try {
    // 获取家庭所有成员
    const members = await dbGet(
      'SELECT user_id FROM family_members WHERE family_id = ? AND is_active = 1',
      [familyId]
    );

    if (!members) return [];

    const memberIds = Array.isArray(members) ? members.map(m => m.user_id) : [members.user_id];
    
    // 过滤出在线成员
    return memberIds.filter(userId => isUserOnline(userId));
  } catch (error) {
    logger.error('获取家庭在线成员失败', { familyId, error });
    return [];
  }
}

/**
 * 广播在线成员列表更新
 */
export async function broadcastOnlineMembersUpdate(io: SocketIOServer, familyId: string): Promise<void> {
  try {
    const onlineMembers = await getFamilyOnlineMembers(familyId);
    broadcastToFamily(io, familyId, 'user:online_members', {
      onlineMembers,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('广播在线成员更新失败', { familyId, error });
  }
}