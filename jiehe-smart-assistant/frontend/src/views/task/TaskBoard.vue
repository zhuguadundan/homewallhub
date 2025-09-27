<template>
  <div class="task-board">
    <!-- 头部导航 -->
    <nav-bar 
      title="家务任务" 
      left-arrow 
      @click-left="router.back()"
      right-text="新建"
      @click-right="showCreateDialog = true"
    />

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <van-tabs v-model:active="activeFilter" @change="onFilterChange">
        <van-tab title="全部" name="all" />
        <van-tab title="待办" name="pending" />
        <van-tab title="进行中" name="in_progress" />
        <van-tab title="已完成" name="completed" />
      </van-tabs>
      
      <div class="filter-actions">
        <van-button 
          size="small" 
          type="primary" 
          plain
          @click="showFilterSheet = true"
        >
          筛选
        </van-button>
      </div>
    </div>

    <!-- 任务看板 -->
    <div class="task-columns">
      <!-- 待办任务 -->
      <div class="task-column" v-if="showColumn('pending')">
        <div class="column-header">
          <h3>待办 ({{ pendingTasks.length }})</h3>
          <van-icon name="plus" @click="createTask('pending')" />
        </div>
        <div class="task-list">
          <task-card
            v-for="task in pendingTasks"
            :key="task.id"
            :task="task"
            @click="openTaskDetail(task)"
            @update-status="updateTaskStatus"
            @assign="showAssignDialog"
          />
          <van-empty 
            v-if="pendingTasks.length === 0" 
            description="暂无待办任务"
            :image-size="60"
          />
        </div>
      </div>

      <!-- 进行中任务 -->
      <div class="task-column" v-if="showColumn('in_progress')">
        <div class="column-header">
          <h3>进行中 ({{ inProgressTasks.length }})</h3>
          <van-icon name="plus" @click="createTask('in_progress')" />
        </div>
        <div class="task-list">
          <task-card
            v-for="task in inProgressTasks"
            :key="task.id"
            :task="task"
            @click="openTaskDetail(task)"
            @update-status="updateTaskStatus"
            @assign="showAssignDialog"
          />
          <van-empty 
            v-if="inProgressTasks.length === 0" 
            description="暂无进行中任务"
            :image-size="60"
          />
        </div>
      </div>

      <!-- 已完成任务 -->
      <div class="task-column" v-if="showColumn('completed')">
        <div class="column-header">
          <h3>已完成 ({{ completedTasks.length }})</h3>
        </div>
        <div class="task-list">
          <task-card
            v-for="task in completedTasks"
            :key="task.id"
            :task="task"
            @click="openTaskDetail(task)"
            @update-status="updateTaskStatus"
          />
          <van-empty 
            v-if="completedTasks.length === 0" 
            description="暂无已完成任务"
            :image-size="60"
          />
        </div>
      </div>
    </div>

    <!-- 创建任务弹窗 -->
    <van-dialog
      v-model:show="showCreateDialog"
      title="创建任务"
      show-cancel-button
      @confirm="handleCreateTask"
    >
      <van-form @submit="handleCreateTask">
        <van-field
          v-model="newTask.title"
          label="任务标题"
          placeholder="请输入任务标题"
          required
        />
        <van-field
          v-model="newTask.description"
          type="textarea"
          label="任务描述"
          placeholder="请输入任务描述（可选）"
          maxlength="200"
          show-word-limit
        />
        <van-field
          v-model="newTask.priority"
          label="优先级"
          readonly
          @click="showPriorityPicker = true"
          :placeholder="getPriorityText(newTask.priority)"
        />
        <van-field
          v-model="newTask.dueDate"
          label="截止时间"
          readonly
          @click="showDatePicker = true"
          placeholder="选择截止时间（可选）"
        />
        <van-field
          v-model="newTask.assignedTo"
          label="分配给"
          readonly
          @click="showMemberPicker = true"
          placeholder="选择负责人（可选）"
        />
      </van-form>
    </van-dialog>

    <!-- 优先级选择器 -->
    <van-action-sheet
      v-model:show="showPriorityPicker"
      :actions="priorityActions"
      @select="onPrioritySelect"
    />

    <!-- 日期选择器 -->
    <van-calendar
      v-model:show="showDatePicker"
      @confirm="onDateSelect"
    />

    <!-- 成员选择器 -->
    <van-action-sheet
      v-model:show="showMemberPicker"
      :actions="memberActions"
      @select="onMemberSelect"
    />

    <!-- 筛选选项 -->
    <van-action-sheet
      v-model:show="showFilterSheet"
      title="筛选选项"
    >
      <div class="filter-options">
        <van-field
          label="负责人"
          readonly
          :value="filterAssignee"
          @click="showAssigneeFilter = true"
        />
        <van-field
          label="优先级"
          readonly
          :value="filterPriority"
          @click="showPriorityFilter = true"
        />
        <div class="filter-actions-bottom">
          <van-button block @click="resetFilter">重置</van-button>
          <van-button type="primary" block @click="applyFilter">应用</van-button>
        </div>
      </div>
    </van-action-sheet>

    <!-- 任务分配弹窗 -->
    <van-action-sheet
      v-model:show="showAssignSheet"
      title="分配任务"
      :actions="memberActions"
      @select="onTaskAssign"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useTaskStore } from '@/stores/task'
