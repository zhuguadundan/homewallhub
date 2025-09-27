import { dbAll, dbGet, dbRun } from '../config/database';
import { logger } from '../utils/logger';
import { socketManager } from '../middleware/socket';
import { IReminder, ICalendarEvent } from '../interfaces/calendar';

export class CalendarReminderService {
  private static checkInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * 启动提醒检查服务
   */
  static start(): void {
    if (this.isRunning) {
      logger.warn('日历提醒服务已在运行');
      return;
    }

    this.isRunning = true;
    
    // 每分钟检查一次提醒
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAndSendReminders();
      } catch (error) {
        logger.error('检查日历提醒失败:', error);
      }
    }, 60000); // 60秒

    logger.info('日历提醒服务已启动');
  }

  /**
   * 停止提醒检查服务
   */
  static stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('日历提醒服务已停止');
  }

  /**
   * 检查并发送提醒
   */
  static async checkAndSendReminders(): Promise<void> {
    const now = new Date();
    
    // 获取需要发送的提醒
    const pendingReminders = await dbAll<IReminder & { 
      event_title: string;
      event_start_time: string;
      family_id: string;
    }>(`
      SELECT 
        r.*,
        e.title as event_title,
        e.start_time as event_start_time,
        e.family_id
      FROM calendar_reminders r
      JOIN calendar_events e ON r.event_id = e.id
      WHERE r.is_sent = 0 
        AND e.is_active = 1
        AND e.status NOT IN ('cancelled', 'completed')
        AND datetime(e.start_time, '-' || r.remind_before_minutes || ' minutes') <= datetime('now')
        AND datetime(e.start_time) > datetime('now')
    `);

    for (const reminder of pendingReminders) {
      try {
        await this.sendReminder(reminder);
        
        // 标记为已发送
        await dbRun(`
          UPDATE calendar_reminders 
          SET is_sent = 1, sent_at = ? 
          WHERE id = ?
        `, [now.toISOString(), reminder.id]);

        logger.info('日历提醒发送成功', {
          reminderId: reminder.id,
          eventTitle: reminder.event_title,
          reminderType: reminder.reminder_type
        });
      } catch (error) {
        logger.error('发送日历提醒失败', {
          reminderId: reminder.id,
          error
        });
      }
    }
  }

  /**
   * 发送单个提醒
   */
  private static async sendReminder(reminder: IReminder & { 
    event_title: string;
    event_start_time: string;
    family_id: string;
  }): Promise<void> {
    const eventStartTime = new Date(reminder.event_start_time);
    const timeToEvent = Math.ceil((eventStartTime.getTime() - new Date().getTime()) / (1000 * 60));
    
    const message = reminder.message || 
      `提醒：${reminder.event_title} 将在${timeToEvent}分钟后开始`;

    switch (reminder.reminder_type) {
      case 'notification':
        await this.sendInAppNotification(reminder, message);
        break;
      case 'email':
        await this.sendEmailReminder(reminder, message);
        break;
      case 'sms':
        await this.sendSmsReminder(reminder, message);
        break;
      default:
        logger.warn('未知的提醒类型:', reminder.reminder_type);
    }
  }

  /**
   * 发送应用内通知
   */
  private static async sendInAppNotification(reminder: IReminder & { 
    event_title: string;
    family_id: string;
  }, message: string): Promise<void> {
    // 获取接收者
    const recipients = reminder.recipient_id ? 
      [reminder.recipient_id] : 
      await this.getEventParticipants(reminder.event_id);

    // 创建通知记录
    for (const userId of recipients) {
      const notificationId = require('uuid').v4();
      await dbRun(`
        INSERT INTO notifications (
          id, family_id, user_id, title, message, type, 
          priority, data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        notificationId,
        reminder.family_id,
        userId,
        '日历提醒',
        message,
        'calendar',
        'normal',
        JSON.stringify({
          event_id: reminder.event_id,
          reminder_id: reminder.id
        }),
        new Date().toISOString()
      ]);

      // 通过Socket.IO发送实时通知
      socketManager.emitToUser(userId, 'calendar_reminder', {
        id: notificationId,
        title: '日历提醒',
        message,
        event_title: reminder.event_title,
        event_id: reminder.event_id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 发送邮件提醒
   */
  private static async sendEmailReminder(reminder: IReminder & { 
    event_title: string;
  }, message: string): Promise<void> {
    // TODO: 实现邮件发送逻辑
    logger.info('邮件提醒功能待实现', {
      reminderId: reminder.id,
      message
    });
  }

  /**
   * 发送短信提醒
   */
  private static async sendSmsReminder(reminder: IReminder & { 
    event_title: string;
  }, message: string): Promise<void> {
    // TODO: 实现短信发送逻辑
    logger.info('短信提醒功能待实现', {
      reminderId: reminder.id,
      message
    });
  }

  /**
   * 获取事件参与者
   */
  private static async getEventParticipants(eventId: string): Promise<string[]> {
    const participants = await dbAll<{ user_id: string }>(`
      SELECT user_id FROM calendar_event_participants 
      WHERE event_id = ?
    `, [eventId]);

    return participants.map(p => p.user_id);
  }

  /**
   * 手动触发事件提醒检查（用于测试）
   */
  static async triggerCheck(): Promise<void> {
    await this.checkAndSendReminders();
  }

  /**
   * 为特定事件创建提醒
   */
  static async createEventReminder(
    eventId: string, 
    reminderType: 'notification' | 'email' | 'sms',
    remindBeforeMinutes: number,
    message?: string,
    recipientId?: string
  ): Promise<string> {
    const reminderId = require('uuid').v4();
    const now = new Date().toISOString();

    await dbRun(`
      INSERT INTO calendar_reminders (
        id, event_id, reminder_type, remind_before_minutes, 
        message, recipient_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      reminderId, eventId, reminderType, remindBeforeMinutes,
      message || null, recipientId || null, now
    ]);

    logger.info('事件提醒创建成功', {
      reminderId,
      eventId,
      reminderType,
      remindBeforeMinutes
    });

    return reminderId;
  }

  /**
   * 批量创建默认提醒
   */
  static async createDefaultReminders(eventId: string): Promise<void> {
    const defaultReminders = [
      { type: 'notification', minutes: 15 },
      { type: 'notification', minutes: 60 }
    ];

    for (const reminder of defaultReminders) {
      await this.createEventReminder(
        eventId,
        reminder.type as 'notification',
        reminder.minutes
      );
    }
  }

  /**
   * 删除事件的所有提醒
   */
  static async deleteEventReminders(eventId: string): Promise<void> {
    await dbRun(`
      DELETE FROM calendar_reminders WHERE event_id = ?
    `, [eventId]);

    logger.info('事件提醒删除完成', { eventId });
  }

  /**
   * 获取事件提醒统计
   */
  static async getReminderStats(familyId: string): Promise<{
    total_reminders: number;
    sent_reminders: number;
    pending_reminders: number;
    reminders_by_type: { [key: string]: number };
  }> {
    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total_reminders,
        SUM(CASE WHEN is_sent = 1 THEN 1 ELSE 0 END) as sent_reminders,
        SUM(CASE WHEN is_sent = 0 THEN 1 ELSE 0 END) as pending_reminders
      FROM calendar_reminders r
      JOIN calendar_events e ON r.event_id = e.id
      WHERE e.family_id = ? AND e.is_active = 1
    `, [familyId]);

    const remindersByType = await dbAll<{ reminder_type: string; count: number }>(`
      SELECT 
        r.reminder_type,
        COUNT(*) as count
      FROM calendar_reminders r
      JOIN calendar_events e ON r.event_id = e.id
      WHERE e.family_id = ? AND e.is_active = 1
      GROUP BY r.reminder_type
    `, [familyId]);

    return {
      total_reminders: stats?.total_reminders || 0,
      sent_reminders: stats?.sent_reminders || 0,
      pending_reminders: stats?.pending_reminders || 0,
      reminders_by_type: remindersByType.reduce((acc: any, item) => {
        acc[item.reminder_type] = item.count;
        return acc;
      }, {})
    };
  }
}
