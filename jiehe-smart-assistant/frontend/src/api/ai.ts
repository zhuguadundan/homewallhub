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
}

