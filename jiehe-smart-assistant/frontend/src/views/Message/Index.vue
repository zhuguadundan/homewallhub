<template>
  <div class="message-page">
    <!-- 页面头部 -->
    <van-nav-bar
      title="家庭留言板"
      left-arrow
      @click-left="$router.go(-1)"
    >
      <template #right>
        <div class="header-actions">
          <van-badge :content="unreadCount" :show-zero="false">
            <van-icon name="bell-o" @click="showNotifications = true" />
          </van-badge>
          <van-icon name="plus" @click="showCreateMessage = true" />
        </div>
      </template>
    </van-nav-bar>

    <!-- 筛选和搜索栏 -->
    <div class="filter-section">
      <van-search
        v-model="searchQuery"
        placeholder="搜索留言内容..."
        @search="onSearch"
        @clear="onClear"
      />
      <div class="filter-tabs">
        <van-tabs v-model:active="activeCategory" @change="onCategoryChange">
          <van-tab title="全部" name="" />
          <van-tab title="紧急" name="urgent" />
          <van-tab title="提醒" name="reminder" />
          <van-tab title="家庭动态" name="family_news" />
          <van-tab title="庆祝" name="celebration" />
        </van-tabs>
      </div>
    </div>

    <!-- 置顶留言 -->
    <div v-if="pinnedMessages.length > 0" class="pinned-section">
      <h3 class="section-title">
        <van-icon name="star" />
        置顶留言
      </h3>
      <div class="pinned-messages">
        <div 
          v-for="message in pinnedMessages" 
          :key="message.id"
          class="message-card pinned"
          @click="viewMessageDetail(message.id)"
        >
          <div class="message-header">
            <div class="user-info">
              <van-avatar size="32" :src="getUserAvatar(message.user_id)" />
              <div class="user-details">
                <span class="username">{{ getUserName(message.user_id) }}</span>
                <span class="timestamp">{{ formatTime(message.created_at) }}</span>
              </div>
            </div>
            <div class="message-badges">
              <van-tag type="warning" size="mini">置顶</van-tag>
              <van-tag :type="getPriorityType(message.priority)" size="mini">
                {{ getPriorityText(message.priority) }}
              </van-tag>
            </div>
          </div>
          
          <div class="message-content">
            <h4 v-if="message.title" class="message-title">{{ message.title }}</h4>
            <p class="message-text">{{ message.content }}</p>
            
            <div v-if="message.attachments && message.attachments.length > 0" class="attachments">
              <van-image
                v-for="(attachment, index) in message.attachments.slice(0, 3)"
                :key="index"
                :src="attachment"
                width="60"
                height="60"
                fit="cover"
                radius="4"
              />
              <div v-if="message.attachments.length > 3" class="more-attachments">
                +{{ message.attachments.length - 3 }}
              </div>
            </div>
          </div>

          <div class="message-footer">
            <div class="message-meta">
              <span class="category">{{ getCategoryText(message.category) }}</span>
              <span v-if="message.mentioned_users && message.mentioned_users.length > 0" class="mentions">
                @{{ message.mentioned_users.length }}人
              </span>
            </div>
            <div class="message-actions">
              <van-button size="mini" icon="good-job-o" @click.stop="addReaction(message.id, 'like')">
                {{ message.reactions?.like || 0 }}
              </van-button>
              <van-button size="mini" icon="chat-o" @click.stop="showComments(message.id)">
                {{ message.comments_count || 0 }}
              </van-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 普通留言列表 -->
    <div class="messages-section">
      <van-pull-refresh v-model="refreshing" @refresh="refreshMessages">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadMessages"
        >
          <div class="messages-list">
            <div 
              v-for="message in messageList" 
              :key="message.id"
              class="message-card"
              :class="{ unread: !message.is_read }"
              @click="viewMessageDetail(message.id)"
            >
              <div class="message-header">
                <div class="user-info">
                  <van-avatar size="32" :src="getUserAvatar(message.user_id)" />
                  <div class="user-details">
                    <span class="username">{{ getUserName(message.user_id) }}</span>
                    <span class="timestamp">{{ formatTime(message.created_at) }}</span>
                  </div>
                </div>
                <div class="message-badges">
                  <van-tag v-if="!message.is_read" type="danger" size="mini">未读</van-tag>
                  <van-tag :type="getPriorityType(message.priority)" size="mini">
                    {{ getPriorityText(message.priority) }}
                  </van-tag>
                </div>
              </div>
              
              <div class="message-content">
                <h4 v-if="message.title" class="message-title">{{ message.title }}</h4>
                <p class="message-text">{{ message.content }}</p>
                
                <div v-if="message.attachments && message.attachments.length > 0" class="attachments">
                  <van-image
                    v-for="(attachment, index) in message.attachments.slice(0, 3)"
                    :key="index"
                    :src="attachment"
                    width="60"
                    height="60"
                    fit="cover"
                    radius="4"
                  />
                  <div v-if="message.attachments.length > 3" class="more-attachments">
                    +{{ message.attachments.length - 3 }}
                  </div>
                </div>
              </div>

              <div class="message-footer">
                <div class="message-meta">
                  <span class="category">{{ getCategoryText(message.category) }}</span>
                  <span v-if="message.mentioned_users && message.mentioned_users.length > 0" class="mentions">
                    @{{ message.mentioned_users.length }}人
                  </span>
                </div>
                <div class="message-actions">
                  <van-button size="mini" icon="good-job-o" @click.stop="addReaction(message.id, 'like')">
                    {{ message.reactions?.like || 0 }}
                  </van-button>
                  <van-button size="mini" icon="chat-o" @click.stop="showComments(message.id)">
                    {{ message.comments_count || 0 }}
                  </van-button>
                </div>
              </div>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 创建留言弹窗 -->
    <van-popup
      v-model:show="showCreateMessage"
      position="bottom"
      :style="{ height: '80%' }"
      round
    >
      <div class="create-message-form">
        <h3>发布留言</h3>
        <van-form @submit="createMessage">
          <van-field
            v-model="messageForm.title"
            name="title"
            label="标题"
            placeholder="请输入留言标题（可选）"
          />
          <van-field
            v-model="messageForm.content"
            name="content"
            label="内容"
            placeholder="请输入留言内容"
            type="textarea"
            rows="4"
            :rules="[{ required: true, message: '请输入留言内容' }]"
          />
          <van-field
            v-model="messageForm.category"
            name="category"
            label="分类"
            placeholder="选择留言分类"
            readonly
            @click="showCategoryPicker = true"
          />
          <van-field
            v-model="messageForm.priority"
            name="priority"
            label="优先级"
            placeholder="选择优先级"
            readonly
            @click="showPriorityPicker = true"
          />
          <van-field name="is_pinned" label="置顶显示">
            <template #input>
              <van-switch v-model="messageForm.is_pinned" />
            </template>
          </van-field>
          <div class="form-actions">
            <van-button round block type="primary" native-type="submit">
              发布留言
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 通知列表弹窗 -->
    <van-popup
      v-model:show="showNotifications"
      position="right"
      :style="{ width: '80%', height: '100%' }"
    >
      <div class="notifications-panel">
        <div class="panel-header">
          <h3>通知中心</h3>
          <van-button size="small" @click="markAllAsRead">全部已读</van-button>
        </div>
        <div class="notifications-list">
          <div 
            v-for="notification in notifications" 
            :key="notification.id"
            class="notification-item"
            :class="{ unread: !notification.is_read }"
          >
            <div class="notification-content">
              <h4>{{ notification.title }}</h4>
              <p>{{ notification.message }}</p>
              <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 选择器 -->
    <van-popup v-model:show="showCategoryPicker" position="bottom">
      <van-picker
        :columns="categoryOptions"
        @confirm="onCategoryConfirm"
        @cancel="showCategoryPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showPriorityPicker" position="bottom">
      <van-picker
        :columns="priorityOptions"
        @confirm="onPriorityConfirm"
        @cancel="showPriorityPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { messageApi } from '@/api/message'

