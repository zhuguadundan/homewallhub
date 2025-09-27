/**
 * 日历事件接口定义
 */

export interface ICalendarEvent {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  event_type: 'meeting' | 'birthday' | 'holiday' | 'reminder' | 'task' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_all_day: boolean;
  recurrence_rule?: string; // RRULE格式
  created_by: string;
  assigned_to?: string[]; // 分配给特定家庭成员
  status: 'planned' | 'confirmed' | 'cancelled' | 'completed';
  visibility: 'public' | 'private' | 'family'; // 可见性级别
  reminder_settings?: IReminder[];
  attachments?: string[]; // 附件URL数组
  color?: string; // 事件颜色
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IReminder {
  id: string;
  event_id: string;
  reminder_type: 'notification' | 'email' | 'sms';
  remind_before_minutes: number; // 提前多少分钟提醒
  message?: string;
  is_sent: boolean;
  recipient_id?: string; // 指定接收人，为空则发送给所有相关人员
  created_at: string;
  sent_at?: string;
}

export interface ICalendarEventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  participation_status: 'invited' | 'accepted' | 'declined' | 'tentative';
  response_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface IRecurringEvent {
  id: string;
  parent_event_id: string;
  occurrence_date: string;
  is_modified: boolean; // 是否被单独修改过
  is_cancelled: boolean; // 是否被取消
  created_at: string;
  updated_at: string;
}

export interface ICalendarEventQuery {
  family_id?: string;
  start_date?: string;
  end_date?: string;
  event_type?: string;
  status?: string;
  created_by?: string;
  assigned_to?: string;
  priority?: string;
  visibility?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'start_time' | 'created_at' | 'priority' | 'title';
  sort_order?: 'asc' | 'desc';
}

export interface ICalendarStats {
  total_events: number;
  upcoming_events: number;
  overdue_events: number;
  completed_events: number;
  events_by_type: { [key: string]: number };
  events_by_priority: { [key: string]: number };
  active_participants: number;
  monthly_trend: Array<{
    month: string;
    count: number;
  }>;
}

export interface IEventConflict {
  event_id: string;
  conflicting_events: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    participants: string[];
  }>;
  conflict_type: 'time_overlap' | 'resource_conflict' | 'participant_conflict';
}