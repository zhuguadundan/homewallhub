/**
 * AI请求速率限制服务
 * 防止API请求过于频繁
 */

import { logger } from '../utils/logger';
import { aiConfig } from '../config/ai';
import type { RateLimitStatus } from '../interfaces/ai';

interface RateLimitWindow {
  minute: { count: number; resetTime: Date };
  hour: { count: number; resetTime: Date };
  day: { count: number; resetTime: Date };
}

export class RateLimitService {
  private static instance: RateLimitService;
  private limits: Map<string, RateLimitWindow> = new Map();

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  constructor() {
    // 定期清理过期的限制记录
    setInterval(() => {
      this.cleanupExpiredLimits();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 生成限制键
   */
  private getLimitKey(userId: string, familyId: string): string {
    return `${familyId}:${userId}`;
  }

  /**
   * 检查是否可以发起请求
   */
  async checkLimit(userId: string, familyId: string): Promise<{
    allowed: boolean;
    reason?: string;
    status: RateLimitStatus;
  }> {
    const key = this.getLimitKey(userId, familyId);
    const now = new Date();
    
    let window = this.limits.get(key);
    if (!window) {
      window = this.createNewWindow(now);
      this.limits.set(key, window);
    }

    // 重置过期的计数窗口
    this.resetExpiredWindows(window, now);

    const status = this.calculateStatus(window, now);

    // 检查各时间窗口的限制
    if (window.minute.count >= aiConfig.rateLimit.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `每分钟请求次数超限，已请求${window.minute.count}次，限制${aiConfig.rateLimit.maxRequestsPerMinute}次`,
        status
      };
    }

    if (window.hour.count >= aiConfig.rateLimit.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: `每小时请求次数超限，已请求${window.hour.count}次，限制${aiConfig.rateLimit.maxRequestsPerHour}次`,
        status
      };
    }

    if (window.day.count >= aiConfig.rateLimit.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: `每日请求次数超限，已请求${window.day.count}次，限制${aiConfig.rateLimit.maxRequestsPerDay}次`,
        status
      };
    }

    return { allowed: true, status };
  }

  /**
   * 记录请求
   */
  async recordRequest(userId: string, familyId: string): Promise<void> {
    const key = this.getLimitKey(userId, familyId);
    const now = new Date();
    
    let window = this.limits.get(key);
    if (!window) {
      window = this.createNewWindow(now);
      this.limits.set(key, window);
    }

    // 重置过期的计数窗口
    this.resetExpiredWindows(window, now);

    // 增加计数
    window.minute.count++;
    window.hour.count++;
    window.day.count++;

    logger.debug('记录AI请求速率', {
      userId,
      familyId,
      minuteCount: window.minute.count,
      hourCount: window.hour.count,
      dayCount: window.day.count
    });
  }

  /**
   * 获取速率限制状态
   */
  async getStatus(userId: string, familyId: string): Promise<RateLimitStatus> {
    const key = this.getLimitKey(userId, familyId);
    const now = new Date();
    
    let window = this.limits.get(key);
    if (!window) {
      window = this.createNewWindow(now);
      this.limits.set(key, window);
    }

    this.resetExpiredWindows(window, now);
    return this.calculateStatus(window, now);
  }

  /**
   * 创建新的时间窗口
   */
  private createNewWindow(now: Date): RateLimitWindow {
    return {
      minute: {
        count: 0,
        resetTime: new Date(now.getTime() + 60 * 1000)
      },
      hour: {
        count: 0,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000)
      },
      day: {
        count: 0,
        resetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * 重置过期的计数窗口
   */
  private resetExpiredWindows(window: RateLimitWindow, now: Date): void {
    if (now >= window.minute.resetTime) {
      window.minute.count = 0;
      window.minute.resetTime = new Date(now.getTime() + 60 * 1000);
    }

    if (now >= window.hour.resetTime) {
      window.hour.count = 0;
      window.hour.resetTime = new Date(now.getTime() + 60 * 60 * 1000);
    }

    if (now >= window.day.resetTime) {
      window.day.count = 0;
      window.day.resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  /**
   * 计算状态
   */
  private calculateStatus(window: RateLimitWindow, now: Date): RateLimitStatus {
    return {
      minuteCount: window.minute.count,
      hourCount: window.hour.count,
      dayCount: window.day.count,
      minuteRemaining: Math.max(0, aiConfig.rateLimit.maxRequestsPerMinute - window.minute.count),
      hourRemaining: Math.max(0, aiConfig.rateLimit.maxRequestsPerHour - window.hour.count),
      dayRemaining: Math.max(0, aiConfig.rateLimit.maxRequestsPerDay - window.day.count),
      resetTimeMinute: window.minute.resetTime,
      resetTimeHour: window.hour.resetTime,
      resetTimeDay: window.day.resetTime
    };
  }

  /**
   * 清理过期的限制记录
   */
  private cleanupExpiredLimits(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, window] of this.limits.entries()) {
      // 如果所有时间窗口都已过期，删除这个记录
      if (
        now >= window.day.resetTime &&
        window.minute.count === 0 &&
        window.hour.count === 0 &&
        window.day.count === 0
      ) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.limits.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug('清理过期速率限制记录', { 
        cleanedCount: expiredKeys.length,
        remainingCount: this.limits.size
      });
    }
  }

  /**
   * 重置用户的速率限制
   */
  async resetUserLimits(userId: string, familyId: string): Promise<void> {
    const key = this.getLimitKey(userId, familyId);
    this.limits.delete(key);
    
    logger.info('重置用户AI速率限制', { userId, familyId });
  }

  /**
   * 获取所有用户的速率限制统计
   */
  getAllLimitsStats(): Array<{
    key: string;
    minuteCount: number;
    hourCount: number;
    dayCount: number;
    nextReset: Date;
  }> {
    const stats = [];
    
    for (const [key, window] of this.limits.entries()) {
      stats.push({
        key,
        minuteCount: window.minute.count,
        hourCount: window.hour.count,
        dayCount: window.day.count,
        nextReset: new Date(Math.min(
          window.minute.resetTime.getTime(),
          window.hour.resetTime.getTime(),
          window.day.resetTime.getTime()
        ))
      });
    }

    return stats.sort((a, b) => b.dayCount - a.dayCount);
  }

  /**
   * 清空所有速率限制
   */
  clearAllLimits(): void {
    this.limits.clear();
    logger.info('清空所有AI速率限制记录');
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats(): {
    totalUsers: number;
    activeUsers: number;
    totalRequests: {
      minute: number;
      hour: number;
      day: number;
    };
  } {
    const now = new Date();
    let activeUsers = 0;
    const totalRequests = { minute: 0, hour: 0, day: 0 };

    for (const window of this.limits.values()) {
      // 检查用户是否在最近一小时内有活动
      if (window.hour.count > 0 && now < window.hour.resetTime) {
        activeUsers++;
      }

      totalRequests.minute += window.minute.count;
      totalRequests.hour += window.hour.count;
      totalRequests.day += window.day.count;
    }

    return {
      totalUsers: this.limits.size,
      activeUsers,
      totalRequests
    };
  }
}