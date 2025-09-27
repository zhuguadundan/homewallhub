/**
 * 家庭数据分析报告服务
 * 生成综合的家庭管理效率和生活质量分析报告
 */

import { Database } from 'sqlite3'
import { DatabaseManager } from '../config/database'
import { DietAnalysisService, DietAnalysisResponse } from './DietAnalysisService'
import { CostAnalysisService, CostAnalysisResponse } from './CostAnalysisService'
import { AIService } from './AIService'
import { logger } from '../utils/logger'

export interface ReportRequest {
  familyId: string
  userId: string
  reportType: 'comprehensive' | 'monthly' | 'quarterly' | 'annual'
  timeRange: 'week' | 'month' | 'quarter' | 'year'
  includeComparison?: boolean
  customDateRange?: {
    startDate: string
    endDate: string
  }
}

export interface FamilyMetrics {
  taskManagement: {
    totalTasks: number
    completionRate: number
    avgCompletionTime: number
    memberContribution: Array<{
      userId: string
      userName: string
      tasksCompleted: number
      contributionPercentage: number
    }>
    categoryEfficiency: Array<{
      category: string
      completionRate: number
      avgTime: number
    }>
  }
  inventoryManagement: {
    totalItems: number
    turnoverRate: number
    wastageRate: number
    stockEfficiency: number
    topCategories: Array<{
      category: string
      itemCount: number
      value: number
    }>
    expirationManagement: {
      preventedWastage: number
      avgShelfLife: number
    }
  }
  familyActivity: {
    totalEvents: number
    attendanceRate: number
    planningEfficiency: number
    communicationScore: number
    menuPlanningEngagement: number
  }
  healthWellness: {
    nutritionScore: number
    dietVariety: number
    mealPlanningConsistency: number
    healthyChoicesRate: number
  }
}

export interface LifeQualityIndex {
  overallScore: number
  categories: {
    efficiency: { score: number, trend: 'up' | 'down' | 'stable' }
    nutrition: { score: number, trend: 'up' | 'down' | 'stable' }
    finance: { score: number, trend: 'up' | 'down' | 'stable' }
    organization: { score: number, trend: 'up' | 'down' | 'stable' }
    communication: { score: number, trend: 'up' | 'down' | 'stable' }
  }
  recommendations: string[]
  improvements: Array<{
    category: string
    suggestion: string
    impact: 'high' | 'medium' | 'low'
    effort: 'easy' | 'moderate' | 'challenging'
  }>
}

export interface ComparisonData {
  previousPeriod: {
    timeRange: string
    metrics: Partial<FamilyMetrics>
    qualityIndex: number
  }
  changes: Array<{
    metric: string
    change: number
    changePercent: number
    trend: 'positive' | 'negative' | 'neutral'
    significance: 'high' | 'medium' | 'low'
  }>
  achievements: string[]
  areasForImprovement: string[]
}

export interface FamilyReportResponse {
  success: boolean
  reportId: string
  familyId: string
  reportType: string
  timeRange: string
  generatedAt: string
  summary: {
    overallRating: 'excellent' | 'good' | 'average' | 'needs_improvement'
    keyHighlights: string[]
    primaryConcerns: string[]
    progressDirection: 'improving' | 'stable' | 'declining'
  }
  metrics: FamilyMetrics
  qualityIndex: LifeQualityIndex
  dietAnalysis: Partial<DietAnalysisResponse>
  costAnalysis: Partial<CostAnalysisResponse>
  comparison?: ComparisonData
  actionPlan: Array<{
    priority: 'high' | 'medium' | 'low'
    category: string
    action: string
    timeline: string
    expectedImpact: string
  }>
  aiInsights?: string
}

export class FamilyReportService {
  private static instance: FamilyReportService
  private db: Database
  private dietAnalysisService: DietAnalysisService
  private costAnalysisService: CostAnalysisService
  private aiService: AIService

  constructor() {
    this.dietAnalysisService = DietAnalysisService.getInstance()
    this.costAnalysisService = CostAnalysisService.getInstance()
    this.aiService = AIService.getInstance()
  }

  private getDatabase() {
    if (!this.db) {
      this.db = DatabaseManager.getInstance().getDatabase()
    }
    return this.db
  }

  public static getInstance(): FamilyReportService {
    if (!FamilyReportService.instance) {
      FamilyReportService.instance = new FamilyReportService()
    }
    return FamilyReportService.instance
  }

