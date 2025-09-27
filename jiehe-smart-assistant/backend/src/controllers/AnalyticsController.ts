/**
 * 数据分析控制器
 * 处理饮食分析、成本分析等数据分析相关的请求
 */

import { Context } from 'koa'
import { DietAnalysisService, DietAnalysisRequest } from '../services/DietAnalysisService'
import { CostAnalysisService, CostAnalysisRequest, BudgetConfig, CostRecord } from '../services/CostAnalysisService'
import { SmartPurchasingService, PurchasingRequest } from '../services/SmartPurchasingService'
import { FamilyReportService, ReportRequest } from '../services/FamilyReportService'
import { Validator } from '../utils/validation'
import { logger } from '../utils/logger'

export class AnalyticsController {
  private dietAnalysisService: DietAnalysisService
  private costAnalysisService: CostAnalysisService
  private smartPurchasingService: SmartPurchasingService
  private familyReportService: FamilyReportService
  private validator: Validator
  private logger: typeof logger

  constructor() {
    this.dietAnalysisService = DietAnalysisService.getInstance()
    this.costAnalysisService = CostAnalysisService.getInstance()
    this.smartPurchasingService = SmartPurchasingService.getInstance()
    this.familyReportService = FamilyReportService.getInstance()
    this.validator = new Validator()
    this.logger = logger
  }