import { useFamilyStore } from '@/stores/family'
import TaskCard from '@/components/TaskCard.vue'
import type { ITask, CreateTaskData } from '@/types/task'

const router = useRouter()
const taskStore = useTaskStore()
const familyStore = useFamilyStore()

// 响应式数据
const activeFilter = ref('all')
const tasks = ref<ITask[]>([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showPriorityPicker = ref(false)
const showDatePicker = ref(false)
const showMemberPicker = ref(false)
const showFilterSheet = ref(false)
const showAssignSheet = ref(false)
const selectedTask = ref<ITask | null>(null)

// 新建任务表单
const newTask = ref<CreateTaskData>({
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  dueDate: '',
  assignedTo: ''
})

// 筛选条件
const filterAssignee = ref('')
const filterPriority = ref('')

// 计算属性
const pendingTasks = computed(() => 
  tasks.value.filter(task => task.status === 'pending')
)

const inProgressTasks = computed(() => 
  tasks.value.filter(task => task.status === 'in_progress')
)

const completedTasks = computed(() => 
  tasks.value.filter(task => task.status === 'completed')
)

const memberActions = computed(() => 
  familyStore.currentMembers.map(member => ({
    name: member.name,
    value: member.id
  }))
)

const priorityActions = [
  { name: '低优先级', value: 'low' },
  { name: '中优先级', value: 'medium' },
  { name: '高优先级', value: 'high' },
  { name: '紧急', value: 'urgent' }
]

// 方法
const showColumn = (status: string) => {
  if (activeFilter.value === 'all') return true
  return activeFilter.value === status
}

const getPriorityText = (priority: string) => {
  const map: Record<string, string> = {
    low: '低优先级',
    medium: '中优先级', 
    high: '高优先级',
    urgent: '紧急'
  }
  return map[priority] || ''
}

const loadTasks = async () => {
  try {
    loading.value = true
    tasks.value = await taskStore.getTasks()
  } catch (error) {
    showToast('加载任务失败')
    console.error('加载任务失败:', error)
  } finally {
    loading.value = false
  }
}

const createTask = (status: string) => {
  newTask.value.status = status
  showCreateDialog.value = true
}

const handleCreateTask = async () => {
  if (!newTask.value.title.trim()) {
    showToast('请输入任务标题')
    return
  }

  try {
    await taskStore.createTask(newTask.value)
    showSuccessToast('任务创建成功')
    showCreateDialog.value = false
    resetNewTask()
    loadTasks()
  } catch (error) {
    showToast('创建任务失败')
    console.error('创建任务失败:', error)
  }
}

const resetNewTask = () => {
  newTask.value = {
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    dueDate: '',
    assignedTo: ''
  }
}

const updateTaskStatus = async (taskId: string, status: string) => {
  try {
    await taskStore.updateTask(taskId, { status })
    showSuccessToast('任务状态更新成功')
    loadTasks()
  } catch (error) {
    showToast('更新失败')
    console.error('更新任务状态失败:', error)
  }
}

const openTaskDetail = (task: ITask) => {
  router.push({ name: 'TaskDetail', params: { id: task.id } })
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.task-board {
  min-height: 100vh;
  background-color: #f8f8f8;
}

.filter-bar {
  background: white;
  padding: 0 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-columns {
  display: flex;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
}

.task-column {
  flex: 1;
  min-width: 280px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.column-header h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.task-list {
  min-height: 200px;
}

.filter-options {
  padding: 20px;
}

.filter-actions-bottom {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
</style>