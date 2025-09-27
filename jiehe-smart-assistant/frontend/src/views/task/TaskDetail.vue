<template>
  <div class="task-detail" v-if="task">
    <!-- 头部导航 -->
    <nav-bar 
      :title="task.title" 
      left-arrow 
      @click-left="router.back()"
      right-text="编辑"
      @click-right="showEditDialog = true"
    />

    <!-- 任务主要信息 -->
    <div class="task-main-info">
      <div class="task-header">
        <h1 class="task-title">{{ task.title }}</h1>
        <div class="task-meta">
          <van-tag 
            :color="getPriorityColor(task.priority)"
            size="medium"
          >
            {{ getPriorityText(task.priority) }}
          </van-tag>
          <van-tag 
            :color="getStatusColor(task.status)"
            size="medium"
          >
            {{ getStatusText(task.status) }}
          </van-tag>
        </div>
      </div>

      <!-- 任务描述 -->
      <div class="task-description" v-if="task.description">
        <h3>任务描述</h3>
        <p>{{ task.description }}</p>
      </div>

      <!-- 任务信息卡片 -->
      <div class="task-info-cards">
        <!-- 负责人 -->
        <div class="info-card" v-if="task.assignedTo">
          <div class="card-header">
            <van-icon name="contact" />
            <span>负责人</span>
          </div>
          <div class="card-content">
            <van-image
              class="assignee-avatar"
              :src="task.assigneeAvatar || getDefaultAvatar(task.assigneeName || '')"
              round
              width="40"
              height="40"
            />
            <span class="assignee-name">{{ task.assigneeName }}</span>
          </div>
        </div>

        <!-- 截止时间 -->
        <div class="info-card" v-if="task.dueDate">
          <div class="card-header">
            <van-icon name="clock-o" />
            <span>截止时间</span>
          </div>
          <div class="card-content">
            <span 
              class="due-date" 
              :class="{ 'overdue': isOverdue, 'due-soon': isDueSoon }"
            >
              {{ formatDate(task.dueDate) }}
            </span>
          </div>
        </div>

        <!-- 预估工时 -->
        <div class="info-card" v-if="task.estimatedHours">
          <div class="card-header">
            <van-icon name="clock" />
            <span>预估工时</span>
          </div>
          <div class="card-content">
            <span>{{ task.estimatedHours }}小时</span>
            <span v-if="task.actualHours" class="actual-hours">
              / 实际{{ task.actualHours }}小时
            </span>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      <div class="task-tags" v-if="task.tags && task.tags.length > 0">
        <h3>标签</h3>
        <div class="tags-list">
          <van-tag 
            v-for="tag in task.tags" 
            :key="tag"
            plain
          >
            {{ tag }}
          </van-tag>
        </div>
      </div>
    </div>

    <!-- 子任务 -->
    <div class="subtasks-section" v-if="task.subtasks && task.subtasks.length > 0">
      <div class="section-header">
        <h3>子任务 ({{ completedSubtasks }}/{{ task.subtasks.length }})</h3>
        <van-button 
          size="small" 
          type="primary" 
          plain
          @click="showAddSubtaskDialog = true"
        >
          添加
        </van-button>
      </div>
      
      <div class="subtasks-list">
        <div 
          v-for="subtask in task.subtasks"
          :key="subtask.id"
          class="subtask-item"
        >
          <van-checkbox 
            :model-value="subtask.completed"
            @update:model-value="updateSubtaskStatus(subtask.id, $event)"
          />
          <span 
            class="subtask-title"
            :class="{ completed: subtask.completed }"
          >
            {{ subtask.title }}
          </span>
        </div>
      </div>
    </div>

    <!-- 附件 -->
    <div class="attachments-section" v-if="task.attachments && task.attachments.length > 0">
      <div class="section-header">
        <h3>附件 ({{ task.attachments.length }})</h3>
        <van-button 
          size="small" 
          type="primary" 
          plain
          @click="$refs.fileInput.click()"
        >
          上传
        </van-button>
      </div>
      
      <div class="attachments-list">
        <div 
          v-for="attachment in task.attachments"
          :key="attachment.id"
          class="attachment-item"
        >
          <van-icon name="description" />
          <div class="attachment-info">
            <span class="file-name">{{ attachment.fileName }}</span>
            <span class="file-size">{{ formatFileSize(attachment.fileSize) }}</span>
          </div>
          <van-button 
            size="mini" 
            @click="downloadAttachment(attachment)"
          >
            下载
          </van-button>
        </div>
      </div>
    </div>

    <!-- 评论 -->
    <div class="comments-section">
      <div class="section-header">
        <h3>评论 ({{ task.comments?.length || 0 }})</h3>
      </div>
      
      <!-- 添加评论 -->
      <div class="add-comment">
        <van-field
          v-model="newComment"
          type="textarea"
          placeholder="添加评论..."
          rows="3"
        />
        <van-button 
          type="primary" 
          size="small"
          @click="addComment"
          :disabled="!newComment.trim()"
        >
          发表
        </van-button>
      </div>

      <!-- 评论列表 -->
      <div class="comments-list" v-if="task.comments && task.comments.length > 0">
        <div 
          v-for="comment in task.comments"
          :key="comment.id"
          class="comment-item"
        >
          <van-image
            class="comment-avatar"
            :src="comment.createdByAvatar || getDefaultAvatar(comment.createdByName)"
            round
            width="32"
            height="32"
          />
          <div class="comment-content">
            <div class="comment-header">
              <span class="author">{{ comment.createdByName }}</span>
              <span class="time">{{ formatRelativeTime(comment.createdAt) }}</span>
            </div>
            <p class="comment-text">{{ comment.content }}</p>
          </div>
        </div>
      </div>

      <van-empty 
        v-else 
        description="暂无评论" 
        :image-size="60"
      />
    </div>

    <!-- 底部操作栏 -->
    <van-action-bar>
      <van-action-bar-icon 
        icon="chat-o" 
        :text="`${task.comments?.length || 0}`"
        @click="scrollToComments"
      />
      <van-action-bar-icon 
        icon="star-o" 
        text="收藏"
        @click="toggleFavorite"
      />
      <van-action-bar-button
        v-if="task.status === 'pending'"
        type="warning"
        text="开始任务"
        @click="updateStatus('in_progress')"
      />
      <van-action-bar-button
        v-else-if="task.status === 'in_progress'"
        type="danger"
        text="完成任务"
        @click="updateStatus('completed')"
      />
      <van-action-bar-button
        v-else
        type="primary"
        text="重新打开"
        @click="updateStatus('pending')"
      />
    </van-action-bar>

    <!-- 隐藏的文件输入 -->
    <input 
      ref="fileInput"
      type="file" 
      multiple 
      style="display: none"
      @change="handleFileUpload"
    />

    <!-- 编辑任务弹窗 -->
    <van-dialog
      v-model:show="showEditDialog"
      title="编辑任务"
      show-cancel-button
      @confirm="saveTask"
    >
      <!-- 编辑表单内容 -->
      <van-form>
        <van-field
          v-model="editForm.title"
          label="任务标题"
          placeholder="请输入任务标题"
          required
        />
        <van-field
          v-model="editForm.description"
          type="textarea"
          label="任务描述"
          placeholder="请输入任务描述"
        />
        <!-- 其他编辑字段... -->
      </van-form>
    </van-dialog>

    <!-- 添加子任务弹窗 -->
    <van-dialog
      v-model:show="showAddSubtaskDialog"
      title="添加子任务"
      show-cancel-button
      @confirm="addSubtask"
    >
      <van-field
        v-model="newSubtaskTitle"
        placeholder="请输入子任务标题"
        required
      />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { useTaskStore } from '@/stores/task'
