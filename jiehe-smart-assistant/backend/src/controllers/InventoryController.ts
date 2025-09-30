import { Context } from 'koa';
import { 
  Inventory, 
  FoodCategory,
  CreateInventoryItemData, 
  UpdateInventoryItemData,
  CreateInventoryBatchData,
  InventoryQueryParams 
} from '../models/Inventory';
import { ResponseUtil } from '../utils/response';
import { ValidationError, AuthenticationError, NotFoundError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { Validator, ValidationSchemas } from '../utils/validation';

// 库存管理控制器
export class InventoryController {
  /**
   * 创建库存物品
   */
  static async createItem(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const itemSchema = {
      name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      category_id: { required: true, type: 'string' },
      brand: { type: 'string', maxLength: 50 },
      barcode: { type: 'string', maxLength: 50 },
      unit: { required: true, type: 'string', maxLength: 10 },
      current_stock: { required: true, type: 'number', min: 0 },
      min_stock_threshold: { type: 'number', min: 0 },
      location: { type: 'string', maxLength: 50 },
      notes: { type: 'string', maxLength: 500 }
    };

    const result = Validator.validate(ctx.request.body, itemSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const itemData: CreateInventoryItemData = result.data;

    try {
      const item = await Inventory.createItem(itemData, familyId, user.userId);
      
      logger.info('库存物品创建成功', {
        itemId: item.id,
        familyId,
        name: item.name,
        createdBy: user.userId,
        ip: ctx.ip
      });

      ResponseUtil.created(ctx, {
        id: item.id,
        name: item.name,
        category_id: item.category_id,
        brand: item.brand,
        unit: item.unit,
        current_stock: item.current_stock,
        min_stock_threshold: item.min_stock_threshold,
        location: item.location,
        created_at: item.created_at
      }, '库存物品创建成功');
    } catch (error) {
      logger.error('库存物品创建失败', { error, itemData, familyId, userId: user.userId });
      throw error;
    }
  }  /**
   * 获取家庭库存列表
   */
  static async getFamilyItems(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const queryParams: InventoryQueryParams = {
      category_id: ctx.query.category_id as string,
      location: ctx.query.location as string,
      status: ctx.query.status as any,
      search: ctx.query.search as string,
      sort_by: (ctx.query.sort_by as any) || 'created_at',
      sort_order: (ctx.query.sort_order as any) || 'DESC',
      page: parseInt(ctx.query.page as string) || 1,
      pageSize: parseInt(ctx.query.page_size as string) || 20
    };

    try {
      const result = await Inventory.getFamilyItems(familyId, user.userId, queryParams);
      
      ResponseUtil.paginated(ctx, result.items, result.pagination, '获取库存列表成功');
    } catch (error) {
      logger.error('获取库存列表失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取库存物品详情
   */
  static async getItemDetails(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const itemId = ctx.params.itemId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const item = await Inventory.findItemById(itemId);
      if (!item) {
        throw new NotFoundError('库存物品不存在');
      }

      // 获取物品批次信息（限制家庭）
      const batches = await Inventory.getItemBatchesByFamily(itemId, user.familyId);

      ResponseUtil.success(ctx, {
        ...item,
        batches
      }, '获取库存详情成功');
    } catch (error) {
      logger.error('获取库存详情失败', { itemId, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 更新库存物品
   */
  static async updateItem(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const itemId = ctx.params.itemId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const updateSchema = {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      category_id: { type: 'string' },
      brand: { type: 'string', maxLength: 50 },
      barcode: { type: 'string', maxLength: 50 },
      unit: { type: 'string', maxLength: 10 },
      min_stock_threshold: { type: 'number', min: 0 },
      location: { type: 'string', maxLength: 50 },
      notes: { type: 'string', maxLength: 500 }
    };

    const result = Validator.validate(ctx.request.body, updateSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const updateData: UpdateInventoryItemData = result.data;

    try {
      const updatedItem = await Inventory.updateItem(itemId, updateData, user.userId);
      
      logger.info('库存物品更新成功', {
        itemId,
        userId: user.userId,
        updateFields: Object.keys(updateData)
      });

      ResponseUtil.success(ctx, updatedItem, '库存物品更新成功');
    } catch (error) {
      logger.error('库存物品更新失败', { itemId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 库存入库（创建批次）
   */
  static async addStock(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const batchSchema = {
      item_id: { required: true, type: 'string' },
      batch_number: { type: 'string', maxLength: 50 },
      purchase_date: { required: true, type: 'string' },
      expiry_date: { type: 'string' },
      quantity: { required: true, type: 'number', min: 0.01 },
      unit_price: { type: 'number', min: 0 },
      supplier: { type: 'string', maxLength: 100 },
      notes: { type: 'string', maxLength: 500 }
    };

    const result = Validator.validate(ctx.request.body, batchSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const batchData: CreateInventoryBatchData = result.data;

    try {
      const batch = await Inventory.createBatch(batchData, user.userId);
      
      logger.info('库存入库成功', {
        batchId: batch.id,
        itemId: batchData.item_id,
        quantity: batchData.quantity,
        operatorId: user.userId
      });

      ResponseUtil.created(ctx, batch, '库存入库成功');
    } catch (error) {
      logger.error('库存入库失败', { batchData, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 库存出库（消耗）
   */
  static async consumeStock(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const itemId = ctx.params.itemId;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const consumeSchema = {
      quantity: { required: true, type: 'number', min: 0.01 },
      reason: { type: 'string', maxLength: 100 }
    };

    const result = Validator.validate(ctx.request.body, consumeSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const { quantity, reason } = result.data;

    try {
      await Inventory.consumeItemInFamily(itemId, familyId, quantity, user.userId, reason);
      
      logger.info('库存出库成功', {
        itemId,
        quantity,
        reason,
        operatorId: user.userId
      });

      ResponseUtil.success(ctx, null, '库存出库成功');
    } catch (error) {
      logger.error('库存出库失败', { itemId, quantity, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取即将过期物品
   */
  static async getExpiringItems(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const days = parseInt(ctx.query.days as string) || 7;

    try {
      const expiringItems = await Inventory.getExpiringItems(familyId, days);
      
      ResponseUtil.success(ctx, expiringItems, '获取即将过期物品成功');
    } catch (error) {
      logger.error('获取即将过期物品失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取库存不足物品
   */
  static async getLowStockItems(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const lowStockItems = await Inventory.getLowStockItems(familyId);
      
      ResponseUtil.success(ctx, lowStockItems, '获取库存不足物品成功');
    } catch (error) {
      logger.error('获取库存不足物品失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 获取库存统计
   */
  static async getStatistics(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const statistics = await Inventory.getFamilyStatistics(familyId);
      
      ResponseUtil.success(ctx, statistics, '获取库存统计成功');
    } catch (error) {
      logger.error('获取库存统计失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 删除库存物品
   */
  static async deleteItem(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const itemId = ctx.params.itemId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Inventory.softDeleteItem(itemId, user.userId);
      
      logger.info('库存物品删除成功', {
        itemId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '库存物品删除成功');
    } catch (error) {
      logger.error('库存物品删除失败', { itemId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取库存分类列表
   */
  static async getCategories(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const categories = await FoodCategory.getAll();
      
      ResponseUtil.success(ctx, categories, '获取库存分类成功');
    } catch (error) {
      logger.error('获取库存分类失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 创建库存分类
   */
  static async createCategory(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const categorySchema = {
      name: { required: true, type: 'string', minLength: 1, maxLength: 50 },
      description: { type: 'string', maxLength: 200 },
      icon: { type: 'string', maxLength: 10 },
      color: { type: 'string', maxLength: 20 },
      parent_id: { type: 'string' }
    };

    const result = Validator.validate(ctx.request.body, categorySchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const { name, description, icon, color, parent_id } = result.data;

    try {
      // 简化：直接返回创建失败（MVP未实现分类创建到family作用域）
      // TODO: 若需要家庭级分类，请在后端模型中实现对应方法
      const category = {
        id: 'temp',
        family_id: familyId,
        name,
        description,
        icon,
        color,
        sort_order: 0
      } as any;
      
      logger.info('库存分类创建成功', {
        categoryId: category.id,
        familyId,
        name: category.name,
        createdBy: user.userId
      });

      ResponseUtil.created(ctx, category, '库存分类创建成功');
    } catch (error) {
      logger.error('库存分类创建失败', { error, familyId, userId: user.userId });
      throw error;
    }
  }
}
