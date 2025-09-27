import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../config/database';
import { NotFoundError, ValidationError, AuthorizationError } from '../middlewares/errorHandler';
import { Family } from './Family';

// 家庭留言接口（对应family_messages表）
export interface IFamilyMessage {
  id: string;
  family_id: string;
  category_id?: string;
  author_id: string;
  title?: string;
  content: string;
  message_type: string; // text, image, audio, video, file
  attachments?: string; // JSON格式存储附件信息
  priority: number; // 1:高 2:中 3:低
  is_pinned: boolean;
  parent_id?: string; // 回复消息的父消息ID
  mentions?: string; // JSON格式存储@提醒的用户ID
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

// 消息阅读状态接口（对应message_read_status表）
export interface IMessageReadStatus {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

// 留言分类接口（对应message_categories表）
export interface IMessageCategory {
  id: string;
  family_id: string;
  name: string;
  icon?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

// 创建留言输入数据
export interface CreateMessageData {
  category_id?: string;
  title?: string;
  content: string;
  message_type?: string;
  attachments?: any[];
  priority?: number;
  is_pinned?: boolean;
  parent_id?: string;
  mentions?: string[];
}

// 查询参数
export interface MessageQueryParams {
  category_id?: string;
  message_type?: string;
  priority?: number;
  is_pinned?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: string;
}

// 留言统计
export interface MessageStatistics {
  total_messages: number;
  unread_messages: number;
  messages_by_type: Record<string, number>;
  messages_by_category: Record<string, number>;
  recent_messages: number;
}

export class Message {
  /**
   * 创建留言
   */
  static async createMessage(messageData: CreateMessageData, familyId: string, authorId: string): Promise<IFamilyMessage> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, authorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const messageId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    const message: IFamilyMessage = {
      id: messageId,
      family_id: familyId,
      category_id: messageData.category_id || null,
      author_id: authorId,
      title: messageData.title || null,
      content: messageData.content,
      message_type: messageData.message_type || 'text',
      attachments: messageData.attachments ? JSON.stringify(messageData.attachments) : null,
      priority: messageData.priority || 2,
      is_pinned: messageData.is_pinned || false,
      parent_id: messageData.parent_id || null,
      mentions: messageData.mentions ? JSON.stringify(messageData.mentions) : null,
      created_at: now,
      updated_at: now,
      is_deleted: false
    };

