/**
 * 智能购物清单生成服务
 * 基于库存分析和家庭需求，智能生成购物清单
 */

import { logger } from '../utils/logger';
import { dbGet } from '../config/database';
import { AIService } from './AIService';
import { isAIEnabled } from '../config/ai';
import type { AIServiceRequest, AIRequestType } from '../interfaces/ai';

export interface ShoppingListRequest {
  familyId: string;
  currentInventory?: string[];
  plannedMeals?: string[];
  familySize?: number;
  budget?: number;
  preferences?: string[];
  dietaryRestrictions?: string[];
  timeFrame?: number; // 几天的采购计划
  priority?: 'essential' | 'normal' | 'comprehensive';
}

export interface ShoppingItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  alternatives?: string[];
  urgency?: 'immediate' | 'this_week' | 'when_convenient';
}

export interface ShoppingListResponse {
  items: ShoppingItem[];
  totalEstimatedCost: number;
  categorizedItems: Record<string, ShoppingItem[]>;
  budgetAnalysis: {
    withinBudget: boolean;
    overBudgetBy?: number;
    suggestions: string[];
  };
  shoppingSuggestions: string[];
  reasoning: string;
}

export class SmartShoppingService {
  private static instance: SmartShoppingService;
  private aiService: AIService;

  public static getInstance(): SmartShoppingService {
    if (!SmartShoppingService.instance) {
      SmartShoppingService.instance = new SmartShoppingService();
    }
    return SmartShoppingService.instance;
  }

  constructor() {
    this.aiService = AIService.getInstance();
  }

  /**
   * 生成智能购物清单
   */
  async generateShoppingList(
    userId: string,
    request: ShoppingListRequest
  ): Promise<ShoppingListResponse> {
    try {
      // 1. 分析当前库存状况
      const inventoryAnalysis = await this.analyzeInventory(request.familyId);
      
      // 2. 获取家庭消费模式
      const consumptionPattern = await this.getConsumptionPattern(request.familyId);
      
      // 3. 分析即将到期和不足的物品
      const needsAnalysis = this.analyzeNeeds(inventoryAnalysis, request);
      
      // 4. 获取价格信息
      const priceData = await this.getPriceEstimates();

      // 5. 构建AI请求
      const aiPrompt = this.buildShoppingPrompt(
        request,
        inventoryAnalysis,
        consumptionPattern,
        needsAnalysis
      );

      let aiResponse: any = null;
      
      // 6. 调用AI服务
      if (isAIEnabled()) {
        try {
          const aiRequest: AIServiceRequest = {
            prompt: aiPrompt,
            requestType: 'shopping_list' as AIRequestType,
            userId,
            familyId: request.familyId,
            maxTokens: 2000,
            temperature: 0.6
          };

          aiResponse = await this.aiService.makeRequest(aiRequest);
        } catch (error) {
          logger.warn('AI购物清单服务失败，使用本地算法', { error: error instanceof Error ? error.message : error });
        }
      }

      // 7. 解析响应或使用本地算法
      let shoppingList: ShoppingListResponse;
      
      if (aiResponse && aiResponse.content) {
        shoppingList = this.parseAIResponse(aiResponse.content, priceData, request);
      } else {
        shoppingList = this.generateLocalShoppingList(request, inventoryAnalysis, needsAnalysis, priceData);
      }

      // 8. 优化和验证购物清单
      shoppingList = this.optimizeShoppingList(shoppingList, request);

      logger.info('购物清单生成成功', {
        familyId: request.familyId,
        userId,
        itemCount: shoppingList.items.length,
        totalCost: shoppingList.totalEstimatedCost,
        usedAI: !!aiResponse
      });

      return shoppingList;
    } catch (error) {
      logger.error('生成购物清单失败', { familyId: request.familyId, userId, error });
      throw error;
    }
  }

