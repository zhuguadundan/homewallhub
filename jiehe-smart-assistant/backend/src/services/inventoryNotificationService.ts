import { Inventory } from '../models/Inventory';
import { Family } from '../models/Family';
import { socketManager } from '../middleware/socket';
import { logger } from '../utils/logger';

// 库存通知服务
export class InventoryNotificationService {
  /**
   * 检查并发送过期提醒
   */
  static async checkAndSendExpiryNotifications(): Promise<void> {
    try {
      logger.info('开始检查过期物品...');
      
      // 获取所有活跃家庭
      const families = await this.getAllActiveFamilies();
      
      for (const family of families) {
        await this.checkFamilyExpiryItems(family.id);
      }
      
      logger.info('过期物品检查完成');
    } catch (error) {
      logger.error('检查过期物品失败:', error);
    }
  }

  /**
   * 检查单个家庭的过期物品
   */
  private static async checkFamilyExpiryItems(familyId: string): Promise<void> {
    try {
      // 检查即将过期的物品（3天内）
      const expiringItems = await Inventory.getExpiringItems(familyId, 3);
      
      if (expiringItems.length > 0) {
        // 发送即将过期通知
        this.sendExpiryNotification(familyId, expiringItems, 'expiring_soon');
      }

      // 检查已过期的物品
      const expiredItems = await Inventory.getExpiringItems(familyId, 0);
      const reallyExpiredItems = expiredItems.filter(item => item.days_until_expiry < 0);
      
      if (reallyExpiredItems.length > 0) {
        // 发送已过期通知
        this.sendExpiryNotification(familyId, reallyExpiredItems, 'expired');
      }

    } catch (error) {
      logger.error(`检查家庭${familyId}过期物品失败:`, error);
    }
  }

  /**
   * 检查并发送库存不足提醒
   */
  static async checkAndSendLowStockNotifications(): Promise<void> {
    try {
      logger.info('开始检查库存不足物品...');
      
      const families = await this.getAllActiveFamilies();
      
      for (const family of families) {
        await this.checkFamilyLowStockItems(family.id);
      }
      
      logger.info('库存不足检查完成');
    } catch (error) {
      logger.error('检查库存不足物品失败:', error);
    }
  }

  /**
   * 检查单个家庭的库存不足物品
   */
  private static async checkFamilyLowStockItems(familyId: string): Promise<void> {
    try {
      const lowStockItems = await Inventory.getLowStockItems(familyId);
      
      if (lowStockItems.length > 0) {
        this.sendLowStockNotification(familyId, lowStockItems);
      }
    } catch (error) {
      logger.error(`检查家庭${familyId}库存不足物品失败:`, error);
    }
  }  /**
   * 发送过期通知
   */
  private static sendExpiryNotification(
    familyId: string, 
    items: any[], 
    type: 'expiring_soon' | 'expired'
  ): void {
    const notification = {
      type: type === 'expired' ? 'warning' : 'info',
      title: type === 'expired' ? '物品已过期' : '物品即将过期',
      message: `有 ${items.length} 个物品${type === 'expired' ? '已过期' : '即将过期'}，请及时处理`,
      data: {
        items: items.map(item => ({
          id: item.item.id,
          name: item.item.name,
          days_until_expiry: item.days_until_expiry,
          batch_id: item.batch.id,
          expiry_date: item.batch.expiry_date
        })),
        action_type: 'inventory_expiry',
        family_id: familyId
      },
      timestamp: new Date().toISOString()
    };

    // 发送实时通知到家庭成员
    socketManager.emitToFamily(familyId, 'notification', notification);
    
    // 记录通知日志
    logger.info('发送过期通知', {
      familyId,
      type,
      itemCount: items.length,
      items: items.map(item => item.item.name)
    });
  }