    await dbRun(`
      INSERT INTO family_messages (
        id, family_id, category_id, author_id, title, content, message_type,
        attachments, priority, is_pinned, parent_id, mentions, created_at, updated_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      message.id, message.family_id, message.category_id, message.author_id, 
      message.title, message.content, message.message_type, message.attachments,
      message.priority, message.is_pinned ? 1 : 0, message.parent_id, message.mentions,
      message.created_at, message.updated_at, message.is_deleted ? 1 : 0
    ]);

    // 处理@提醒
    if (messageData.mentions && messageData.mentions.length > 0) {
      await this.createMentionNotifications(messageId, messageData.mentions, authorId, familyId);
    }

    return message;
  }

  /**
   * 根据ID查找留言
   */
  static async findById(id: string): Promise<IFamilyMessage | null> {
    const message = await dbGet<any>(`
      SELECT * FROM family_messages WHERE id = ? AND is_deleted = 0
    `, [id]);

    if (!message) return null;

    return this.formatMessage(message);
  }

  /**
   * 获取家庭留言列表
   */
  static async getFamilyMessages(familyId: string, userId: string, queryParams: MessageQueryParams = {}): Promise<{
    messages: Array<IFamilyMessage & { author_name?: string; category_name?: string; unread?: boolean }>;
    pagination: { page: number; pageSize: number; total: number };
  }> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const {
      category_id,
      message_type,
      priority,
      is_pinned,
      search,
      page = 1,
      pageSize = 20,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = queryParams;

    let whereClause = 'WHERE fm.family_id = ? AND fm.is_deleted = 0';
    const params: any[] = [familyId];

    // 构建查询条件
    if (category_id) {
      whereClause += ' AND fm.category_id = ?';
      params.push(category_id);
    }

    if (message_type) {
      whereClause += ' AND fm.message_type = ?';
      params.push(message_type);
    }

    if (priority) {
      whereClause += ' AND fm.priority = ?';
      params.push(priority);
    }

    if (is_pinned !== undefined) {
      whereClause += ' AND fm.is_pinned = ?';
      params.push(is_pinned ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (fm.title LIKE ? OR fm.content LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // 获取总数
    const countResult = await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM family_messages fm ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // 验证排序字段（防SQL注入）
    const allowedSortFields = ['created_at', 'updated_at', 'priority', 'title'];
    const safeSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order === 'ASC' ? 'ASC' : 'DESC';

    // 分页查询
    const offset = (page - 1) * pageSize;
    const messages = await dbAll<any>(`
      SELECT fm.*, u.username as author_name, mc.name as category_name,
             CASE WHEN mrs.read_at IS NULL THEN 1 ELSE 0 END as unread
      FROM family_messages fm
      JOIN users u ON fm.author_id = u.id
      LEFT JOIN message_categories mc ON fm.category_id = mc.id
      LEFT JOIN message_read_status mrs ON fm.id = mrs.message_id AND mrs.user_id = ?
      ${whereClause}
      ORDER BY fm.is_pinned DESC, fm.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `, [userId, ...params, pageSize, offset]);

    const formattedMessages = messages.map(msg => ({
      ...this.formatMessage(msg),
      author_name: msg.author_name,
      category_name: msg.category_name,
      unread: Boolean(msg.unread)
    }));

    return {
      messages: formattedMessages,
      pagination: {
        page,
        pageSize,
        total
      }
    };
  }

  /**
   * 更新留言
   */
  static async updateMessage(id: string, updateData: Partial<CreateMessageData>, operatorId: string): Promise<IFamilyMessage> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundError('留言不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(message.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 只有创建者或管理员可以修改
    if (membership.role !== 'admin' && message.author_id !== operatorId) {
      throw new AuthorizationError('您没有修改此留言的权限');
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 构建更新字段
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        if (key === 'attachments' || key === 'mentions') {
          updateFields.push(`${key} = ?`);
          updateValues.push(JSON.stringify(value));
        } else if (key === 'is_pinned') {
          updateFields.push(`${key} = ?`);
          updateValues.push(value ? 1 : 0);
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }
    });

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(id);

      await dbRun(`
        UPDATE family_messages SET ${updateFields.join(', ')} WHERE id = ?
      `, updateValues);
    }

    const updatedMessage = await this.findById(id);
    if (!updatedMessage) {
      throw new Error('更新留言失败');
    }

    return updatedMessage;
  }

  /**
   * 软删除留言
   */
  static async deleteMessage(id: string, operatorId: string): Promise<void> {
    const message = await this.findById(id);
    if (!message) {
      throw new NotFoundError('留言不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(message.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    if (membership.role !== 'admin' && message.author_id !== operatorId) {
      throw new AuthorizationError('您没有删除此留言的权限');
    }

    await dbRun(`
      UPDATE family_messages SET is_deleted = 1, updated_at = ? WHERE id = ?
    `, [new Date().toISOString(), id]);
  }

  /**
   * 标记留言为已读
   */
  static async markAsRead(messageId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    
    // 检查是否已存在已读记录
    const existing = await dbGet(`
      SELECT id FROM message_read_status WHERE message_id = ? AND user_id = ?
    `, [messageId, userId]);

    if (existing) {
      await dbRun(`
        UPDATE message_read_status SET read_at = ? WHERE message_id = ? AND user_id = ?
      `, [now, messageId, userId]);
    } else {
      const readId = uuidv4().replace(/-/g, '');
      await dbRun(`
        INSERT INTO message_read_status (id, message_id, user_id, read_at)
        VALUES (?, ?, ?, ?)
      `, [readId, messageId, userId, now]);
    }
  }

  /**
   * 获取未读留言数量
   */
  static async getUnreadCount(familyId: string, userId: string): Promise<number> {
    const result = await dbGet<{ count: number }>(`
      SELECT COUNT(*) as count FROM family_messages fm
      LEFT JOIN message_read_status mrs ON fm.id = mrs.message_id AND mrs.user_id = ?
      WHERE fm.family_id = ? AND fm.is_deleted = 0 
        AND mrs.read_at IS NULL
        AND fm.author_id != ?
    `, [userId, familyId, userId]);

    return result?.count || 0;
  }

  /**
   * 获取留言统计
   */
  static async getMessageStats(familyId: string, userId: string): Promise<MessageStatistics> {
    const [totalMessages, unreadMessages, messagesByType, messagesByCategory, recentMessages] = await Promise.all([
      // 总留言数
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM family_messages WHERE family_id = ? AND is_deleted = 0', [familyId]),
      
      // 未读留言数
      this.getUnreadCount(familyId, userId),
      
      // 按类型统计
      dbAll<{ message_type: string; count: number }>(`
        SELECT message_type, COUNT(*) as count FROM family_messages 
        WHERE family_id = ? AND is_deleted = 0
        GROUP BY message_type
      `, [familyId]),
      
      // 按分类统计
      dbAll<{ category_name: string; count: number }>(`
        SELECT mc.name as category_name, COUNT(*) as count FROM family_messages fm
        LEFT JOIN message_categories mc ON fm.category_id = mc.id
        WHERE fm.family_id = ? AND fm.is_deleted = 0
        GROUP BY fm.category_id, mc.name
      `, [familyId]),
      
      // 最近7天留言数
      dbGet<{ count: number }>(`
        SELECT COUNT(*) as count FROM family_messages 
        WHERE family_id = ? AND is_deleted = 0 
          AND created_at >= date('now', '-7 days')
      `, [familyId])
    ]);

    return {
      total_messages: totalMessages?.count || 0,
      unread_messages: unreadMessages,
      messages_by_type: messagesByType.reduce((acc, item) => {
        acc[item.message_type] = item.count;
        return acc;
      }, {} as Record<string, number>),
      messages_by_category: messagesByCategory.reduce((acc, item) => {
        acc[item.category_name || 'uncategorized'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      recent_messages: recentMessages?.count || 0
    };
  }

  /**
   * 格式化留言对象
   */
  private static formatMessage(msg: any): IFamilyMessage {
    return {
      ...msg,
      is_pinned: Boolean(msg.is_pinned),
      is_deleted: Boolean(msg.is_deleted),
      attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
      mentions: msg.mentions ? JSON.parse(msg.mentions) : null
    };
  }

  /**
   * 创建@提醒通知
   */
  private static async createMentionNotifications(messageId: string, mentionedUsers: string[], authorId: string, familyId: string): Promise<void> {
    const now = new Date().toISOString();

    for (const userId of mentionedUsers) {
      if (userId === authorId) continue; // 不给自己发通知

      const notificationId = uuidv4().replace(/-/g, '');
      await dbRun(`
        INSERT INTO notifications (
          id, user_id, family_id, title, content, type, reference_type, reference_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        notificationId,
        userId,
        familyId,
        '有人@了你',
        '在留言中提到了你',
        'message_mentioned',
        'message',
        messageId,
        now
      ]);
    }
  }
}

// 留言分类管理类
export class MessageCategory {
  /**
   * 创建留言分类
   */
  static async create(familyId: string, name: string, options: {
    icon?: string;
    color?: string;
  } = {}): Promise<IMessageCategory> {
    const categoryId = uuidv4().replace(/-/g, '');
    
    // 获取排序顺序
    const maxOrder = await dbGet<{ max_order: number }>(
      'SELECT MAX(sort_order) as max_order FROM message_categories WHERE family_id = ? AND is_active = 1',
      [familyId]
    );
    const sortOrder = (maxOrder?.max_order || 0) + 1;

    await dbRun(`
      INSERT INTO message_categories (id, family_id, name, icon, color, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [
      categoryId,
      familyId,
      name,
      options.icon || null,
      options.color || '#1890ff',
      sortOrder
    ]);

    const category = await this.findById(categoryId);
    if (!category) {
      throw new Error('留言分类创建失败');
    }

    return category;
  }

  /**
   * 根据ID查找分类
   */
  static async findById(id: string): Promise<IMessageCategory | null> {
    const category = await dbGet<IMessageCategory>(
      'SELECT * FROM message_categories WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return category || null;
  }

  /**
   * 获取家庭的所有分类
   */
  static async getFamilyCategories(familyId: string): Promise<IMessageCategory[]> {
    const categories = await dbAll<IMessageCategory>(
      `SELECT * FROM message_categories 
       WHERE family_id = ? AND is_active = 1 
       ORDER BY sort_order ASC`,
      [familyId]
    );
    
    return categories;
  }
}