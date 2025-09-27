<template>
  <div class="notification-center">
    <van-nav-bar title="通知中心" left-arrow @click-left="$router.go(-1)">
      <template #right>
        <van-icon name="setting-o" @click="showSettings = true" />
      </template>
    </van-nav-bar>

    <!-- 统计信息 -->
    <div class="stats-section">
      <van-grid :border="false" :column-num="3">
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">{{ unreadCount }}</div>
            <div class="stat-label">未读通知</div>
          </div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">{{ todayCount }}</div>
            <div class="stat-label">今日通知</div>
          </div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">{{ mentionCount }}</div>
            <div class="stat-label">@我的消息</div>
          </div>
        </van-grid-item>
      </van-grid>
    </div>

    <!-- 快捷操作 -->
    <div class="actions-section">
      <van-button
        v-if="unreadCount > 0"
        type="primary"
        size="small"
        @click="markAllAsRead"
        :loading="markingAllRead"
      >
        全部标记为已读
      </van-button>
      
      <van-button
        size="small"
        plain
        @click="refreshNotifications"
        :loading="refreshing"
      >
        刷新
      </van-button>
    </div>

    <!-- 筛选标签 -->
    <div class="filter-section">
      <van-tabs v-model:active="activeTab" @click-tab="onTabChange">
        <van-tab title="全部" name="all" :badge="allCount" />
        <van-tab title="未读" name="unread" :badge="unreadCount" />
        <van-tab title="@提醒" name="mention" :badge="mentionCount" />
        <van-tab title="系统" name="system" />
      </van-tabs>
    </div>

    <!-- 通知列表 -->
    <div class="notifications-list">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="onLoadMore"
        >
          <div
            v-for="notification in filteredNotifications"
            :key="notification.id"
            class="notification-item"
            :class="{ unread: !notification.is_read }"
            @click="handleNotificationClick(notification)"
          >
            <!-- 通知图标 -->
            <div class="notification-icon">
              <van-icon 
                :name="getNotificationIcon(notification.type)" 
                :color="getNotificationColor(notification.type)"
                size="24"
              />
              <div v-if="!notification.is_read" class="unread-dot"></div>
            </div>

            <!-- 通知内容 -->
            <div class="notification-content">
              <div class="notification-header">
                <span class="notification-title">{{ notification.title }}</span>
                <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
              </div>
              
              <div class="notification-body">
                {{ notification.content }}
              </div>

              <!-- 用户信息 -->
              <div v-if="notification.from_user" class="notification-user">
                <van-image
                  :src="notification.from_user.avatar"
                  width="20"
                  height="20"
                  round
                  fit="cover"
                />
                <span>{{ notification.from_user.name }}</span>
              </div>

              <!-- 操作按钮 -->
              <div class="notification-actions">
                <van-button
                  v-if="!notification.is_read"
                  size="mini"
                  type="primary"
                  plain
                  @click.stop="markAsRead(notification.id)"
                >
                  标记已读
                </van-button>
                
                <van-button
                  v-if="notification.action_url"
                  size="mini"
                  type="primary"
                  @click.stop="handleAction(notification)"
                >
                  查看详情
                </van-button>
                
                <van-button
                  size="mini"
                  plain
                  @click.stop="deleteNotification(notification.id)"
                >
                  删除
                </van-button>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <van-empty 
            v-if="!loading && filteredNotifications.length === 0"
            :image="getEmptyImage()"
            :description="getEmptyDescription()"
          />
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 设置弹窗 -->
    <van-popup v-model:show="showSettings" position="bottom">
      <div class="settings-panel">
        <div class="settings-header">
          <span>通知设置</span>
          <van-icon name="cross" @click="showSettings = false" />
        </div>
        
        <div class="settings-content">
          <van-cell-group>
            <van-cell title="接收新留言通知">
              <template #right-icon>
                <van-switch v-model="settings.messageNotification" />
              </template>
            </van-cell>
            
            <van-cell title="接收@提醒通知">
              <template #right-icon>
                <van-switch v-model="settings.mentionNotification" />
              </template>
            </van-cell>
            
            <van-cell title="接收任务分配通知">
              <template #right-icon>
                <van-switch v-model="settings.taskNotification" />
              </template>
            </van-cell>
            
            <van-cell title="接收日历提醒">
              <template #right-icon>
                <van-switch v-model="settings.calendarNotification" />
              </template>
            </van-cell>
            
            <van-cell title="接收系统通知">
              <template #right-icon>
                <van-switch v-model="settings.systemNotification" />
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group title="通知方式">
            <van-cell title="声音提醒">
              <template #right-icon>
                <van-switch v-model="settings.soundEnabled" />
              </template>
            </van-cell>
            
            <van-cell title="震动提醒">
              <template #right-icon>
                <van-switch v-model="settings.vibrationEnabled" />
              </template>
            </van-cell>
            
            <van-cell 
              title="免打扰时间"
              :value="settings.doNotDisturbTime"
              is-link
              @click="showTimePicker = true"
            />
          </van-cell-group>

          <div class="settings-actions">
            <van-button
              type="primary"
              block
              @click="saveSettings"
              :loading="savingSettings"
            >
              保存设置
            </van-button>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 时间选择器 -->
    <van-popup v-model:show="showTimePicker" position="bottom">
      <van-time-picker
        v-model="doNotDisturbTime"
        title="选择免打扰时间"
        @confirm="onTimeConfirm"
        @cancel="showTimePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { notificationApi } from '@/api/notification'