const router = useRouter()

// 响应式数据
const searchQuery = ref('')
const activeCategory = ref('')
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const showCreateMessage = ref(false)
const showNotifications = ref(false)
const showCategoryPicker = ref(false)
const showPriorityPicker = ref(false)

const messageList = ref([])
const pinnedMessages = ref([])
const notifications = ref([])
const unreadCount = ref(0)

const messageForm = reactive({
  title: '',
  content: '',
  category: 'general',
  priority: 'normal',
  is_pinned: false
})

// 分页数据
const pageData = reactive({
  current: 1,
  size: 20
})

// 选项数据
const categoryOptions = [
  { text: '一般', value: 'general' },
  { text: '紧急', value: 'urgent' },
  { text: '提醒', value: 'reminder' },
  { text: '家庭动态', value: 'family_news' },
  { text: '庆祝', value: 'celebration' },
  { text: '其他', value: 'other' }
]

const priorityOptions = [
  { text: '低', value: 'low' },
  { text: '普通', value: 'normal' },
  { text: '高', value: 'high' },
  { text: '紧急', value: 'urgent' }
]

// 页面初始化
onMounted(() => {
  loadPinnedMessages()
  loadMessages()
  loadNotifications()
  loadUnreadCount()
})

// 加载置顶留言
const loadPinnedMessages = async () => {
  try {
    const response = await messageApi.getMessageList({
      is_pinned: true,
      limit: 10
    })
    pinnedMessages.value = response.data.messages
  } catch (error) {
    console.error('加载置顶留言失败:', error)
  }
}

