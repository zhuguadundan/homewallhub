import { http } from '@/utils/request'

export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type: 'meeting' | 'birthday' | 'holiday' | 'reminder' | 'task' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  is_all_day: boolean
  recurrence_rule?: string
  assigned_to?: string[]
  status: 'planned' | 'confirmed' | 'cancelled' | 'completed'
  visibility: 'public' | 'private' | 'family'
  color?: string
}

export interface EventListParams {
  page?: number
  limit?: number
  start_date?: string
  end_date?: string
  event_type?: string
  status?: string
  priority?: string
  visibility?: string
  search?: string
  sort_by?: 'start_time' | 'created_at' | 'priority' | 'title'
  sort_order?: 'asc' | 'desc'
}

export interface ReminderData {
  reminder_type: 'notification' | 'email' | 'sms'
  remind_before_minutes: number
  message?: string
  recipient_id?: string
}

export interface ParticipationData {
  status: 'accepted' | 'declined' | 'tentative'
  notes?: string
}

export const calendarApi = {
  /**
   * 获取事件列表
   */
  getEventList(params?: EventListParams) {
    return http.get('/calendar/events', { params })
  },

  /**
   * 获取事件详情
   */
  getEventDetail(eventId: string) {
    return http.get(`/calendar/events/${eventId}`)
  },

  /**
   * 创建事件
   */
  createEvent(data: CalendarEvent) {
    return http.post('/calendar/events', data)
  },

  /**
   * 更新事件
   */
  updateEvent(eventId: string, data: Partial<CalendarEvent>) {
    return http.put(`/calendar/events/${eventId}`, data)
  },

  /**
   * 删除事件
   */
  deleteEvent(eventId: string) {
    return http.delete(`/calendar/events/${eventId}`)
  },

  /**
   * 更新参与状态
   */
  updateParticipationStatus(eventId: string, data: ParticipationData) {
    return http.put(`/calendar/events/${eventId}/participation`, data)
  },

  /**
   * 获取日历统计
   */
  getCalendarStats() {
    return http.get('/calendar/stats')
  },

  /**
   * 获取今日事件
   */
  getTodayEvents() {
    return http.get('/calendar/today')
  },

  /**
   * 获取即将到来的事件
   */
  getUpcomingEvents(params?: { days?: number }) {
    return http.get('/calendar/upcoming', { params })
  },

  /**
   * 创建事件提醒
   */
  createEventReminder(eventId: string, data: ReminderData) {
    return http.post(`/calendar/events/${eventId}/reminders`, data)
  },

  /**
   * 获取提醒统计
   */
  getReminderStats() {
    return http.get('/calendar/reminders/stats')
  },

  /**
   * 手动触发提醒检查
   */
  triggerReminderCheck() {
    return http.post('/calendar/reminders/trigger')
  }
}