/**
 * AI控制器
 * 提供AI相关的REST API接口
 */

import { Context } from 'koa';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';
import { ValidationError, NotFoundError, AuthorizationError } from '../middlewares/errorHandler';
import { Validator } from '../utils/validation';
import { AIService } from '../services/AIService';
import { BudgetService } from '../services/BudgetService';
import { AICacheService } from '../services/AICacheService';
import { RateLimitService } from '../services/RateLimitService';
import { RecipeRecommendationService } from '../services/RecipeRecommendationService';
import { TaskSuggestionService } from '../services/TaskSuggestionService';
import { SmartShoppingService } from '../services/SmartShoppingService';
import { isAIEnabled } from '../config/ai';
import type { AIServiceRequest, AIRequestType } from '../interfaces/ai';

export class AIController {
  private static aiService = AIService.getInstance();
  private static budgetService = BudgetService.getInstance();
  private static cacheService = AICacheService.getInstance();
  private static rateLimitService = RateLimitService.getInstance();
  private static recipeService = RecipeRecommendationService.getInstance();
  private static taskSuggestionService = TaskSuggestionService.getInstance();
  private static shoppingService = SmartShoppingService.getInstance();

  /**
   * 通用AI请求处理
   */
  static async makeRequest(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!isAIEnabled()) {
      throw new AuthorizationError('AI功能未启用');
    }

    // 验证请求参数
    const requestSchema = {
      prompt: { required: true, type: 'string', minLength: 1, maxLength: 2000 },
      context: { required: false, type: 'string', maxLength: 1000 },
      requestType: { 
        required: true, 
        type: 'string', 
        enum: [
          'recipe_recommendation',
          'meal_planning', 
          'shopping_list',
          'task_suggestion',
          'schedule_analysis',
          'general_assistant'
        ]
      },
      maxTokens: { required: false, type: 'number', min: 100, max: 4000 },
      temperature: { required: false, type: 'number', min: 0, max: 2 }
    };

    const validation = Validator.validate(ctx.request.body, requestSchema);
    if (!validation.isValid) {
      throw new ValidationError('请求参数验证失败', validation.errors);
    }

