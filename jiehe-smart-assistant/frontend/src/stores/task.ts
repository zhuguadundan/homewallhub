import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { taskApi } from '@/api/task'
import type { ITask, CreateTaskData, UpdateTaskData, TaskFilter } from '@/types/task'

export const useTaskStore = defineStore('task', () => {
  // 状态
  const tasks = ref<ITask[]>([])
  const currentTask = ref<ITask | null>(null)
  const loading = ref(false)
  const filter = ref<TaskFilter>({
    status: 'all',
    assignee: '',
    priority: '',
    dueDate: ''
  })

  // 计算属性
  const filteredTasks = computed(() => {
    let result = tasks.value

    if (filter.value.status && filter.value.status !== 'all') {
      result = result.filter(task => task.status === filter.value.status)
    }

    if (filter.value.assignee) {
      result = result.filter(task => task.assignedTo === filter.value.assignee)
    }

    if (filter.value.priority) {
      result = result.filter(task => task.priority === filter.value.priority)
    }

    return result
  })

  const pendingTasks = computed(() => 
    tasks.value.filter(task => task.status === 'pending')
  )

  const inProgressTasks = computed(() => 
    tasks.value.filter(task => task.status === 'in_progress')
  )

  const completedTasks = computed(() => 
    tasks.value.filter(task => task.status === 'completed')
  )

  const myTasks = computed(() => {
    // TODO: 从用户store获取当前用户ID
    const currentUserId = 'current-user-id'
    return tasks.value.filter(task => 
      task.assignedTo === currentUserId || task.createdBy === currentUserId
    )
  })

  const overdueTasks = computed(() => {
    const now = new Date()
    return tasks.value.filter(task => 
      task.dueDate && 
      new Date(task.dueDate) < now && 
      task.status !== 'completed'
    )
  })

  // 获取任务列表
  const getTasks = async (familyId?: string): Promise<ITask[]> => {
    try {
      loading.value = true
      const response = await taskApi.getTasks({ familyId })
      tasks.value = response.data
      return response.data
    } catch (error) {
      console.error('获取任务列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 创建任务
  const createTask = async (taskData: CreateTaskData): Promise<ITask> => {
    try {
      loading.value = true
      const response = await taskApi.createTask(taskData)
      tasks.value.unshift(response.data)
      return response.data
    } catch (error) {
      console.error('创建任务失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新任务
  const updateTask = async (taskId: string, updates: UpdateTaskData): Promise<ITask> => {
    try {
      const response = await taskApi.updateTask(taskId, updates)
      const index = tasks.value.findIndex(task => task.id === taskId)
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], ...response.data }
      }
      if (currentTask.value?.id === taskId) {
        currentTask.value = { ...currentTask.value, ...response.data }
      }
      return response.data
    } catch (error) {
      console.error('更新任务失败:', error)
      throw error
    }
  }

  // 删除任务
  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      await taskApi.deleteTask(taskId)
      tasks.value = tasks.value.filter(task => task.id !== taskId)
      if (currentTask.value?.id === taskId) {
        currentTask.value = null
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      throw error
    }
  }

  // 获取任务详情
  const getTaskDetail = async (taskId: string): Promise<ITask> => {
    try {
      loading.value = true
      const response = await taskApi.getTaskDetail(taskId)
      currentTask.value = response.data
      return response.data
    } catch (error) {
      console.error('获取任务详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 分配任务
  const assignTask = async (taskId: string, userId: string): Promise<ITask> => {
    try {
      const response = await taskApi.assignTask(taskId, userId)
      const index = tasks.value.findIndex(task => task.id === taskId)
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], ...response.data }
      }
      return response.data
    } catch (error) {
      console.error('分配任务失败:', error)
      throw error
    }
  }

  // 更新任务状态
  const updateTaskStatus = async (taskId: string, status: string): Promise<ITask> => {
    try {
      const response = await taskApi.updateTaskStatus(taskId, status)
      const index = tasks.value.findIndex(task => task.id === taskId)
      if (index !== -1) {
        tasks.value[index] = { ...tasks.value[index], status, ...response.data }
      }
      return response.data
    } catch (error) {
      console.error('更新任务状态失败:', error)
      throw error
    }
  }

  // 设置筛选条件
  const setFilter = (newFilter: Partial<TaskFilter>) => {
    filter.value = { ...filter.value, ...newFilter }
  }

  // 清空筛选条件
  const clearFilter = () => {
    filter.value = {
      status: 'all',
      assignee: '',
      priority: '',
      dueDate: ''
    }
  }

  // 设置当前任务
  const setCurrentTask = (task: ITask | null) => {
    currentTask.value = task
  }

  return {
    // 状态
    tasks,
    currentTask,
    loading,
    filter,
    
    // 计算属性
    filteredTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    myTasks,
    overdueTasks,
    
    // 方法
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getTaskDetail,
    assignTask,
    updateTaskStatus,
    setFilter,
    clearFilter,
    setCurrentTask
  }
})