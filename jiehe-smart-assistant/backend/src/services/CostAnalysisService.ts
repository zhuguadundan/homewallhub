/**
 * 食材成本统计服务
 * 提供详细的成本跟踪、预算管理、价格趋势分析和成本优化建议
 */

import { Database } from 'sqlite3'
import { DatabaseManager } from '../config/database'
import { AIService } from './AIService'
import { logger } from '../utils/logger'
import { AIRequestType } from '../interfaces/ai'

export interface CostAnalysisRequest {
  familyId: string
  userId: string
  timeRange: 'week' | 'month' | 'quarter' | 'year'
  analysisType: 'summary' | 'detailed' | 'trends' | 'budget' | 'optimization'
  categories?: string[]
}

export interface BudgetConfig {
  id: string
  familyId: string
  period: 'daily' | 'weekly' | 'monthly'
  amount: number
  category?: string
  alertThreshold: number // 0.8 表示80%时预警
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CostRecord {
  id: string
  familyId: string
  itemName: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  totalCost: number
  purchaseDate: string
  expirationDate?: string
  isConsumed: boolean
  consumedDate?: string
  wastageReason?: string
  createdBy: string
}

export interface PriceTrend {
  itemName: string
  category: string
  currentPrice: number
  avgPrice30Days: number
  priceChange: number
  priceChangePercent: number
  trend: 'rising' | 'falling' | 'stable'
  recommendation: string
}

export interface CostSummary {
  totalSpending: number
  dailyAverage: number
  categoryBreakdown: Array<{
    category: string
    amount: number
    percentage: number
    itemCount: number
  }>
  topExpenses: Array<{
    itemName: string
    totalCost: number
    frequency: number
    avgUnitPrice: number
  }>
  budgetStatus: Array<{
    period: string
    budgeted: number
    spent: number
    remaining: number
    utilizationRate: number
    status: 'within' | 'warning' | 'exceeded'
  }>
}

export interface CostOptimization {
  totalSavings: number
  recommendations: Array<{
    type: 'price_comparison' | 'bulk_purchase' | 'substitute' | 'timing' | 'wastage_reduction'
    itemName: string
    currentCost: number
    optimizedCost: number
    savings: number
    action: string
    confidence: number
  }>
  wastageAnalysis: {
    totalWastage: number
    wastageRate: number
    topWastedItems: Array<{
      itemName: string
      wastedAmount: number
      wastedValue: number
      mainReasons: string[]
    }>
  }
}

export interface CostAnalysisResponse {
  success: boolean
  familyId: string
  analysisDate: string
  timeRange: string
  summary: CostSummary
  trends: PriceTrend[]
  optimization: CostOptimization
  monthlyComparison: Array<{
    month: string
    totalSpending: number
    avgDailySpending: number
    changeFromPrevious: number
  }>
  aiInsights?: string
  budgetRecommendations: string[]
}

export class CostAnalysisService {
  private static instance: CostAnalysisService
  private db: Database
  private aiService: AIService

  constructor() {
    this.aiService = AIService.getInstance()
  }

  private getDatabase() {
    if (!this.db) {
      this.db = DatabaseManager.getInstance().getDatabase()
    }
    return this.db
  }

  public static getInstance(): CostAnalysisService {
    if (!CostAnalysisService.instance) {
      CostAnalysisService.instance = new CostAnalysisService()
    }
    return CostAnalysisService.instance
  }

