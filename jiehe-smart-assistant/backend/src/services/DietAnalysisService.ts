/**
 * 家庭饮食习惯分析服务
 * 提供基于历史数据的饮食模式分析、营养评估和健康建议
 */

import { Database } from 'sqlite3'
import { DatabaseManager } from '../config/database'
import { AIService } from './AIService'
import { logger } from '../utils/logger'

export interface DietAnalysisRequest {
  familyId: string
  userId: string
  timeRange: 'week' | 'month' | 'quarter' | 'year'
  analysisType: 'comprehensive' | 'nutrition' | 'preference' | 'cost' | 'trend'
}

export interface DietPattern {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  frequency: number
  avgCost: number
  popularIngredients: Array<{
    name: string
    frequency: number
    percentage: number
  }>
  nutritionScore: number
  preferences: Array<{
    category: string
    preference: number // -1 to 1
    confidence: number
  }>
}

export interface NutritionAnalysis {
  dailyAverage: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    vitamins: Record<string, number>
  }
  weeklyTrend: Array<{
    date: string
    calories: number
    nutritionScore: number
  }>
  nutritionBalance: {
    score: number // 0-100
    recommendations: string[]
    deficiencies: string[]
    excesses: string[]
  }
}

export interface CostAnalysis {
  totalSpending: number
  avgDailyCost: number
  categoryBreakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
  costTrend: Array<{
    date: string
    amount: number
  }>
  budgetEfficiency: {
    score: number
    wastageRate: number
    recommendations: string[]
  }
}

export interface DietAnalysisResponse {
  success: boolean
  familyId: string
  analysisDate: string
  timeRange: string
  summary: {
    totalMeals: number
    avgDailyCost: number
    nutritionScore: number
    varietyScore: number
    healthScore: number
  }
  patterns: DietPattern[]
  nutrition: NutritionAnalysis
  cost: CostAnalysis
  preferences: {
    topCategories: string[]
    dislikedCategories: string[]
    seasonalPreferences: Record<string, string[]>
  }
  recommendations: {
    nutritional: string[]
    economic: string[]
    variety: string[]
    health: string[]
  }
  aiInsights?: string
  trends: {
    improving: string[]
    declining: string[]
    stable: string[]
  }
}

export class DietAnalysisService {
  private static instance: DietAnalysisService
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

  public static getInstance(): DietAnalysisService {
    if (!DietAnalysisService.instance) {
      DietAnalysisService.instance = new DietAnalysisService()
    }
    return DietAnalysisService.instance
  }