import { formatDate, formatRelativeTime, getDefaultAvatar } from '@/utils/date'
import type { ITask } from '@/types/task'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()

// 响应式数据
const task = ref<ITask | null>(null)
const loading = ref(false)
const showEditDialog = ref(false)
const showAddSubtaskDialog = ref(false)
const newComment = ref('')
const newSubtaskTitle = ref('')

// 编辑表单
const editForm = ref({
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  estimatedHours: 0
})

// 计算属性
const isOverdue = computed(() => {
  if (!task.value?.dueDate) return false
  return new Date(task.value.dueDate) < new Date() && task.value.status !== 'completed'
})

const isDueSoon = computed(() => {
  if (!task.value?.dueDate || isOverdue.value) return false
  const dueDate = new Date(task.value.dueDate)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return dueDate <= tomorrow
})

const completedSubtasks = computed(() => {
  if (!task.value?.subtasks) return 0
  return task.value.subtasks.filter(subtask => subtask.completed).length
})

// 方法
const loadTask = async () => {
  try {
    loading.value = true
    const taskId = route.params.id as string
    task.value = await taskStore.getTaskDetail(taskId)
    initEditForm()
  } catch (error) {
    showToast('加载任务详情失败')
    console.error('加载任务详情失败:', error)
  } finally {
    loading.value = false
  }
}

