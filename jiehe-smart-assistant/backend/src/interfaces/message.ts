/**
 * 留言板相关接口定义
 */

export interface IMessage {
  id: string;
  family_id: string;
  user_id: string;
  title?: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'reminder' | 'announcement';
  category: 'general' | 'urgent' | 'reminder' | 'family_news' | 'celebration' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  attachments?: string[]; // 附件URL数组
  mentioned_users?: string[]; // @提醒的用户ID数组
  expires_at?: string; // 过期时间
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow';
  created_at: string;
}

export interface IMessageReadStatus {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
  is_read: boolean;
}

export interface IMessageComment {
  id: string;
  message_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string; // 回复评论的ID
  mentioned_users?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IMessageQuery {
  family_id?: string;
  user_id?: string;
  message_type?: string;
  category?: string;
  priority?: string;
  is_pinned?: boolean;
  mentioned_user?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'priority' | 'category';
  sort_order?: 'asc' | 'desc';
}

export interface IMessageStats {
  total_messages: number;
  unread_messages: number;
  messages_by_type: { [key: string]: number };
  messages_by_category: { [key: string]: number };
  active_users: number;
  recent_activity: Array<{
    date: string;
    count: number;
  }>;
}

export interface INotificationSettings {
  id: string;
  user_id: string;
  family_id: string;
  enable_mention_notifications: boolean;
  enable_message_notifications: boolean;
  enable_urgent_notifications: boolean;
  notification_methods: ('app' | 'email' | 'sms')[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  created_at: string;
  updated_at: string;
}