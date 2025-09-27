/**
 * AI服务核心类
 * 整合通义千问API、预算控制、缓存机制等
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { aiConfig, isAIEnabled } from '../config/ai';
import { BudgetService } from './BudgetService';
import { AICacheService } from './AICacheService';
import { RateLimitService } from './RateLimitService';
import type {
  AIServiceRequest,
  AIServiceResponse,
  AIServiceError,
  QianwenRequest,
  QianwenResponse,
  QianwenMessage,
  AIRequestType
} from '../interfaces/ai';

export class AIService {
  private static instance: AIService;
  private budgetService: BudgetService;
  private cacheService: AICacheService;
  private rateLimitService: RateLimitService;

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  constructor() {
    this.budgetService = BudgetService.getInstance();
    this.cacheService = AICacheService.getInstance();
    this.rateLimitService = RateLimitService.getInstance();
  }

  /**
   * 统一AI请求入口
   */
  async makeRequest(request: AIServiceRequest): Promise<AIServiceResponse> {
    // 检查AI功能是否启用
    if (!isAIEnabled()) {
      throw this.createError(
        'AI_DISABLED',
        'AI功能未启用，请检查配置',
        'validation_error',
        false
      );
    }

    try {
      // 1. 检查速率限制
      const rateLimitCheck = await this.rateLimitService.checkLimit(
        request.userId,
        request.familyId
      );
      
      if (!rateLimitCheck.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          rateLimitCheck.reason || '请求频率超限',
          'rate_limit',
          true
        );
      }

      // 2. 检查缓存
      const cachedResponse = await this.cacheService.get(request);
      if (cachedResponse) {
        await this.rateLimitService.recordRequest(request.userId, request.familyId);
        logger.info('AI请求缓存命中', { 
          userId: request.userId,
          requestType: request.requestType 
        });
        return cachedResponse;
      }

      // 3. 预算检查
      const estimatedTokens = this.estimateTokens(request.prompt, request.context);
      const budgetCheck = await this.budgetService.canMakeRequest(
        request.userId,
        request.familyId,
        estimatedTokens
      );

      if (!budgetCheck.allowed) {
        throw this.createError(
          'BUDGET_EXCEEDED',
          budgetCheck.reason || '预算不足',
          'budget_exceeded',
          false
        );
      }

      // 4. 调用通义千问API
      const response = await this.callQianwenAPI(request);

      // 5. 记录使用情况
      await this.budgetService.recordUsage(
        request.userId,
        request.familyId,
        request.requestType,
        response.tokens,
        response.requestId
      );

      await this.rateLimitService.recordRequest(request.userId, request.familyId);

      // 6. 缓存响应
      await this.cacheService.set(request, response);

      logger.info('AI请求处理完成', {
        userId: request.userId,
        requestType: request.requestType,
        tokens: response.tokens,
        cost: `¥${response.cost.toFixed(4)}`
      });

      return response;
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        throw error; // 重新抛出已知的AI服务错误
      }

      logger.error('AI请求处理失败', {
        userId: request.userId,
        requestType: request.requestType,
        error: error instanceof Error ? error.message : error
      });

      throw this.createError(
        'UNKNOWN_ERROR',
        '处理AI请求时发生未知错误',
        'api_error',
        true
      );
    }
  }

  /**
   * 调用通义千问API
   */
  private async callQianwenAPI(request: AIServiceRequest): Promise<AIServiceResponse> {
    try {
      const messages = this.buildMessages(request);
      
      const qianwenRequest: QianwenRequest = {
        model: aiConfig.qianwen.model,
        input: { messages },
        parameters: {
          max_tokens: request.maxTokens || aiConfig.qianwen.maxTokens,
          temperature: request.temperature || aiConfig.qianwen.temperature,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      };

      const startTime = Date.now();
      
      const response: AxiosResponse<QianwenResponse> = await axios.post(
        `${aiConfig.qianwen.baseUrl}/services/aigc/text-generation/generation`,
        qianwenRequest,
        {
          headers: {
            'Authorization': `Bearer ${aiConfig.qianwen.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-SSE': 'disable'
          },
          timeout: aiConfig.qianwen.timeout
        }
      );

      const endTime = Date.now();
      const responseData = response.data;

      if (!responseData.output?.text) {
        throw new Error('API响应格式错误：缺少输出文本');
      }

      const tokens = responseData.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens);

      return {
        content: responseData.output.text.trim(),
        tokens,
        cost,
        requestId: responseData.request_id,
        cached: false,
        timestamp: new Date()
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 429) {
          throw this.createError(
            'API_RATE_LIMIT',
            '通义千问API请求频率超限',
            'rate_limit',
            true
          );
        }

        if (status === 401 || status === 403) {
          throw this.createError(
            'API_AUTH_ERROR',
            'API认证失败，请检查密钥配置',
            'api_error',
            false
          );
        }

        if (status >= 500) {
          throw this.createError(
            'API_SERVER_ERROR',
            '通义千问服务器错误',
            'api_error',
            true
          );
        }

        throw this.createError(
          'API_REQUEST_FAILED',
          `API请求失败: ${message}`,
          'api_error',
          status ? status >= 500 : true
        );
      }

      throw this.createError(
        'NETWORK_ERROR',
        '网络连接失败',
        'network_error',
        true
      );
    }
  }

  /**
   * 构建对话消息
   */
  private buildMessages(request: AIServiceRequest): QianwenMessage[] {
    const messages: QianwenMessage[] = [];

    // 系统消息
    const systemPrompt = this.getSystemPrompt(request.requestType);
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // 上下文消息
    if (request.context) {
      messages.push({
        role: 'user',
        content: `背景信息：${request.context}`
      });
    }

    // 用户消息
    messages.push({
      role: 'user',
      content: request.prompt
    });

    return messages;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(requestType: AIRequestType): string {
    const prompts = {
      [AIRequestType.RECIPE_RECOMMENDATION]: `你是一个专业的营养师和厨师助手。请根据用户提供的食材和偏好，推荐适合的菜谱。
要求：
1. 优先使用用户现有的食材
2. 考虑营养搭配和口感平衡
3. 提供详细的制作步骤
4. 标注烹饪时间和难度等级
5. 如果缺少关键食材，请提供替代建议`,

      [AIRequestType.MEAL_PLANNING]: `你是一个家庭营养规划师。请帮助用户制定健康、均衡且实用的餐食计划。
要求：
1. 考虑家庭成员的年龄和营养需求
2. 平衡蛋白质、碳水化合物和维生素
3. 合理安排一日三餐
4. 考虑食材的季节性和经济性
5. 提供简单易做的家常菜建议`,

      [AIRequestType.SHOPPING_LIST]: `你是一个智能购物助手。请根据用户的需求和现有库存，生成智能购物清单。
要求：
1. 避免重复购买现有物品
2. 考虑食材的保质期和用量
3. 按照商品类别分类整理
4. 提供大概的价格预估
5. 建议最佳的购买时机`,

      [AIRequestType.TASK_SUGGESTION]: `你是一个家庭管理顾问。请根据家庭情况和现有任务，提供合理的任务建议。
要求：
1. 考虑家庭成员的能力和时间
2. 合理分配任务优先级
3. 提供任务执行的最佳时间
4. 给出任务完成的预估时间
5. 提供提高效率的小贴士`,

      [AIRequestType.SCHEDULE_ANALYSIS]: `你是一个时间管理专家。请分析用户的日程安排，提供优化建议。
要求：
1. 识别时间冲突和空闲时段
2. 提供合理的时间分配建议
3. 考虑任务的紧急性和重要性
4. 建议适当的休息时间
5. 提供提高时间利用率的方法`,

      [AIRequestType.GENERAL_ASSISTANT]: `你是一个智能家庭助手。请用友好、专业的态度回答用户的问题。
要求：
1. 提供准确、实用的信息
2. 语言简洁明了，易于理解
3. 考虑中国家庭的实际情况
4. 必要时提供具体的操作步骤
5. 保持积极正面的沟通风格`
    };

    return prompts[requestType] || prompts[AIRequestType.GENERAL_ASSISTANT];
  }

  /**
   * 估算token数量
   */
  private estimateTokens(prompt: string, context?: string): number {
    const totalText = prompt + (context || '');
    // 中文字符和英文单词的粗略估算：平均1.5个字符=1个token
    return Math.ceil(totalText.length / 1.5);
  }

  /**
   * 计算成本
   */
  private calculateCost(tokens: number): number {
    return (tokens / 1000) * aiConfig.budget.tokenCost;
  }

  /**
   * 创建标准化错误
   */
  private createError(
    code: string,
    message: string,
    type: AIServiceError['type'],
    retryable: boolean
  ): AIServiceError {
    const error = new Error(message) as AIServiceError;
    error.code = code;
    error.type = type;
    error.retryable = retryable;
    return error;
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(familyId: string): Promise<{
    enabled: boolean;
    budgetUsage: any;
    cacheStats: any;
    rateLimitStatus: any;
  }> {
    const enabled = isAIEnabled();
    
    if (!enabled) {
      return {
        enabled: false,
        budgetUsage: null,
        cacheStats: null,
        rateLimitStatus: null
      };
    }

    const [budgetUsage, cacheStats, rateLimitStatus] = await Promise.all([
      this.budgetService.getBudgetUsage('system', familyId),
      Promise.resolve(this.cacheService.getStats()),
      this.rateLimitService.getStatus('system', familyId)
    ]);

    return {
      enabled,
      budgetUsage,
      cacheStats,
      rateLimitStatus
    };
  }
}