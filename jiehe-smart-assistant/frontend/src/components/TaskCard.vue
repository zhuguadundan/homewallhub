<template>
  <div 
    class="task-card" 
    :class="[`priority-${task.priority}`, `status-${task.status}`]"
    @click="$emit('click', task)"
  >
    <!-- 任务头部 -->
    <div class="task-header">
      <div class="task-priority">
        <van-tag 
          :color="getPriorityColor(task.priority)"
          size="mini"
        >
          {{ getPriorityText(task.priority) }}
        </van-tag>
      </div>
      <div class="task-actions">
        <van-icon 
          name="more-o" 
          @click.stop="$emit('show-actions', task)"
        />
      </div>
    </div>

    <!-- 任务标题 -->
    <h4 class="task-title">{{ task.title }}</h4>

    <!-- 任务描述 -->
    <p class="task-description" v-if="task.description">
      {{ task.description }}
    </p>

    <!-- 任务标签 -->
    <div class="task-tags" v-if="task.tags && task.tags.length > 0">
      <van-tag 
        v-for="tag in task.tags" 
        :key="tag"
        size="mini"
        plain
      >
        {{ tag }}
      </van-tag>
    </div>

    <!-- 任务信息 -->
    <div class="task-info">
      <!-- 负责人 -->
      <div class="assignee-info" v-if="task.assignedTo">
        <van-image
          class="assignee-avatar"
          :src="task.assigneeAvatar || getDefaultAvatar(task.assigneeName || '')"
          round
          width="20"
          height="20"
        />
        <span class="assignee-name">{{ task.assigneeName }}</span>
      </div>

      <!-- 截止时间 -->
      <div class="due-date" v-if="task.dueDate">
        <van-icon name="clock-o" />
        <span 
          class="due-text" 
          :class="{ 'overdue': isOverdue, 'due-soon': isDueSoon }"
        >
          {{ formatDueDate(task.dueDate) }}
        </span>
      </div>
    </div>

    <!-- 任务状态操作 -->
    <div class="task-status-actions">
      <van-button 
        v-if="task.status === 'pending'"
        size="mini"
        type="primary"
        @click.stop="$emit('update-status', task.id, 'in_progress')"
      >
        开始
      </van-button>
      
      <van-button 
        v-else-if="task.status === 'in_progress'"
        size="mini"
        type="success"
        @click.stop="$emit('update-status', task.id, 'completed')"
      >
        完成
      </van-button>
      
      <van-button 
        v-else-if="task.status === 'completed'"
        size="mini"
        plain
        @click.stop="$emit('update-status', task.id, 'pending')"
      >
        重新打开
      </van-button>

      <!-- 分配按钮 -->
      <van-button 
        v-if="!task.assignedTo"
        size="mini"
        plain
        @click.stop="$emit('assign', task)"
      >
        分配
      </van-button>
    </div>

    <!-- 子任务进度 -->
    <div class="subtask-progress" v-if="task.subtasks && task.subtasks.length > 0">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${subtaskProgress}%` }"
        ></div>
      </div>
      <span class="progress-text">
        {{ completedSubtasks }}/{{ task.subtasks.length }} 子任务
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// import { formatDate, getDefaultAvatar } from '@/utils/date'

// 临时工具函数
const formatDate = (date: Date, format: string) => {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

const getDefaultAvatar = (name: string) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
}
import type { ITask } from '@/types/task'

interface Props {
  task: ITask
}

interface Emits {
  (e: 'click', task: ITask): void
  (e: 'update-status', taskId: string, status: string): void
  (e: 'assign', task: ITask): void
  (e: 'show-actions', task: ITask): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

// 计算属性
const isOverdue = computed(() => {
  if (!props.task.dueDate) return false
  return new Date(props.task.dueDate) < new Date() && props.task.status !== 'completed'
})

const isDueSoon = computed(() => {
  if (!props.task.dueDate || isOverdue.value) return false
  const dueDate = new Date(props.task.dueDate)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return dueDate <= tomorrow
})

const completedSubtasks = computed(() => {
  if (!props.task.subtasks) return 0
  return props.task.subtasks.filter(subtask => subtask.completed).length
})

const subtaskProgress = computed(() => {
  if (!props.task.subtasks || props.task.subtasks.length === 0) return 0
  return (completedSubtasks.value / props.task.subtasks.length) * 100
})

// 方法
const getPriorityText = (priority: string): string => {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '急'
  }
  return map[priority] || '中'
}

const getPriorityColor = (priority: string): string => {
  const map: Record<string, string> = {
    low: '#52c41a',
    medium: '#1890ff',
    high: '#fa8c16',
    urgent: '#f5222d'
  }
  return map[priority] || '#1890ff'
}

const formatDueDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === -1) return '昨天'
  if (diffDays < -1) return `逾期${Math.abs(diffDays)}天`
  if (diffDays <= 7) return `${diffDays}天后`
  
  return formatDate(date, 'MM-DD')
}
</script>

<style scoped>
.task-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  cursor: pointer;
  border-left: 3px solid transparent;
}

.task-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.task-card.priority-low {
  border-left-color: #52c41a;
}

.task-card.priority-medium {
  border-left-color: #1890ff;
}

.task-card.priority-high {
  border-left-color: #fa8c16;
}

.task-card.priority-urgent {
  border-left-color: #f5222d;
}

.task-card.status-completed {
  opacity: 0.7;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.task-description {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-tags {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 11px;
  color: #666;
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.assignee-avatar {
  flex-shrink: 0;
}

.assignee-name {
  font-size: 11px;
  color: #666;
}

.due-date {
  display: flex;
  align-items: center;
  gap: 2px;
}

.due-text.overdue {
  color: #f5222d;
  font-weight: 500;
}

.due-text.due-soon {
  color: #fa8c16;
  font-weight: 500;
}

.task-status-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.subtask-progress {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.progress-bar {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: #1890ff;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: #666;
}
</style>