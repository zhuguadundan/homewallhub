import { http } from '@/utils/request'

export interface CreateMessageData {
  title?: string
  content: string
  category?: 'general' | 'urgent' | 'reminder' | 'family_news' | 'celebration' | 'other'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  is_pinned?: boolean
  attachments?: string[]
}

export interface UpdateMessageData extends Partial<CreateMessageData> {}

export interface MessageListParams {
  page?: number
  limit?: number
  category?: string
  search?: string
  is_pinned?: boolean
}

export const messageApi = {
  // 获取留言列表（支持置顶/分页/筛选）
  getMessageList(params?: MessageListParams) {
    return http.get('/messages', { params })
  },

  // 获取单条留言详情
  getMessageDetail(messageId: string) {
    return http.get(`/messages/${messageId}`)
  },

  // 创建留言
  createMessage(data: CreateMessageData) {
    return http.post('/messages', data)
  },

  // 更新留言
  updateMessage(messageId: string, data: UpdateMessageData) {
    return http.put(`/messages/${messageId}`, data)
  },

  // 删除留言
  deleteMessage(messageId: string) {
    return http.delete(`/messages/${messageId}`)
  },

  // 添加反应
  addReaction(messageId: string, data: { reaction_type: string }) {
    return http.post(`/messages/${messageId}/reaction`, data)
  },

  // 标记已读
  markAsRead(messageId: string) {
    return http.post(`/messages/${messageId}/read`)
  },

  // 获取未读数量
  getUnreadCount() {
    return http.get('/messages/unread/count')
  },

  // 全部标记为已读
  markAllAsRead() {
    return http.post('/messages/read/all')
  },

  // 概览统计
  getMessageStats() {
    return http.get('/messages/stats/overview')
  }
}
