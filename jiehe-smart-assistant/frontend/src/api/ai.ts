import { http } from '@/utils/request'

export const aiApi = {
  // 获取AI服务整体状态
  getServiceStatus() {
    return http.get('/ai/status')
  },

  // 获取AI预算使用情况
  getBudgetUsage() {
    return http.get('/ai/budget/usage')
  },

  // 获取菜谱推荐
  getRecipeRecommendation(data: any) {
    return http.post('/ai/recipe-recommendation', data)
  },

  // 获取任务建议
  getTaskSuggestion(data: any) {
    return http.post('/ai/task-suggestion', data)
  },

  // 生成智能购物清单
  generateShoppingList(data: any) {
    return http.post('/ai/shopping-list', data)
  },
}

