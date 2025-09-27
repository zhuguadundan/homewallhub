import { http } from '@/utils/request'
import type { 
  ITask, 
  CreateTaskData, 
  UpdateTaskData, 
  TaskQueryParams,
  TaskStats,
  TaskTemplate 
} from '@/types/task'

import type { ApiResponse } from '@/types/api'

export const taskApi = {
  // 获取任务列表
  getTasks(familyId: string, params?: Partial<TaskQueryParams>): Promise<ApiResponse<ITask[]>> {
    return http.get(`/families/${familyId}/tasks`, { params })
  },

  // 创建任务
  createTask(familyId: string, data: CreateTaskData): Promise<ApiResponse<ITask>> {
    return http.post(`/families/${familyId}/tasks`, data)
  },

  // 获取任务详情
  getTaskDetail(taskId: string): Promise<ApiResponse<ITask>> {
    return http.get(`/tasks/${taskId}`)
  },

  // 更新任务
  updateTask(taskId: string, data: UpdateTaskData): Promise<ApiResponse<ITask>> {
    return http.put(`/tasks/${taskId}`, data)
  },

  // 删除任务
  deleteTask(taskId: string): Promise<ApiResponse<void>> {
    return http.delete(`/tasks/${taskId}`)
  },

  // 分配任务
  assignTask(taskId: string, userId: string): Promise<ApiResponse<ITask>> {
    return http.post(`/tasks/${taskId}/assign`, { userId })
  },

  // 更新任务状态
  updateTaskStatus(taskId: string, status: string): Promise<ApiResponse<ITask>> {
    return http.put(`/tasks/${taskId}/status`, { status })
  },

  // 添加子任务
  addSubtask(taskId: string, title: string): Promise<ApiResponse<void>> {
    return http.post(`/tasks/${taskId}/subtasks`, { title })
  },

  // 更新子任务状态
  updateSubtaskStatus(taskId: string, subtaskId: string, completed: boolean): Promise<ApiResponse<void>> {
    return http.put(`/tasks/${taskId}/subtasks/${subtaskId}`, { completed })
  },

  // 添加任务评论
  addComment(taskId: string, content: string): Promise<ApiResponse<void>> {
    return http.post(`/tasks/${taskId}/comments`, { content })
  },

  // 上传任务附件
  uploadAttachment(taskId: string, file: File): Promise<ApiResponse<void>> {
    const formData = new FormData()
    formData.append('file', file)
    return http.post(`/tasks/${taskId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 删除任务附件
  deleteAttachment(taskId: string, attachmentId: string): Promise<ApiResponse<void>> {
    return http.delete(`/tasks/${taskId}/attachments/${attachmentId}`)
  },

  // 获取任务统计
  getTaskStats(familyId: string): Promise<ApiResponse<TaskStats>> {
    return http.get(`/families/${familyId}/tasks/statistics`)
  },

  // 获取我的任务
  getMyTasks(params?: Partial<TaskQueryParams>): Promise<ApiResponse<ITask[]>> {
    return http.get('/tasks/my', { params })
  },

  // 获取逾期任务
  getOverdueTasks(familyId: string): Promise<ApiResponse<ITask[]>> {
    // 后端无明确"overdue"接口，这里返回未来3天任务作为近期待办
    return http.get(`/families/${familyId}/tasks/upcoming`, { params: { days: 3 } })
  },

  // 获取任务模板
  getTaskTemplates(): Promise<ApiResponse<TaskTemplate[]>> {
    return http.get('/tasks/templates')
  },

  // 从模板创建任务
  createFromTemplate(templateId: string, data: Partial<CreateTaskData>): Promise<ApiResponse<ITask>> {
    return http.post(`/tasks/templates/${templateId}/create`, data)
  }
}
