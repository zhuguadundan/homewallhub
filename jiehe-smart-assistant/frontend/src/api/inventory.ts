import { http } from '@/utils/request'

export const inventoryApi = {
  // 兼容别名：RecipeRecommendation 等页面使用 getItems
  getItems: (familyId: string, params = {}) => {
    return http.get(`/families/${familyId}/inventory`, { params })
  },
  // 获取库存列表
  getInventoryList: (familyId: string, params = {}) => {
    return http.get(`/families/${familyId}/inventory`, { params })
  },

  // 获取库存详情
  getInventoryDetail: (familyId: string, id: string) => {
    return http.get(`/families/${familyId}/inventory/${id}`)
  },

  // 添加库存
  addInventory: (familyId: string, data: any) => {
    return http.post(`/families/${familyId}/inventory`, data)
  },

  // 更新库存
  updateInventory: (familyId: string, id: string, data: any) => {
    return http.put(`/families/${familyId}/inventory/${id}`, data)
  },

  // 删除库存
  deleteInventory: (familyId: string, id: string) => {
    return http.delete(`/families/${familyId}/inventory/${id}`)
  },

  // 获取库存分类
  getCategories: (familyId: string) => {
    return http.get(`/families/${familyId}/inventory/categories`)
  },

  // 获取库存统计
  getStats: (familyId: string) => {
    return http.get(`/families/${familyId}/inventory/statistics`)
  },

  // 批量更新库存
  batchUpdate: (familyId: string, data: any) => {
    return http.post(`/families/${familyId}/inventory/batch`, data)
  }
}