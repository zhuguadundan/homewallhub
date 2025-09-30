import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../config/database';
import { ICalendarEvent, IReminder, ICalendarEventParticipant, ICalendarEventQuery, ICalendarStats } from '../interfaces/calendar';
import { NotFoundError, ValidationError, AuthorizationError } from '../middlewares/errorHandler';
import { Family } from './Family';
import { User } from './User';

export class Calendar {
  /**
   * 创建日历事件
   */
  static async createEvent(eventData: Partial<ICalendarEvent>, creatorId: string): Promise<ICalendarEvent> {
    const id = uuidv4();
    const now = new Date().toISOString();

    // 验证必需字段
    if (!eventData.family_id || !eventData.title || !eventData.start_time || !eventData.end_time) {
      throw new ValidationError('缺少必需的事件信息');
    }

    // 验证时间逻辑
    const startTime = new Date(eventData.start_time);
    const endTime = new Date(eventData.end_time);
    if (endTime <= startTime) {
      throw new ValidationError('结束时间必须晚于开始时间');
    }

    // 验证创建者是否为家庭成员
    const membership = await Family.getMembership(eventData.family_id, creatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const event: ICalendarEvent = {
      id,
      family_id: eventData.family_id,
      title: eventData.title,
      description: eventData.description || null,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      location: eventData.location || null,
      event_type: eventData.event_type || 'other',
      priority: eventData.priority || 'medium',
      is_all_day: eventData.is_all_day || false,
      recurrence_rule: eventData.recurrence_rule || null,
      created_by: creatorId,
      status: eventData.status || 'planned',
      visibility: eventData.visibility || 'family',
      color: eventData.color || '#1890ff',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    await dbRun(`
      INSERT INTO calendar_events (
        id, family_id, title, description, start_time, end_time, location,
        event_type, priority, is_all_day, recurrence_rule, created_by,
        status, visibility, color, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      event.id, event.family_id, event.title, event.description,
      event.start_time, event.end_time, event.location, event.event_type,
      event.priority, event.is_all_day ? 1 : 0, event.recurrence_rule,
      event.created_by, event.status, event.visibility, event.color,
      event.is_active ? 1 : 0, event.created_at, event.updated_at
    ]);

    // 处理参与者
    if (eventData.assigned_to && eventData.assigned_to.length > 0) {
      await this.addParticipants(event.id, eventData.assigned_to, creatorId);
    }

    // 处理提醒设置
    if (eventData.reminder_settings && eventData.reminder_settings.length > 0) {
      await this.addReminders(event.id, eventData.reminder_settings);
    }

    return event;
  }

  /**
   * 查找事件
   */
  static async findById(id: string): Promise<ICalendarEvent | null> {
    const event = await dbGet(`
      SELECT * FROM calendar_events WHERE id = ? AND is_active = 1
    `, [id]);

    if (!event) return null;

    return {
      ...event,
      is_all_day: Boolean(event.is_all_day),
      is_active: Boolean(event.is_active),
      assigned_to: await this.getEventParticipants(id)
    };
  }

  /**
   * 获取家庭事件列表
   */
  static async getFamilyEvents(familyId: string, query: ICalendarEventQuery = {}): Promise<{
    events: ICalendarEvent[];
    pagination: any;
  }> {
    const {
      start_date,
      end_date,
      event_type,
      status,
      priority,
      visibility,
      search,
      page = 1,
      limit = 20,
      sort_by = 'start_time',
      sort_order = 'asc'
    } = query;

    let whereClause = 'WHERE family_id = ? AND is_active = 1';
    const params: any[] = [familyId];

    if (start_date) {
      whereClause += ' AND start_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND end_time <= ?';
      params.push(end_date);
    }
    if (event_type) {
      whereClause += ' AND event_type = ?';
      params.push(event_type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND priority = ?';
      params.push(priority);
    }
    if (visibility) {
      whereClause += ' AND visibility = ?';
      params.push(visibility);
    }
    if (search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 排序白名单映射，避免SQL注入
    const sortFieldMap: Record<string, string> = {
      start_time: 'start_time',
      created_at: 'created_at',
      priority: 'priority',
      title: 'title',
    };
    const safeSortBy = sortFieldMap[sort_by as string] || 'start_time';
    const safeSortOrder = (String(sort_order).toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    const orderClause = `ORDER BY ${safeSortBy} ${safeSortOrder}`;
    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await dbGet(`
      SELECT COUNT(*) as total FROM calendar_events ${whereClause}
    `, params);

    // 获取事件列表
    const events = await dbAll(`
      SELECT * FROM calendar_events ${whereClause} ${orderClause} LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const eventsWithParticipants = await Promise.all(
      events.map(async (event: any) => ({
        ...event,
        is_all_day: Boolean(event.is_all_day),
        is_active: Boolean(event.is_active),
        assigned_to: await this.getEventParticipants(event.id)
      }))
    );

    return {
      events: eventsWithParticipants,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(countResult.total / limit),
        total_items: countResult.total,
        items_per_page: limit
      }
    };
  }

  /**
   * 更新事件
   */
  static async updateEvent(id: string, updateData: Partial<ICalendarEvent>, operatorId: string): Promise<ICalendarEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new NotFoundError('事件不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(event.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 只有创建者或管理员可以修改
    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_calendar && event.created_by !== operatorId) {
      throw new AuthorizationError('您没有修改此事件的权限');
    }

    // 验证时间逻辑
    if (updateData.start_time && updateData.end_time) {
      const startTime = new Date(updateData.start_time);
      const endTime = new Date(updateData.end_time);
      if (endTime <= startTime) {
        throw new ValidationError('结束时间必须晚于开始时间');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        if (key === 'is_all_day' || key === 'is_active') {
          updateFields.push(`${key} = ?`);
          updateValues.push(value ? 1 : 0);
        } else if (key === 'assigned_to' || key === 'reminder_settings') {
          // 这些字段单独处理
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
        UPDATE calendar_events SET ${updateFields.join(', ')} WHERE id = ?
      `, updateValues);
    }

    // 处理参与者更新
    if (updateData.assigned_to !== undefined) {
      await this.updateParticipants(id, updateData.assigned_to, operatorId);
    }

    return this.findById(id) as Promise<ICalendarEvent>;
  }

  /**
   * 删除事件（软删除）
   */
  static async deleteEvent(id: string, operatorId: string): Promise<void> {
    const event = await this.findById(id);
    if (!event) {
      throw new NotFoundError('事件不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(event.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_calendar && event.created_by !== operatorId) {
      throw new AuthorizationError('您没有删除此事件的权限');
    }

    await dbRun(`
      UPDATE calendar_events SET is_active = 0, updated_at = ? WHERE id = ?
    `, [new Date().toISOString(), id]);
  }

  /**
   * 添加参与者
   */
  static async addParticipants(eventId: string, userIds: string[], operatorId: string): Promise<void> {
    const now = new Date().toISOString();
    
    for (const userId of userIds) {
      const participantId = uuidv4();
      await dbRun(`
        INSERT INTO calendar_event_participants (
          id, event_id, user_id, participation_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [participantId, eventId, userId, 'invited', now, now]);
    }
  }

  /**
   * 获取事件参与者
   */
  static async getEventParticipants(eventId: string): Promise<string[]> {
    const participants = await dbAll(`
      SELECT user_id FROM calendar_event_participants 
      WHERE event_id = ?
    `, [eventId]);

    return participants.map((p: any) => p.user_id);
  }

  /**
   * 更新参与者
   */
  static async updateParticipants(eventId: string, newUserIds: string[], operatorId: string): Promise<void> {
    // 删除现有参与者
    await dbRun(`
      DELETE FROM calendar_event_participants WHERE event_id = ?
    `, [eventId]);

    // 添加新参与者
    if (newUserIds.length > 0) {
      await this.addParticipants(eventId, newUserIds, operatorId);
    }
  }

  /**
   * 添加提醒
   */
  static async addReminders(eventId: string, reminders: Partial<IReminder>[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const reminder of reminders) {
      const reminderId = uuidv4();
      await dbRun(`
        INSERT INTO calendar_reminders (
          id, event_id, reminder_type, remind_before_minutes, message, 
          is_sent, recipient_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reminderId, eventId, reminder.reminder_type || 'notification',
        reminder.remind_before_minutes || 15, reminder.message || null,
        0, reminder.recipient_id || null, now
      ]);
    }
  }

  /**
   * 获取日历统计
   */
  static async getCalendarStats(familyId: string): Promise<ICalendarStats> {
    const now = new Date().toISOString();
    
    // 总事件数
    const totalEvents = await dbGet(`
      SELECT COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1
    `, [familyId]);

    // 即将到来的事件
    const upcomingEvents = await dbGet(`
      SELECT COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1 AND start_time > ? AND status != 'cancelled'
    `, [familyId, now]);

    // 逾期事件
    const overdueEvents = await dbGet(`
      SELECT COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1 AND end_time < ? 
        AND status NOT IN ('completed', 'cancelled')
    `, [familyId, now]);

    // 已完成事件
    const completedEvents = await dbGet(`
      SELECT COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1 AND status = 'completed'
    `, [familyId]);

    // 按类型统计
    const eventsByType = await dbAll(`
      SELECT event_type, COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1
      GROUP BY event_type
    `, [familyId]);

    // 按优先级统计
    const eventsByPriority = await dbAll(`
      SELECT priority, COUNT(*) as count FROM calendar_events 
      WHERE family_id = ? AND is_active = 1
      GROUP BY priority
    `, [familyId]);

    // 活跃参与者数
    const activeParticipants = await dbGet(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM calendar_event_participants cep
      JOIN calendar_events ce ON cep.event_id = ce.id
      WHERE ce.family_id = ? AND ce.is_active = 1
    `, [familyId]);

    return {
      total_events: totalEvents.count,
      upcoming_events: upcomingEvents.count,
      overdue_events: overdueEvents.count,
      completed_events: completedEvents.count,
      events_by_type: eventsByType.reduce((acc: any, item: any) => {
        acc[item.event_type] = item.count;
        return acc;
      }, {}),
      events_by_priority: eventsByPriority.reduce((acc: any, item: any) => {
        acc[item.priority] = item.count;
        return acc;
      }, {}),
      active_participants: activeParticipants.count,
      monthly_trend: [] // 这里可以后续补充月度趋势数据
    };
  }
}
