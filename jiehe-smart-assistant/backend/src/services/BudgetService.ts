/**
 * AI预算控制服务
 * 管理AI API使用成本和预算限制
 */

import { logger } from '../utils/logger';
import { dbGet, dbRun } from '../config/database';
import { aiConfig } from '../config/ai';
import type { BudgetUsage, BudgetRecord, AIRequestType } from '../interfaces/ai';

export class BudgetService {
  private static instance: BudgetService;

  public static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  /**
   * 检查是否可以发起AI请求
   */
  async canMakeRequest(userId: string, familyId: string, estimatedTokens: number): Promise<{
    allowed: boolean;
    reason?: string;
    usage?: BudgetUsage;
  }> {
    try {
      const usage = await this.getBudgetUsage(userId, familyId);
      const estimatedCost = this.calculateCost(estimatedTokens);

      // 检查每日预算
      if (usage.dailyUsed + estimatedCost > aiConfig.budget.dailyLimit) {
        return {
          allowed: false,
          reason: `超出每日预算限制。已使用: ¥${usage.dailyUsed.toFixed(2)}, 限制: ¥${aiConfig.budget.dailyLimit}`,
          usage
        };
      }

      // 检查每月预算
      if (usage.monthlyUsed + estimatedCost > aiConfig.budget.monthlyLimit) {
        return {
          allowed: false,
          reason: `超出每月预算限制。已使用: ¥${usage.monthlyUsed.toFixed(2)}, 限制: ¥${aiConfig.budget.monthlyLimit}`,
          usage
        };
      }

      // 检查预警阈值
      const dailyUsagePercent = (usage.dailyUsed + estimatedCost) / aiConfig.budget.dailyLimit;
      const monthlyUsagePercent = (usage.monthlyUsed + estimatedCost) / aiConfig.budget.monthlyLimit;

      if (dailyUsagePercent > aiConfig.budget.warningThreshold) {
        logger.warn('AI预算预警', {
          userId,
          familyId,
          dailyUsagePercent: (dailyUsagePercent * 100).toFixed(1) + '%',
          estimatedCost
        });
      }

      return { allowed: true, usage };
    } catch (error) {
      logger.error('检查AI请求预算失败', { userId, familyId, error });
      return { allowed: false, reason: '预算检查失败' };
    }
  }

  /**
   * 记录AI请求使用情况
   */
  async recordUsage(
    userId: string,
    familyId: string,
    requestType: AIRequestType,
    tokens: number,
    requestId: string
  ): Promise<void> {
    try {
      const cost = this.calculateCost(tokens);
      
      await dbRun(
        `INSERT INTO ai_budget_records (
          id, user_id, family_id, request_type, tokens, cost, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          this.generateId(),
          userId,
          familyId,
          requestType,
          tokens,
          cost,
          requestId
        ]
      );

      logger.info('AI使用记录已保存', {
        userId,
        familyId,
        requestType,
        tokens,
        cost: `¥${cost.toFixed(4)}`
      });
    } catch (error) {
      logger.error('记录AI使用情况失败', { userId, familyId, requestType, tokens, error });
    }
  }

  /**
   * 获取预算使用统计
   */
  async getBudgetUsage(userId: string, familyId: string): Promise<BudgetUsage> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().slice(0, 7);

      // 今日使用统计
      const dailyStats = await dbGet(
        `SELECT 
          COALESCE(SUM(cost), 0) as daily_cost,
          COALESCE(SUM(tokens), 0) as daily_tokens,
          COUNT(*) as daily_requests
        FROM ai_budget_records 
        WHERE family_id = ? AND date(created_at) = ?`,
        [familyId, today]
      );

      // 本月使用统计
      const monthlyStats = await dbGet(
        `SELECT 
          COALESCE(SUM(cost), 0) as monthly_cost,
          COALESCE(SUM(tokens), 0) as monthly_tokens,
          COUNT(*) as monthly_requests
        FROM ai_budget_records 
        WHERE family_id = ? AND strftime('%Y-%m', created_at) = ?`,
        [familyId, thisMonth]
      );

      const dailyUsed = dailyStats?.daily_cost || 0;
      const monthlyUsed = monthlyStats?.monthly_cost || 0;

      return {
        dailyUsed,
        monthlyUsed,
        dailyRemaining: Math.max(0, aiConfig.budget.dailyLimit - dailyUsed),
        monthlyRemaining: Math.max(0, aiConfig.budget.monthlyLimit - monthlyUsed),
        tokensUsed: monthlyStats?.monthly_tokens || 0,
        requestCount: monthlyStats?.monthly_requests || 0,
        averageCost: monthlyStats?.monthly_requests > 0 
          ? monthlyUsed / monthlyStats.monthly_requests 
          : 0
      };
    } catch (error) {
      logger.error('获取预算使用统计失败', { userId, familyId, error });
      return {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyRemaining: aiConfig.budget.dailyLimit,
        monthlyRemaining: aiConfig.budget.monthlyLimit,
        tokensUsed: 0,
        requestCount: 0,
        averageCost: 0
      };
    }
  }

  /**
   * 获取详细使用记录
   */
  async getUsageRecords(
    familyId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 100
  ): Promise<BudgetRecord[]> {
    try {
      let query = `
        SELECT id, user_id, family_id, request_type, tokens, cost, request_id, created_at
        FROM ai_budget_records 
        WHERE family_id = ?
      `;
      const params: any[] = [familyId];

      if (startDate) {
        query += ` AND date(created_at) >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND date(created_at) <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const records = await dbGet(query, params);
      
      if (!records) return [];
      
      return Array.isArray(records) ? records : [records];
    } catch (error) {
      logger.error('获取AI使用记录失败', { familyId, error });
      return [];
    }
  }

  /**
   * 清理过期记录
   */
  async cleanupOldRecords(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await dbRun(
        `DELETE FROM ai_budget_records WHERE created_at < ?`,
        [cutoffDate.toISOString()]
      );

      logger.info('AI预算记录清理完成', { 
        deletedRows: result.changes,
        cutoffDate: cutoffDate.toISOString().split('T')[0]
      });
    } catch (error) {
      logger.error('清理AI预算记录失败', { error });
    }
  }