  /**
   * 生成综合饮食分析报告
   */
  async generateAnalysis(request: DietAnalysisRequest): Promise<DietAnalysisResponse> {
    try {
      logger.info(`开始生成饮食分析报告`, { familyId: request.familyId, timeRange: request.timeRange })

      const timeFilter = this.getTimeFilter(request.timeRange)
      
      // 并行获取各类数据
      const [
        mealData,
        inventoryData, 
        menuVotingData,
        costData
      ] = await Promise.all([
        this.getMealData(request.familyId, timeFilter),
        this.getInventoryUsageData(request.familyId, timeFilter),
        this.getMenuVotingData(request.familyId, timeFilter),
        this.getCostData(request.familyId, timeFilter)
      ])

      // 分析饮食模式
      const patterns = await this.analyzeDietPatterns(mealData, inventoryData)
      
      // 营养分析
      const nutrition = await this.analyzeNutrition(mealData, inventoryData)
      
      // 成本分析
      const cost = await this.analyzeCost(costData, inventoryData)
      
      // 偏好分析
      const preferences = await this.analyzePreferences(menuVotingData, mealData)
      
      // 生成建议
      const recommendations = await this.generateRecommendations(patterns, nutrition, cost, preferences)
      
      // 趋势分析
      const trends = await this.analyzeTrends(request.familyId, request.timeRange)

      // 计算综合评分
      const summary = this.calculateSummary(patterns, nutrition, cost, mealData.length)

      const response: DietAnalysisResponse = {
        success: true,
        familyId: request.familyId,
        analysisDate: new Date().toISOString(),
        timeRange: request.timeRange,
        summary,
        patterns,
        nutrition,
        cost,
        preferences,
        recommendations,
        trends
      }

      // 尝试获取AI洞察
      try {
        const aiInsights = await this.generateAIInsights(response)
        response.aiInsights = aiInsights
      } catch (error) {
        logger.warn('AI洞察生成失败，使用本地分析', { error: error.message })
      }

      logger.info(`饮食分析报告生成完成`, { 
        familyId: request.familyId, 
        totalMeals: summary.totalMeals,
        nutritionScore: summary.nutritionScore
      })

      return response

    } catch (error) {
      logger.error('生成饮食分析报告失败', { error: error.message, request })
      throw new Error(`饮食分析失败: ${error.message}`)
    }
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
   * 获取餐食数据
   */
  private async getMealData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT mv.*, md.dish_name, md.category, md.estimated_cost, md.difficulty,
               json_extract(md.nutritional_info, '$.calories') as calories,
               json_extract(md.nutritional_info, '$.protein') as protein,
               json_extract(md.nutritional_info, '$.carbs') as carbs,
               json_extract(md.nutritional_info, '$.fat') as fat
        FROM menu_voting mv
        LEFT JOIN menu_dishes md ON mv.menu_id = md.menu_id
        WHERE mv.family_id = ? AND mv.created_at >= ?
        AND mv.status = 'completed'
        ORDER BY mv.created_at DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取库存使用数据
   */
  private async getInventoryUsageData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT i.name, i.category, i.unit, ib.quantity, ib.cost_per_unit,
               ib.expiration_date, ib.created_at, ib.consumed_at
        FROM inventory_batches ib
        LEFT JOIN inventory i ON ib.inventory_id = i.id
        WHERE i.family_id = ? AND ib.created_at >= ?
        AND ib.consumed_at IS NOT NULL
        ORDER BY ib.consumed_at DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取菜单投票数据
   */
  private async getMenuVotingData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT mv.menu_id, mv.status, mv.voting_end_time,
               mvr.user_id, mvr.dish_id, mvr.vote_type, mvr.priority,
               md.dish_name, md.category
        FROM menu_voting mv
        LEFT JOIN menu_voting_results mvr ON mv.id = mvr.voting_id
        LEFT JOIN menu_dishes md ON mvr.dish_id = md.id
        WHERE mv.family_id = ? AND mv.created_at >= ?
        ORDER BY mv.created_at DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取成本数据
   */
  private async getCostData(familyId: string, startDate: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DATE(ib.created_at) as date, 
               SUM(ib.quantity * ib.cost_per_unit) as daily_cost,
               i.category
        FROM inventory_batches ib
        LEFT JOIN inventory i ON ib.inventory_id = i.id
        WHERE i.family_id = ? AND ib.created_at >= ?
        GROUP BY DATE(ib.created_at), i.category
        ORDER BY date DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 分析饮食模式
   */
  private async analyzeDietPatterns(mealData: any[], inventoryData: any[]): Promise<DietPattern[]> {
    const patterns: Record<string, DietPattern> = {}

    // 基于时间段分析餐食类型
    mealData.forEach(meal => {
      const hour = new Date(meal.created_at).getHours()
      let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      
      if (hour >= 6 && hour < 10) mealType = 'breakfast'
      else if (hour >= 10 && hour < 14) mealType = 'lunch'
      else if (hour >= 17 && hour < 21) mealType = 'dinner'
      else mealType = 'snack'

      if (!patterns[mealType]) {
        patterns[mealType] = {
          mealType,
          frequency: 0,
          avgCost: 0,
          popularIngredients: [],
          nutritionScore: 0,
          preferences: []
        }
      }

      patterns[mealType].frequency++
      patterns[mealType].avgCost += meal.estimated_cost || 0
    })

    // 计算平均值和营养评分
    Object.values(patterns).forEach(pattern => {
      if (pattern.frequency > 0) {
        pattern.avgCost = pattern.avgCost / pattern.frequency
        pattern.nutritionScore = this.calculateNutritionScore(pattern.mealType)
      }
    })

    // 分析常用食材
    const ingredientMap = new Map<string, number>()
    inventoryData.forEach(item => {
      const count = ingredientMap.get(item.name) || 0
      ingredientMap.set(item.name, count + 1)
    })

    // 为每个餐食类型分配常用食材
    Object.values(patterns).forEach(pattern => {
      const totalIngredients = Array.from(ingredientMap.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, frequency]) => ({
          name,
          frequency,
          percentage: Math.round((frequency / inventoryData.length) * 100)
        }))
      
      pattern.popularIngredients = totalIngredients
    })

    return Object.values(patterns)
  }