  /**
   * 分析库存状况
   */
  private async analyzeInventory(familyId: string) {
    try {
      // 获取所有库存物品
      const inventory = await dbGet(
        `SELECT 
          i.name,
          ic.name as category,
          COALESCE(SUM(ib.remaining_quantity), 0) as current_quantity,
          i.minimum_stock,
          i.unit,
          MIN(ib.expire_date) as next_expiry,
          CASE WHEN COALESCE(SUM(ib.remaining_quantity), 0) <= i.minimum_stock THEN 1 ELSE 0 END as is_low_stock
        FROM inventory_items i
        LEFT JOIN inventory_batches ib ON i.id = ib.item_id AND ib.remaining_quantity > 0
        LEFT JOIN inventory_categories ic ON i.category_id = ic.id
        WHERE i.family_id = ? AND i.is_active = 1 AND i.is_deleted = 0
        GROUP BY i.id, i.name, ic.name, i.unit, i.minimum_stock
        ORDER BY is_low_stock DESC, next_expiry ASC`,
        [familyId]
      );

      const inventoryArray = Array.isArray(inventory) ? inventory : inventory ? [inventory] : [];

      return {
        items: inventoryArray,
        lowStockItems: inventoryArray.filter((item: any) => item.is_low_stock),
        expiringSoon: inventoryArray.filter((item: any) => {
          if (!item.next_expiry) return false;
          const expiry = new Date(item.next_expiry);
          const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          return expiry <= threeDaysFromNow;
        }),
        categories: this.groupByCategory(inventoryArray)
      };
    } catch (error) {
      logger.error('分析库存状况失败', { familyId, error });
      return { items: [], lowStockItems: [], expiringSoon: [], categories: {} };
    }
  }

  /**
   * 获取消费模式
   */
  private async getConsumptionPattern(familyId: string) {
    try {
      // 分析过去30天的出库记录
      const consumptionData = await dbGet(
        `SELECT 
          i.name,
          ic.name as category,
          SUM(ib.consumed_quantity) as total_consumed,
          COUNT(*) as consumption_frequency
        FROM inventory_items i
        JOIN inventory_batches ib ON i.id = ib.item_id
        JOIN inventory_categories ic ON i.category_id = ic.id
        WHERE i.family_id = ? 
        AND ib.updated_at >= date('now', '-30 days')
        AND ib.consumed_quantity > 0
        GROUP BY i.id, i.name, ic.name
        ORDER BY total_consumed DESC`,
        [familyId]
      );

      const consumptionArray = Array.isArray(consumptionData) ? consumptionData : consumptionData ? [consumptionData] : [];

      return {
        highConsumptionItems: consumptionArray.slice(0, 10),
        categories: this.groupByCategory(consumptionArray),
        averageConsumption: this.calculateAverageConsumption(consumptionArray)
      };
    } catch (error) {
      logger.error('获取消费模式失败', { familyId, error });
      return { highConsumptionItems: [], categories: {}, averageConsumption: {} };
    }
  }

  /**
   * 分析需求
   */
  private analyzeNeeds(inventoryAnalysis: any, request: ShoppingListRequest) {
    const needs = {
      immediate: [] as any[],
      planned: [] as any[],
      routine: [] as any[]
    };

    // 立即需要的物品（库存不足或即将过期）
    needs.immediate = [
      ...inventoryAnalysis.lowStockItems.map((item: any) => ({
        ...item,
        reason: '库存不足',
        urgency: 'immediate'
      })),
      ...inventoryAnalysis.expiringSoon.map((item: any) => ({
        ...item,
        reason: '即将过期需替换',
        urgency: 'immediate'
      }))
    ];

    // 计划性需求（基于用餐计划）
    if (request.plannedMeals) {
      const plannedIngredients = this.extractIngredientsFromMeals(request.plannedMeals);
      needs.planned = plannedIngredients.map(ingredient => ({
        name: ingredient,
        reason: '用餐计划所需',
        urgency: 'this_week'
      }));
    }

    // 日常用品需求
    needs.routine = this.getRoutineItems(request);

    return needs;
  }

  /**
   * 获取价格估算
   */
  private async getPriceEstimates(): Promise<Record<string, number>> {
    // 这里可以集成实际的价格API，目前使用模拟数据
    return {
      // 蔬菜类
      '白菜': 3, '萝卜': 2, '土豆': 4, '番茄': 6, '黄瓜': 5,
      '青椒': 8, '茄子': 5, '豆角': 10, '韭菜': 6, '菠菜': 8,
      
      // 肉类
      '猪肉': 25, '牛肉': 45, '鸡肉': 20, '鱼': 30, '虾': 35,
      
      // 主食
      '大米': 6, '面粉': 5, '面条': 8, '馒头': 4,
      
      // 调料
      '盐': 3, '糖': 5, '醋': 8, '生抽': 12, '老抽': 15,
      '料酒': 10, '香油': 20, '花生油': 25,
      
      // 日用品
      '牙膏': 15, '洗发水': 25, '沐浴露': 20, '洗衣粉': 18,
      '卫生纸': 12, '洗洁精': 8
    };
  }

