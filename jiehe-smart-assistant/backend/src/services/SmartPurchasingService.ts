/**
 * 智能采购计划生成服务
 * 基于库存状况、消费模式、价格趋势等数据生成智能采购建议
 */

import { Database } from 'sqlite3'
import { DatabaseManager } from '../config/database'
import { AIService } from './AIService'
import { CostAnalysisService } from './CostAnalysisService'
import { logger } from '../utils/logger'

export interface PurchasingRequest {
  familyId: string
  userId: string
  timeHorizon: 'week' | 'month' | 'quarter'
  budget?: number
  preferences?: {
    priorityCategories?: string[]
    avoidCategories?: string[]
    bulkPurchasePreference?: boolean
    organicPreference?: boolean
    localPreference?: boolean
  }
  constraints?: {
    storageCapacity?: 'small' | 'medium' | 'large'
    shoppingFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    dietaryRestrictions?: string[]
  }
}

export interface PurchaseItem {
  id: string
  itemName: string
  category: string
  recommendedQuantity: number
  unit: string
  estimatedPrice: number
  totalCost: number
  priority: 'high' | 'medium' | 'low'
  reasoning: string
  alternatives?: string[]
  bulkOption?: {
    quantity: number
    unitPrice: number
    savings: number
  }
  seasonality?: {
    isInSeason: boolean
    priceImpact: 'positive' | 'negative' | 'neutral'
  }
  nutritionalValue?: {
    calories: number
    protein: number
    vitamins: string[]
  }
}

export interface PurchasingPlan {
  planId: string
  familyId: string
  timeHorizon: string
  generatedAt: string
  totalBudget: number
  estimatedCost: number
  savingsOpportunity: number
  items: PurchaseItem[]
  schedule: Array<{
    week: number
    items: string[]
    estimatedCost: number
    reasoning: string
  }>
  optimizations: {
    bulkPurchases: PurchaseItem[]
    seasonalBuys: PurchaseItem[]
    costSavings: number
    nutritionScore: number
  }
}

export interface PurchasingResponse {
  success: boolean
  plan: PurchasingPlan
  insights: {
    budgetUtilization: number
    nutritionBalance: string
    sustainabilityScore: number
    convenience: string
  }
  alternatives: Array<{
    scenario: string
    totalCost: number
    keyChanges: string[]
  }>
  aiRecommendations?: string
}

export class SmartPurchasingService {
  private static instance: SmartPurchasingService
  private db: Database
  private aiService: AIService
  private costAnalysisService: CostAnalysisService

  constructor() {
    this.aiService = AIService.getInstance()
    this.costAnalysisService = CostAnalysisService.getInstance()
  }

  private getDatabase() {
    if (!this.db) {
      this.db = DatabaseManager.getInstance().getDatabase()
    }
    return this.db
  }

  public static getInstance(): SmartPurchasingService {
    if (!SmartPurchasingService.instance) {
      SmartPurchasingService.instance = new SmartPurchasingService()
    }
    return SmartPurchasingService.instance
  }

  /**
   * 生成智能采购计划
   */
  async generatePurchasingPlan(request: PurchasingRequest): Promise<PurchasingResponse> {
    try {
      logger.info(`开始生成智能采购计划`, { 
        familyId: request.familyId, 
        timeHorizon: request.timeHorizon 
      })

      // 收集分析数据
      const analysisData = await this.collectAnalysisData(request.familyId, request.timeHorizon)
      
      // 生成基础采购清单
      const baseItems = await this.generateBaseItems(request, analysisData)
      
      // 应用智能优化
      const optimizedItems = await this.applyOptimizations(baseItems, analysisData, request)
      
      // 生成采购时间表
      const schedule = await this.generatePurchaseSchedule(optimizedItems, request)
      
      // 计算优化结果
      const optimizations = await this.calculateOptimizations(optimizedItems, baseItems)
      
      // 生成采购计划
      const plan: PurchasingPlan = {
        planId: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        familyId: request.familyId,
        timeHorizon: request.timeHorizon,
        generatedAt: new Date().toISOString(),
        totalBudget: request.budget || 0,
        estimatedCost: optimizedItems.reduce((sum, item) => sum + item.totalCost, 0),
        savingsOpportunity: optimizations.costSavings,
        items: optimizedItems,
        schedule,
        optimizations
      }

      // 生成洞察分析
      const insights = await this.generateInsights(plan, request)
      
      // 生成替代方案
      const alternatives = await this.generateAlternatives(plan, request)

      const response: PurchasingResponse = {
        success: true,
        plan,
        insights,
        alternatives
      }

      // 尝试获取AI建议
      try {
        const aiRecommendations = await this.generateAIRecommendations(response)
        response.aiRecommendations = aiRecommendations
      } catch (error) {
        logger.warn('AI建议生成失败，使用本地分析', { error: error.message })
      }

      // 保存采购计划
      await this.savePurchasingPlan(plan)

      logger.info(`智能采购计划生成完成`, { 
        planId: plan.planId,
        itemCount: plan.items.length,
        estimatedCost: plan.estimatedCost
      })

      return response

    } catch (error) {
      logger.error('生成智能采购计划失败', { error: error.message, request })
      throw new Error(`采购计划生成失败: ${error.message}`)
    }
  }