const initEditForm = () => {
  if (task.value) {
    editForm.value = {
      title: task.value.title,
      description: task.value.description || '',
      priority: task.value.priority,
      dueDate: task.value.dueDate || '',
      estimatedHours: task.value.estimatedHours || 0
    }
  }
}

const updateStatus = async (status: string) => {
  if (!task.value) return
  
  try {
    await taskStore.updateTaskStatus(task.value.id, status)
    task.value.status = status as any
    showSuccessToast('任务状态更新成功')
  } catch (error) {
    showToast('更新失败')
    console.error('更新任务状态失败:', error)
  }
}

const addComment = async () => {
  if (!task.value || !newComment.value.trim()) return
  
  try {
    // TODO: 调用API添加评论
    showSuccessToast('评论添加成功')
    newComment.value = ''
    // 重新加载任务详情
    loadTask()
  } catch (error) {
    showToast('添加评论失败')
    console.error('添加评论失败:', error)
  }
}

const getPriorityText = (priority: string) => {
  const map: Record<string, string> = {
    low: '低优先级',
    medium: '中优先级',
    high: '高优先级',
    urgent: '紧急'
  }
  return map[priority] || '中优先级'
}

const getPriorityColor = (priority: string) => {
  const map: Record<string, string> = {
    low: '#52c41a',
    medium: '#1890ff', 
    high: '#fa8c16',
    urgent: '#f5222d'
  }
  return map[priority] || '#1890ff'
}

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待办',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || '待办'
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending: '#faad14',
    in_progress: '#1890ff',
    completed: '#52c41a',
    cancelled: '#d9d9d9'
  }
  return map[status] || '#faad14'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  loadTask()
})
</script>

<style scoped>
.task-detail {
  min-height: 100vh;
  background-color: #f8f8f8;
  padding-bottom: 70px;
}

.task-main-info {
  margin: 16px;
  padding: 20px;
  background: white;
  border-radius: 12px;
}

.task-header {
  margin-bottom: 20px;
}

.task-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  gap: 8px;
}

.task-description h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
}

.task-description p {
  margin: 0;
  line-height: 1.6;
  color: #333;
}

.task-info-cards {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.info-card {
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assignee-name {
  font-weight: 500;
  color: #333;
}

.due-date.overdue {
  color: #f5222d;
  font-weight: 500;
}

.due-date.due-soon {
  color: #fa8c16;
  font-weight: 500;
}

.actual-hours {
  color: #666;
  font-size: 12px;
}

.task-tags {
  margin-top: 20px;
}

.task-tags h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subtasks-section,
.attachments-section,
.comments-section {
  margin: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.subtask-item:last-child {
  border-bottom: none;
}

.subtask-title.completed {
  text-decoration: line-through;
  color: #999;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.attachment-item:last-child {
  border-bottom: none;
}

.attachment-info {
  flex: 1;
}

.file-name {
  display: block;
  font-weight: 500;
  color: #333;
}

.file-size {
  display: block;
  font-size: 12px;
  color: #999;
}

.add-comment {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.author {
  font-weight: 500;
  color: #333;
}

.time {
  font-size: 12px;
  color: #999;
}

.comment-text {
  margin: 0;
  line-height: 1.4;
  color: #666;
}
</style>