  /**
   * 生成家庭数据分析报告
   */
  async generateFamilyReport(request: ReportRequest): Promise<FamilyReportResponse> {
    try {
      logger.info(`开始生成家庭数据分析报告`, { 
        familyId: request.familyId, 
        reportType: request.reportType,
        timeRange: request.timeRange
      })

      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 并行获取各类数据分析
      const [
        dietAnalysis,
        costAnalysis,
        familyMetrics,
        previousPeriodData
      ] = await Promise.all([
        this.getDietAnalysis(request),
        this.getCostAnalysis(request),
        this.calculateFamilyMetrics(request),
        request.includeComparison ? this.getPreviousPeriodData(request) : null
      ])

      // 计算生活质量指数
      const qualityIndex = this.calculateLifeQualityIndex(
        familyMetrics, 
        dietAnalysis, 
        costAnalysis
      )

      // 生成对比数据
      const comparison = previousPeriodData ? 
        this.generateComparisonData(familyMetrics, previousPeriodData) : undefined

      // 生成综合评估
      const summary = this.generateSummary(familyMetrics, qualityIndex, comparison)

      // 生成行动计划
      const actionPlan = this.generateActionPlan(familyMetrics, qualityIndex)

      const response: FamilyReportResponse = {
        success: true,
        reportId,
        familyId: request.familyId,
        reportType: request.reportType,
        timeRange: request.timeRange,
        generatedAt: new Date().toISOString(),
        summary,
        metrics: familyMetrics,
        qualityIndex,
        dietAnalysis,
        costAnalysis,
        comparison,
        actionPlan
      }

      // 尝试获取AI洞察
      try {
        const aiInsights = await this.generateAIInsights(response)
        response.aiInsights = aiInsights
      } catch (error) {
        logger.warn('AI洞察生成失败，使用本地分析', { error: error.message })
      }

      // 保存报告
      await this.saveReport(response)

      logger.info(`家庭数据分析报告生成完成`, { 
        reportId,
        overallRating: summary.overallRating,
        qualityScore: qualityIndex.overallScore
      })

      return response

    } catch (error) {
      logger.error('生成家庭数据分析报告失败', { error: error.message, request })
      throw new Error(`家庭报告生成失败: ${error.message}`)
    }
  }

  /**
   * 获取饮食分析数据
   */
  private async getDietAnalysis(request: ReportRequest): Promise<Partial<DietAnalysisResponse>> {
    try {
      const analysis = await this.dietAnalysisService.generateAnalysis({
        familyId: request.familyId,
        userId: request.userId,
        timeRange: request.timeRange,
        analysisType: 'comprehensive'
      })

      return {
        summary: analysis.summary,
        nutrition: analysis.nutrition,
        preferences: analysis.preferences,
        recommendations: analysis.recommendations
      }
    } catch (error) {
      logger.warn('饮食分析数据获取失败，使用默认数据', { error: error.message })
      return {
        summary: { totalMeals: 0, nutritionScore: 50, healthScore: 50, avgDailyCost: 0, varietyScore: 50 },
        recommendations: { nutritional: [], economic: [], variety: [], health: [] }
      }
    }
  }

  /**
   * 获取成本分析数据
   */
  private async getCostAnalysis(request: ReportRequest): Promise<Partial<CostAnalysisResponse>> {
    try {
      const analysis = await this.costAnalysisService.generateCostAnalysis({
        familyId: request.familyId,
        userId: request.userId,
        timeRange: request.timeRange,
        analysisType: 'summary'
      })

      return {
        summary: analysis.summary,
        optimization: analysis.optimization,
        budgetRecommendations: analysis.budgetRecommendations
      }
    } catch (error) {
      logger.warn('成本分析数据获取失败，使用默认数据', { error: error.message })
      return {
        summary: { 
          totalSpending: 0, 
          dailyAverage: 0, 
          categoryBreakdown: [], 
          topExpenses: [], 
          budgetStatus: [] 
        }
      }
    }
  }

  /**
   * 计算家庭指标
   */
  private async calculateFamilyMetrics(request: ReportRequest): Promise<FamilyMetrics> {
    const timeFilter = this.getTimeFilter(request.timeRange)
    
    const [
      taskData,
      inventoryData,
      familyActivityData
    ] = await Promise.all([
      this.getTaskManagementData(request.familyId, timeFilter),
      this.getInventoryManagementData(request.familyId, timeFilter),
      this.getFamilyActivityData(request.familyId, timeFilter)
    ])

    const taskManagement = this.calculateTaskMetrics(taskData)
    const inventoryManagement = this.calculateInventoryMetrics(inventoryData)
    const familyActivity = this.calculateActivityMetrics(familyActivityData)
    const healthWellness = this.calculateHealthMetrics(taskData, inventoryData)

    return {
      taskManagement,
      inventoryManagement,
      familyActivity,
      healthWellness
    }
  }