  /**
   * 生成成本分析报告
   */
  async generateCostAnalysis(request: CostAnalysisRequest): Promise<CostAnalysisResponse> {
    try {
      logger.info(`开始生成成本分析报告`, { familyId: request.familyId, timeRange: request.timeRange })

      const timeFilter = this.getTimeFilter(request.timeRange)
      
      // 获取成本数据
      const [costRecords, budgetConfigs] = await Promise.all([
        this.getCostRecords(request.familyId, timeFilter, request.categories),
        this.getBudgetConfigs(request.familyId)
      ])

      // 生成各类分析
      const summary = await this.generateCostSummary(costRecords, budgetConfigs, request.timeRange)
      const trends = await this.analyzePriceTrends(request.familyId, costRecords)
      const optimization = await this.generateOptimizationSuggestions(request.familyId, costRecords)
      const monthlyComparison = await this.getMonthlyComparison(request.familyId)
      const budgetRecommendations = await this.generateBudgetRecommendations(summary, budgetConfigs)

      const response: CostAnalysisResponse = {
        success: true,
        familyId: request.familyId,
        analysisDate: new Date().toISOString(),
        timeRange: request.timeRange,
        summary,
        trends,
        optimization,
        monthlyComparison,
        budgetRecommendations
      }

      // 尝试获取AI洞察
      try {
        const aiInsights = await this.generateAIInsights(response)
        response.aiInsights = aiInsights
      } catch (error) {
        logger.warn('AI洞察生成失败，使用本地分析', { error: error.message })
      }

      logger.info(`成本分析报告生成完成`, { 
        familyId: request.familyId, 
        totalSpending: summary.totalSpending,
        optimizationSavings: optimization.totalSavings
      })

      return response

    } catch (error) {
      logger.error('生成成本分析报告失败', { error: error.message, request })
      throw new Error(`成本分析失败: ${error.message}`)
    }
  }