  /**
   * 计算token成本
   */
  private calculateCost(tokens: number): number {
    return (tokens / 1000) * aiConfig.budget.tokenCost;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return 'budget_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * 获取家庭预算统计
   */
  async getFamilyBudgetStats(familyId: string): Promise<{
    today: BudgetUsage;
    week: BudgetUsage;
    month: BudgetUsage;
    topRequestTypes: Array<{ type: string; count: number; cost: number }>;
    topUsers: Array<{ userId: string; count: number; cost: number }>;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().slice(0, 7);

      // 今日统计
      const todayStats = await this.getBudgetUsageByPeriod(familyId, today, today);
      
      // 本周统计
      const weekStats = await this.getBudgetUsageByPeriod(familyId, weekAgo, today);
      
      // 本月统计
      const monthStats = await this.getBudgetUsageByPeriod(familyId, thisMonth + '-01', today);

      // 请求类型统计
      const typeStats = await dbGet(
        `SELECT 
          request_type,
          COUNT(*) as count,
          SUM(cost) as total_cost
        FROM ai_budget_records 
        WHERE family_id = ? AND strftime('%Y-%m', created_at) = ?
        GROUP BY request_type
        ORDER BY total_cost DESC
        LIMIT 10`,
        [familyId, thisMonth]
      );

      // 用户使用统计
      const userStats = await dbGet(
        `SELECT 
          user_id,
          COUNT(*) as count,
          SUM(cost) as total_cost
        FROM ai_budget_records 
        WHERE family_id = ? AND strftime('%Y-%m', created_at) = ?
        GROUP BY user_id
        ORDER BY total_cost DESC
        LIMIT 10`,
        [familyId, thisMonth]
      );

      return {
        today: todayStats,
        week: weekStats,
        month: monthStats,
        topRequestTypes: Array.isArray(typeStats) ? typeStats : typeStats ? [typeStats] : [],
        topUsers: Array.isArray(userStats) ? userStats : userStats ? [userStats] : []
      };
    } catch (error) {
      logger.error('获取家庭预算统计失败', { familyId, error });
      throw error;
    }
  }

  /**
   * 按时间段获取预算使用情况
   */
  private async getBudgetUsageByPeriod(
    familyId: string, 
    startDate: string, 
    endDate: string
  ): Promise<BudgetUsage> {
    try {
      const stats = await dbGet(
        `SELECT 
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(SUM(tokens), 0) as total_tokens,
          COUNT(*) as total_requests
        FROM ai_budget_records 
        WHERE family_id = ? AND date(created_at) BETWEEN ? AND ?`,
        [familyId, startDate, endDate]
      );

      const used = stats?.total_cost || 0;

      return {
        dailyUsed: used,
        monthlyUsed: used,
        dailyRemaining: Math.max(0, aiConfig.budget.dailyLimit - used),
        monthlyRemaining: Math.max(0, aiConfig.budget.monthlyLimit - used),
        tokensUsed: stats?.total_tokens || 0,
        requestCount: stats?.total_requests || 0,
        averageCost: stats?.total_requests > 0 ? used / stats.total_requests : 0
      };
    } catch (error) {
      logger.error('获取时间段预算使用情况失败', { familyId, startDate, endDate, error });
      return {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyRemaining: aiConfig.budget.dailyLimit,
        monthlyRemaining: aiConfig.budget.monthlyLimit,
        tokensUsed: 0,
        requestCount: 0,
        averageCost: 0
      };
    }
  }
}