  /**
   * 获取任务管理数据
   */
  private async getTaskManagementData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT t.*, u.username,
               (julianday(t.completed_at) - julianday(t.created_at)) as completion_days
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.family_id = ? AND t.created_at >= ?
        ORDER BY t.created_at DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取库存管理数据
   */
  private async getInventoryManagementData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT i.*, ib.quantity, ib.cost_per_unit, ib.expiration_date, ib.consumed_at
        FROM inventory i
        LEFT JOIN inventory_batches ib ON i.id = ib.inventory_id
        WHERE i.family_id = ? AND i.created_at >= ?
        ORDER BY i.created_at DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取家庭活动数据
   */
  private async getFamilyActivityData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 'calendar' as type, COUNT(*) as count FROM calendar_events WHERE family_id = ? AND created_at >= ?
        UNION ALL
        SELECT 'messages' as type, COUNT(*) as count FROM messages WHERE family_id = ? AND created_at >= ?
        UNION ALL
        SELECT 'menu_voting' as type, COUNT(*) as count FROM menu_voting WHERE family_id = ? AND created_at >= ?
      `
      
      this.getDatabase().all(query, [familyId, startDate, familyId, startDate, familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 计算任务指标
   */
  private calculateTaskMetrics(taskData: any[]): FamilyMetrics['taskManagement'] {
    const totalTasks = taskData.length
    const completedTasks = taskData.filter(task => task.status === 'completed')
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0
    
    const avgCompletionTime = completedTasks.length > 0 ? 
      completedTasks.reduce((sum, task) => sum + (task.completion_days || 0), 0) / completedTasks.length : 0

    // 成员贡献度计算
    const memberMap = new Map<string, { userName: string, count: number }>()
    completedTasks.forEach(task => {
      if (task.assigned_to && task.username) {
        const current = memberMap.get(task.assigned_to) || { userName: task.username, count: 0 }
        current.count++
        memberMap.set(task.assigned_to, current)
      }
    })

    const memberContribution = Array.from(memberMap.entries()).map(([userId, data]) => ({
      userId,
      userName: data.userName,
      tasksCompleted: data.count,
      contributionPercentage: Math.round((data.count / completedTasks.length) * 100)
    }))

    // 类别效率计算
    const categoryMap = new Map<string, { total: number, completed: number, totalTime: number }>()
    taskData.forEach(task => {
      const category = task.category || '其他'
      const current = categoryMap.get(category) || { total: 0, completed: 0, totalTime: 0 }
      current.total++
      if (task.status === 'completed') {
        current.completed++
        current.totalTime += task.completion_days || 0
      }
      categoryMap.set(category, current)
    })

    const categoryEfficiency = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      completionRate: Math.round((data.completed / data.total) * 100),
      avgTime: data.completed > 0 ? Math.round((data.totalTime / data.completed) * 10) / 10 : 0
    }))

    return {
      totalTasks,
      completionRate: Math.round(completionRate),
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      memberContribution,
      categoryEfficiency
    }
  }

  /**
   * 计算库存指标
   */
  private calculateInventoryMetrics(inventoryData: any[]): FamilyMetrics['inventoryManagement'] {
    const totalItems = inventoryData.length
    const consumedItems = inventoryData.filter(item => item.consumed_at)
    const expiredItems = inventoryData.filter(item => 
      item.expiration_date && new Date(item.expiration_date) < new Date() && !item.consumed_at
    )

    const turnoverRate = totalItems > 0 ? (consumedItems.length / totalItems) * 100 : 0
    const wastageRate = totalItems > 0 ? (expiredItems.length / totalItems) * 100 : 0
    const stockEfficiency = Math.max(0, 100 - wastageRate)

    // 分类统计
    const categoryMap = new Map<string, { count: number, value: number }>()
    inventoryData.forEach(item => {
      const category = item.category || '其他'
      const current = categoryMap.get(category) || { count: 0, value: 0 }
      current.count++
      current.value += (item.quantity || 0) * (item.cost_per_unit || 0)
      categoryMap.set(category, current)
    })

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        itemCount: data.count,
        value: Math.round(data.value * 100) / 100
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    return {
      totalItems,
      turnoverRate: Math.round(turnoverRate),
      wastageRate: Math.round(wastageRate),
      stockEfficiency: Math.round(stockEfficiency),
      topCategories,
      expirationManagement: {
        preventedWastage: Math.max(0, consumedItems.length - expiredItems.length),
        avgShelfLife: 7 // 简化计算
      }
    }
  }

  /**
   * 计算活动指标
   */
  private calculateActivityMetrics(activityData: any[]): FamilyMetrics['familyActivity'] {
    const calendarEvents = activityData.find(item => item.type === 'calendar')?.count || 0
    const messages = activityData.find(item => item.type === 'messages')?.count || 0
    const menuVoting = activityData.find(item => item.type === 'menu_voting')?.count || 0

    return {
      totalEvents: calendarEvents,
      attendanceRate: 85, // 简化计算
      planningEfficiency: Math.min(100, calendarEvents * 10),
      communicationScore: Math.min(100, messages * 2),
      menuPlanningEngagement: Math.min(100, menuVoting * 15)
    }
  }

  /**
   * 计算健康指标
   */
  private calculateHealthMetrics(taskData: any[], inventoryData: any[]): FamilyMetrics['healthWellness'] {
    // 基于任务和库存数据计算健康相关指标
    const healthTasks = taskData.filter(task => 
      task.category && ['健康', '运动', '医疗'].includes(task.category)
    )
    
    const healthyInventory = inventoryData.filter(item =>
      item.category && ['蔬菜', '水果', '蛋白质'].includes(item.category)
    )

    return {
      nutritionScore: 75, // 将从饮食分析中获取
      dietVariety: Math.min(100, healthyInventory.length * 5),
      mealPlanningConsistency: 80, // 简化计算
      healthyChoicesRate: Math.min(100, (healthyInventory.length / Math.max(inventoryData.length, 1)) * 100)
    }
  }

  /**
   * 计算生活质量指数
   */
  private calculateLifeQualityIndex(
    metrics: FamilyMetrics,
    dietAnalysis: any,
    costAnalysis: any
  ): LifeQualityIndex {
    const efficiency = Math.round((metrics.taskManagement.completionRate + 
      metrics.inventoryManagement.stockEfficiency) / 2)
    
    const nutrition = dietAnalysis.summary?.nutritionScore || 50
    
    const finance = Math.min(100, 100 - (costAnalysis.optimization?.wastageAnalysis?.wastageRate || 20))
    
    const organization = Math.round((metrics.familyActivity.planningEfficiency + 
      metrics.inventoryManagement.stockEfficiency) / 2)
    
    const communication = metrics.familyActivity.communicationScore

    const overallScore = Math.round((efficiency + nutrition + finance + organization + communication) / 5)

    return {
      overallScore,
      categories: {
        efficiency: { score: efficiency, trend: 'stable' },
        nutrition: { score: nutrition, trend: 'stable' },
        finance: { score: finance, trend: 'stable' },
        organization: { score: organization, trend: 'stable' },
        communication: { score: communication, trend: 'stable' }
      },
      recommendations: this.generateQualityRecommendations(overallScore),
      improvements: this.generateImprovementSuggestions(metrics)
    }
  }

  /**
   * 生成质量建议
   */
  private generateQualityRecommendations(score: number): string[] {
    if (score >= 80) {
      return ['继续保持良好的家庭管理习惯', '考虑尝试新的优化策略']
    } else if (score >= 60) {
      return ['重点关注评分较低的领域', '制定具体的改进计划']
    } else {
      return ['需要系统性改善家庭管理方式', '建议寻求专业指导']
    }
  }

  /**
   * 生成改进建议
   */
  private generateImprovementSuggestions(metrics: FamilyMetrics): LifeQualityIndex['improvements'] {
    const suggestions: LifeQualityIndex['improvements'] = []

    if (metrics.taskManagement.completionRate < 70) {
      suggestions.push({
        category: '任务管理',
        suggestion: '优化任务分配和时间安排',
        impact: 'high',
        effort: 'moderate'
      })
    }

    if (metrics.inventoryManagement.wastageRate > 15) {
      suggestions.push({
        category: '库存管理',
        suggestion: '改善食材储存和使用计划',
        impact: 'medium',
        effort: 'easy'
      })
    }

    return suggestions
  }

  /**
   * 生成综合评估
   */
  private generateSummary(
    metrics: FamilyMetrics, 
    qualityIndex: LifeQualityIndex, 
    comparison?: ComparisonData
  ): FamilyReportResponse['summary'] {
    let overallRating: 'excellent' | 'good' | 'average' | 'needs_improvement'
    
    if (qualityIndex.overallScore >= 85) overallRating = 'excellent'
    else if (qualityIndex.overallScore >= 70) overallRating = 'good'
    else if (qualityIndex.overallScore >= 55) overallRating = 'average'
    else overallRating = 'needs_improvement'

    const keyHighlights = []
    const primaryConcerns = []

    if (metrics.taskManagement.completionRate >= 80) {
      keyHighlights.push(`任务完成率达${metrics.taskManagement.completionRate}%`)
    } else {
      primaryConcerns.push('任务完成率偏低，需要改善时间管理')
    }

    if (metrics.inventoryManagement.wastageRate <= 10) {
      keyHighlights.push('库存管理效率良好，浪费率较低')
    } else {
      primaryConcerns.push('库存浪费率偏高，需要优化采购和使用计划')
    }

    return {
      overallRating,
      keyHighlights,
      primaryConcerns,
      progressDirection: comparison ? this.determineProgressDirection(comparison) : 'stable'
    }
  }

  /**
   * 生成行动计划
   */
  private generateActionPlan(
    metrics: FamilyMetrics, 
    qualityIndex: LifeQualityIndex
  ): FamilyReportResponse['actionPlan'] {
    const actionPlan: FamilyReportResponse['actionPlan'] = []

    if (metrics.taskManagement.completionRate < 70) {
      actionPlan.push({
        priority: 'high',
        category: '任务管理',
        action: '制定更合理的任务分配策略，设置提醒机制',
        timeline: '2周内',
        expectedImpact: '提高完成率15-20%'
      })
    }

    if (metrics.inventoryManagement.wastageRate > 15) {
      actionPlan.push({
        priority: 'medium',
        category: '库存管理',
        action: '建立食材使用计划，设置过期提醒',
        timeline: '1个月内',
        expectedImpact: '减少浪费率5-10%'
      })
    }

    return actionPlan
  }

  /**
   * 生成AI洞察
   */
  private async generateAIInsights(response: FamilyReportResponse): Promise<string> {
    const prompt = `
      基于以下家庭管理数据分析报告，请提供专业的家庭生活质量改善建议：
      
