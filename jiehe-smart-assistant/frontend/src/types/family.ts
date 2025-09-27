// 家庭相关类型定义

export interface IFamily {
  id: string
  name: string
  description?: string
  inviteCode: string
  memberCount: number
  maxMembers: number
  createdBy: string
  createdAt: string
  updatedAt: string
  role?: 'admin' | 'member' // 当前用户在该家庭中的角色
}

export interface IFamilyMember {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'member'
  joinedAt: string
  lastActiveAt: string
  completedTasks?: number
  isOnline?: boolean
}

export interface CreateFamilyData {
  name: string
  description?: string
  maxMembers?: number
}

export interface UpdateFamilyData {
  name?: string
  description?: string
  maxMembers?: number
}

// 家庭统计信息
export interface FamilyStats {
  totalMembers: number
  activeTasks: number
  completedTasks: number
  inventoryItems: number
  upcomingEvents: number
}

// 家庭活动记录
export interface FamilyActivity {
  id: string
  type: 'task_created' | 'task_completed' | 'member_joined' | 'inventory_updated' | 'event_created'
  title: string
  description?: string
  userId: string
  userName: string
  createdAt: string
}

// 家庭设置
export interface FamilySettings {
  allowMemberInvite: boolean
  requireApprovalForJoin: boolean
  taskNotifications: boolean
  inventoryNotifications: boolean
  calendarNotifications: boolean
}