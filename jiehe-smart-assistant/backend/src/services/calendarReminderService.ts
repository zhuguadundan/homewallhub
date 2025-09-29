import { dbAll, dbGet, dbRun } from '../config/database';
import { logger } from '../utils/logger';
import { socketManager } from '../middleware/socket';

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
   * 检查并发送提醒（基于 calendar_events.reminder_times，而非独立提醒表）
   */
  static async checkAndSendReminders(): Promise<void> {
    const now = new Date();

    // 查询未来的且设置了提醒时间的事件
    const events = await dbAll<{
      id: string;
      family_id: string;
      title: string;
      start_time: string;
      reminder_times: string | null;
      created_by: string | null;
    }>(
      `SELECT id, family_id, title, start_time, reminder_times, created_by
       FROM calendar_events
       WHERE is_deleted = 0
         AND datetime(start_time) > datetime('now')
         AND reminder_times IS NOT NULL`
    );

    for (const e of events) {
      if (!e.reminder_times) continue;

      let reminders: number[] = [];
      try {
        const parsed = JSON.parse(e.reminder_times);
        if (Array.isArray(parsed)) {
          reminders = parsed.map((n) => Number(n)).filter((n) => !isNaN(n) && n >= 0);
        }
      } catch {
        // 非法 JSON，跳过
        continue;
      }

      if (reminders.length === 0) continue;

      const startTs = new Date(e.start_time).getTime();
      const diffMinutes = Math.ceil((startTs - now.getTime()) / (1000 * 60));

      // 在一分钟粒度内触发：如果 diffMinutes 正好等于某个提醒阈值
      for (const m of reminders) {
        if (diffMinutes === m) {
          const sent = await this.hasSentReminder(e.id, m);
          if (!sent) {
            const message = `提醒：${e.title} 将在${m}分钟后开始`;
            await this.sendInAppNotificationByEvent(e, message, m);
          }
        }
      }
    }
  }

  /**
   * 检查是否已对某事件在指定分钟数发送过提醒（通过 notifications 表去重）
   */
  private static async hasSentReminder(eventId: string, minutes: number): Promise<boolean> {
    const row = await dbGet<{ cnt: number }>(
      `SELECT COUNT(*) as cnt
       FROM notifications
       WHERE reference_type = 'calendar'
         AND reference_id = ?
         AND title = '日历提醒'
         AND content LIKE ?
         AND datetime(created_at) >= datetime('now', '-1 day')`,
      [eventId, `%将在${minutes}分钟后开始%`]
    );
    return (row?.cnt || 0) > 0;
  }

  /**
   * 发送应用内通知（基于事件，通知参与者；若无参与者则通知创建者）
   */
  private static async sendInAppNotificationByEvent(
    event: { id: string; family_id: string; title: string; start_time: string; created_by: string | null },
    message: string,
    minutes: number
  ): Promise<void> {
    // 参与者（若无记录则尝试用创建者作为接收者）
    let recipients = await this.getEventParticipants(event.id);
    if (recipients.length === 0 && event.created_by) {
      recipients = [event.created_by];
    }

    for (const userId of recipients) {
      const notificationId = require('uuid').v4();
      await dbRun(
        `INSERT INTO notifications (
           id, user_id, family_id, title, content, type, reference_type, reference_id, is_read, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          notificationId,
          userId,
          event.family_id,
          '日历提醒',
          message,
          'calendar',
          'calendar',
          event.id,
          new Date().toISOString(),
        ]
      );

      // 通过 Socket.IO 实时推送
      socketManager.emitToUser(userId, 'calendar_reminder', {
        id: notificationId,
        title: '日历提醒',
        message,
        event_title: event.title,
        event_id: event.id,
        minutes,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('已发送日历提醒', {
      eventId: event.id,
      minutes,
      recipients: recipients.length,
    });
  }

  /**
   * 获取事件参与者
   */
  private static async getEventParticipants(eventId: string): Promise<string[]> {
    const participants = await dbAll<{ user_id: string }>(
      `SELECT user_id FROM event_participants WHERE event_id = ?`,
      [eventId]
    );
    return participants.map((p) => p.user_id);
  }

  /**
   * 手动触发事件提醒检查（用于测试）
   */
  static async triggerCheck(): Promise<void> {
    await this.checkAndSendReminders();
  }

  /**
   * 统计（基于 notifications 表）
   */
  static async getReminderStats(
    familyId: string
  ): Promise<{
    total_reminders: number;
    sent_reminders: number;
    pending_reminders: number;
    reminders_by_type: { [key: string]: number };
  }> {
    const stats = await dbGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM notifications WHERE family_id = ? AND reference_type = 'calendar'`,
      [familyId]
    );

    const byTypeRows = await dbAll<{ type: string; cnt: number }>(
      `SELECT type as type, COUNT(*) as cnt
       FROM notifications
       WHERE family_id = ? AND reference_type = 'calendar'
       GROUP BY type`,
      [familyId]
    );

    const reminders_by_type = byTypeRows.reduce((acc: any, r) => {
      acc[r.type] = r.cnt;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_reminders: stats?.total || 0,
      sent_reminders: stats?.total || 0,
      pending_reminders: 0,
      reminders_by_type,
    };
  }
}
