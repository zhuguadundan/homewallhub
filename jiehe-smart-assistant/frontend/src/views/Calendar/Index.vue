<template>
  <div class="calendar-page">
    <!-- 页面头部 -->
    <van-nav-bar
      title="家庭日历"
      left-arrow
      @click-left="$router.go(-1)"
    >
      <template #right>
        <van-icon name="plus" @click="showCreateEvent = true" />
      </template>
    </van-nav-bar>

    <!-- 视图切换 -->
    <div class="view-switcher">
      <van-tabs v-model:active="activeTab" @change="onTabChange">
        <van-tab title="月视图" name="month" />
        <van-tab title="列表视图" name="list" />
        <van-tab title="今日" name="today" />
      </van-tabs>
    </div>

    <!-- 月视图 -->
    <div v-if="activeTab === 'month'" class="month-view">
      <van-calendar
        v-model:show="showCalendar"
        :poppable="false"
        :show-mark="true"
        :show-title="false"
        :show-confirm="false"
        :formatter="calendarFormatter"
        @select="onDateSelect"
      />
      
      <!-- 选中日期的事件列表 -->
      <div v-if="selectedDateEvents.length > 0" class="selected-date-events">
        <h3>{{ formatSelectedDate }} 的事件</h3>
        <div class="event-list">
          <div 
            v-for="event in selectedDateEvents" 
            :key="event.id"
            class="event-item"
            @click="viewEventDetail(event.id)"
          >
            <div class="event-time">
              {{ formatEventTime(event.start_time, event.end_time, event.is_all_day) }}
            </div>
            <div class="event-content">
              <h4 class="event-title">{{ event.title }}</h4>
              <p class="event-desc">{{ event.description }}</p>
              <div class="event-meta">
                <span class="event-type" :class="event.event_type">{{ getEventTypeText(event.event_type) }}</span>
                <span class="event-priority" :class="event.priority">{{ getPriorityText(event.priority) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-if="activeTab === 'list'" class="list-view">
      <!-- 筛选器 -->
      <div class="filter-bar">
        <van-dropdown-menu>
          <van-dropdown-item v-model="filters.event_type" :options="eventTypeOptions" />
          <van-dropdown-item v-model="filters.priority" :options="priorityOptions" />
          <van-dropdown-item v-model="filters.status" :options="statusOptions" />
        </van-dropdown-menu>
      </div>

      <!-- 事件列表 -->
      <van-pull-refresh v-model="refreshing" @refresh="refreshEvents">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadEvents"
        >
          <div class="events-container">
            <div 
              v-for="event in eventList" 
              :key="event.id"
              class="event-card"
              @click="viewEventDetail(event.id)"
            >
              <div class="event-header">
                <div class="event-basic">
                  <h3 class="event-title">{{ event.title }}</h3>
                  <p class="event-desc">{{ event.description }}</p>
                </div>
                <div class="event-status">
                  <span class="status-badge" :class="event.status">{{ getStatusText(event.status) }}</span>
                </div>
              </div>
              
              <div class="event-details">
                <div class="detail-item">
                  <van-icon name="clock-o" />
                  <span>{{ formatEventDateTime(event.start_time, event.end_time, event.is_all_day) }}</span>
                </div>
                <div v-if="event.location" class="detail-item">
                  <van-icon name="location-o" />
                  <span>{{ event.location }}</span>
                </div>
                <div class="detail-item">
                  <van-icon name="label-o" />
                  <span class="event-type">{{ getEventTypeText(event.event_type) }}</span>
                  <span class="event-priority" :class="event.priority">{{ getPriorityText(event.priority) }}</span>
                </div>
              </div>

              <div v-if="event.assigned_to && event.assigned_to.length > 0" class="participants">
                <van-icon name="friends-o" />
                <span>参与者: {{ event.assigned_to.length }}人</span>
              </div>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 今日视图 -->
    <div v-if="activeTab === 'today'" class="today-view">
      <!-- 今日概览 -->
      <div class="today-overview">
        <h2>{{ formatToday }}</h2>
        <div class="today-stats">
          <div class="stat-item">
            <span class="stat-number">{{ todayEvents.length }}</span>
            <span class="stat-label">今日事件</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ upcomingEvents.length }}</span>
            <span class="stat-label">即将到来</span>
          </div>
        </div>
      </div>

      <!-- 今日事件 -->
      <div class="today-events">
        <h3>今日事件</h3>
        <div v-if="todayEvents.length === 0" class="empty-state">
          <van-empty description="今天没有安排事件" />
        </div>
        <div v-else class="timeline">
          <div 
            v-for="event in todayEvents" 
            :key="event.id"
            class="timeline-item"
            :class="{ completed: event.status === 'completed' }"
            @click="viewEventDetail(event.id)"
          >
            <div class="timeline-time">
              {{ formatTime(event.start_time) }}
            </div>
            <div class="timeline-content">
              <h4 class="timeline-title">{{ event.title }}</h4>
              <p class="timeline-desc">{{ event.description }}</p>
              <div class="timeline-meta">
                <span class="event-type">{{ getEventTypeText(event.event_type) }}</span>
                <span v-if="event.location" class="location">{{ event.location }}</span>
              </div>
            </div>
            <div class="timeline-actions">
              <van-button 
                v-if="event.status !== 'completed'"
                size="mini" 
                type="success"
                @click.stop="markAsCompleted(event.id)"
              >
                完成
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 即将到来的事件 -->
      <div class="upcoming-events">
        <h3>即将到来 (7天内)</h3>
        <div v-if="upcomingEvents.length === 0" class="empty-state">
          <van-empty description="暂无即将到来的事件" />
        </div>
        <div v-else class="upcoming-list">
          <div 
            v-for="event in upcomingEvents.slice(0, 5)" 
            :key="event.id"
            class="upcoming-item"
            @click="viewEventDetail(event.id)"
          >
            <div class="upcoming-date">
              {{ formatUpcomingDate(event.start_time) }}
            </div>
            <div class="upcoming-content">
              <h4 class="upcoming-title">{{ event.title }}</h4>
              <div class="upcoming-meta">
                <span class="event-type">{{ getEventTypeText(event.event_type) }}</span>
                <span class="time">{{ formatTime(event.start_time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建事件弹窗 -->
    <van-popup
      v-model:show="showCreateEvent"
      position="bottom"
      :style="{ height: '80%' }"
      round
    >
      <div class="create-event-form">
        <h3>创建新事件</h3>
        <van-form @submit="createEvent">
          <van-field
            v-model="eventForm.title"
            name="title"
            label="事件标题"
            placeholder="请输入事件标题"
            :rules="[{ required: true, message: '请输入事件标题' }]"
          />
          <van-field
            v-model="eventForm.description"
            name="description"
            label="事件描述"
            placeholder="请输入事件描述"
            type="textarea"
            rows="3"
          />
          <van-field
            v-model="eventForm.event_type"
            name="event_type"
            label="事件类型"
            placeholder="选择事件类型"
            readonly
            @click="showEventTypePicker = true"
          />
          <van-field
            v-model="eventForm.priority"
            name="priority"
            label="优先级"
            placeholder="选择优先级"
            readonly
            @click="showPriorityPicker = true"
          />
          <van-field
            v-model="eventForm.location"
            name="location"
            label="地点"
            placeholder="请输入地点"
          />
          <van-field
            v-model="eventForm.start_time"
            name="start_time"
            label="开始时间"
            placeholder="选择开始时间"
            readonly
            @click="showStartTimePicker = true"
          />
          <van-field
            v-model="eventForm.end_time"
            name="end_time"
            label="结束时间"
            placeholder="选择结束时间"
            readonly
            @click="showEndTimePicker = true"
          />
          <van-field name="is_all_day" label="全天事件">
            <template #input>
              <van-switch v-model="eventForm.is_all_day" />
            </template>
          </van-field>
          <div class="form-actions">
            <van-button round block type="primary" native-type="submit">
              创建事件
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 选择器 -->
    <van-popup v-model:show="showEventTypePicker" position="bottom">
      <van-picker
        :columns="eventTypeColumns"
        @confirm="onEventTypeConfirm"
        @cancel="showEventTypePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showPriorityPicker" position="bottom">
      <van-picker
        :columns="priorityColumns"
        @confirm="onPriorityConfirm"
        @cancel="showPriorityPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showStartTimePicker" position="bottom">
      <van-date-picker
        v-model="selectedStartTime"
        @confirm="onStartTimeConfirm"
        @cancel="showStartTimePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showEndTimePicker" position="bottom">
      <van-date-picker
        v-model="selectedEndTime"
        @confirm="onEndTimeConfirm"
        @cancel="showEndTimePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { calendarApi } from '@/api/calendar'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const activeTab = ref('month')
const showCalendar = ref(true)
const showCreateEvent = ref(false)
const showEventTypePicker = ref(false)
const showPriorityPicker = ref(false)
const showStartTimePicker = ref(false)
const showEndTimePicker = ref(false)
const selectedDate = ref(new Date())
const selectedStartTime = ref(new Date())
const selectedEndTime = ref(new Date(Date.now() + 60 * 60 * 1000)) // 默认1小时后
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

const eventList = ref([])
const todayEvents = ref([])
const upcomingEvents = ref([])
const calendarEvents = ref({}) // 按日期分组的事件

const eventForm = reactive({
  title: '',
  description: '',
  event_type: '',
  priority: '',
  location: '',
  start_time: '',
  end_time: '',
  is_all_day: false
})

const filters = reactive({
  event_type: '',
  priority: '',
  status: ''
})

// 分页数据
const pageData = reactive({
  current: 1,
  size: 20
})

// 选项数据
const eventTypeColumns = [
  { text: '会议', value: 'meeting' },
  { text: '生日', value: 'birthday' },
  { text: '节日', value: 'holiday' },
  { text: '提醒', value: 'reminder' },
  { text: '任务', value: 'task' },
  { text: '其他', value: 'other' }
]

const priorityColumns = [
  { text: '低', value: 'low' },
  { text: '中', value: 'medium' },
  { text: '高', value: 'high' },
  { text: '紧急', value: 'urgent' }
]

const eventTypeOptions = [
  { text: '全部类型', value: '' },
  ...eventTypeColumns
]

const priorityOptions = [
  { text: '全部优先级', value: '' },
  ...priorityColumns
]

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '计划中', value: 'planned' },
  { text: '已确认', value: 'confirmed' },
  { text: '已取消', value: 'cancelled' },
  { text: '已完成', value: 'completed' }
]

// 计算属性
const familyId = computed(() => userStore.currentFamily?.id)

const selectedDateEvents = computed(() => {
  const dateStr = formatDateKey(selectedDate.value)
  return calendarEvents.value[dateStr] || []
})

const formatSelectedDate = computed(() => {
  return selectedDate.value.toLocaleDateString('zh-CN')
})

const formatToday = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

// 页面初始化
onMounted(() => {
  if (familyId.value) {
    loadTodayEvents()
    loadUpcomingEvents()
    loadCalendarEvents()
  }
})

// 标签页切换
const onTabChange = (name: string) => {
  if (name === 'list') {
    loadEvents()
  } else if (name === 'today') {
    loadTodayEvents()
    loadUpcomingEvents()
  }
}

// 日期选择
const onDateSelect = (date: Date) => {
  selectedDate.value = date
}

// 加载事件列表
const loadEvents = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const params = {
      page: pageData.current,
      limit: pageData.size,
      ...filters
    }
    
    const response = await calendarApi.getEventList(params)
    
    if (pageData.current === 1) {
      eventList.value = response.data.events
    } else {
      eventList.value.push(...response.data.events)
    }
    
    finished.value = response.data.pagination.current_page >= response.data.pagination.total_pages
    pageData.current++
  } catch (error) {
    showToast('加载事件列表失败')
    console.error('加载事件列表失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 加载今日事件
const loadTodayEvents = async () => {
  try {
    const response = await calendarApi.getTodayEvents()
    todayEvents.value = response.data
  } catch (error) {
    console.error('加载今日事件失败:', error)
  }
}

// 加载即将到来的事件
const loadUpcomingEvents = async () => {
  try {
    const response = await calendarApi.getUpcomingEvents({ days: 7 })
    upcomingEvents.value = response.data
  } catch (error) {
    console.error('加载即将到来的事件失败:', error)
  }
}

// 加载日历事件
const loadCalendarEvents = async () => {
  try {
    const startDate = new Date()
    startDate.setDate(1) // 月初
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1, 0) // 月末
    
    const response = await calendarApi.getEventList({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      limit: 200
    })
    
    // 按日期分组
    const groupedEvents = {}
    response.data.events.forEach(event => {
      const dateKey = formatDateKey(new Date(event.start_time))
      if (!groupedEvents[dateKey]) {
        groupedEvents[dateKey] = []
      }
      groupedEvents[dateKey].push(event)
    })
    
    calendarEvents.value = groupedEvents
  } catch (error) {
    console.error('加载日历事件失败:', error)
  }
}

// 刷新数据
const refreshEvents = () => {
  pageData.current = 1
  finished.value = false
  if (activeTab.value === 'list') {
    loadEvents()
  } else if (activeTab.value === 'today') {
    loadTodayEvents()
    loadUpcomingEvents()
  }
}

// 创建事件
const createEvent = async () => {
  try {
    await calendarApi.createEvent(eventForm)
    showToast('事件创建成功')
    showCreateEvent.value = false
    resetEventForm()
    refreshEvents()
    loadCalendarEvents()
  } catch (error) {
    showToast('事件创建失败')
    console.error('事件创建失败:', error)
  }
}

// 重置表单
const resetEventForm = () => {
  Object.assign(eventForm, {
    title: '',
    description: '',
    event_type: '',
    priority: '',
    location: '',
    start_time: '',
    end_time: '',
    is_all_day: false
  })
}

// 标记为已完成
const markAsCompleted = async (eventId: string) => {
  try {
    await calendarApi.updateEvent(eventId, { status: 'completed' })
    showToast('事件已标记为完成')
    loadTodayEvents()
  } catch (error) {
    showToast('操作失败')
    console.error('标记完成失败:', error)
  }
}

// 查看事件详情
const viewEventDetail = (eventId: string) => {
  router.push(`/calendar/event/${eventId}`)
}

// 日历格式化器
const calendarFormatter = (day: any) => {
  const dateKey = formatDateKey(day.date)
  const events = calendarEvents.value[dateKey] || []
  
  if (events.length > 0) {
    day.bottomInfo = `${events.length}个事件`
    day.className = 'has-events'
  }
  
  return day
}

// 选择器确认事件
const onEventTypeConfirm = ({ selectedValues }) => {
  eventForm.event_type = selectedValues[0]
  showEventTypePicker.value = false
}

const onPriorityConfirm = ({ selectedValues }) => {
  eventForm.priority = selectedValues[0]
  showPriorityPicker.value = false
}

const onStartTimeConfirm = (value: Date) => {
  eventForm.start_time = value.toISOString()
  showStartTimePicker.value = false
}

const onEndTimeConfirm = (value: Date) => {
  eventForm.end_time = value.toISOString()
  showEndTimePicker.value = false
}

// 工具函数
const formatDateKey = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatEventTime = (startTime: string, endTime: string, isAllDay: boolean) => {
  if (isAllDay) return '全天'
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  return `${formatTime(start)} - ${formatTime(end)}`
}

const formatEventDateTime = (startTime: string, endTime: string, isAllDay: boolean) => {
  const start = new Date(startTime)
  const startDate = start.toLocaleDateString('zh-CN')
  
  if (isAllDay) {
    return `${startDate} 全天`
  }
  
  const end = new Date(endTime)
  const endDate = end.toLocaleDateString('zh-CN')
  
  if (startDate === endDate) {
    return `${startDate} ${formatTime(start)} - ${formatTime(end)}`
  } else {
    return `${startDate} ${formatTime(start)} - ${endDate} ${formatTime(end)}`
  }
}

const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const formatUpcomingDate = (dateTime: string) => {
  const date = new Date(dateTime)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return '今天'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return '明天'
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

const getEventTypeText = (type: string) => {
  const typeMap = {
    meeting: '会议',
    birthday: '生日',
    holiday: '节日',
    reminder: '提醒',
    task: '任务',
    other: '其他'
  }
  return typeMap[type] || type
}

const getPriorityText = (priority: string) => {
  const priorityMap = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  }
  return priorityMap[priority] || priority
}

const getStatusText = (status: string) => {
  const statusMap = {
    planned: '计划中',
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成'
  }
  return statusMap[status] || status
}
</script>

<style scoped>
.calendar-page {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.view-switcher {
  background: white;
  position: sticky;
  top: 46px;
  z-index: 100;
}

.month-view {
  background: white;
}

.selected-date-events {
  padding: 16px;
  background: white;
  margin-top: 8px;
}

.selected-date-events h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  cursor: pointer;
}

.event-time {
  min-width: 80px;
  font-size: 12px;
  color: #1890ff;
  font-weight: 500;
}

.event-content {
  flex: 1;
}

.event-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #323233;
}

