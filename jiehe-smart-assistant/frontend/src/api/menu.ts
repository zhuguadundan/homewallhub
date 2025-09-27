import { http } from '@/utils/request'

export interface MenuData {
  id?: string
  name: string
  description?: string
  target_date: string
  voting_deadline?: string
  status?: string
}

export interface DishData {
  id?: string
  name: string
  description?: string
  category: string
  estimated_price?: number
  preparation_time?: number
  difficulty_level?: string
  ingredients?: string[]
}

export interface VoteData {
  vote_type: 'like' | 'dislike' | 'neutral'
  priority?: number
  notes?: string
}

export interface MenuListParams {
  page?: number
  limit?: number
  status?: string
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const menuApi = {
  /**
   * 获取菜单列表
   */
  getMenuList(familyId: string, params?: MenuListParams) {
    return http.get(`/families/${familyId}/menus`, { params })
  },

  /**
   * 获取菜单详情
   */
  getMenuDetail(familyId: string, menuId: string) {
    return http.get(`/families/${familyId}/menus/${menuId}`)
  },

  /**
   * 创建菜单
   */
  createMenu(familyId: string, data: MenuData) {
    return http.post(`/families/${familyId}/menus`, data)
  },

  /**
   * 更新菜单
   */
  updateMenu(familyId: string, menuId: string, data: Partial<MenuData>) {
    return http.put(`/families/${familyId}/menus/${menuId}`, data)
  },

  /**
   * 删除菜单
   */
  deleteMenu(familyId: string, menuId: string) {
    return http.delete(`/families/${familyId}/menus/${menuId}`)
  },

  /**
   * 添加菜品
   */
  addDish(familyId: string, menuId: string, data: DishData) {
    return http.post(`/families/${familyId}/menus/${menuId}/dishes`, data)
  },

  /**
   * 更新菜品
   */
  updateDish(familyId: string, dishId: string, data: Partial<DishData>) {
    return http.put(`/families/${familyId}/menus/dishes/${dishId}`, data)
  },

  /**
   * 删除菜品
   */
  deleteDish(familyId: string, dishId: string) {
    return http.delete(`/families/${familyId}/menus/dishes/${dishId}`)
  },

  /**
   * 为菜品投票
   */
  voteForDish(familyId: string, menuId: string, dishId: string, data: VoteData) {
    return http.post(`/families/${familyId}/menus/${menuId}/dishes/${dishId}/vote`, data)
  },

  /**
   * 获取用户投票记录
   */
  getUserVotes(familyId: string, menuId: string) {
    return http.get(`/families/${familyId}/menus/${menuId}/votes`)
  },

  /**
   * 开始投票
   */
  startVoting(familyId: string, menuId: string) {
    return http.post(`/families/${familyId}/menus/${menuId}/start-voting`)
  },

  /**
   * 完成投票
   */
  finalizeMenu(familyId: string, menuId: string) {
    return http.post(`/families/${familyId}/menus/${menuId}/finalize`)
  },

  /**
   * 获取菜单统计
   */
  getMenuStatistics(familyId: string, menuId: string) {
    return http.get(`/families/${familyId}/menus/${menuId}/statistics`)
  },

  /**
   * 获取最终点菜结果
   */
  getFinalResult(familyId: string, menuId: string) {
    return http.get(`/families/${familyId}/menus/${menuId}/result`)
  },

  /**
   * 导出点菜结果
   */
  exportResult(familyId: string, menuId: string, format: 'json' | 'csv' = 'json') {
    return http.get(`/families/${familyId}/menus/${menuId}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    })
  },

  /**
   * 获取家庭偏好分析
   */
  getFamilyPreferences(familyId: string, days: number = 30) {
    return http.get(`/families/${familyId}/menus/family/preferences`, {
      params: { days }
    })
  },

  /**
   * 获取菜单统计概览
   */
  getStats(familyId: string) {
    return http.get(`/families/${familyId}/menus/stats`)
  }
}