  /**
   * 收集分析数据
   */
  private async collectAnalysisData(familyId: string, timeHorizon: string): Promise<any> {
    const [
      currentInventory,
      consumptionHistory,
      priceHistory,
      familyPreferences
    ] = await Promise.all([
      this.getCurrentInventory(familyId),
      this.getConsumptionHistory(familyId, timeHorizon),
      this.getPriceHistory(familyId, timeHorizon),
      this.getFamilyPreferences(familyId)
    ])

    return {
      currentInventory,
      consumptionHistory,
      priceHistory,
      familyPreferences
    }
  }

  /**
   * 获取当前库存
   */
  private async getCurrentInventory(familyId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT i.id, i.name, i.category, i.unit, i.min_stock_level,
               SUM(ib.quantity) as current_quantity,
               AVG(ib.cost_per_unit) as avg_cost
        FROM inventory i
        LEFT JOIN inventory_batches ib ON i.id = ib.inventory_id
        WHERE i.family_id = ? AND i.deleted_at IS NULL
        AND (ib.consumed_at IS NULL OR ib.consumed_at = '')
        GROUP BY i.id
        ORDER BY i.category, i.name
      `
      
      this.getDatabase().all(query, [familyId], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取消费历史
   */
  private async getConsumptionHistory(familyId: string, timeHorizon: string): Promise<any[]> {
    const days = this.getTimeHorizonDays(timeHorizon)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    return new Promise((resolve, reject) => {
      const query = `
        SELECT i.name, i.category, i.unit,
               SUM(ib.quantity) as total_consumed,
               COUNT(*) as consumption_frequency,
               AVG(ib.cost_per_unit) as avg_cost
        FROM inventory i
        LEFT JOIN inventory_batches ib ON i.id = ib.inventory_id
        WHERE i.family_id = ? AND ib.consumed_at >= ?
        GROUP BY i.id
        ORDER BY total_consumed DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取价格历史
   */
  private async getPriceHistory(familyId: string, timeHorizon: string): Promise<any[]> {
    const days = this.getTimeHorizonDays(timeHorizon)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    return new Promise((resolve, reject) => {
      const query = `
        SELECT item_name, category, unit_price, purchase_date
        FROM cost_records
        WHERE family_id = ? AND purchase_date >= ?
        ORDER BY item_name, purchase_date DESC
      `
      
      this.getDatabase().all(query, [familyId, startDate], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  /**
   * 获取家庭偏好
   */
  private async getFamilyPreferences(familyId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT mv.*, md.category, mvr.vote_type
        FROM menu_voting mv
        LEFT JOIN menu_dishes md ON mv.menu_id = md.menu_id
        LEFT JOIN menu_voting_results mvr ON mv.id = mvr.voting_id
        WHERE mv.family_id = ? AND mv.status = 'completed'
        ORDER BY mv.created_at DESC
        LIMIT 100
      `
      
      this.getDatabase().all(query, [familyId], (err, rows) => {
        if (err) reject(err)
        else {
          const preferences = this.analyzeVotingPreferences(rows || [])
          resolve(preferences)
        }
      })
    })
  }

  /**
   * 分析投票偏好
   */
  private analyzeVotingPreferences(votingData: any[]): any {
    const categoryPreferences = new Map<string, { likes: number, dislikes: number }>()
    
    votingData.forEach(vote => {
      if (!vote.category) return
      
      const current = categoryPreferences.get(vote.category) || { likes: 0, dislikes: 0 }
      
      if (vote.vote_type === 'like') current.likes++
      else if (vote.vote_type === 'dislike') current.dislikes++
      
      categoryPreferences.set(vote.category, current)
    })

    const preferences = Array.from(categoryPreferences.entries())
      .map(([category, data]) => ({
        category,
        score: (data.likes - data.dislikes) / Math.max(data.likes + data.dislikes, 1),
        confidence: Math.min(data.likes + data.dislikes, 20) / 20
      }))
      .sort((a, b) => b.score - a.score)

    return {
      topCategories: preferences.filter(p => p.score > 0).slice(0, 5),
      avoidCategories: preferences.filter(p => p.score < -0.3).slice(0, 3)
    }
  }

  /**
   * 生成基础采购清单
   */
  private async generateBaseItems(request: PurchasingRequest, analysisData: any): Promise<PurchaseItem[]> {
    const items: PurchaseItem[] = []
    
    // 基于库存不足生成采购项目
    analysisData.currentInventory.forEach((inventoryItem: any) => {
      const currentQty = inventoryItem.current_quantity || 0
      const minLevel = inventoryItem.min_stock_level || 0
      
      if (currentQty <= minLevel) {
        const consumptionData = analysisData.consumptionHistory.find(
          (h: any) => h.name === inventoryItem.name
        )
        
        const dailyConsumption = consumptionData ? 
          consumptionData.total_consumed / this.getTimeHorizonDays(request.timeHorizon) : 0.1
        
        const recommendedQty = Math.max(
          minLevel + 1,
          dailyConsumption * this.getTimeHorizonDays(request.timeHorizon) * 1.2
        )

        items.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          itemName: inventoryItem.name,
          category: inventoryItem.category,
          recommendedQuantity: Math.round(recommendedQty * 10) / 10,
          unit: inventoryItem.unit,
          estimatedPrice: inventoryItem.avg_cost || this.getEstimatedPrice(inventoryItem.name),
          totalCost: 0, // 将在后续计算
          priority: 'high',
          reasoning: `库存不足：当前${currentQty}${inventoryItem.unit}，低于最低库存${minLevel}${inventoryItem.unit}`,
          alternatives: this.generateAlternativeItems(inventoryItem.name, inventoryItem.category)
        })
      }
    })

    // 基于消费模式预测未来需求
    analysisData.consumptionHistory.forEach((item: any) => {
      const currentInventoryItem = analysisData.currentInventory.find(
        (inv: any) => inv.name === item.name
      )
      
      if (!currentInventoryItem) {
        // 历史消费但当前无库存的物品
        const dailyConsumption = item.total_consumed / this.getTimeHorizonDays(request.timeHorizon)
        const forecastQty = dailyConsumption * this.getTimeHorizonDays(request.timeHorizon)
        
        if (forecastQty > 0.1) { // 只有预测消费量大于0.1才添加
          items.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            itemName: item.name,
            category: item.category,
            recommendedQuantity: Math.round(forecastQty * 10) / 10,
            unit: item.unit,
            estimatedPrice: item.avg_cost || this.getEstimatedPrice(item.name),
            totalCost: 0,
            priority: 'medium',
            reasoning: `基于消费预测：过去${request.timeHorizon}平均消费${item.total_consumed}${item.unit}`,
            alternatives: this.generateAlternativeItems(item.name, item.category)
          })
        }
      }
    })

    // 计算总成本
    items.forEach(item => {
      item.totalCost = Math.round(item.recommendedQuantity * item.estimatedPrice * 100) / 100
    })

    return items
  }

  /**
   * 应用智能优化
   */
  private async applyOptimizations(
    baseItems: PurchaseItem[], 
    analysisData: any, 
    request: PurchasingRequest
  ): Promise<PurchaseItem[]> {
    let optimizedItems = [...baseItems]

    // 应用预算约束
    if (request.budget) {
      optimizedItems = this.applyBudgetConstraints(optimizedItems, request.budget)
    }

    // 应用偏好优化
    if (request.preferences) {
      optimizedItems = this.applyPreferences(optimizedItems, request.preferences, analysisData.familyPreferences)
    }

    // 应用批量采购优化
    optimizedItems = this.applyBulkPurchaseOptimization(optimizedItems)

    // 应用季节性优化
    optimizedItems = this.applySeasonalOptimization(optimizedItems)

    // 应用营养平衡优化
    optimizedItems = this.applyNutritionalOptimization(optimizedItems)

    return optimizedItems
  }

  /**
   * 应用预算约束
   */
  private applyBudgetConstraints(items: PurchaseItem[], budget: number): PurchaseItem[] {
    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0)
    
    if (totalCost <= budget) {
      return items
    }

    // 按优先级排序，保留高优先级项目
    const sortedItems = items.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    const optimizedItems: PurchaseItem[] = []
    let currentCost = 0

    for (const item of sortedItems) {
      if (currentCost + item.totalCost <= budget) {
        optimizedItems.push(item)
        currentCost += item.totalCost
      } else if (item.priority === 'high') {
        // 对于高优先级项目，尝试减少数量
        const maxAffordableQty = (budget - currentCost) / item.estimatedPrice
        if (maxAffordableQty >= 0.5) {
          const reducedItem = {
            ...item,
            recommendedQuantity: Math.floor(maxAffordableQty * 10) / 10,
            totalCost: Math.round(maxAffordableQty * item.estimatedPrice * 100) / 100,
            reasoning: `${item.reasoning}（因预算限制调整数量）`
          }
          optimizedItems.push(reducedItem)
          currentCost += reducedItem.totalCost
        }
      }
    }

    return optimizedItems
  }

  /**
   * 应用偏好优化
   */
  private applyPreferences(
    items: PurchaseItem[], 
    preferences: any, 
    familyPreferences: any
  ): PurchaseItem[] {
    return items.map(item => {
      let adjustedItem = { ...item }

      // 检查优先类别
      if (preferences.priorityCategories?.includes(item.category)) {
        adjustedItem.priority = item.priority === 'low' ? 'medium' : 'high'
        adjustedItem.reasoning += ' · 符合偏好类别'
      }

      // 检查避免类别
      if (preferences.avoidCategories?.includes(item.category)) {
        adjustedItem.priority = 'low'
        adjustedItem.reasoning += ' · 非偏好类别'
      }

      // 基于家庭投票偏好调整
      const categoryPreference = familyPreferences.topCategories?.find(
        (pref: any) => pref.category === item.category
      )
      
      if (categoryPreference && categoryPreference.confidence > 0.5) {
        if (categoryPreference.score > 0.5) {
          adjustedItem.recommendedQuantity *= 1.2 // 增加20%
          adjustedItem.reasoning += ` · 家庭喜好类别(${Math.round(categoryPreference.score * 100)}%)`
        }
      }

      // 重新计算总成本
      adjustedItem.totalCost = Math.round(adjustedItem.recommendedQuantity * adjustedItem.estimatedPrice * 100) / 100

      return adjustedItem
    })
  }

  /**
   * 应用批量采购优化
   */
  private applyBulkPurchaseOptimization(items: PurchaseItem[]): PurchaseItem[] {
    return items.map(item => {
      // 对于数量较大的项目，提供批量采购选项
      if (item.recommendedQuantity >= 5 && ['肉类', '米面', '调料'].includes(item.category)) {
        const bulkQuantity = Math.ceil(item.recommendedQuantity * 1.5)
        const bulkDiscount = 0.12 // 12% 批量折扣
        const bulkUnitPrice = item.estimatedPrice * (1 - bulkDiscount)
        const savings = (item.estimatedPrice - bulkUnitPrice) * bulkQuantity

        item.bulkOption = {
          quantity: bulkQuantity,
          unitPrice: Math.round(bulkUnitPrice * 100) / 100,
          savings: Math.round(savings * 100) / 100
        }

        item.reasoning += ` · 可批量采购节省¥${item.bulkOption.savings}`
      }

      return item
    })
  }

  /**
   * 应用季节性优化
   */
  private applySeasonalOptimization(items: PurchaseItem[]): PurchaseItem[] {
    const currentMonth = new Date().getMonth() + 1
    
    return items.map(item => {
      const seasonality = this.getSeasonality(item.itemName, currentMonth)
      
      item.seasonality = seasonality
      
      if (seasonality.isInSeason && seasonality.priceImpact === 'positive') {
        item.priority = item.priority === 'low' ? 'medium' : 'high'
        item.recommendedQuantity *= 1.3 // 增加30%
        item.reasoning += ' · 当季优质低价'
      } else if (!seasonality.isInSeason && seasonality.priceImpact === 'negative') {
        item.priority = 'low'
        item.reasoning += ' · 非当季价格偏高'
      }

      // 重新计算总成本
      item.totalCost = Math.round(item.recommendedQuantity * item.estimatedPrice * 100) / 100
      
      return item
    })
  }

  /**
   * 应用营养平衡优化
   */
  private applyNutritionalOptimization(items: PurchaseItem[]): PurchaseItem[] {
    // 为每个项目添加营养价值信息
    return items.map(item => {
      item.nutritionalValue = this.getNutritionalValue(item.itemName, item.category)
      return item
    })
  }

  /**
   * 生成采购时间表
   */
  private async generatePurchaseSchedule(
    items: PurchaseItem[], 
    request: PurchasingRequest
  ): Promise<any[]> {
    const weeks = Math.ceil(this.getTimeHorizonDays(request.timeHorizon) / 7)
    const schedule: any[] = []

    // 按优先级和易腐程度分配到不同周次
    for (let week = 1; week <= weeks; week++) {
      const weekItems: string[] = []
      let weekCost = 0

      if (week === 1) {
        // 第一周：高优先级和急需物品
        items.filter(item => 
          item.priority === 'high' || 
          ['蔬菜', '水果', '肉类'].includes(item.category)
        ).forEach(item => {
          weekItems.push(item.id)
          weekCost += item.totalCost
        })
      } else if (week === 2) {
        // 第二周：中等优先级物品
        items.filter(item => 
          item.priority === 'medium' && 
          !['蔬菜', '水果', '肉类'].includes(item.category)
        ).forEach(item => {
          weekItems.push(item.id)
          weekCost += item.totalCost
        })
      } else {
        // 后续周：低优先级和耐储存物品
        items.filter(item => 
          item.priority === 'low' || 
          ['调料', '米面', '罐头'].includes(item.category)
        ).forEach(item => {
          if (!schedule.some(s => s.items.includes(item.id))) {
            weekItems.push(item.id)
            weekCost += item.totalCost
          }
        })
      }

      if (weekItems.length > 0) {
        schedule.push({
          week,
          items: weekItems,
          estimatedCost: Math.round(weekCost * 100) / 100,
          reasoning: this.generateWeekReasoning(week, weekItems.length)
        })
      }
    }

    return schedule
  }

  /**
   * 计算优化结果
   */
  private async calculateOptimizations(
    optimizedItems: PurchaseItem[], 
    baseItems: PurchaseItem[]
  ): Promise<any> {
    const bulkPurchases = optimizedItems.filter(item => item.bulkOption)
    const seasonalBuys = optimizedItems.filter(item => 
      item.seasonality?.isInSeason && item.seasonality.priceImpact === 'positive'
    )
    
    const baseCost = baseItems.reduce((sum, item) => sum + item.totalCost, 0)
    const optimizedCost = optimizedItems.reduce((sum, item) => sum + item.totalCost, 0)
    const costSavings = Math.max(0, baseCost - optimizedCost)

    const nutritionScore = this.calculateNutritionScore(optimizedItems)

    return {
      bulkPurchases,
      seasonalBuys,
      costSavings: Math.round(costSavings * 100) / 100,
      nutritionScore: Math.round(nutritionScore)
    }
  }

  /**
   * 生成洞察分析
   */
  private async generateInsights(plan: PurchasingPlan, request: PurchasingRequest): Promise<any> {
    const budgetUtilization = request.budget ? 
      Math.round((plan.estimatedCost / request.budget) * 100) : 100

    const nutritionBalance = this.evaluateNutritionBalance(plan.items)
    const sustainabilityScore = this.calculateSustainabilityScore(plan.items)
    const convenience = this.evaluateConvenience(plan.schedule, request)

    return {
      budgetUtilization,
      nutritionBalance,
      sustainabilityScore,
      convenience
    }
  }

  /**
   * 生成替代方案
   */
  private async generateAlternatives(plan: PurchasingPlan, request: PurchasingRequest): Promise<any[]> {
    const alternatives = []

    // 节约方案
    const budgetItems = plan.items.filter(item => item.priority !== 'high')
    const economyCost = plan.estimatedCost - budgetItems.reduce((sum, item) => sum + item.totalCost * 0.3, 0)
    alternatives.push({
      scenario: '经济方案',
      totalCost: Math.round(economyCost * 100) / 100,
      keyChanges: ['减少非必需品数量', '选择更多性价比选项', '推迟部分低优先级采购']
    })

    // 营养优化方案
    const nutritionCost = plan.estimatedCost * 1.15
    alternatives.push({
      scenario: '营养优化方案',
      totalCost: Math.round(nutritionCost * 100) / 100,
      keyChanges: ['增加有机蔬果', '选择优质蛋白质', '添加营养补充食品']
    })

    // 便利方案
    const convenienceCost = plan.estimatedCost * 1.25
    alternatives.push({
      scenario: '便利方案',
      totalCost: Math.round(convenienceCost * 100) / 100,
      keyChanges: ['选择预处理食材', '增加即食选项', '优先选择就近商店']
    })

    return alternatives
  }

  /**
   * 生成AI建议
   */
  private async generateAIRecommendations(response: PurchasingResponse): Promise<string> {
    const prompt = `
      基于以下智能采购计划数据，请提供专业的采购建议：
      
      计划概况：
      - 总预算：${response.plan.totalBudget}元
      - 预估成本：${response.plan.estimatedCost}元
      - 物品数量：${response.plan.items.length}项
      - 预算利用率：${response.insights.budgetUtilization}%
      
      主要采购类别：
      ${response.plan.items.slice(0, 5).map(item => 
        `- ${item.itemName}：${item.recommendedQuantity}${item.unit}，¥${item.totalCost}`
      ).join('\n')}
      
      优化机会：
      - 批量采购节省：${response.plan.optimizations.costSavings}元
      - 营养评分：${response.plan.optimizations.nutritionScore}分
      
      请提供：
      1. 采购策略建议
      2. 成本优化建议
      3. 营养搭配建议
      4. 储存和使用建议
      
      要求简洁实用，300字以内。
    `

    const aiResponse = await this.aiService.makeRequest({
      type: 'purchasing_plan',
      content: prompt,
      familyId: response.plan.familyId,
      userId: response.plan.familyId
    })

    return aiResponse.content
  }

  /**
   * 保存采购计划
   */
  private async savePurchasingPlan(plan: PurchasingPlan): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO purchasing_plans (
          id, family_id, time_horizon, total_budget, estimated_cost, 
          savings_opportunity, plan_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      this.getDatabase().run(query, [
        plan.planId, plan.familyId, plan.timeHorizon, plan.totalBudget,
        plan.estimatedCost, plan.savingsOpportunity, JSON.stringify(plan),
        plan.generatedAt
      ], function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  // 辅助方法
  private getTimeHorizonDays(timeHorizon: string): number {
    switch (timeHorizon) {
      case 'week': return 7
      case 'month': return 30
      case 'quarter': return 90
      default: return 30
    }
  }

  private getEstimatedPrice(itemName: string): number {
    // 简化的价格估算，实际可以从历史数据或外部API获取
    const priceMap: Record<string, number> = {
      '大米': 5.5, '面条': 3.2, '鸡蛋': 0.8, '牛奶': 3.5,
      '白菜': 2.5, '胡萝卜': 4.0, '土豆': 3.0, '苹果': 8.0,
      '猪肉': 25.0, '鸡肉': 18.0, '鱼肉': 22.0
    }
    return priceMap[itemName] || 10.0
  }

  private generateAlternativeItems(itemName: string, category: string): string[] {
    const alternatives: Record<string, string[]> = {
      '蔬菜': ['有机版本', '冷冻版本', '当季替代'],
      '肉类': ['不同部位', '冷冻版本', '其他肉类'],
      '水果': ['冷冻版本', '罐装版本', '当季替代']
    }
    return alternatives[category] || ['其他品牌', '不同规格']
  }

  private getSeasonality(itemName: string, month: number): any {
    // 简化的季节性判断
    const seasonalItems: Record<string, number[]> = {
      '苹果': [9, 10, 11, 12],
      '橙子': [11, 12, 1, 2],
      '草莓': [3, 4, 5],
      '西瓜': [6, 7, 8],
      '白菜': [10, 11, 12, 1],
      '萝卜': [10, 11, 12, 1]
    }

    const seasons = seasonalItems[itemName] || []
    const isInSeason = seasons.includes(month)
    
    return {
      isInSeason,
      priceImpact: isInSeason ? 'positive' : 'neutral'
    }
  }

  private getNutritionalValue(itemName: string, category: string): any {
    // 简化的营养价值数据
    const nutritionData: Record<string, any> = {
      '大米': { calories: 130, protein: 2.7, vitamins: ['B1', 'B3'] },
      '鸡蛋': { calories: 155, protein: 13, vitamins: ['A', 'D', 'B12'] },
      '苹果': { calories: 52, protein: 0.3, vitamins: ['C', 'K'] },
      '猪肉': { calories: 242, protein: 27, vitamins: ['B1', 'B6', 'B12'] }
    }
    
    return nutritionData[itemName] || { calories: 100, protein: 5, vitamins: ['综合'] }
  }

  private calculateNutritionScore(items: PurchaseItem[]): number {
    const categoryScores: Record<string, number> = {
      '蔬菜': 10, '水果': 9, '肉类': 8, '蛋类': 8,
      '奶制品': 7, '米面': 6, '调料': 3
    }

    const totalScore = items.reduce((sum, item) => {
      const score = categoryScores[item.category] || 5
      return sum + score * item.recommendedQuantity
    }, 0)

    const maxPossibleScore = items.length * 10
    return (totalScore / maxPossibleScore) * 100
  }

  private evaluateNutritionBalance(items: PurchaseItem[]): string {
    const categories = new Set(items.map(item => item.category))
    
    const hasVegetables = categories.has('蔬菜')
    const hasFruits = categories.has('水果')
    const hasProteins = categories.has('肉类') || categories.has('蛋类')
    const hasCarbs = categories.has('米面')

    if (hasVegetables && hasFruits && hasProteins && hasCarbs) {
      return '营养搭配均衡'
    } else if ((hasVegetables || hasFruits) && hasProteins) {
      return '营养搭配较好'
    } else {
      return '营养搭配需要改善'
    }
  }

  private calculateSustainabilityScore(items: PurchaseItem[]): number {
    // 简化的可持续性评分
    let score = 70 // 基础分

    const localItems = items.filter(item => 
      ['蔬菜', '水果'].includes(item.category)
    ).length
    score += localItems * 3

    const packagedItems = items.filter(item => 
      ['罐头', '包装食品'].includes(item.category)
    ).length
    score -= packagedItems * 2

    return Math.max(0, Math.min(100, score))
  }

  private evaluateConvenience(schedule: any[], request: PurchasingRequest): string {
    const totalWeeks = schedule.length
    
    if (totalWeeks <= 1) {
      return '一次性采购，最大便利'
    } else if (totalWeeks <= 2) {
      return '分两次采购，平衡便利与新鲜'
    } else {
      return '多次采购，确保食材新鲜'
    }
  }

  private generateWeekReasoning(week: number, itemCount: number): string {
    if (week === 1) {
      return `第${week}周：优先采购${itemCount}项高优先级和易腐食材`
    } else {
      return `第${week}周：采购${itemCount}项耐储存和补充类物品`
    }
  }
}