      基本信息：
      - 综合评级：${response.summary.overallRating}
      - 生活质量指数：${response.qualityIndex.overallScore}/100
      - 任务完成率：${response.metrics.taskManagement.completionRate}%
      - 库存浪费率：${response.metrics.inventoryManagement.wastageRate}%
      
      主要亮点：
      ${response.summary.keyHighlights.map(highlight => `- ${highlight}`).join('\n')}
      
      主要关注点：
      ${response.summary.primaryConcerns.map(concern => `- ${concern}`).join('\n')}
      
      请提供：
      1. 家庭管理策略建议
      2. 生活质量提升方法
      3. 具体执行计划
      4. 预期改善效果
      
      要求实用可行，300字以内。
    `

    const aiResponse = await this.aiService.makeRequest({
      type: 'family_report',
      content: prompt,
      familyId: response.familyId,
      userId: response.familyId
    })

    return aiResponse.content
  }

  /**
   * 保存报告
   */
  private async saveReport(report: FamilyReportResponse): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO analysis_reports (
          id, family_id, report_type, time_range, report_data, 
          status, generated_by, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      this.getDatabase().run(query, [
        report.reportId, report.familyId, report.reportType, report.timeRange,
        JSON.stringify(report), 'completed', report.familyId,
        report.generatedAt, report.generatedAt
      ], function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  // 辅助方法
  private getTimeFilter(timeRange: string): string {
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return startDate.toISOString()
  }

  private async getPreviousPeriodData(request: ReportRequest): Promise<any> {
    // 获取上一个周期的数据用于对比
    // 这里简化实现，实际应该查询历史报告或重新计算
    return null
  }

  private generateComparisonData(current: FamilyMetrics, previous: any): ComparisonData {
    // 生成对比数据
    // 这里简化实现
    return {
      previousPeriod: {
        timeRange: '上月',
        metrics: {},
        qualityIndex: 70
      },
      changes: [],
      achievements: ['任务完成率有所提升'],
      areasForImprovement: ['库存管理需要改善']
    }
  }

  private determineProgressDirection(comparison: ComparisonData): 'improving' | 'stable' | 'declining' {
    const positiveChanges = comparison.changes.filter(c => c.trend === 'positive').length
    const negativeChanges = comparison.changes.filter(c => c.trend === 'negative').length
    
    if (positiveChanges > negativeChanges) return 'improving'
    if (negativeChanges > positiveChanges) return 'declining'
    return 'stable'
  }
}