    try {
      const aiRequest: AIServiceRequest = {
        prompt: validation.data.prompt,
        context: validation.data.context,
        requestType: validation.data.requestType as AIRequestType,
        maxTokens: validation.data.maxTokens,
        temperature: validation.data.temperature,
        userId: user.userId,
        familyId: user.familyId
      };

      const response = await AIController.aiService.makeRequest(aiRequest);

      logger.info('AI请求处理成功', {
        userId: user.userId,
        familyId: user.familyId,
        requestType: aiRequest.requestType,
        tokens: response.tokens,
        cached: response.cached
      });

      ResponseUtil.success(ctx, {
        content: response.content,
        tokens: response.tokens,
        cost: response.cost,
        cached: response.cached,
        requestId: response.requestId,
        timestamp: response.timestamp
      }, 'AI请求处理成功');
    } catch (error: any) {
      logger.error('AI请求处理失败', {
        userId: user.userId,
        familyId: user.familyId,
        error: error.message,
        errorType: error.type
      });

      // 根据错误类型返回适当的HTTP状态码
      if (error.type === 'budget_exceeded') {
        ctx.status = 402; // Payment Required
      } else if (error.type === 'rate_limit') {
        ctx.status = 429; // Too Many Requests
      } else if (error.type === 'validation_error') {
        ctx.status = 400; // Bad Request
      } else {
        ctx.status = 500; // Internal Server Error
      }

      ctx.body = {
        success: false,
        message: error.message,
        errorCode: error.code,
        errorType: error.type,
        retryable: error.retryable,
        timestamp: new Date().toISOString(),
        path: ctx.path
      };
    }
  }

  /**
   * 智能食谱推荐（基于库存）
   */
  static async getRecipeRecommendation(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    const requestSchema = {
      availableIngredients: { required: true, type: 'array', minItems: 1 },
      preferences: { required: false, type: 'array' },
      restrictions: { required: false, type: 'array' },
      mealType: { required: false, type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
      cookingTime: { required: false, type: 'number', min: 5, max: 240 },
      difficulty: { required: false, type: 'string', enum: ['easy', 'medium', 'hard'] },
      servings: { required: false, type: 'number', min: 1, max: 20 }
    };

    const validation = Validator.validate(ctx.request.body, requestSchema);
    if (!validation.isValid) {
      throw new ValidationError('参数验证失败', validation.errors);
    }

    try {
      const recommendations = await AIController.recipeService.getRecommendations(
        user.familyId,
        user.userId,
        validation.data
      );

      ResponseUtil.success(ctx, recommendations, '智能食谱推荐获取成功');
    } catch (error) {
      logger.error('获取食谱推荐失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 智能任务建议
   */
  static async getTaskSuggestion(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    const requestSchema = {
      currentTasks: { required: false, type: 'array' },
      familyMembers: { required: false, type: 'array' },
      timeAvailable: { required: false, type: 'number', min: 5, max: 480 },
      priority: { required: false, type: 'string', enum: ['low', 'medium', 'high'] },
      preferences: { required: false, type: 'array' }
    };

    const validation = Validator.validate(ctx.request.body, requestSchema);
    if (!validation.isValid) {
      throw new ValidationError('参数验证失败', validation.errors);
    }

    try {
      const suggestions = await AIController.taskSuggestionService.getTaskSuggestions(
        user.familyId,
        user.userId,
        validation.data
      );

      ResponseUtil.success(ctx, suggestions, '智能任务建议获取成功');
    } catch (error) {
      logger.error('获取任务建议失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 获取预算使用情况
   */
  static async getBudgetUsage(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    try {
      const usage = await AIController.budgetService.getBudgetUsage(user.userId, user.familyId);
      const stats = await AIController.budgetService.getFamilyBudgetStats(user.familyId);
      
      ResponseUtil.success(ctx, {
        current: usage,
        statistics: stats
      }, '预算使用情况获取成功');
    } catch (error) {
      logger.error('获取AI预算使用情况失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 获取使用记录
   */
  static async getUsageRecords(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const { startDate, endDate, limit = 50 } = ctx.query;

    try {
      const records = await AIController.budgetService.getUsageRecords(
        user.familyId,
        startDate as string,
        endDate as string,
        parseInt(limit as string)
      );

      ResponseUtil.success(ctx, records, '使用记录获取成功');
    } catch (error) {
      logger.error('获取AI使用记录失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 获取缓存统计
   */
  static async getCacheStats(ctx: Context): Promise<void> {
    try {
      const stats = AIController.cacheService.getStats();
      const entries = AIController.cacheService.getEntries(20);

      ResponseUtil.success(ctx, {
        statistics: stats,
        recentEntries: entries
      }, '缓存统计获取成功');
    } catch (error) {
      logger.error('获取AI缓存统计失败', { error });
      throw error;
    }
  }

  /**
   * 清理缓存
   */
  static async clearCache(ctx: Context): Promise<void> {
    try {
      AIController.cacheService.clear();
      ResponseUtil.success(ctx, null, '缓存清理成功');
    } catch (error) {
      logger.error('清理AI缓存失败', { error });
      throw error;
    }
  }

  /**
   * 获取速率限制状态
   */
  static async getRateLimitStatus(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    try {
      const status = await AIController.rateLimitService.getStatus(user.userId, user.familyId);
      const serviceStats = AIController.rateLimitService.getServiceStats();

      ResponseUtil.success(ctx, {
        userStatus: status,
        serviceStats
      }, '速率限制状态获取成功');
    } catch (error) {
      logger.error('获取AI速率限制状态失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 获取AI服务整体状态
   */
  static async getServiceStatus(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    try {
      const status = await AIController.aiService.getServiceStatus(user.familyId);
      ResponseUtil.success(ctx, status, 'AI服务状态获取成功');
    } catch (error) {
      logger.error('获取AI服务状态失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }

  /**
   * 智能购物清单生成
   */
  static async generateShoppingList(ctx: Context): Promise<void> {
    const user = ctx.state.user;

    const requestSchema = {
      currentInventory: { required: false, type: 'array' },
      plannedMeals: { required: false, type: 'array' },
      familySize: { required: false, type: 'number', min: 1, max: 20 },
      budget: { required: false, type: 'number', min: 0 },
      preferences: { required: false, type: 'array' },
      dietaryRestrictions: { required: false, type: 'array' },
      timeFrame: { required: false, type: 'number', min: 1, max: 30 },
      priority: { required: false, type: 'string', enum: ['essential', 'normal', 'comprehensive'] }
    };

    const validation = Validator.validate(ctx.request.body, requestSchema);
    if (!validation.isValid) {
      throw new ValidationError('参数验证失败', validation.errors);
    }

    try {
      const shoppingRequest = {
        familyId: user.familyId,
        ...validation.data
      };

      const shoppingList = await AIController.shoppingService.generateShoppingList(
        user.userId,
        shoppingRequest
      );

      ResponseUtil.success(ctx, shoppingList, '智能购物清单生成成功');
    } catch (error) {
      logger.error('生成购物清单失败', { 
        userId: user.userId, 
        familyId: user.familyId, 
        error 
      });
      throw error;
    }
  }
}
