/**
 * 基于库存的智能菜谱推荐服务
 * 结合AI和算法，提供个性化菜谱推荐
 */

import { logger } from '../utils/logger';
import { dbGet } from '../config/database';
import { AIService } from './AIService';
import { isAIEnabled } from '../config/ai';
import type { 
  RecipeRecommendationRequest, 
  RecipeRecommendationResponse, 
  Recipe, 
  AIServiceRequest, 
  AIRequestType 
} from '../interfaces/ai';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  total_quantity: number;
  unit: string;
  expire_date?: string;
  is_running_low: boolean;
}

export interface FamilyPreference {
  preferred_cuisines: string[];
  dietary_restrictions: string[];
  spice_level: 'mild' | 'medium' | 'spicy';
  cooking_skills: 'beginner' | 'intermediate' | 'advanced';
  typical_meal_times: string[];
}

export class RecipeRecommendationService {
  private static instance: RecipeRecommendationService;
  private aiService: AIService;

  public static getInstance(): RecipeRecommendationService {
    if (!RecipeRecommendationService.instance) {
      RecipeRecommendationService.instance = new RecipeRecommendationService();
    }
    return RecipeRecommendationService.instance;
  }

  constructor() {
    this.aiService = AIService.getInstance();
  }

  /**
   * 获取智能菜谱推荐
   */
  async getRecommendations(
    familyId: string,
    userId: string,
    request: RecipeRecommendationRequest
  ): Promise<RecipeRecommendationResponse> {
    try {
      // 1. 获取家庭库存情况
      const inventory = await this.getFamilyInventory(familyId);
      
      // 2. 获取家庭偏好设置
      const preferences = await this.getFamilyPreferences(familyId);
      
      // 3. 分析库存状况
      const inventoryAnalysis = this.analyzeInventory(inventory, request.availableIngredients);
      
      // 4. 构建AI推荐请求
      const aiPrompt = this.buildRecommendationPrompt(
        request,
        inventoryAnalysis,
        preferences
      );

      let aiResponse: any = null;
      
      // 5. 调用AI服务（如果启用）
      if (isAIEnabled()) {
        try {
          const aiRequest: AIServiceRequest = {
            prompt: aiPrompt,
            requestType: 'recipe_recommendation' as AIRequestType,
            userId,
            familyId,
            maxTokens: 2000,
            temperature: 0.7
          };

          aiResponse = await this.aiService.makeRequest(aiRequest);
        } catch (error) {
          logger.warn('AI推荐服务失败，使用本地算法', { error: error instanceof Error ? error.message : error });
        }
      }

      // 6. 解析AI响应或使用本地算法
      let recommendations: RecipeRecommendationResponse;
      
      if (aiResponse && aiResponse.content) {
        recommendations = this.parseAIResponse(aiResponse.content, inventoryAnalysis);
      } else {
        recommendations = await this.getLocalRecommendations(request, inventoryAnalysis, preferences);
      }

      // 7. 增强推荐结果
      recommendations = this.enhanceRecommendations(recommendations, inventoryAnalysis, preferences);

      logger.info('菜谱推荐生成成功', {
        familyId,
        userId,
        recipeCount: recommendations.recipes.length,
        usedAI: !!aiResponse
      });

      return recommendations;
    } catch (error) {
      logger.error('获取菜谱推荐失败', { familyId, userId, error });
      throw error;
    }
  }