  /**
   * 创建预算配置
   */
  async createBudgetConfig(config: Omit<BudgetConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<BudgetConfig> {
    return new Promise((resolve, reject) => {
      const id = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      const query = `
        INSERT INTO budget_configs (id, family_id, period, amount, category, alert_threshold, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      this.getDatabase().run(query, [
        id, config.familyId, config.period, config.amount, 
        config.category || null, config.alertThreshold, 
        config.isActive ? 1 : 0, now, now
      ], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({
            ...config,
            id,
            createdAt: now,
            updatedAt: now
          })
        }
      })
    })
  }

  /**
   * 记录成本支出
   */
  async recordCost(cost: Omit<CostRecord, 'id'>): Promise<CostRecord> {
    return new Promise((resolve, reject) => {
      const id = `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const query = `
        INSERT INTO cost_records (
          id, family_id, item_name, category, quantity, unit, unit_price, 
          total_cost, purchase_date, expiration_date, is_consumed, 
          consumed_date, wastage_reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      this.getDatabase().run(query, [
        id, cost.familyId, cost.itemName, cost.category, cost.quantity,
        cost.unit, cost.unitPrice, cost.totalCost, cost.purchaseDate,
        cost.expirationDate || null, cost.isConsumed ? 1 : 0,
        cost.consumedDate || null, cost.wastageReason || null, cost.createdBy
      ], function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({ ...cost, id })
        }
      })
    })
  }

  /**
   * 获取时间过滤条件
   */
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

  /**
   * 获取成本记录
   */
  private async getCostRecords(familyId: string, startDate: string, categories?: string[]): Promise<CostRecord[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM cost_records 
        WHERE family_id = ? AND purchase_date >= ?
      `
      const params: any[] = [familyId, startDate]

      if (categories && categories.length > 0) {
        query += ` AND category IN (${categories.map(() => '?').join(', ')})`
        params.push(...categories)
      }

      query += ` ORDER BY purchase_date DESC`
      
      this.getDatabase().all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err)
        } else {
          const records = rows.map(row => ({
            id: row.id,
            familyId: row.family_id,
            itemName: row.item_name,
            category: row.category,
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unit_price,
            totalCost: row.total_cost,
            purchaseDate: row.purchase_date,
            expirationDate: row.expiration_date,
            isConsumed: row.is_consumed === 1,
            consumedDate: row.consumed_date,
            wastageReason: row.wastage_reason,
            createdBy: row.created_by
          }))
          resolve(records)
        }
      })
    })
  }

  /**
   * 获取预算配置
   */
  private async getBudgetConfigs(familyId: string): Promise<BudgetConfig[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM budget_configs 
        WHERE family_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `
      
      this.getDatabase().all(query, [familyId], (err, rows: any[]) => {
        if (err) {
          reject(err)
        } else {
          const configs = rows.map(row => ({
            id: row.id,
            familyId: row.family_id,
            period: row.period,
            amount: row.amount,
            category: row.category,
            alertThreshold: row.alert_threshold,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }))
          resolve(configs)
        }
      })
    })
  }

  /**
   * 生成成本汇总
   */
  private async generateCostSummary(records: CostRecord[], budgets: BudgetConfig[], timeRange: string): Promise<CostSummary> {
    const totalSpending = records.reduce((sum, record) => sum + record.totalCost, 0)
    const days = this.getDaysInRange(timeRange)
    const dailyAverage = totalSpending / days

    // 按类别分组
    const categoryMap = new Map<string, { amount: number, count: number }>()
    records.forEach(record => {
      const current = categoryMap.get(record.category) || { amount: 0, count: 0 }
      current.amount += record.totalCost
      current.count += 1
      categoryMap.set(record.category, current)
    })

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: Math.round(data.amount * 100) / 100,
        percentage: Math.round((data.amount / totalSpending) * 100),
        itemCount: data.count
      }))
      .sort((a, b) => b.amount - a.amount)

    // 计算最高支出项目
    const itemMap = new Map<string, { total: number, count: number, unitPrices: number[] }>()
    records.forEach(record => {
      const current = itemMap.get(record.itemName) || { total: 0, count: 0, unitPrices: [] }
      current.total += record.totalCost
      current.count += 1
      current.unitPrices.push(record.unitPrice)
      itemMap.set(record.itemName, current)
    })

    const topExpenses = Array.from(itemMap.entries())
      .map(([itemName, data]) => ({
        itemName,
        totalCost: Math.round(data.total * 100) / 100,
        frequency: data.count,
        avgUnitPrice: Math.round((data.unitPrices.reduce((a, b) => a + b, 0) / data.unitPrices.length) * 100) / 100
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)

    // 预算状态分析
    const budgetStatus = budgets.map(budget => {
      const relevantRecords = budget.category 
        ? records.filter(r => r.category === budget.category)
        : records

      const spent = relevantRecords.reduce((sum, r) => sum + r.totalCost, 0)
      const budgeted = budget.amount * this.getPeriodMultiplier(budget.period, timeRange)
      const remaining = budgeted - spent
      const utilizationRate = Math.round((spent / budgeted) * 100)

      let status: 'within' | 'warning' | 'exceeded'
      if (utilizationRate > 100) status = 'exceeded'
      else if (utilizationRate > budget.alertThreshold * 100) status = 'warning'
      else status = 'within'

      return {
        period: budget.period,
        budgeted: Math.round(budgeted * 100) / 100,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        utilizationRate,
        status
      }
    })

    return {
      totalSpending: Math.round(totalSpending * 100) / 100,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      categoryBreakdown,
      topExpenses,
      budgetStatus
    }
  }

  /**
   * 分析价格趋势
   */
  private async analyzePriceTrends(familyId: string, records: CostRecord[]): Promise<PriceTrend[]> {
    const itemPrices = new Map<string, number[]>()
    
    // 收集每个商品的价格历史
    records.forEach(record => {
      const prices = itemPrices.get(record.itemName) || []
      prices.push(record.unitPrice)
      itemPrices.set(record.itemName, prices)
    })

    // 获取30天前的价格数据进行对比
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const oldRecords = await this.getCostRecords(familyId, thirtyDaysAgo)
    
    const oldPrices = new Map<string, number[]>()
    oldRecords.forEach(record => {
      const prices = oldPrices.get(record.itemName) || []
      prices.push(record.unitPrice)
      oldPrices.set(record.itemName, prices)
    })

    const trends: PriceTrend[] = []
    
    itemPrices.forEach((prices, itemName) => {
      if (prices.length < 2) return // 需要至少2个数据点

      const currentPrice = prices[prices.length - 1]
      const avgPrice30Days = prices.reduce((a, b) => a + b, 0) / prices.length
      const priceChange = currentPrice - avgPrice30Days
      const priceChangePercent = Math.round((priceChange / avgPrice30Days) * 100)

      let trend: 'rising' | 'falling' | 'stable'
      if (Math.abs(priceChangePercent) < 5) trend = 'stable'
      else if (priceChangePercent > 0) trend = 'rising'
      else trend = 'falling'

      let recommendation = ''
      if (trend === 'rising') {
        recommendation = '价格上涨中，建议适量囤货或寻找替代品'
      } else if (trend === 'falling') {
        recommendation = '价格下降中，是采购的好时机'
      } else {
        recommendation = '价格稳定，可按需采购'
      }

      const record = records.find(r => r.itemName === itemName)
      trends.push({
        itemName,
        category: record?.category || '未分类',
        currentPrice: Math.round(currentPrice * 100) / 100,
        avgPrice30Days: Math.round(avgPrice30Days * 100) / 100,
        priceChange: Math.round(priceChange * 100) / 100,
        priceChangePercent,
        trend,
        recommendation
      })
    })

    return trends.sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent)).slice(0, 20)
  }

  /**
   * 生成优化建议
   */
  private async generateOptimizationSuggestions(familyId: string, records: CostRecord[]): Promise<CostOptimization> {
    const recommendations: CostOptimization['recommendations'] = []
    
    // 分析批量购买机会
    const itemFrequency = new Map<string, { count: number, avgQuantity: number, totalCost: number }>()
    records.forEach(record => {
      const current = itemFrequency.get(record.itemName) || { count: 0, avgQuantity: 0, totalCost: 0 }
      current.count += 1
      current.avgQuantity += record.quantity
      current.totalCost += record.totalCost
      itemFrequency.set(record.itemName, current)
    })

    // 高频商品批量购买建议
    itemFrequency.forEach((data, itemName) => {
      if (data.count >= 3) { // 购买3次以上
        const avgUnitPrice = data.totalCost / data.avgQuantity
        const bulkDiscount = 0.15 // 假设批量购买15%折扣
        const optimizedCost = data.totalCost * (1 - bulkDiscount)
        const savings = data.totalCost - optimizedCost

        recommendations.push({
          type: 'bulk_purchase',
          itemName,
          currentCost: Math.round(data.totalCost * 100) / 100,
          optimizedCost: Math.round(optimizedCost * 100) / 100,
          savings: Math.round(savings * 100) / 100,
          action: `建议批量购买${itemName}，可节省约15%成本`,
          confidence: 0.8
        })
      }
    })

    // 浪费分析
    const wastedItems = records.filter(r => r.wastageReason)
    const wastageMap = new Map<string, { amount: number, value: number, reasons: string[] }>()
    
    wastedItems.forEach(item => {
      const current = wastageMap.get(item.itemName) || { amount: 0, value: 0, reasons: [] }
      current.amount += item.quantity
      current.value += item.totalCost
      if (item.wastageReason && !current.reasons.includes(item.wastageReason)) {
        current.reasons.push(item.wastageReason)
      }
      wastageMap.set(item.itemName, current)
    })

    const topWastedItems = Array.from(wastageMap.entries())
      .map(([itemName, data]) => ({
        itemName,
        wastedAmount: data.amount,
        wastedValue: Math.round(data.value * 100) / 100,
        mainReasons: data.reasons
      }))
      .sort((a, b) => b.wastedValue - a.wastedValue)
      .slice(0, 10)

    const totalWastage = topWastedItems.reduce((sum, item) => sum + item.wastedValue, 0)
    const totalValue = records.reduce((sum, record) => sum + record.totalCost, 0)
    const wastageRate = totalValue > 0 ? totalWastage / totalValue : 0

    const totalSavings = recommendations.reduce((sum, rec) => sum + rec.savings, 0)

    return {
      totalSavings: Math.round(totalSavings * 100) / 100,
      recommendations: recommendations.sort((a, b) => b.savings - a.savings).slice(0, 10),
      wastageAnalysis: {
        totalWastage: Math.round(totalWastage * 100) / 100,
        wastageRate: Math.round(wastageRate * 100) / 100,
        topWastedItems
      }
    }
  }

  /**
   * 获取月度对比数据
   */
  private async getMonthlyComparison(familyId: string): Promise<Array<{month: string, totalSpending: number, avgDailySpending: number, changeFromPrevious: number}>> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%Y-%m', purchase_date) as month,
          SUM(total_cost) as total_spending,
          AVG(total_cost) as avg_daily_spending
        FROM cost_records 
        WHERE family_id = ? 
        AND purchase_date >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', purchase_date)
        ORDER BY month DESC
      `
      
      this.getDatabase().all(query, [familyId], (err, rows: any[]) => {
        if (err) {
          reject(err)
        } else {
          const comparison = rows.map((row, index) => {
            const prevRow = rows[index + 1]
            const changeFromPrevious = prevRow 
              ? Math.round(((row.total_spending - prevRow.total_spending) / prevRow.total_spending) * 100)
              : 0

            return {
              month: row.month,
              totalSpending: Math.round(row.total_spending * 100) / 100,
              avgDailySpending: Math.round(row.avg_daily_spending * 100) / 100,
              changeFromPrevious
            }
          })
          resolve(comparison)
        }
      })
    })
  }

  /**
   * 生成预算建议
   */
  private async generateBudgetRecommendations(summary: CostSummary, budgets: BudgetConfig[]): Promise<string[]> {
    const recommendations: string[] = []

    // 检查是否超预算
    summary.budgetStatus.forEach(status => {
      if (status.status === 'exceeded') {
        recommendations.push(`${status.period}预算已超支${Math.abs(status.remaining)}元，建议调整支出或增加预算`)
      } else if (status.status === 'warning') {
        recommendations.push(`${status.period}预算使用率已达${status.utilizationRate}%，请注意控制支出`)
      }
    })

    // 基于历史数据的预算建议
    if (budgets.length === 0) {
      const suggestedMonthlyBudget = Math.round(summary.dailyAverage * 30 * 1.1) // 增加10%缓冲
      recommendations.push(`建议设置月度预算为${suggestedMonthlyBudget}元（基于当前日均支出${summary.dailyAverage}元）`)
    }

    // 类别预算建议
    summary.categoryBreakdown.slice(0, 3).forEach(category => {
      if (category.percentage > 40) {
        recommendations.push(`${category.category}类支出占比过高（${category.percentage}%），建议设置专项预算控制`)
      }
    })

    return recommendations
  }

  /**
   * 生成AI洞察
   */
  private async generateAIInsights(analysisData: CostAnalysisResponse): Promise<string> {
    const prompt = `
      基于以下家庭食材成本数据，请提供专业的成本控制和预算管理建议：
      
      基本信息：
      - 总支出：${analysisData.summary.totalSpending}元
      - 日均支出：${analysisData.summary.dailyAverage}元
      - 浪费率：${analysisData.optimization.wastageAnalysis.wastageRate}%
      - 潜在节省：${analysisData.optimization.totalSavings}元
      
      主要支出类别：
      ${analysisData.summary.categoryBreakdown.slice(0, 3).map(cat => 
        `- ${cat.category}: ${cat.amount}元 (${cat.percentage}%)`
      ).join('\n')}
      
      价格趋势：
      ${analysisData.trends.slice(0, 3).map(trend => 
        `- ${trend.itemName}: ${trend.trend === 'rising' ? '上涨' : trend.trend === 'falling' ? '下降' : '稳定'} ${Math.abs(trend.priceChangePercent)}%`
      ).join('\n')}
      
      请提供：
      1. 成本控制策略
      2. 预算优化建议
      3. 减少浪费的方法
      4. 采购时机建议
      
      要求简洁实用，300字以内。
    `

    const aiResponse = await this.aiService.makeRequest({
      prompt,
      context: undefined,
      familyId: analysisData.familyId,
      userId: analysisData.familyId,
      requestType: AIRequestType.GENERAL_ASSISTANT
    })

    return aiResponse.content
  }

  /**
   * 辅助方法：获取时间范围对应的天数
   */
  private getDaysInRange(timeRange: string): number {
    switch (timeRange) {
      case 'week': return 7
      case 'month': return 30
      case 'quarter': return 90
      case 'year': return 365
      default: return 30
    }
  }

  /**
   * 辅助方法：获取周期乘数
   */
  private getPeriodMultiplier(budgetPeriod: string, analysisRange: string): number {
    const budgetDays = budgetPeriod === 'daily' ? 1 : budgetPeriod === 'weekly' ? 7 : 30
    const analysisDays = this.getDaysInRange(analysisRange)
    return analysisDays / budgetDays
  }
}