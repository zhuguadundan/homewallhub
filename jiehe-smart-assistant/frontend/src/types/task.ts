// 任务相关类型定义

export interface ITask {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  familyId: string
  createdBy: string
  assignedTo?: string
  assigneeName?: string
  assigneeAvatar?: string
  dueDate?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  attachments?: TaskAttachment[]
  subtasks?: SubTask[]
  comments?: TaskComment[]
  estimatedHours?: number
  actualHours?: number
}

export interface SubTask {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

export interface TaskAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  uploadedBy: string
  uploadedAt: string
}

export interface TaskComment {
  id: string
  content: string
  createdBy: string
  createdByName: string
  createdByAvatar?: string
  createdAt: string
}

export interface CreateTaskData {
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed'
  assignedTo?: string
  dueDate?: string
  tags?: string[]
  estimatedHours?: number
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
  dueDate?: string
  tags?: string[]
  estimatedHours?: number
  actualHours?: number
}

export interface TaskFilter {
  status?: string
  assignee?: string
  priority?: string
  dueDate?: string
  tags?: string[]
  search?: string
}

export interface TaskQueryParams {
  familyId?: string
  status?: string
  assignedTo?: string
  priority?: string
  search?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 任务统计
export interface TaskStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  overdue: number
  myTasks: number
}

// 任务模板
export interface TaskTemplate {
  id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours?: number
  tags?: string[]
  subtasks?: Omit<SubTask, 'id' | 'createdAt' | 'completed'>[]
}