  /**
   * 构建购物提示词
   */
  private buildShoppingPrompt(
    request: ShoppingListRequest,
    inventoryAnalysis: any,
    consumptionPattern: any,
    needsAnalysis: any
  ): string {
    const prompt = `
作为智能购物助手，请基于以下信息生成购物清单：

## 家庭基本信息
- 家庭人数：${request.familySize || 3}人
- 采购时间范围：${request.timeFrame || 7}天
- 预算限制：${request.budget ? `¥${request.budget}` : '无特殊限制'}
- 优先级：${request.priority || 'normal'}

## 当前库存分析
**库存不足物品**：${inventoryAnalysis.lowStockItems.map((item: any) => item.name).join('、') || '无'}
**即将过期物品**：${inventoryAnalysis.expiringSoon.map((item: any) => item.name).join('、') || '无'}
**主要库存分类**：${Object.keys(inventoryAnalysis.categories).join('、')}

## 消费习惯分析
**高频消费物品**：${consumptionPattern.highConsumptionItems.slice(0, 5).map((item: any) => item.name).join('、')}

## 特殊需求
${request.plannedMeals ? `**计划餐食**：${request.plannedMeals.join('、')}` : ''}
${request.preferences ? `**偏好**：${request.preferences.join('、')}` : ''}
${request.dietaryRestrictions ? `**饮食限制**：${request.dietaryRestrictions.join('、')}` : ''}

## 需求分析
**紧急需求**：${needsAnalysis.immediate.map((item: any) => `${item.name}(${item.reason})`).join('、')}
**计划需求**：${needsAnalysis.planned.map((item: any) => item.name).join('、')}

## 要求
请生成一份智能购物清单，包含：
1. 具体商品名称和建议购买数量
2. 商品分类（生鲜、日用品、调料等）
3. 购买优先级（高、中、低）
4. 购买理由（库存不足、计划用餐、日常需要等）
5. 预计价格和替代品建议
6. 总体预算分析和购物建议

请以JSON格式返回结果，确保实用性和经济性。
`;

    return prompt.trim();
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(
    aiContent: string,
    priceData: Record<string, number>,
    request: ShoppingListRequest
  ): ShoppingListResponse {
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.items) {
          return this.formatShoppingListResponse(parsed, priceData, request);
        }
      }