  /**
   * 获取家庭库存
   */
  private async getFamilyInventory(familyId: string): Promise<InventoryItem[]> {
    try {
      const inventory = await dbGet(
        `SELECT 
          i.id,
          i.name,
          ic.name as category,
          COALESCE(SUM(ib.remaining_quantity), 0) as total_quantity,
          i.unit,
          MIN(ib.expire_date) as expire_date,
          CASE WHEN COALESCE(SUM(ib.remaining_quantity), 0) <= i.minimum_stock THEN 1 ELSE 0 END as is_running_low
        FROM inventory_items i
        LEFT JOIN inventory_batches ib ON i.id = ib.item_id AND ib.remaining_quantity > 0
        LEFT JOIN inventory_categories ic ON i.category_id = ic.id
        WHERE i.family_id = ? AND i.is_active = 1 AND i.is_deleted = 0
        GROUP BY i.id, i.name, ic.name, i.unit, i.minimum_stock
        HAVING total_quantity > 0
        ORDER BY is_running_low DESC, expire_date ASC`,
        [familyId]
      );

      return Array.isArray(inventory) ? inventory : inventory ? [inventory] : [];
    } catch (error) {
      logger.error('获取家庭库存失败', { familyId, error });
      return [];
    }
  }

  /**
   * 获取家庭偏好（模拟数据，实际可从用户设置中获取）
   */
  private async getFamilyPreferences(familyId: string): Promise<FamilyPreference> {
    // 这里可以从数据库中获取实际的家庭偏好设置
    // 暂时使用默认值
    return {
      preferred_cuisines: ['川菜', '粤菜', '家常菜'],
      dietary_restrictions: [],
      spice_level: 'medium',
      cooking_skills: 'intermediate',
      typical_meal_times: ['08:00', '12:00', '18:00']
    };
  }