  /**
   * 生成饮食分析报告
   * POST /api/analytics/diet-analysis
   */
  async generateDietAnalysis(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const request = ctx.request.body as Partial<DietAnalysisRequest>

      // 验证请求参数
      const validationRules = {
        timeRange: { required: true, type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
        analysisType: { required: true, type: 'string', enum: ['comprehensive', 'nutrition', 'preference', 'cost', 'trend'] }
      }

      const validation = this.validator.validate(request, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const analysisRequest: DietAnalysisRequest = {
        familyId,
        userId,
        timeRange: request.timeRange!,
        analysisType: request.analysisType!
      }

      this.logger.info('开始生成饮食分析报告', { familyId, userId, timeRange: request.timeRange })

      const result = await this.dietAnalysisService.generateAnalysis(analysisRequest)

      ctx.status = 200
      ctx.body = result

    } catch (error) {
      this.logger.error('生成饮食分析报告失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '生成饮食分析报告失败',
        error: error.message
      }
    }
  }

  /**
   * 生成成本分析报告
   * POST /api/analytics/cost-analysis
   */
  async generateCostAnalysis(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const request = ctx.request.body as Partial<CostAnalysisRequest>

      // 验证请求参数
      const validationRules = {
        timeRange: { required: true, type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
        analysisType: { required: true, type: 'string', enum: ['summary', 'detailed', 'trends', 'budget', 'optimization'] },
        categories: { required: false, type: 'array' }
      }

      const validation = this.validator.validate(request, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const analysisRequest: CostAnalysisRequest = {
        familyId,
        userId,
        timeRange: request.timeRange!,
        analysisType: request.analysisType!,
        categories: request.categories
      }

      this.logger.info('开始生成成本分析报告', { familyId, userId, timeRange: request.timeRange })

      const result = await this.costAnalysisService.generateCostAnalysis(analysisRequest)

      ctx.status = 200
      ctx.body = result

    } catch (error) {
      this.logger.error('生成成本分析报告失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '生成成本分析报告失败',
        error: error.message
      }
    }
  }

  /**
   * 创建预算配置
   * POST /api/analytics/budget-config
   */
  async createBudgetConfig(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const budgetData = ctx.request.body as Partial<BudgetConfig>

      // 验证请求参数
      const validationRules = {
        period: { required: true, type: 'string', enum: ['daily', 'weekly', 'monthly'] },
        amount: { required: true, type: 'number', min: 0 },
        category: { required: false, type: 'string' },
        alertThreshold: { required: true, type: 'number', min: 0, max: 1 },
        isActive: { required: true, type: 'boolean' }
      }

      const validation = this.validator.validate(budgetData, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const config = await this.costAnalysisService.createBudgetConfig({
        familyId,
        period: budgetData.period!,
        amount: budgetData.amount!,
        category: budgetData.category,
        alertThreshold: budgetData.alertThreshold!,
        isActive: budgetData.isActive!
      })

      this.logger.info('创建预算配置成功', { familyId, userId, configId: config.id })

      ctx.status = 201
      ctx.body = {
        success: true,
        message: '预算配置创建成功',
        data: config
      }

    } catch (error) {
      this.logger.error('创建预算配置失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '创建预算配置失败',
        error: error.message
      }
    }
  }

  /**
   * 记录成本支出
   * POST /api/analytics/cost-record
   */
  async recordCost(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const costData = ctx.request.body as Partial<CostRecord>

      // 验证请求参数
      const validationRules = {
        itemName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
        category: { required: true, type: 'string', minLength: 1, maxLength: 50 },
        quantity: { required: true, type: 'number', min: 0 },
        unit: { required: true, type: 'string', minLength: 1, maxLength: 20 },
        unitPrice: { required: true, type: 'number', min: 0 },
        totalCost: { required: true, type: 'number', min: 0 },
        purchaseDate: { required: true, type: 'string' },
        expirationDate: { required: false, type: 'string' },
        isConsumed: { required: false, type: 'boolean' },
        consumedDate: { required: false, type: 'string' },
        wastageReason: { required: false, type: 'string' }
      }

      const validation = this.validator.validate(costData, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const record = await this.costAnalysisService.recordCost({
        familyId,
        itemName: costData.itemName!,
        category: costData.category!,
        quantity: costData.quantity!,
        unit: costData.unit!,
        unitPrice: costData.unitPrice!,
        totalCost: costData.totalCost!,
        purchaseDate: costData.purchaseDate!,
        expirationDate: costData.expirationDate,
        isConsumed: costData.isConsumed || false,
        consumedDate: costData.consumedDate,
        wastageReason: costData.wastageReason,
        createdBy: userId
      })

      this.logger.info('记录成本支出成功', { familyId, userId, recordId: record.id })

      ctx.status = 201
      ctx.body = {
        success: true,
        message: '成本记录创建成功',
        data: record
      }

    } catch (error) {
      this.logger.error('记录成本支出失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '记录成本支出失败',
        error: error.message
      }
    }
  }

  /**
   * 获取快速统计数据
   * GET /api/analytics/quick-stats
   */
  async getQuickStats(ctx: Context) {
    try {
      const { familyId } = ctx.state.user
      const timeRange = ctx.query.timeRange as string || 'month'

      // 并行获取各类快速统计
      const [dietAnalysis, costAnalysis] = await Promise.all([
        this.dietAnalysisService.generateAnalysis({
          familyId,
          userId: familyId,
          timeRange: timeRange as any,
          analysisType: 'comprehensive'
        }),
        this.costAnalysisService.generateCostAnalysis({
          familyId,
          userId: familyId,
          timeRange: timeRange as any,
          analysisType: 'summary'
        })
      ])

      const quickStats = {
        diet: {
          totalMeals: dietAnalysis.summary.totalMeals,
          nutritionScore: dietAnalysis.summary.nutritionScore,
          healthScore: dietAnalysis.summary.healthScore,
          topCategories: dietAnalysis.preferences.topCategories.slice(0, 3)
        },
        cost: {
          totalSpending: costAnalysis.summary.totalSpending,
          dailyAverage: costAnalysis.summary.dailyAverage,
          topCategory: costAnalysis.summary.categoryBreakdown[0]?.category || '无数据',
          wastageRate: costAnalysis.optimization.wastageAnalysis.wastageRate
        },
        trends: {
          dietImproving: dietAnalysis.trends.improving.length > 0,
          costOptimization: costAnalysis.optimization.totalSavings,
          budgetStatus: costAnalysis.summary.budgetStatus.find(b => b.status !== 'within')?.status || 'within'
        }
      }

      ctx.status = 200
      ctx.body = {
        success: true,
        data: quickStats
      }

    } catch (error) {
      this.logger.error('获取快速统计失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '获取统计数据失败',
        error: error.message
      }
    }
  }

  /**
   * 生成智能采购计划
   * POST /api/analytics/purchasing-plan
   */
  async generatePurchasingPlan(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const request = ctx.request.body as Partial<PurchasingRequest>

      // 验证请求参数
      const validationRules = {
        timeHorizon: { required: true, type: 'string', enum: ['week', 'month', 'quarter'] },
        budget: { required: false, type: 'number', min: 0 },
        preferences: { required: false, type: 'object' },
        constraints: { required: false, type: 'object' }
      }

      const validation = this.validator.validate(request, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const purchasingRequest: PurchasingRequest = {
        familyId,
        userId,
        timeHorizon: request.timeHorizon!,
        budget: request.budget,
        preferences: request.preferences,
        constraints: request.constraints
      }

      this.logger.info('开始生成智能采购计划', { familyId, userId, timeHorizon: request.timeHorizon })

      const result = await this.smartPurchasingService.generatePurchasingPlan(purchasingRequest)

      ctx.status = 200
      ctx.body = result

    } catch (error) {
      this.logger.error('生成智能采购计划失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '生成智能采购计划失败',
        error: error.message
      }
    }
  }

  /**
   * 生成家庭数据分析报告
   * POST /api/analytics/family-report
   */
  async generateFamilyReport(ctx: Context) {
    try {
      const { familyId, userId } = ctx.state.user
      const request = ctx.request.body as Partial<ReportRequest>

      // 验证请求参数
      const validationRules = {
        reportType: { required: true, type: 'string', enum: ['comprehensive', 'monthly', 'quarterly', 'annual'] },
        timeRange: { required: true, type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
        includeComparison: { required: false, type: 'boolean' },
        customDateRange: { required: false, type: 'object' }
      }

      const validation = this.validator.validate(request, validationRules)
      if (!validation.isValid) {
        ctx.status = 400
        ctx.body = {
          success: false,
          message: '请求参数无效',
          errors: validation.errors
        }
        return
      }

      const reportRequest: ReportRequest = {
        familyId,
        userId,
        reportType: request.reportType!,
        timeRange: request.timeRange!,
        includeComparison: request.includeComparison,
        customDateRange: request.customDateRange
      }

      this.logger.info('开始生成家庭数据分析报告', { 
        familyId, 
        userId, 
        reportType: request.reportType,
        timeRange: request.timeRange 
      })

      const result = await this.familyReportService.generateFamilyReport(reportRequest)

      ctx.status = 200
      ctx.body = result

    } catch (error) {
      this.logger.error('生成家庭数据分析报告失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '生成家庭数据分析报告失败',
        error: error.message
      }
    }
  }

  /**
   * 获取数据概览
   * GET /api/analytics/overview
   */
  async getAnalyticsOverview(ctx: Context) {
    try {
      const { familyId } = ctx.state.user

      // 生成过去一个月的综合分析
      const monthlyDietAnalysis = await this.dietAnalysisService.generateAnalysis({
        familyId,
        userId: familyId,
        timeRange: 'month',
        analysisType: 'comprehensive'
      })

      const monthlyCostAnalysis = await this.costAnalysisService.generateCostAnalysis({
        familyId,
        userId: familyId,
        timeRange: 'month',
        analysisType: 'summary'
      })

      const overview = {
        period: '最近30天',
        summary: {
          totalMeals: monthlyDietAnalysis.summary.totalMeals,
          totalSpending: monthlyCostAnalysis.summary.totalSpending,
          avgDailyCost: monthlyCostAnalysis.summary.dailyAverage,
          nutritionScore: monthlyDietAnalysis.summary.nutritionScore,
          healthScore: monthlyDietAnalysis.summary.healthScore,
          wastageRate: monthlyCostAnalysis.optimization.wastageAnalysis.wastageRate
        },
        highlights: {
          topFoodCategory: monthlyDietAnalysis.preferences.topCategories[0] || '无数据',
          topExpenseCategory: monthlyCostAnalysis.summary.categoryBreakdown[0]?.category || '无数据',
          biggestSaving: monthlyCostAnalysis.optimization.recommendations[0]?.savings || 0,
          nutritionalImprovement: monthlyDietAnalysis.trends.improving.length > 0
        },
        recommendations: [
          ...monthlyDietAnalysis.recommendations.nutritional.slice(0, 2),
          ...monthlyCostAnalysis.budgetRecommendations.slice(0, 2)
        ].slice(0, 4)
      }

      ctx.status = 200
      ctx.body = {
        success: true,
        data: overview
      }

    } catch (error) {
      this.logger.error('获取数据概览失败', { error: error.message })
      ctx.status = 500
      ctx.body = {
        success: false,
        message: '获取数据概览失败',
        error: error.message
      }
    }
  }
}