  /**
   * 营养分析
   */
  private async analyzeNutrition(mealData: any[], inventoryData: any[]): Promise<NutritionAnalysis> {
    const dailyData = new Map<string, any>()

    // 按日期聚合营养数据
    mealData.forEach(meal => {
      const date = new Date(meal.created_at).toISOString().split('T')[0]
      if (!dailyData.has(date)) {
        dailyData.set(date, {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          count: 0
        })
      }

      const day = dailyData.get(date)
      day.calories += meal.calories || 0
      day.protein += meal.protein || 0
      day.carbs += meal.carbs || 0
      day.fat += meal.fat || 0
      day.count++
    })

    // 计算平均值
    const days = Array.from(dailyData.values())
    const avgCalories = days.reduce((sum, day) => sum + day.calories, 0) / Math.max(days.length, 1)
    const avgProtein = days.reduce((sum, day) => sum + day.protein, 0) / Math.max(days.length, 1)
    const avgCarbs = days.reduce((sum, day) => sum + day.carbs, 0) / Math.max(days.length, 1)
    const avgFat = days.reduce((sum, day) => sum + day.fat, 0) / Math.max(days.length, 1)

    // 生成周趋势
    const weeklyTrend = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        calories: data.calories,
        nutritionScore: this.calculateDailyNutritionScore(data)
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 营养平衡评估
    const nutritionBalance = this.evaluateNutritionBalance(avgCalories, avgProtein, avgCarbs, avgFat)

    return {
      dailyAverage: {
        calories: Math.round(avgCalories),
        protein: Math.round(avgProtein),
        carbs: Math.round(avgCarbs),
        fat: Math.round(avgFat),
        fiber: Math.round(avgProtein * 0.5), // 估算
        vitamins: { 
          A: Math.round(avgCalories * 0.001),
          C: Math.round(avgCalories * 0.002),
          D: Math.round(avgCalories * 0.0005)
        }
      },
      weeklyTrend,
      nutritionBalance
    }
  }