import { userStore } from '@/stores/user'
import { formatTime } from '@/utils/format'
import { socketService } from '@/services/socket'

const router = useRouter()

// 数据状态
const notifications = ref<any[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const markingAllRead = ref(false)
const savingSettings = ref(false)

// 界面状态
const activeTab = ref('all')
const showSettings = ref(false)
const showTimePicker = ref(false)
const doNotDisturbTime = ref(['22', '00'])

// 分页参数
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

// 通知设置
const settings = reactive({
  messageNotification: true,
  mentionNotification: true,
  taskNotification: true,
  calendarNotification: true,
  systemNotification: true,
  soundEnabled: true,
  vibrationEnabled: true,
  doNotDisturbTime: '22:00-07:00'
})

// 计算属性
const filteredNotifications = computed(() => {
  switch (activeTab.value) {
    case 'unread':
      return notifications.value.filter(n => !n.is_read)
    case 'mention':
      return notifications.value.filter(n => n.type === 'mention')
    case 'system':
      return notifications.value.filter(n => n.type === 'system')
    default:
      return notifications.value
  }
})

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.is_read).length
})

const todayCount = computed(() => {
  const today = new Date().toDateString()
  return notifications.value.filter(n => 
    new Date(n.created_at).toDateString() === today
  ).length
})

const mentionCount = computed(() => {
  return notifications.value.filter(n => 
    n.type === 'mention' && !n.is_read
  ).length
})

const allCount = computed(() => notifications.value.length)

// 方法
const loadNotifications = async (reset = false) => {
  if (loading.value) return
  
  try {
    loading.value = true
    
    if (reset) {
      pagination.page = 1
      finished.value = false
    }
    
    const res = await notificationApi.getList({
      page: pagination.page,
      limit: pagination.limit,
      type: activeTab.value === 'all' ? undefined : activeTab.value
    })
    
    if (reset) {
      notifications.value = res.data.list
    } else {
      notifications.value.push(...res.data.list)
    }
    
    pagination.total = res.data.total
    
    // 检查是否还有更多数据
    if (notifications.value.length >= pagination.total) {
      finished.value = true
    } else {
      pagination.page++
    }
  } catch (error) {
    console.error('加载通知失败:', error)
    uni.showToast({
      title: '加载失败',
      icon: 'error'
    })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  loadNotifications(true)
}

const onLoadMore = () => {
  if (!finished.value) {
    loadNotifications()
  }
}

const refreshNotifications = () => {
  refreshing.value = true
  loadNotifications(true)
}

const onTabChange = (name: string) => {
  activeTab.value = name
  loadNotifications(true)
}

const markAsRead = async (notificationId: string) => {
  try {
    await notificationApi.markAsRead(notificationId)
    
    // 更新本地状态
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.is_read = true
    }
    
    uni.showToast({
      title: '已标记为已读',
      icon: 'success'
    })
  } catch (error) {
    console.error('标记已读失败:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'error'
    })
  }
}

const markAllAsRead = async () => {
  try {
    markingAllRead.value = true
    
    await notificationApi.markAllAsRead()
    
    // 更新本地状态
    notifications.value.forEach(n => {
      n.is_read = true
    })
    
    uni.showToast({
      title: '全部标记为已读',
      icon: 'success'
    })
  } catch (error) {
    console.error('批量标记已读失败:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'error'
    })
  } finally {
    markingAllRead.value = false
  }
}