.event-desc {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #646566;
  line-height: 1.4;
}

.event-meta {
  display: flex;
  gap: 8px;
}

.event-type,
.event-priority {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.event-type {
  background: #f0f9ff;
  color: #1890ff;
}

.event-priority.high {
  background: #fff2e6;
  color: #fa8c16;
}

.event-priority.urgent {
  background: #fff1f0;
  color: #f56565;
}

.filter-bar {
  background: white;
  padding: 0 16px;
}

.list-view {
  padding: 16px;
}

.events-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.event-basic .event-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #323233;
}

.event-basic .event-desc {
  margin: 0;
  font-size: 14px;
  color: #646566;
  line-height: 1.4;
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #646566;
}

.status-badge.confirmed {
  background: #f6ffed;
  color: #52c41a;
}

.status-badge.completed {
  background: #f6ffed;
  color: #52c41a;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #646566;
}

.participants {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #969799;
}

.today-view {
  padding: 16px;
}

.today-overview {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.today-overview h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #323233;
}

.today-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.today-events,
.upcoming-events {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.today-events h3,
.upcoming-events h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.timeline-item.completed {
  opacity: 0.6;
  background: #f6ffed;
}

.timeline-time {
  min-width: 60px;
  font-size: 12px;
  color: #1890ff;
  font-weight: 500;
}

.timeline-content {
  flex: 1;
}

.timeline-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #323233;
}

.timeline-desc {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #646566;
  line-height: 1.4;
}

.timeline-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.timeline-actions {
  display: flex;
  align-items: center;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcoming-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  cursor: pointer;
}

.upcoming-date {
  min-width: 50px;
  font-size: 12px;
  color: #1890ff;
  font-weight: 500;
}

.upcoming-content {
  flex: 1;
}

.upcoming-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #323233;
}

.upcoming-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #646566;
}

.create-event-form {
  padding: 24px;
}

.create-event-form h3 {
  text-align: center;
  margin-bottom: 24px;
  color: #323233;
}

.form-actions {
  margin-top: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

/* 日历自定义样式 */
:deep(.van-calendar__month-mark) {
  color: #1890ff;
}

:deep(.has-events .van-calendar__bottom-info) {
  color: #1890ff;
  font-size: 10px;
}
</style>