// 加载留言列表
const loadMessages = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const params = {
      page: pageData.current,
      limit: pageData.size,
      category: activeCategory.value,
      search: searchQuery.value,
      is_pinned: false // 排除置顶留言
    }
    
    const response = await messageApi.getMessageList(params)
    
    if (pageData.current === 1) {
      messageList.value = response.data.messages
    } else {
      messageList.value.push(...response.data.messages)
    }
    
    finished.value = response.data.pagination.current_page >= response.data.pagination.total_pages
    pageData.current++
  } catch (error) {
    showToast('加载留言列表失败')
    console.error('加载留言列表失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 加载通知
const loadNotifications = async () => {
  try {
    // 这里应该调用通知API，暂时模拟数据
    notifications.value = []
  } catch (error) {
    console.error('加载通知失败:', error)
  }
}

// 加载未读数量
const loadUnreadCount = async () => {
  try {
    const response = await messageApi.getUnreadCount()
    unreadCount.value = response.data.count
  } catch (error) {
    console.error('加载未读数量失败:', error)
  }
}

// 刷新留言
const refreshMessages = () => {
  pageData.current = 1
  finished.value = false
  loadPinnedMessages()
  loadMessages()
  loadUnreadCount()
}

// 创建留言
const createMessage = async () => {
  try {
    await messageApi.createMessage(messageForm)
    showToast('留言发布成功')
    showCreateMessage.value = false
    resetMessageForm()
    refreshMessages()
  } catch (error) {
    showToast('留言发布失败')
    console.error('留言发布失败:', error)
  }
}

// 重置表单
const resetMessageForm = () => {
  Object.assign(messageForm, {
    title: '',
    content: '',
    category: 'general',
    priority: 'normal',
    is_pinned: false
  })
}

// 搜索留言
const onSearch = () => {
  pageData.current = 1
  finished.value = false
  loadMessages()
}

// 清除搜索
const onClear = () => {
  searchQuery.value = ''
  pageData.current = 1
  finished.value = false
  loadMessages()
}

// 分类切换
const onCategoryChange = () => {
  pageData.current = 1
  finished.value = false
  loadMessages()
}

// 添加反应
const addReaction = async (messageId: string, reactionType: string) => {
  try {
    await messageApi.addReaction(messageId, { reaction_type: reactionType })
    showToast('反应添加成功')
    refreshMessages()
  } catch (error) {
    showToast('操作失败')
    console.error('添加反应失败:', error)
  }
}

// 查看留言详情
const viewMessageDetail = (messageId: string) => {
  router.push(`/message/${messageId}`)
}

// 显示评论
const showComments = (messageId: string) => {
  router.push(`/message/${messageId}#comments`)
}

// 全部已读
const markAllAsRead = async () => {
  try {
    await messageApi.markAllAsRead()
    showToast('已标记全部为已读')
    loadUnreadCount()
    refreshMessages()
  } catch (error) {
    showToast('操作失败')
    console.error('标记已读失败:', error)
  }
}

// 选择器确认事件
const onCategoryConfirm = ({ selectedValues }) => {
  messageForm.category = selectedValues[0]
  showCategoryPicker.value = false
}

const onPriorityConfirm = ({ selectedValues }) => {
  messageForm.priority = selectedValues[0]
  showPriorityPicker.value = false
}

// 工具函数
const formatTime = (timeStr: string) => {
  const time = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - time.getTime()
  
  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前'
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前'
  } else {
    return time.toLocaleDateString('zh-CN')
  }
}

const getCategoryText = (category: string) => {
  const categoryMap = {
    general: '一般',
    urgent: '紧急',
    reminder: '提醒',
    family_news: '家庭动态',
    celebration: '庆祝',
    other: '其他'
  }
  return categoryMap[category] || category
}

const getPriorityText = (priority: string) => {
  const priorityMap = {
    low: '低',
    normal: '普通',
    high: '高',
    urgent: '紧急'
  }
  return priorityMap[priority] || priority
}

const getPriorityType = (priority: string) => {
  const typeMap = {
    low: 'default',
    normal: 'primary',
    high: 'warning',
    urgent: 'danger'
  }
  return typeMap[priority] || 'default'
}

const getUserName = (userId: string) => {
  // 这里应该从用户信息中获取，暂时返回默认值
  return '家庭成员'
}

const getUserAvatar = (userId: string) => {
  // 这里应该从用户信息中获取，暂时返回默认头像
  return ''
}
</script>

<style scoped>
.message-page {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.filter-section {
  background: white;
  position: sticky;
  top: 46px;
  z-index: 100;
}

.filter-tabs {
  padding: 0 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 16px 12px;
  font-size: 16px;
  color: #323233;
}

.pinned-section {
  margin-bottom: 8px;
}

.pinned-messages,
.messages-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.message-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.message-card.pinned {
  border-left: 4px solid #ffa940;
}

.message-card.unread {
  border-left: 4px solid #1890ff;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.timestamp {
  font-size: 12px;
  color: #969799;
}

.message-badges {
  display: flex;
  gap: 4px;
}

.message-content {
  margin-bottom: 12px;
}

.message-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.message-text {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #646566;
  line-height: 1.5;
}

.attachments {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}

.more-attachments {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: #f2f3f5;
  border-radius: 4px;
  font-size: 12px;
  color: #646566;
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.message-actions {
  display: flex;
  gap: 8px;
}

.create-message-form {
  padding: 24px;
}

.create-message-form h3 {
  text-align: center;
  margin-bottom: 24px;
  color: #323233;
}

.form-actions {
  margin-top: 24px;
}

.notifications-panel {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.notifications-list {
  flex: 1;
  overflow-y: auto;
}

.notification-item {
  padding: 12px;
  border-bottom: 1px solid #ebedf0;
}

.notification-item.unread {
  background: #f0f9ff;
}

.notification-content h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #323233;
}

.notification-content p {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #646566;
}

.notification-time {
  font-size: 11px;
  color: #969799;
}
</style>