const deleteNotification = async (notificationId: string) => {
  try {
    await notificationApi.delete(notificationId)
    
    // 从本地列表中移除
    const index = notifications.value.findIndex(n => n.id === notificationId)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
    
    uni.showToast({
      title: '删除成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('删除通知失败:', error)
    uni.showToast({
      title: '删除失败',
      icon: 'error'
    })
  }
}

const handleNotificationClick = (notification: any) => {
  // 如果未读，标记为已读
  if (!notification.is_read) {
    markAsRead(notification.id)
  }
  
  // 跳转到相关页面
  if (notification.action_url) {
    handleAction(notification)
  }
}

const handleAction = (notification: any) => {
  if (notification.action_url) {
    router.push(notification.action_url)
  }
}

const getNotificationIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    'message': 'chat-o',
    'mention': 'friends-o',
    'task': 'todo-list-o',
    'calendar': 'calendar-o',
    'system': 'setting-o',
    'comment': 'comment-o',
    'reaction': 'like-o',
    'family': 'home-o'
  }
  return iconMap[type] || 'bell-o'
}

const getNotificationColor = (type: string) => {
  const colorMap: Record<string, string> = {
    'message': '#1989fa',
    'mention': '#ff6b35',
    'task': '#07c160',
    'calendar': '#ff976a',
    'system': '#646566',
    'comment': '#1989fa',
    'reaction': '#ee0a24',
    'family': '#ff6b35'
  }
  return colorMap[type] || '#969799'
}

const getEmptyImage = () => {
  switch (activeTab.value) {
    case 'unread':
      return 'search'
    case 'mention':
      return 'network'
    case 'system':
      return 'default'
    default:
      return 'default'
  }
}

const getEmptyDescription = () => {
  switch (activeTab.value) {
    case 'unread':
      return '暂无未读通知'
    case 'mention':
      return '暂无@提醒'
    case 'system':
      return '暂无系统通知'
    default:
      return '暂无通知'
  }
}

const loadSettings = async () => {
  try {
    const res = await notificationApi.getSettings()
    Object.assign(settings, res.data)
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

const saveSettings = async () => {
  try {
    savingSettings.value = true
    
    await notificationApi.updateSettings(settings)
    
    showSettings.value = false
    
    uni.showToast({
      title: '设置保存成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('保存设置失败:', error)
    uni.showToast({
      title: '保存失败',
      icon: 'error'
    })
  } finally {
    savingSettings.value = false
  }
}

const onTimeConfirm = () => {
  settings.doNotDisturbTime = `${doNotDisturbTime.value[0]}:${doNotDisturbTime.value[1]}-07:00`
  showTimePicker.value = false
}

// Socket.IO 事件监听
const handleNewNotification = (data: any) => {
  // 添加新通知到列表顶部
  notifications.value.unshift(data)
  
  // 如果启用了声音提醒
  if (settings.soundEnabled) {
    // 播放通知声音
    uni.playBackgroundAudio({
      dataUrl: '/static/sounds/notification.mp3'
    })
  }
  
  // 如果启用了震动提醒
  if (settings.vibrationEnabled) {
    uni.vibrateShort()
  }
}

onMounted(() => {
  loadNotifications(true)
  loadSettings()
  
  // 监听实时通知
  socketService.on('notification:new', handleNewNotification)
  socketService.on('message:mention', handleNewNotification)
  socketService.on('comment:mention', handleNewNotification)
})

onUnmounted(() => {
  // 移除事件监听
  socketService.off('notification:new', handleNewNotification)
  socketService.off('message:mention', handleNewNotification)
  socketService.off('comment:mention', handleNewNotification)
})
</script>

<style scoped>
.notification-center {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.stats-section {
  background: white;
  margin-bottom: 12px;
  padding: 16px 0;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}

.actions-section {
  padding: 12px 16px;
  background: white;
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
}

.filter-section {
  background: white;
  margin-bottom: 1px;
}

.notifications-list {
  background: white;
}

.notification-item {
  display: flex;
  padding: 16px;
  border-bottom: 1px solid #ebedf0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f7f8fa;
}

.notification-item.unread {
  background-color: #f0f8ff;
}

.notification-icon {
  position: relative;
  margin-right: 12px;
  flex-shrink: 0;
}

.unread-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: #ee0a24;
  border-radius: 50%;
  border: 2px solid white;
}

.notification-content {
  flex: 1;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.notification-title {
  font-weight: 600;
  color: #323233;
  font-size: 14px;
}

.notification-time {
  font-size: 12px;
  color: #969799;
}

.notification-body {
  color: #646566;
  line-height: 1.5;
  margin-bottom: 8px;
  font-size: 14px;
}

.notification-user {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #969799;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.settings-panel {
  max-height: 80vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ebedf0;
  font-weight: 600;
}

.settings-content {
  padding: 16px;
}

.settings-actions {
  margin-top: 24px;
}
</style>