      return this.parseTextShoppingList(aiContent, priceData, request);
    } catch (error) {
      logger.warn('解析AI购物清单响应失败', { error });
      return this.parseTextShoppingList(aiContent, priceData, request);
    }
  }

  /**
   * 本地算法生成购物清单
   */
  private generateLocalShoppingList(
    request: ShoppingListRequest,
    inventoryAnalysis: any,
    needsAnalysis: any,
    priceData: Record<string, number>
  ): ShoppingListResponse {
    const items: ShoppingItem[] = [];

    // 添加库存不足的物品
    inventoryAnalysis.lowStockItems.forEach((item: any) => {
      items.push({
        name: item.name,
        category: item.category || '其他',
        quantity: Math.max(1, item.minimum_stock - item.current_quantity),
        unit: item.unit || '份',
        estimatedPrice: priceData[item.name] || 10,
        priority: 'high',
        reason: '库存不足，需要补充',
        urgency: 'immediate'
      });
    });

    // 添加基础生活用品
    const essentials = [
      { name: '大米', category: '主食', quantity: 1, unit: '袋(5kg)', price: 30 },
      { name: '食用油', category: '调料', quantity: 1, unit: '瓶', price: 25 },
      { name: '鸡蛋', category: '蛋类', quantity: 1, unit: '斤', price: 12 },
      { name: '牛奶', category: '乳制品', quantity: 2, unit: '盒', price: 8 }
    ];

    essentials.forEach(essential => {
      items.push({
        name: essential.name,
        category: essential.category,
        quantity: essential.quantity,
        unit: essential.unit,
        estimatedPrice: essential.price,
        priority: 'medium',
        reason: '日常必需品',
        urgency: 'this_week'
      });
    });

    // 添加新鲜蔬菜
    const vegetables = ['白菜', '土豆', '番茄', '黄瓜'];
    vegetables.forEach(veg => {
      items.push({
        name: veg,
        category: '蔬菜',
        quantity: 1,
        unit: '斤',
        estimatedPrice: priceData[veg] || 5,
        priority: 'medium',
        reason: '保证营养均衡',
        urgency: 'this_week'
      });
    });

    return this.formatShoppingListResponse({ items }, priceData, request);
  }

  /**
   * 格式化购物清单响应
   */
  private formatShoppingListResponse(
    data: any,
    priceData: Record<string, number>,
    request: ShoppingListRequest
  ): ShoppingListResponse {
    const items: ShoppingItem[] = data.items.map((item: any) => ({
      name: item.name,
      category: item.category || '其他',
      quantity: item.quantity || 1,
      unit: item.unit || '份',
      estimatedPrice: item.estimatedPrice || priceData[item.name] || 10,
      priority: item.priority || 'medium',
      reason: item.reason || '日常需要',
      alternatives: item.alternatives || [],
      urgency: item.urgency || 'this_week'
    }));

    const totalCost = items.reduce((sum, item) => sum + (item.estimatedPrice * item.quantity), 0);
    const categorizedItems = this.categorizeItems(items);

    const budgetAnalysis = this.analyzeBudget(totalCost, request.budget);

    return {
      items,
      totalEstimatedCost: totalCost,
      categorizedItems,
      budgetAnalysis,
      shoppingSuggestions: this.generateShoppingSuggestions(items, request),
      reasoning: data.reasoning || '基于库存分析和家庭需求的智能推荐'
    };
  }

  /**
   * 优化购物清单
   */
  private optimizeShoppingList(
    shoppingList: ShoppingListResponse,
    request: ShoppingListRequest
  ): ShoppingListResponse {
    // 按优先级排序
    shoppingList.items.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aOrder = priorityOrder[a.priority] || 1;
      const bOrder = priorityOrder[b.priority] || 1;
      
      if (aOrder !== bOrder) {
        return bOrder - aOrder;
      }
      
      // 优先级相同按紧急程度排序
      const urgencyOrder = { immediate: 3, this_week: 2, when_convenient: 1 };
      const aUrgency = urgencyOrder[a.urgency || 'when_convenient'] || 1;
      const bUrgency = urgencyOrder[b.urgency || 'when_convenient'] || 1;
      
      return bUrgency - aUrgency;
    });

    // 预算优化
    if (request.budget && shoppingList.totalEstimatedCost > request.budget) {
      shoppingList = this.optimizeForBudget(shoppingList, request.budget);
    }

    return shoppingList;
  }

  // 辅助方法
  private groupByCategory(items: any[]): Record<string, any[]> {
    return items.reduce((groups, item) => {
      const category = item.category || '其他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {});
  }

  private calculateAverageConsumption(items: any[]): Record<string, number> {
    return items.reduce((avg, item) => {
      avg[item.name] = item.total_consumed / 30; // 日均消费
      return avg;
    }, {});
  }

  private extractIngredientsFromMeals(meals: string[]): string[] {
    // 简单的食材提取逻辑，实际可以更复杂
    const commonIngredients = ['米饭', '面条', '鸡蛋', '蔬菜', '肉类', '调料'];
    return commonIngredients.filter(ingredient => 
      meals.some(meal => meal.includes(ingredient.substring(0, 1)))
    );
  }

  private getRoutineItems(request: ShoppingListRequest): any[] {
    const routineItems = [
      { name: '洗洁精', category: '日用品', reason: '日常清洁' },
      { name: '卫生纸', category: '日用品', reason: '生活必需' },
      { name: '牙膏', category: '个人护理', reason: '个人卫生' }
    ];

    return routineItems.map(item => ({
      ...item,
      urgency: 'when_convenient'
    }));
  }

  private parseTextShoppingList(
    content: string,
    priceData: Record<string, number>,
    request: ShoppingListRequest
  ): ShoppingListResponse {
    const items: ShoppingItem[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('购买') || line.includes('需要') || /\d+/.test(line)) {
        const item: ShoppingItem = {
          name: this.extractItemName(line) || '商品',
          category: this.extractCategory(line) || '其他',
          quantity: this.extractQuantity(line) || 1,
          unit: this.extractUnit(line) || '份',
          estimatedPrice: priceData[this.extractItemName(line) || ''] || 10,
          priority: this.extractPriority(line) || 'medium',
          reason: this.extractReason(line) || '日常需要',
          urgency: 'this_week'
        };
        items.push(item);
      }
    }

    return this.formatShoppingListResponse({ items }, priceData, request);
  }

  private categorizeItems(items: ShoppingItem[]): Record<string, ShoppingItem[]> {
    return items.reduce((categories, item) => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
      return categories;
    }, {} as Record<string, ShoppingItem[]>);
  }

  private analyzeBudget(totalCost: number, budget?: number) {
    if (!budget) {
      return {
        withinBudget: true,
        suggestions: ['合理的价格预估', '建议比较不同商家价格']
      };
    }

    const withinBudget = totalCost <= budget;
    const suggestions = [];

    if (!withinBudget) {
      const overBy = totalCost - budget;
      suggestions.push(
        '考虑减少非必需品',
        '选择更经济的替代品',
        '分批次采购',
        `需要削减约¥${overBy.toFixed(2)}`
      );
      return { withinBudget, overBudgetBy: overBy, suggestions };
    }

    suggestions.push(
      '预算控制良好',
      '可考虑增加一些营养品',
      '建议预留紧急采购资金'
    );

    return { withinBudget, suggestions };
  }

  private generateShoppingSuggestions(items: ShoppingItem[], request: ShoppingListRequest): string[] {
    const suggestions = [
      '建议选择新鲜食材，注意保质期',
      '可以考虑批量购买常用物品以节省成本',
      '购买前检查家中库存，避免重复采购',
      '选择当季蔬菜，价格更优惠且营养更好'
    ];

    if (request.budget) {
      suggestions.push('建议货比三家，选择性价比更高的商品');
    }

    if (items.some(item => item.priority === 'high')) {
      suggestions.push('优先购买高优先级物品，避免影响日常生活');
    }

    return suggestions;
  }

  private optimizeForBudget(
    shoppingList: ShoppingListResponse,
    budget: number
  ): ShoppingListResponse {
    let currentCost = shoppingList.totalEstimatedCost;
    const optimizedItems = [...shoppingList.items];

    // 按优先级从低到高移除物品，直到符合预算
    while (currentCost > budget && optimizedItems.length > 0) {
      const lowPriorityIndex = optimizedItems.findIndex(item => item.priority === 'low');
      if (lowPriorityIndex !== -1) {
        const removedItem = optimizedItems.splice(lowPriorityIndex, 1)[0];
        currentCost -= removedItem.estimatedPrice * removedItem.quantity;
      } else {
        break;
      }
    }

    // 重新计算
    const newTotalCost = optimizedItems.reduce((sum, item) => sum + (item.estimatedPrice * item.quantity), 0);
    const newCategorizedItems = this.categorizeItems(optimizedItems);
    const newBudgetAnalysis = this.analyzeBudget(newTotalCost, budget);

    return {
      ...shoppingList,
      items: optimizedItems,
      totalEstimatedCost: newTotalCost,
      categorizedItems: newCategorizedItems,
      budgetAnalysis: newBudgetAnalysis
    };
  }

  // 文本解析辅助方法
  private extractItemName(text: string): string | null {
    const patterns = [/购买(.+?)(?=\s|，|,|$)/i, /需要(.+?)(?=\s|，|,|$)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractCategory(text: string): string | null {
    const categories = ['蔬菜', '水果', '肉类', '主食', '调料', '日用品', '个人护理'];
    for (const category of categories) {
      if (text.includes(category)) return category;
    }
    return null;
  }

  private extractQuantity(text: string): number | null {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  private extractUnit(text: string): string | null {
    const units = ['斤', '公斤', '袋', '瓶', '盒', '个', '份'];
    for (const unit of units) {
      if (text.includes(unit)) return unit;
    }
    return null;
  }

  private extractPriority(text: string): 'high' | 'medium' | 'low' | null {
    if (text.includes('紧急') || text.includes('急需')) return 'high';
    if (text.includes('可选') || text.includes('备用')) return 'low';
    return null;
  }

  private extractReason(text: string): string | null {
    const patterns = [/因为(.+?)(?=\s|，|,|$)/i, /原因(.+?)(?=\s|，|,|$)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }
}