  /**
   * 分析库存状况
   */
  private analyzeInventory(
    inventory: InventoryItem[],
    requestedIngredients?: string[]
  ): {
    available: string[];
    expiringSoon: string[];
    runningLow: string[];
    categories: Record<string, string[]>;
    missing: string[];
  } {
    const available = inventory.map(item => item.name);
    const expiringSoon = inventory
      .filter(item => {
        if (!item.expire_date) return false;
        const expireDate = new Date(item.expire_date);
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        return expireDate <= threeDaysFromNow;
      })
      .map(item => item.name);

    const runningLow = inventory
      .filter(item => item.is_running_low)
      .map(item => item.name);

    const categories: Record<string, string[]> = {};
    inventory.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item.name);
    });

    const missing = requestedIngredients 
      ? requestedIngredients.filter(ingredient => !available.includes(ingredient))
      : [];

    return {
      available,
      expiringSoon,
      runningLow,
      categories,
      missing
    };
  }

  /**
   * 构建AI推荐提示词
   */
  private buildRecommendationPrompt(
    request: RecipeRecommendationRequest,
    inventoryAnalysis: any,
    preferences: FamilyPreference
  ): string {
    const prompt = `
作为专业的营养师和厨师助手，请基于以下信息为家庭推荐菜谱：

## 库存情况分析
**现有食材**：${inventoryAnalysis.available.join('、')}
**即将过期**：${inventoryAnalysis.expiringSoon.join('、') || '无'}
**库存不足**：${inventoryAnalysis.runningLow.join('、') || '无'}

## 用户需求
**指定食材**：${request.availableIngredients.join('、')}
${request.mealType ? `**餐次类型**：${request.mealType}` : ''}
${request.cookingTime ? `**烹饪时间限制**：${request.cookingTime}分钟内` : ''}
${request.difficulty ? `**难度要求**：${request.difficulty}` : ''}
${request.servings ? `**用餐人数**：${request.servings}人` : ''}

## 家庭偏好
**菜系偏好**：${preferences.preferred_cuisines.join('、')}
**饮食限制**：${preferences.dietary_restrictions.join('、') || '无'}
**辣度偏好**：${preferences.spice_level}
**烹饪技能**：${preferences.cooking_skills}

## 推荐要求
1. 优先使用即将过期的食材
2. 充分利用现有库存
3. 推荐2-3个菜谱，包含：
   - 菜名和简介
   - 详细制作步骤
   - 所需食材和用量
   - 烹饪时间和难度
   - 营养价值说明
4. 对于缺失的关键食材，提供替代建议
5. 考虑营养搭配的均衡性

请以JSON格式返回推荐结果。
`;

    return prompt.trim();
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(
    aiContent: string,
    inventoryAnalysis: any
  ): RecipeRecommendationResponse {
    try {
      // 尝试解析JSON格式的AI响应
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.recipes) {
          return {
            recipes: parsed.recipes,
            reasoning: parsed.reasoning || '基于您的库存和偏好进行智能推荐',
            missingIngredients: inventoryAnalysis.missing,
            alternatives: parsed.alternatives || []
          };
        }
      }

      // 如果无法解析JSON，尝试从文本中提取信息
      return this.parseTextResponse(aiContent, inventoryAnalysis);
    } catch (error) {
      logger.warn('解析AI响应失败，使用文本解析', { error });
      return this.parseTextResponse(aiContent, inventoryAnalysis);
    }
  }

  /**
   * 解析文本格式的AI响应
   */
  private parseTextResponse(
    content: string,
    inventoryAnalysis: any
  ): RecipeRecommendationResponse {
    const recipes: Recipe[] = [];
    
    // 简单的文本解析逻辑
    const sections = content.split(/\n\s*\n/);
    
    for (const section of sections) {
      if (section.includes('菜名') || section.includes('推荐')) {
        const recipe: Recipe = {
          name: this.extractValue(section, ['菜名', '推荐']) || '推荐菜谱',
          description: this.extractValue(section, ['简介', '描述']) || '美味家常菜',
          ingredients: this.parseIngredients(section),
          instructions: this.parseInstructions(section),
          cookingTime: this.extractNumber(section, ['时间', '分钟']) || 30,
          difficulty: this.extractDifficulty(section) || 'medium',
          servings: this.extractNumber(section, ['人数', '份']) || 2,
          tags: ['AI推荐', '家常菜']
        };
        
        recipes.push(recipe);
      }
    }

    return {
      recipes: recipes.length > 0 ? recipes : this.getDefaultRecipes(),
      reasoning: '基于AI分析您的库存状况和偏好进行推荐',
      missingIngredients: inventoryAnalysis.missing,
      alternatives: ['可用其他蔬菜替代', '调味料可根据个人喜好调整']
    };
  }

  /**
   * 本地算法推荐（AI服务不可用时的备选方案）
   */
  private async getLocalRecommendations(
    request: RecipeRecommendationRequest,
    inventoryAnalysis: any,
    preferences: FamilyPreference
  ): Promise<RecipeRecommendationResponse> {
    const recipes: Recipe[] = [];

    // 基于库存的简单推荐逻辑
    const availableIngredients = inventoryAnalysis.available;
    
    if (availableIngredients.includes('鸡蛋') && availableIngredients.includes('番茄')) {
      recipes.push({
        name: '番茄炒蛋',
        description: '经典家常菜，营养丰富，制作简单',
        ingredients: [
          { name: '鸡蛋', amount: '3', unit: '个' },
          { name: '番茄', amount: '2', unit: '个' },
          { name: '盐', amount: '适量', unit: '' },
          { name: '糖', amount: '少许', unit: '' }
        ],
        instructions: [
          '鸡蛋打散，加少许盐调味',
          '番茄洗净切块',
          '热锅下油，倒入蛋液炒熟盛起',
          '番茄下锅炒出汁水，加糖调味',
          '倒入炒蛋翻炒均匀即可'
        ],
        cookingTime: 15,
        difficulty: 'easy',
        servings: 2,
        tags: ['家常菜', '快手菜']
      });
    }

    if (availableIngredients.includes('土豆')) {
      recipes.push({
        name: '土豆丝',
        description: '爽脆可口的家常小菜',
        ingredients: [
          { name: '土豆', amount: '2', unit: '个' },
          { name: '青椒', amount: '1', unit: '个', optional: true },
          { name: '醋', amount: '适量', unit: '' },
          { name: '盐', amount: '适量', unit: '' }
        ],
        instructions: [
          '土豆去皮切丝，用水冲洗淀粉',
          '青椒切丝备用',
          '热锅下油，倒入土豆丝大火翻炒',
          '加入青椒丝继续炒制',
          '调入醋和盐，炒匀即可出锅'
        ],
        cookingTime: 20,
        difficulty: 'easy',
        servings: 2,
        tags: ['素食', '下饭菜']
      });
    }

    return {
      recipes: recipes.length > 0 ? recipes : this.getDefaultRecipes(),
      reasoning: '基于您的现有库存和基础算法推荐',
      missingIngredients: inventoryAnalysis.missing,
      alternatives: ['可根据现有食材灵活调整', '调料可按个人口味增减']
    };
  }

  /**
   * 增强推荐结果
   */
  private enhanceRecommendations(
    recommendations: RecipeRecommendationResponse,
    inventoryAnalysis: any,
    preferences: FamilyPreference
  ): RecipeRecommendationResponse {
    // 为菜谱添加库存匹配度评分
    recommendations.recipes = recommendations.recipes.map(recipe => {
      const availableCount = recipe.ingredients.filter(ingredient => 
        inventoryAnalysis.available.includes(ingredient.name)
      ).length;
      
      const matchRate = availableCount / recipe.ingredients.length;
      
      return {
        ...recipe,
        tags: [...recipe.tags, `库存匹配: ${Math.round(matchRate * 100)}%`]
      };
    });

    // 按库存匹配度排序
    recommendations.recipes.sort((a, b) => {
      const aMatch = parseFloat(a.tags.find(tag => tag.includes('库存匹配'))?.split(': ')[1] || '0');
      const bMatch = parseFloat(b.tags.find(tag => tag.includes('库存匹配'))?.split(': ')[1] || '0');
      return bMatch - aMatch;
    });

    return recommendations;
  }

  /**
   * 辅助方法：从文本中提取值
   */
  private extractValue(text: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[：:](.*?)(?=\n|$)`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * 解析食材列表
   */
  private parseIngredients(text: string): any[] {
    const ingredients: any[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('食材') || line.includes('原料')) {
        const match = line.match(/([^0-9]+)(\d+)([^0-9]*)/);
        if (match) {
          ingredients.push({
            name: match[1].trim(),
            amount: match[2],
            unit: match[3].trim() || '份'
          });
        }
      }
    }
    
    return ingredients.length > 0 ? ingredients : [
      { name: '主料', amount: '适量', unit: '' },
      { name: '调料', amount: '适量', unit: '' }
    ];
  }

  /**
   * 解析制作步骤
   */
  private parseInstructions(text: string): string[] {
    const instructions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (/^\d+\./.test(line.trim()) || line.includes('步骤')) {
        instructions.push(line.replace(/^\d+\./, '').trim());
      }
    }
    
    return instructions.length > 0 ? instructions : [
      '准备所需食材',
      '按照常规方法制作',
      '调味出锅即可'
    ];
  }

  /**
   * 提取数字
   */
  private extractNumber(text: string, keywords: string[]): number | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[^0-9]*(\d+)`, 'i');
      const match = text.match(regex);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return null;
  }

  /**
   * 提取难度
   */
  private extractDifficulty(text: string): 'easy' | 'medium' | 'hard' | null {
    if (text.includes('简单') || text.includes('容易')) return 'easy';
    if (text.includes('困难') || text.includes('复杂')) return 'hard';
    if (text.includes('中等') || text.includes('一般')) return 'medium';
    return null;
  }

  /**
   * 默认菜谱
   */
  private getDefaultRecipes(): Recipe[] {
    return [
      {
        name: '简易蒸蛋',
        description: '嫩滑营养的家常蒸蛋',
        ingredients: [
          { name: '鸡蛋', amount: '2', unit: '个' },
          { name: '温水', amount: '150', unit: 'ml' },
          { name: '盐', amount: '少许', unit: '' }
        ],
        instructions: [
          '鸡蛋打散，加入温水和盐调匀',
          '过筛倒入蒸蛋器中',
          '水开后蒸10分钟即可'
        ],
        cookingTime: 15,
        difficulty: 'easy',
        servings: 1,
        tags: ['营养', '简单']
      }
    ];
  }
}