  /**
   * 发送库存不足通知
   */
  private static sendLowStockNotification(familyId: string, items: any[]): void {
    const notification = {
      type: 'warning',
      title: '库存不足提醒',
      message: `有 ${items.length} 个物品库存不足，建议及时补充`,
      data: {
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          current_stock: item.current_stock,
          min_stock_threshold: item.min_stock_threshold,
          unit: item.unit
        })),
        action_type: 'inventory_low_stock',
        family_id: familyId
      },
      timestamp: new Date().toISOString()
    };

    // 发送实时通知到家庭成员
    socketManager.emitToFamily(familyId, 'notification', notification);
    
    // 记录通知日志
    logger.info('发送库存不足通知', {
      familyId,
      itemCount: items.length,
      items: items.map(item => `${item.name}: ${item.current_stock}${item.unit}`)
    });
  }

  /**
   * 生成智能购物清单
   */
  static async generateSmartShoppingList(familyId: string): Promise<{
    low_stock_items: any[];
    expiring_items: any[];
    suggestions: any[];
    total_estimated_cost: number;
  }> {
    try {
      // 获取库存不足的物品
      const lowStockItems = await Inventory.getLowStockItems(familyId);
      
      // 获取即将过期但可能需要补充的物品
      const expiringItems = await Inventory.getExpiringItems(familyId, 7);
      
      // 基于历史消费数据生成建议（简化版）
      const suggestions = await this.generatePurchaseSuggestions(familyId, lowStockItems);
      
      // 估算总成本
      const totalEstimatedCost = this.calculateEstimatedCost([...lowStockItems, ...suggestions]);

      return {
        low_stock_items: lowStockItems,
        expiring_items: expiringItems,
        suggestions,
        total_estimated_cost: totalEstimatedCost
      };
    } catch (error) {
      logger.error('生成智能购物清单失败:', error);
      throw error;
    }
  }  /**
   * 生成采购建议
   */
  private static async generatePurchaseSuggestions(
    familyId: string, 
    lowStockItems: any[]
  ): Promise<any[]> {
    // 简化版建议算法，基于分类和季节性
    const suggestions = [];
    
    for (const item of lowStockItems) {
      const suggestedQuantity = Math.max(
        item.min_stock_threshold * 2, 
        item.min_stock_threshold + 10
      );
      
      suggestions.push({
        item_id: item.id,
        name: item.name,
        category: item.category_id,
        suggested_quantity: suggestedQuantity,
        unit: item.unit,
        reason: '库存不足',
        priority: this.calculatePriority(item),
        estimated_price: this.estimatePrice(item, suggestedQuantity)
      });
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 计算采购优先级
   */
  private static calculatePriority(item: any): number {
    let priority = 0;
    
    // 基于库存不足程度
    const stockRatio = item.current_stock / Math.max(item.min_stock_threshold, 1);
    if (stockRatio < 0.5) priority += 10;
    else if (stockRatio < 1) priority += 5;
    
    // 基于物品分类（生活必需品优先级更高）
    const essentialCategories = ['蔬菜类', '水果类', '米面粮油'];
    if (essentialCategories.includes(item.category_name)) {
      priority += 5;
    }
    
    return priority;
  }

  /**
   * 估算物品价格
   */
  private static estimatePrice(item: any, quantity: number): number {
    // 简化版价格估算，可以基于历史采购数据
    const basePrices: { [key: string]: number } = {
      '蔬菜类': 8,   // 每斤8元
      '水果类': 12,  // 每斤12元
      '肉类': 35,    // 每斤35元
      '米面粮油': 6, // 每斤6元
      '调料': 15     // 每包15元
    };
    
    const basePrice = basePrices[item.category_name] || 10;
    return basePrice * quantity;
  }

  /**
   * 计算预估总成本
   */
  private static calculateEstimatedCost(items: any[]): number {
    return items.reduce((total, item) => {
      return total + (item.estimated_price || 0);
    }, 0);
  }

  /**
   * 获取所有活跃家庭
   */
  private static async getAllActiveFamilies(): Promise<any[]> {
    // 这里需要实现获取所有活跃家庭的逻辑
    // 简化版，实际应该从数据库查询
    return [];
  }

  /**
   * 发送购物清单通知
   */
  static async sendShoppingListNotification(familyId: string): Promise<void> {
    try {
      const shoppingList = await this.generateSmartShoppingList(familyId);
      
      if (shoppingList.low_stock_items.length > 0 || shoppingList.suggestions.length > 0) {
        const notification = {
          type: 'info',
          title: '智能购物清单',
          message: `为您生成了包含 ${shoppingList.low_stock_items.length + shoppingList.suggestions.length} 个物品的购物清单`,
          data: {
            shopping_list: shoppingList,
            action_type: 'shopping_list_generated',
            family_id: familyId
          },
          timestamp: new Date().toISOString()
        };

        socketManager.emitToFamily(familyId, 'notification', notification);
        
        logger.info('发送购物清单通知', {
          familyId,
          itemCount: shoppingList.low_stock_items.length + shoppingList.suggestions.length,
          estimatedCost: shoppingList.total_estimated_cost
        });
      }
    } catch (error) {
      logger.error('发送购物清单通知失败:', error);
    }
  }
}