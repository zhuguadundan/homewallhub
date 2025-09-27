/**
 * 数据分析路由
 * 处理饮食分析、成本分析等数据分析相关的路由
 */

import Router from 'koa-router'
import { AnalyticsController } from '../controllers/AnalyticsController'
import { authMiddleware } from '../middlewares/auth'

const router = new Router({ prefix: '/api/analytics' })
const analyticsController = new AnalyticsController()

// 应用认证中间件
router.use(authMiddleware)

/**
 * 饮食分析相关路由
 */

// 生成饮食分析报告
router.post('/diet-analysis', async (ctx, next) => {
  await analyticsController.generateDietAnalysis(ctx)
})

/**
 * 成本分析相关路由
 */

// 生成成本分析报告
router.post('/cost-analysis', async (ctx, next) => {
  await analyticsController.generateCostAnalysis(ctx)
})

// 创建预算配置
router.post('/budget-config', async (ctx, next) => {
  await analyticsController.createBudgetConfig(ctx)
})

// 记录成本支出
router.post('/cost-record', async (ctx, next) => {
  await analyticsController.recordCost(ctx)
})

/**
 * 快速统计和概览
 */

// 获取快速统计数据
router.get('/quick-stats', async (ctx, next) => {
  await analyticsController.getQuickStats(ctx)
})

// 获取数据概览
router.get('/overview', async (ctx, next) => {
  await analyticsController.getAnalyticsOverview(ctx)
})

/**
 * 智能采购计划相关路由
 */

// 生成智能采购计划
router.post('/purchasing-plan', async (ctx, next) => {
  await analyticsController.generatePurchasingPlan(ctx)
})

/**
 * 家庭数据分析报告相关路由
 */

// 生成家庭数据分析报告
router.post('/family-report', async (ctx, next) => {
  await analyticsController.generateFamilyReport(ctx)
})

export default router
