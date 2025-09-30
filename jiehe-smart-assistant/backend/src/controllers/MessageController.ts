import { Context } from 'koa';
import { Message } from '../models/Message';
import { ResponseUtil } from '../utils/response';
import { logger } from '../utils/logger';
import { AuthenticationError, ValidationError, NotFoundError, AuthorizationError } from '../middlewares/errorHandler';
import { Validator } from '../utils/validation';
import { socketManager } from '../middlewares/socket';

export class MessageController {
  /**
   * 获取留言列表
   */
  static async getMessageList(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const queryParams = {
      message_type: ctx.query.message_type as string,
      category: ctx.query.category as string,
      priority: ctx.query.priority ? Number(ctx.query.priority) : undefined,
      is_pinned: ctx.query.is_pinned ? ctx.query.is_pinned === 'true' : undefined,
      mentioned_user: ctx.query.mentioned_user as string,
      search: ctx.query.search as string,
      start_date: ctx.query.start_date as string,
      end_date: ctx.query.end_date as string,
      page: parseInt(ctx.query.page as string) || 1,
      pageSize: Math.min(parseInt(ctx.query.limit as string) || 20, 50),
      sort_by: (ctx.query.sort_by as any) || 'created_at',
      sort_order: (ctx.query.sort_order as any) || 'desc'
    } as any;

    try {
      const result = await Message.getFamilyMessages(user.familyId, user.userId, queryParams);
      
      ResponseUtil.paginated(ctx, result.messages, result.pagination as any, '获取留言列表成功');
    } catch (error) {
      logger.error('获取留言列表失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 创建留言
   */
  static async createMessage(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const messageSchema = {
      title: { type: 'string', maxLength: 100 },
      content: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
      message_type: { 
        type: 'string', 
        enum: ['text', 'image', 'file', 'reminder', 'announcement'] 
      },
      category: { 
        type: 'string', 
        enum: ['general', 'urgent', 'reminder', 'family_news', 'celebration', 'other'] 
      },
      priority: { 
        type: 'string', 
        enum: ['low', 'normal', 'high', 'urgent'] 
      },
      is_pinned: { type: 'boolean' },
      attachments: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      mentioned_users: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      expires_at: { type: 'string' }
    };

    const validation = Validator.validate(ctx.request.body, messageSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      const messageData: any = {
        ...validation.data,
        family_id: user.familyId
      };

      const message = await Message.createMessage(messageData, user.familyId, user.userId);
      
      logger.info('留言创建成功', {
        messageId: message.id,
        familyId: user.familyId,
        userId: user.userId,
        title: message.title || message.content.substring(0, 50)
      });

      // 实时推送新留言通知（使用 socketManager）
      socketManager.emitToFamily(user.familyId, 'message:new', {
        id: message.id,
        title: message.title,
        content: message.content,
        userId: user.userId,
        userName: user.username,
        mentionedUsers: messageData.mentions || [],
        category: (message as any).category_id || null,
        isPinned: message.is_pinned,
        timestamp: new Date().toISOString()
      });
      if (Array.isArray(messageData.mentions)) {
        for (const uid of messageData.mentions) {
          socketManager.emitToUser(uid, 'message:mention', {
            messageId: message.id,
            title: message.title,
            content: message.content?.substring(0, 100) || '',
            fromUserId: user.userId,
            fromUserName: user.username,
            timestamp: new Date().toISOString()
          });
        }
      }

      ResponseUtil.success(ctx, message, '留言创建成功');
    } catch (error) {
      logger.error('留言创建失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取留言详情
   */
  static async getMessageDetail(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const messageId = ctx.params.messageId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new NotFoundError('留言不存在');
      }

      // 验证权限 - 只有家庭成员可以查看
      if (message.family_id !== user.familyId) {
        throw new AuthorizationError('您没有查看此留言的权限');
      }

      // 自动标记为已读
      await Message.markAsRead(messageId, user.userId);

      ResponseUtil.success(ctx, message, '获取留言详情成功');
    } catch (error) {
      logger.error('获取留言详情失败', { messageId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新留言
   */
  static async updateMessage(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const messageId = ctx.params.messageId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const updateSchema = {
      title: { type: 'string', maxLength: 100 },
      content: { type: 'string', minLength: 1, maxLength: 2000 },
      message_type: { 
        type: 'string', 
        enum: ['text', 'image', 'file', 'reminder', 'announcement'] 
      },
      category: { 
        type: 'string', 
        enum: ['general', 'urgent', 'reminder', 'family_news', 'celebration', 'other'] 
      },
      priority: { 
        type: 'string', 
        enum: ['low', 'normal', 'high', 'urgent'] 
      },
      is_pinned: { type: 'boolean' },
      attachments: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      mentioned_users: { 
        type: 'array', 
        items: { type: 'string' } 
      },
      expires_at: { type: 'string' }
    };

    const validation = Validator.validate(ctx.request.body, updateSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      const updatedMessage = await Message.updateMessage(messageId, validation.data, user.userId);
      
      logger.info('留言更新成功', {
        messageId,
        userId: user.userId,
        updates: Object.keys(validation.data)
      });

      // 实时推送留言更新通知
      socketManager.emitToFamily(user.familyId, 'message_updated', {
        message_id: messageId,
        updates: Object.keys(validation.data),
        updated_by: user.userId,
        updated_at: updatedMessage.updated_at
      });

      ResponseUtil.success(ctx, updatedMessage, '留言更新成功');
    } catch (error) {
      logger.error('留言更新失败', { messageId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 删除留言
   */
  static async deleteMessage(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const messageId = ctx.params.messageId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Message.deleteMessage(messageId, user.userId);
      
      logger.info('留言删除成功', {
        messageId,
        userId: user.userId
      });

      // 实时推送留言删除通知
      socketManager.emitToFamily(user.familyId, 'message_deleted', {
        message_id: messageId,
        deleted_by: user.userId,
        deleted_at: new Date().toISOString()
      });

      ResponseUtil.success(ctx, null, '留言删除成功');
    } catch (error) {
      logger.error('留言删除失败', { messageId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 添加留言反应
   */
  static async addReaction(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const messageId = ctx.params.messageId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const reactionSchema = {
      reaction_type: { 
        required: true,
        type: 'string', 
        enum: ['like', 'love', 'laugh', 'angry', 'sad', 'wow'] 
      }
    };

    const validation = Validator.validate(ctx.request.body, reactionSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      await Message.addReaction(messageId, user.userId, validation.data.reaction_type);
      
      logger.info('留言反应添加成功', {
        messageId,
        userId: user.userId,
        reactionType: validation.data.reaction_type
      });

      // 实时推送反应更新
      socketManager.emitToFamily(user.familyId, 'message_reaction', {
        message_id: messageId,
        user_id: user.userId,
        reaction_type: validation.data.reaction_type,
        timestamp: new Date().toISOString()
      });

      ResponseUtil.success(ctx, null, '反应添加成功');
    } catch (error) {
      logger.error('添加留言反应失败', { messageId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 标记留言为已读
   */
  static async markAsRead(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const messageId = ctx.params.messageId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Message.markAsRead(messageId, user.userId);
      
      logger.info('留言标记已读成功', {
        messageId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '标记已读成功');
    } catch (error) {
      logger.error('标记留言已读失败', { messageId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取未读留言数量
   */
  static async getUnreadCount(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const count = await Message.getUnreadCount(user.familyId, user.userId);
      
      ResponseUtil.success(ctx, { count }, '获取未读数量成功');
    } catch (error) {
      logger.error('获取未读留言数量失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取留言统计
   */
  static async getMessageStats(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const stats = await Message.getMessageStats(user.familyId, user.userId);
      
      ResponseUtil.success(ctx, stats, '获取留言统计成功');
    } catch (error) {
      logger.error('获取留言统计失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 批量标记已读
   */
  static async markAllAsRead(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      // 获取用户的所有未读留言
      const unreadMessages = await Message.getFamilyMessages(user.familyId, user.userId, {
        pageSize: 1000 // 假设最多1000条
      } as any);

      // 标记所有留言为已读
      for (const message of unreadMessages.messages) {
        if ((message as any).author_id !== user.userId) {
          await Message.markAsRead(message.id, user.userId);
        }
      }
      
      logger.info('批量标记已读成功', {
        familyId: user.familyId,
        userId: user.userId,
        count: unreadMessages.messages.length
      });

      ResponseUtil.success(ctx, null, '全部标记已读成功');
    } catch (error) {
      logger.error('批量标记已读失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }
}