  /**
   * 成本分析
   */
  private async analyzeCost(costData: any[], inventoryData: any[]): Promise<CostAnalysis> {
    const totalSpending = costData.reduce((sum, item) => sum + (item.daily_cost || 0), 0)
    const uniqueDays = new Set(costData.map(item => item.date)).size
    const avgDailyCost = totalSpending / Math.max(uniqueDays, 1)

    // 按类别分析成本
    const categoryMap = new Map<string, number>()
    costData.forEach(item => {
      const current = categoryMap.get(item.category) || 0
      categoryMap.set(item.category, current + (item.daily_cost || 0))
    })

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percentage: Math.round((amount / totalSpending) * 100)
      }))
      .sort((a, b) => b.amount - a.amount)

    // 成本趋势
    const costTrend = costData
      .reduce((acc, item) => {
        const existing = acc.find(x => x.date === item.date)
        if (existing) {
          existing.amount += item.daily_cost || 0
        } else {
          acc.push({ date: item.date, amount: item.daily_cost || 0 })
        }
        return acc
      }, [] as Array<{date: string, amount: number}>)
      .sort((a, b) => a.date.localeCompare(b.date))

    // 预算效率评估
    const budgetEfficiency = this.evaluateBudgetEfficiency(inventoryData, totalSpending)

    return {
      totalSpending: Math.round(totalSpending * 100) / 100,
      avgDailyCost: Math.round(avgDailyCost * 100) / 100,
      categoryBreakdown,
      costTrend,
      budgetEfficiency
    }
  }

  /**
   * 偏好分析
   */
  private async analyzePreferences(votingData: any[], mealData: any[]): Promise<any> {
    const categoryVotes = new Map<string, { positive: number, negative: number, total: number }>()
    
    votingData.forEach(vote => {
      if (!vote.category) return
      
      const current = categoryVotes.get(vote.category) || { positive: 0, negative: 0, total: 0 }
      current.total++
      
      if (vote.vote_type === 'like') current.positive++
      else if (vote.vote_type === 'dislike') current.negative++
      
      categoryVotes.set(vote.category, current)
    })

    const topCategories = Array.from(categoryVotes.entries())
      .map(([category, votes]) => ({
        category,
        score: (votes.positive - votes.negative) / Math.max(votes.total, 1)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.category)

    const dislikedCategories = Array.from(categoryVotes.entries())
      .map(([category, votes]) => ({
        category,
        score: (votes.positive - votes.negative) / Math.max(votes.total, 1)
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(item => item.category)

    return {
      topCategories,
      dislikedCategories,
      seasonalPreferences: {
        spring: ['蔬菜', '水果'],
        summer: ['凉菜', '汤品'],
        autumn: ['肉类', '根茎'],
        winter: ['热菜', '汤品']
      }
    }
  }

  /**
   * 生成建议
   */
  private async generateRecommendations(
    patterns: DietPattern[], 
    nutrition: NutritionAnalysis, 
    cost: CostAnalysis, 
    preferences: any
  ): Promise<any> {
    const recommendations = {
      nutritional: [] as string[],
      economic: [] as string[],
      variety: [] as string[],
      health: [] as string[]
    }

    // 营养建议
    if (nutrition.nutritionBalance.score < 70) {
      recommendations.nutritional.push('建议增加蔬菜和水果的摄入，提高营养均衡性')
    }
    if (nutrition.dailyAverage.protein < 50) {
      recommendations.nutritional.push('蛋白质摄入不足，建议增加肉类、蛋类或豆类食品')
    }

    // 经济建议
    if (cost.budgetEfficiency.wastageRate > 0.2) {
      recommendations.economic.push('食材浪费率较高，建议改善食材管理和使用规划')
    }
    if (cost.avgDailyCost > 100) {
      recommendations.economic.push('日均饮食成本偏高，建议选择性价比更高的食材')
    }

    // 多样性建议
    const varietyScore = patterns.length * 25 // 简单计算
    if (varietyScore < 75) {
      recommendations.variety.push('饮食种类偏少，建议尝试更多不同类型的菜品')
    }

    // 健康建议
    if (nutrition.dailyAverage.calories > 2500) {
      recommendations.health.push('日均热量摄入偏高，建议控制食量或选择低热量食品')
    }

    return recommendations
  }

  /**
   * 趋势分析
   */
  private async analyzeTrends(familyId: string, timeRange: string): Promise<any> {
    // 这里可以比较不同时间段的数据来分析趋势
    return {
      improving: ['营养均衡性', '成本控制'],
      declining: [],
      stable: ['饮食偏好', '用餐规律']
    }
  }

  /**
   * 计算总结数据
   */
  private calculateSummary(patterns: DietPattern[], nutrition: NutritionAnalysis, cost: CostAnalysis, totalMeals: number): any {
    const nutritionScore = nutrition.nutritionBalance.score
    const varietyScore = Math.min(patterns.length * 20, 100)
    const healthScore = Math.round((nutritionScore + varietyScore) / 2)

    return {
      totalMeals,
      avgDailyCost: cost.avgDailyCost,
      nutritionScore: Math.round(nutritionScore),
      varietyScore: Math.round(varietyScore),
      healthScore
    }
  }

  /**
   * 生成AI洞察
   */
  private async generateAIInsights(analysisData: DietAnalysisResponse): Promise<string> {
    const prompt = `
      基于以下家庭饮食数据，请提供专业的健康和营养建议：
      
      基本信息：
      - 总餐数：${analysisData.summary.totalMeals}
      - 营养评分：${analysisData.summary.nutritionScore}/100
      - 健康评分：${analysisData.summary.healthScore}/100
      - 日均成本：${analysisData.summary.avgDailyCost}元
      
      营养状况：
      - 日均热量：${analysisData.nutrition.dailyAverage.calories}卡路里
      - 蛋白质：${analysisData.nutrition.dailyAverage.protein}g
      - 碳水化合物：${analysisData.nutrition.dailyAverage.carbs}g
      
      请提供：
      1. 营养状况评估
      2. 健康改善建议
      3. 经济优化建议
      4. 具体的行动计划
      
      要求简洁专业，300字以内。
    `

    const aiResponse = await this.aiService.makeRequest({
      type: 'diet_analysis',
      content: prompt,
      familyId: analysisData.familyId,
      userId: analysisData.familyId
    })

    return aiResponse.content
  }

  /**
   * 计算营养评分
   */
  private calculateNutritionScore(mealType: string): number {
    // 简化的营养评分算法
    const baseScore = {
      breakfast: 80,
      lunch: 85,
      dinner: 90,
      snack: 60
    }
    return baseScore[mealType] || 70
  }

  /**
   * 计算日营养评分
   */
  private calculateDailyNutritionScore(data: any): number {
    const ideal = { calories: 2000, protein: 60, carbs: 250, fat: 65 }
    const calScore = Math.max(0, 100 - Math.abs(data.calories - ideal.calories) / ideal.calories * 100)
    const proteinScore = Math.max(0, 100 - Math.abs(data.protein - ideal.protein) / ideal.protein * 100)
    
    return Math.round((calScore + proteinScore) / 2)
  }

  /**
   * 评估营养平衡
   */
  private evaluateNutritionBalance(calories: number, protein: number, carbs: number, fat: number): any {
    const recommendations: string[] = []
    const deficiencies: string[] = []
    const excesses: string[] = []

    if (protein < 50) deficiencies.push('蛋白质')
    if (protein > 100) excesses.push('蛋白质')
    if (calories < 1500) deficiencies.push('热量')
    if (calories > 2500) excesses.push('热量')

    const score = Math.max(0, 100 - deficiencies.length * 20 - excesses.length * 15)

    if (deficiencies.length > 0) {
      recommendations.push(`建议增加${deficiencies.join('、')}的摄入`)
    }
    if (excesses.length > 0) {
      recommendations.push(`建议减少${excesses.join('、')}的摄入`)
    }

    return { score, recommendations, deficiencies, excesses }
  }

  /**
   * 评估预算效率
   */
  private evaluateBudgetEfficiency(inventoryData: any[], totalSpending: number): any {
    const totalItems = inventoryData.length
    const expiredItems = inventoryData.filter(item => 
      item.expiration_date && new Date(item.expiration_date) < new Date()
    ).length

    const wastageRate = totalItems > 0 ? expiredItems / totalItems : 0
    const score = Math.max(0, 100 - wastageRate * 100)

    const recommendations: string[] = []
    if (wastageRate > 0.1) {
      recommendations.push('建议改善食材保存方法，减少浪费')
    }
    if (totalSpending > 1000) {
      recommendations.push('建议制定采购计划，控制成本')
    }

    return { score: Math.round(score), wastageRate, recommendations }
  }
}