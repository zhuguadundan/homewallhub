import { Context } from 'koa';
import { Calendar } from '../models/Calendar';
import { ResponseUtil } from '../utils/response';
import { logger } from '../utils/logger';
import { AuthenticationError, ValidationError, NotFoundError, AuthorizationError } from '../middlewares/errorHandler';
import { Validator } from '../utils/validation';
import { CalendarReminderService } from '../services/calendarReminderService';
import { Family } from '../models/Family';

export class CalendarController {
  /**
   * 获取日历事件列表
   */
  static async getEventList(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const queryParams = {
      start_date: ctx.query.start_date as string,
      end_date: ctx.query.end_date as string,
      event_type: ctx.query.event_type as string,
      status: ctx.query.status as string,
      priority: ctx.query.priority as string,
      visibility: ctx.query.visibility as string,
      search: ctx.query.search as string,
      page: parseInt(ctx.query.page as string) || 1,
      limit: Math.min(parseInt(ctx.query.limit as string) || 20, 50),
      sort_by: ctx.query.sort_by as 'start_time' | 'created_at' | 'priority' | 'title' || 'start_time',
      sort_order: ctx.query.sort_order as 'asc' | 'desc' || 'asc'
    };

    try {
      const result = await Calendar.getFamilyEvents(user.familyId, queryParams);
      
      ResponseUtil.paginated(ctx, result.events, result.pagination, '获取事件列表成功');
    } catch (error) {
      logger.error('获取事件列表失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 创建日历事件
   */
  static async createEvent(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const eventSchema = {
      title: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      start_time: { required: true, type: 'string' },
      end_time: { required: true, type: 'string' },
      location: { type: 'string', maxLength: 200 },
      event_type: { 
        type: 'string', 
        enum: ['meeting', 'birthday', 'holiday', 'reminder', 'task', 'other'] 
      },
      priority: { 
        type: 'string', 
        enum: ['low', 'medium', 'high', 'urgent'] 
      },
      is_all_day: { type: 'boolean' },
      recurrence_rule: { type: 'string' },
      assigned_to: { type: 'array', items: { type: 'string' } },
      visibility: { 
        type: 'string', 
        enum: ['public', 'private', 'family'] 
      },
      color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      reminder_settings: { 
        type: 'array', 
        items: {
          type: 'object',
          properties: {
            reminder_type: { type: 'string', enum: ['notification', 'email', 'sms'] },
            remind_before_minutes: { type: 'number', min: 0 },
            message: { type: 'string' },
            recipient_id: { type: 'string' }
          }
        }
      }
    };

    const validation = Validator.validate(ctx.request.body, eventSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      const eventData = {
        ...validation.data,
        family_id: user.familyId
      };

      const event = await Calendar.createEvent(eventData, user.userId);
      
      logger.info('日历事件创建成功', {
        eventId: event.id,
        familyId: user.familyId,
        userId: user.userId,
        title: event.title
      });

      ResponseUtil.success(ctx, event, '事件创建成功');
    } catch (error) {
      logger.error('日历事件创建失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取事件详情
   */
  static async getEventDetails(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const eventId = ctx.params.eventId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const event = await Calendar.findById(eventId);
      if (!event) {
        throw new NotFoundError('事件不存在');
      }

      // 验证权限 - 只有家庭成员可以查看
      if (event.family_id !== user.familyId) {
        throw new AuthorizationError('您没有查看此事件的权限');
      }

      ResponseUtil.success(ctx, event, '获取事件详情成功');
    } catch (error) {
      logger.error('获取事件详情失败', { eventId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新事件
   */
  static async updateEvent(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const eventId = ctx.params.eventId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const updateSchema = {
      title: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      start_time: { type: 'string' },
      end_time: { type: 'string' },
      location: { type: 'string', maxLength: 200 },
      event_type: { 
        type: 'string', 
        enum: ['meeting', 'birthday', 'holiday', 'reminder', 'task', 'other'] 
      },
      priority: { 
        type: 'string', 
        enum: ['low', 'medium', 'high', 'urgent'] 
      },
      is_all_day: { type: 'boolean' },
      recurrence_rule: { type: 'string' },
      assigned_to: { type: 'array', items: { type: 'string' } },
      status: { 
        type: 'string', 
        enum: ['planned', 'confirmed', 'cancelled', 'completed'] 
      },
      visibility: { 
        type: 'string', 
        enum: ['public', 'private', 'family'] 
      },
      color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
    };

    const validation = Validator.validate(ctx.request.body, updateSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      const updatedEvent = await Calendar.updateEvent(eventId, validation.data, user.userId);
      
      logger.info('事件更新成功', {
        eventId,
        userId: user.userId,
        updates: Object.keys(validation.data)
      });

      ResponseUtil.success(ctx, updatedEvent, '事件更新成功');
    } catch (error) {
      logger.error('事件更新失败', { eventId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 删除事件
   */
  static async deleteEvent(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const eventId = ctx.params.eventId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Calendar.deleteEvent(eventId, user.userId);
      
      logger.info('事件删除成功', {
        eventId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '事件删除成功');
    } catch (error) {
      logger.error('事件删除失败', { eventId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新参与状态
   */
  static async updateParticipationStatus(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const eventId = ctx.params.eventId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const statusSchema = {
      status: { 
        required: true,
        type: 'string', 
        enum: ['accepted', 'declined', 'tentative'] 
      },
      notes: { type: 'string', maxLength: 200 }
    };

    const validation = Validator.validate(ctx.request.body, statusSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      // 这里需要实现参与状态更新逻辑
      // await Calendar.updateParticipationStatus(eventId, user.userId, validation.data);
      
      logger.info('参与状态更新成功', {
        eventId,
        userId: user.userId,
        status: validation.data.status
      });

      ResponseUtil.success(ctx, null, '参与状态更新成功');
    } catch (error) {
      logger.error('参与状态更新失败', { eventId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取日历统计
   */
  static async getCalendarStats(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const stats = await Calendar.getCalendarStats(user.familyId);
      
      ResponseUtil.success(ctx, stats, '获取日历统计成功');
    } catch (error) {
      logger.error('获取日历统计失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取今日事件
   */
  static async getTodayEvents(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const result = await Calendar.getFamilyEvents(user.familyId, {
        start_date: startOfDay,
        end_date: endOfDay,
        status: 'confirmed',
        sort_by: 'start_time',
        sort_order: 'asc',
        limit: 50
      });
      
      ResponseUtil.success(ctx, result.events, '获取今日事件成功');
    } catch (error) {
      logger.error('获取今日事件失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取即将到来的事件
   */
  static async getUpcomingEvents(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const days = parseInt(ctx.query.days as string) || 7;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      const result = await Calendar.getFamilyEvents(user.familyId, {
        start_date: now.toISOString(),
        end_date: futureDate.toISOString(),
        status: 'confirmed',
        sort_by: 'start_time',
        sort_order: 'asc',
        limit: 20
      });
      
      ResponseUtil.success(ctx, result.events, '获取即将到来的事件成功');
    } catch (error) {
      logger.error('获取即将到来的事件失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 创建事件提醒
   */
  static async createEventReminder(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const eventId = ctx.params.eventId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const reminderSchema = {
      reminder_type: { 
        required: true,
        type: 'string', 
        enum: ['notification', 'email', 'sms'] 
      },
      remind_before_minutes: { 
        required: true,
        type: 'number', 
        min: 0, 
        max: 10080 // 最多提前7天
      },
      message: { type: 'string', maxLength: 200 },
      recipient_id: { type: 'string' }
    };

    const validation = Validator.validate(ctx.request.body, reminderSchema);
    if (!validation.isValid) {
      throw new ValidationError('数据验证失败', validation.errors);
    }

    try {
      // 验证事件存在且用户有权限
      const event = await Calendar.findById(eventId);
      if (!event || event.family_id !== user.familyId) {
        throw new NotFoundError('事件不存在或无权限');
      }

      const reminderId = await CalendarReminderService.createEventReminder(
        eventId,
        validation.data.reminder_type,
        validation.data.remind_before_minutes,
        validation.data.message,
        validation.data.recipient_id
      );
      
      logger.info('事件提醒创建成功', {
        reminderId,
        eventId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, { id: reminderId }, '提醒创建成功');
    } catch (error) {
      logger.error('创建事件提醒失败', { eventId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取提醒统计
   */
  static async getReminderStats(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const stats = await CalendarReminderService.getReminderStats(user.familyId);
      
      ResponseUtil.success(ctx, stats, '获取提醒统计成功');
    } catch (error) {
      logger.error('获取提醒统计失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 手动触发提醒检查（管理员功能）
   */
  static async triggerReminderCheck(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 检查是否为管理员
    const membership = await Family.getMembership(user.familyId, user.userId);
    if (!membership || membership.role !== 'admin') {
      throw new AuthorizationError('只有管理员可以执行此操作');
    }

    try {
      await CalendarReminderService.triggerCheck();
      
      logger.info('手动触发提醒检查', {
        familyId: user.familyId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '提醒检查已触发');
    } catch (error) {
      logger.error('触发提醒检查失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }
}
