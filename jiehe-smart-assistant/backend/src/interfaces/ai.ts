/**
 * AI服务相关接口定义
 */

// 通义千问API请求接口
export interface QianwenRequest {
  model: string;
  input: {
    messages: QianwenMessage[];
  };
  parameters?: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    stop?: string[];
  };
}

// 通义千问消息接口
export interface QianwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 通义千问API响应接口
export interface QianwenResponse {
  output: {
    text: string;
    finish_reason: 'stop' | 'length' | 'timeout';
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

// AI服务请求接口
export interface AIServiceRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  familyId: string;
  requestType: AIRequestType;
}

// AI请求类型枚举
export enum AIRequestType {
  RECIPE_RECOMMENDATION = 'recipe_recommendation',
  MEAL_PLANNING = 'meal_planning',
  SHOPPING_LIST = 'shopping_list',
  TASK_SUGGESTION = 'task_suggestion',
  SCHEDULE_ANALYSIS = 'schedule_analysis',
  GENERAL_ASSISTANT = 'general_assistant'
}

// AI服务响应接口
export interface AIServiceResponse {
  content: string;
  tokens: number;
  cost: number;
  requestId: string;
  cached: boolean;
  timestamp: Date;
}

// 预算使用统计接口
export interface BudgetUsage {
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  tokensUsed: number;
  requestCount: number;
  averageCost: number;
}

// 预算记录接口
export interface BudgetRecord {
  id: string;
  userId: string;
  familyId: string;
  requestType: AIRequestType;
  tokens: number;
  cost: number;
  timestamp: Date;
  requestId: string;
}

// 缓存条目接口
export interface CacheEntry {
  key: string;
  content: string;
  tokens: number;
  timestamp: Date;
  hitCount: number;
  lastHit: Date;
}

// 速率限制状态接口
export interface RateLimitStatus {
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  minuteRemaining: number;
  hourRemaining: number;
  dayRemaining: number;
  resetTimeMinute: Date;
  resetTimeHour: Date;
  resetTimeDay: Date;
}

// AI服务错误接口
export interface AIServiceError {
  code: string;
  message: string;
  type: 'budget_exceeded' | 'rate_limit' | 'api_error' | 'validation_error' | 'network_error';
  details?: any;
  retryable: boolean;
}

// 食谱推荐请求接口
export interface RecipeRecommendationRequest {
  availableIngredients: string[];
  preferences?: string[];
  restrictions?: string[];
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cookingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
}

// 食谱推荐响应接口
export interface RecipeRecommendationResponse {
  recipes: Recipe[];
  reasoning: string;
  missingIngredients: string[];
  alternatives: string[];
}

// 食谱接口
export interface Recipe {
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  cookingTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  tags: string[];
  nutritionInfo?: NutritionInfo;
}

// 食谱食材接口
export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  optional?: boolean;
  substitutes?: string[];
}

// 营养信息接口
export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

// 智能任务建议请求接口
export interface TaskSuggestionRequest {
  currentTasks: string[];
  familyMembers: string[];
  preferences?: string[];
  timeAvailable?: number;
  priority?: 'low' | 'medium' | 'high';
}

// 智能任务建议响应接口
export interface TaskSuggestionResponse {
  suggestions: TaskSuggestion[];
  reasoning: string;
  tips: string[];
}

// 任务建议接口
export interface TaskSuggestion {
  title: string;
  description: string;
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  category: string;
  tips: string[];
}