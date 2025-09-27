/**
 * AI配置文件
 * 通义千问API集成配置
 */

import dotenv from 'dotenv';
dotenv.config();

export interface AIConfig {
  // 通义千问API配置
  qianwen: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
  };
  
  // 预算控制
  budget: {
    dailyLimit: number;  // 每日预算限制（元）
    monthlyLimit: number; // 每月预算限制（元）
    tokenCost: number;   // 每千token成本（元）
    warningThreshold: number; // 预算预警阈值（90%）
  };
  
  // 缓存配置
  cache: {
    enabled: boolean;
    ttl: number; // 缓存时间（秒）
    maxSize: number; // 最大缓存条目数
  };
  
  // 请求限制
  rateLimit: {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
  };
}

export const aiConfig: AIConfig = {
  qianwen: {
    apiKey: process.env.QIANWEN_API_KEY || '',
    baseUrl: process.env.QIANWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
    model: process.env.QIANWEN_MODEL || 'qwen-plus',
    maxTokens: parseInt(process.env.QIANWEN_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.QIANWEN_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.QIANWEN_TIMEOUT || '30000'),
  },
  
  budget: {
    dailyLimit: parseFloat(process.env.AI_DAILY_BUDGET || '10.0'),
    monthlyLimit: parseFloat(process.env.AI_MONTHLY_BUDGET || '200.0'),
    tokenCost: parseFloat(process.env.AI_TOKEN_COST || '0.002'), // 每千token 2分钱
    warningThreshold: parseFloat(process.env.AI_WARNING_THRESHOLD || '0.9'),
  },
  
  cache: {
    enabled: process.env.AI_CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.AI_CACHE_TTL || '3600'), // 1小时
    maxSize: parseInt(process.env.AI_CACHE_MAX_SIZE || '1000'),
  },
  
  rateLimit: {
    maxRequestsPerMinute: parseInt(process.env.AI_RATE_LIMIT_MINUTE || '10'),
    maxRequestsPerHour: parseInt(process.env.AI_RATE_LIMIT_HOUR || '100'),
    maxRequestsPerDay: parseInt(process.env.AI_RATE_LIMIT_DAY || '1000'),
  }
};

// 验证配置
export function validateAIConfig(): boolean {
  if (!aiConfig.qianwen.apiKey) {
    console.warn('AI配置警告: 未设置通义千问API密钥');
    return false;
  }
  
  if (aiConfig.budget.dailyLimit <= 0) {
    console.warn('AI配置警告: 每日预算限制必须大于0');
    return false;
  }
  
  if (aiConfig.budget.monthlyLimit <= 0) {
    console.warn('AI配置警告: 每月预算限制必须大于0');
    return false;
  }
  
  return true;
}

// 获取AI功能启用状态
export function isAIEnabled(): boolean {
  return validateAIConfig() && !!aiConfig.qianwen.apiKey;
}