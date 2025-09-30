import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll, executeInTransaction } from '../config/database';
import { NotFoundError, ConflictError, AuthorizationError } from '../middlewares/errorHandler';
import { Family } from './Family';

// 食材基础信息接口（对应food_items表）
export interface IFoodItem {
  id: string;
  name: string;
  category_id: string;
  barcode?: string;
  unit: string; // kg, g, L, ml, 个, 包, 盒, 瓶等
  default_expire_days: number;
  min_stock_threshold?: number;
  nutrition_info?: string; // JSON格式营养信息
  image?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 库存记录接口（对应inventory表，支持多批次）
export interface IInventory {
  id: string;
  family_id: string;
  food_item_id: string;
  batch_number?: string; // 批次号
  quantity: number;
  unit: string;
  purchase_date: string;
  expire_date?: string;
  purchase_price?: number;
  location: string; // 冰箱、冷冻室、储藏室、厨房等
  status: string; // available, expired, consumed, running_low
  notes?: string;
  added_by: string;
  created_at: string;
  updated_at: string;
  consumed_at?: string;
}

// 食材分类接口（对应food_categories表）
export interface IFoodCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
}

// 创建食材输入数据
export interface CreateFoodItemData {
  name: string;
  category_id: string;
  barcode?: string;
  unit: string;
  default_expire_days?: number;
  min_stock_threshold?: number;
  nutrition_info?: string;
  image?: string;
  description?: string;
}

// 创建库存记录输入数据
export interface CreateInventoryData {
  food_item_id: string;
  batch_number?: string;
  quantity: number;
  unit: string;
  purchase_date: string;
  expire_date?: string;
  purchase_price?: number;
  location?: string;
  notes?: string;
}

// 库存查询参数
export interface InventoryQueryParams {
  category_id?: string;
  location?: string;
  status?: 'available' | 'expired' | 'consumed' | 'running_low';
  search?: string;
  sort_by?: 'name' | 'expire_date' | 'quantity' | 'created_at';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

// 库存统计接口
export interface InventoryStatistics {
  total_items: number;
  total_categories: number;
  expired_items: number;
  expiring_soon_items: number;
  total_value?: number;
}

// 兼容控制器引用的类型（占位）
export type CreateInventoryItemData = any;
export type UpdateInventoryItemData = any;
export type CreateInventoryBatchData = any;

// 库存管理类
export class Inventory {
  /**
   * 获取库存不足的物品（简化：阈值未建模，先返回空列表）
   */
  static async getLowStockItems(familyId: string): Promise<any[]> {
    const rows = await dbAll<any>(
      `SELECT 
         fi.id as item_id, fi.name, fi.unit, fi.min_stock_threshold,
         SUM(CASE WHEN i.status='available' THEN i.quantity ELSE 0 END) as current_stock
       FROM food_items fi
       LEFT JOIN inventory i ON i.food_item_id = fi.id AND i.family_id = ?
       WHERE fi.is_active = 1
       GROUP BY fi.id
       HAVING fi.min_stock_threshold IS NOT NULL 
          AND fi.min_stock_threshold > 0 
          AND (SUM(CASE WHEN i.status='available' THEN i.quantity ELSE 0 END) <= fi.min_stock_threshold)
       ORDER BY current_stock ASC, fi.name ASC`,
      [familyId]
    );

    return rows.map(r => ({
      id: r.item_id,
      name: r.name,
      unit: r.unit,
      current_stock: Number(r.current_stock || 0),
      min_stock_threshold: Number(r.min_stock_threshold || 0)
    }));
  }

  /**
   * 创建物品：映射为创建 food_item 记录
   */
  static async createItem(itemData: any, familyId: string, userId: string): Promise<any> {
    const created = await this.createFoodItem({
      name: itemData.name,
      category_id: itemData.category_id,
      barcode: itemData.barcode,
      unit: itemData.unit,
      description: itemData.notes || itemData.brand || undefined
    }, userId);

    return {
      id: created.id,
      family_id: familyId,
      name: created.name,
      category_id: created.category_id,
      unit: created.unit,
      current_stock: 0,
      min_stock_threshold: itemData.min_stock_threshold || 0,
      location: itemData.location || null,
      created_at: created.created_at
    };
  }

  /**
   * 获取家庭物品列表（按 food_item 聚合）
   */
  static async getFamilyItems(
    familyId: string,
    userId: string,
    queryParams: any
  ): Promise<{ items: any[]; pagination: { page: number; pageSize: number; total: number } }> {
    const {
      category_id,
      location,
      status,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
      page = 1,
      pageSize = 20
    } = queryParams || {};

    const params: any[] = [familyId];
    let where = 'WHERE fi.is_active = 1';

    if (category_id) {
      where += ' AND fi.category_id = ?';
      params.push(category_id);
    }

    let having = '';
    if (status) {
      // 按状态筛选：存在对应状态批次
      having = ` HAVING SUM(CASE WHEN i.status = ? THEN 1 ELSE 0 END) > 0`;
      params.push(status);
    }

    // 搜索
    if (search) {
      where += ' AND (fi.name LIKE ? OR fi.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // 统计总数（以 food_item 维度）
    const countRows = await dbAll<any>(
      `SELECT fi.id
       FROM food_items fi
       LEFT JOIN inventory i ON i.food_item_id = fi.id AND i.family_id = ?
       ${where}
       GROUP BY fi.id${having}`,
      params
    );
    const total = countRows.length;

    const offset = (page - 1) * pageSize;
    const sortExpr = (() => {
      if (sort_by === 'name') return 'fi.name';
      if (sort_by === 'expire_date') return 'MIN(i.expire_date)';
      if (sort_by === 'quantity') return "SUM(CASE WHEN i.status='available' THEN i.quantity ELSE 0 END)";
      return 'COALESCE(MIN(i.created_at), fi.created_at)';
    })();

    const rows = await dbAll<any>(
      `SELECT 
         fi.id as item_id, fi.name, fi.category_id, fi.unit, fi.description, fi.min_stock_threshold,
         SUM(CASE WHEN i.status='available' THEN i.quantity ELSE 0 END) as current_stock,
         MIN(i.expire_date) as nearest_expire_date,
         COUNT(i.id) as batch_count
       FROM food_items fi
       LEFT JOIN inventory i ON i.food_item_id = fi.id AND i.family_id = ?
       ${where}
       GROUP BY fi.id
       ${having}
       ORDER BY ${sortExpr} ${sort_order === 'ASC' ? 'ASC' : 'DESC'}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const items = rows.map(r => ({
      id: r.item_id,
      name: r.name,
      category_id: r.category_id,
      unit: r.unit,
      current_stock: Number(r.current_stock || 0),
      min_stock_threshold: Number(r.min_stock_threshold || 0),
      nearest_expire_date: r.nearest_expire_date,
      batch_count: r.batch_count
    }));

    return { items, pagination: { page, pageSize, total } };
  }

  /**
   * 按ID查找物品（含聚合库存）
   */
  static async findItemById(id: string): Promise<any | null> {
    const item = await dbGet<any>('SELECT * FROM food_items WHERE id = ? AND is_active = 1', [id]);
    if (!item) return null;

    const agg = await dbGet<any>(
      `SELECT 
         SUM(CASE WHEN status='available' THEN quantity ELSE 0 END) as current_stock,
         MIN(expire_date) as nearest_expire_date
       FROM inventory WHERE food_item_id = ?`,
      [id]
    );

    return {
      id: item.id,
      name: item.name,
      category_id: item.category_id,
      unit: item.unit,
      description: item.description,
      min_stock_threshold: Number(item.min_stock_threshold || 0),
      current_stock: Number(agg?.current_stock || 0),
      nearest_expire_date: agg?.nearest_expire_date || null,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  }

  /**
   * 获取物品批次（限制家庭）
   */
  static async getItemBatchesByFamily(itemId: string, familyId: string): Promise<any[]> {
    return await dbAll<any>(
      `SELECT * FROM inventory 
       WHERE food_item_id = ? AND family_id = ?
       ORDER BY 
         CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
         expire_date ASC, created_at ASC`,
      [itemId, familyId]
    );
  }

  /**
   * 更新物品（更新 food_items）
   */
  static async updateItem(itemId: string, updateData: any, userId: string): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = ['name', 'category_id', 'barcode', 'unit', 'description', 'image', 'min_stock_threshold'];
    for (const k of allowed) {
      if (updateData[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(updateData[k]);
      }
    }

    if (fields.length === 0) {
      return await this.findItemById(itemId);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(itemId);

    await dbRun(`UPDATE food_items SET ${fields.join(', ')} WHERE id = ?`, values);
    return await this.findItemById(itemId);
  }

  /**
   * 创建批次（映射为 inventory 记录）
   */
  static async createBatch(batchData: any, userId: string): Promise<any> {
    const now = new Date().toISOString();
    const id = uuidv4().replace(/-/g, '');

    await dbRun(
      `INSERT INTO inventory (
        id, family_id, food_item_id, batch_number, quantity, unit, purchase_date, expire_date,
        purchase_price, location, status, notes, added_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`,
      [
        id,
        batchData.family_id,
        batchData.item_id,
        batchData.batch_number || null,
        batchData.quantity,
        batchData.unit,
        batchData.purchase_date,
        batchData.expiry_date || null,
        batchData.unit_price || null,
        batchData.location || '仓库',
        batchData.notes || null,
        userId,
        now,
        now
      ]
    );

    return await this.findInventoryById(id);
  }

  /**
   * 消耗物品（按家庭 + 食材分配，支持部分消耗）
   */
  static async consumeItemInFamily(itemId: string, familyId: string, quantity: number, userId: string, reason?: string): Promise<void> {
    if (quantity <= 0) return;

    // 按过期时间优先
    const batches = await dbAll<any>(
      `SELECT * FROM inventory 
       WHERE family_id = ? AND food_item_id = ? AND status = 'available' AND quantity > 0
       ORDER BY 
         CASE WHEN expire_date IS NULL THEN 1 ELSE 0 END,
         expire_date ASC, created_at ASC`,
      [familyId, itemId]
    );

    let remain = quantity;
    const now = new Date().toISOString();

    for (const b of batches) {
      if (remain <= 0) break;
      const take = Math.min(Number(b.quantity), remain);

      if (take <= 0) continue;

      // 1) 为消耗部分插入一条 consumed 记录（保留原批次追踪）
      const consumedId = uuidv4().replace(/-/g, '');
      await dbRun(
        `INSERT INTO inventory (id, family_id, food_item_id, batch_number, quantity, unit, purchase_date, expire_date, purchase_price,
          location, status, notes, added_by, created_at, updated_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'consumed', ?, ?, ?, ?, ?)`,
        [
          consumedId,
          b.family_id,
          b.food_item_id,
          b.batch_number,
          take,
          b.unit,
          b.purchase_date,
          b.expire_date,
          b.purchase_price,
          b.location,
          reason || null,
          userId,
          now,
          now,
          now
        ]
      );

      // 2) 更新原批次剩余数量/状态
      const left = Number(b.quantity) - take;
      if (left <= 0) {
        await dbRun(
          `UPDATE inventory SET quantity = 0, status = 'consumed', consumed_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, b.id]
        );
      } else {
        await dbRun(
          `UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?`,
          [left, now, b.id]
        );
      }

      remain -= take;
    }
  }

  /**
   * 软删除物品（禁用 food_item）
   */
  static async softDeleteItem(itemId: string, userId: string): Promise<void> {
    await dbRun('UPDATE food_items SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), itemId]);
  }

  /**
   * 创建食材基础信息
   */
  static async createFoodItem(itemData: CreateFoodItemData, creatorId: string): Promise<IFoodItem> {
    const itemId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO food_items (id, name, category_id, barcode, unit, 
       default_expire_days, min_stock_threshold, nutrition_info, image, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        itemData.name,
        itemData.category_id,
        itemData.barcode || null,
        itemData.unit,
        itemData.default_expire_days || 7,
        itemData.min_stock_threshold || 0,
        itemData.nutrition_info || null,
        itemData.image || null,
        itemData.description || null,
        now,
        now
      ]
    );

    const item = await this.findFoodItemById(itemId);
    if (!item) {
      throw new Error('食材创建失败');
    }

    return item;
  }

  /**
   * 根据ID查找食材
   */
  static async findFoodItemById(id: string): Promise<IFoodItem | null> {
    const item = await dbGet<IFoodItem>(
      'SELECT * FROM food_items WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return item || null;
  }

  /**
   * 创建库存记录
   */
  static async createInventory(inventoryData: CreateInventoryData, familyId: string, userId: string): Promise<IInventory> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const inventoryId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO inventory (id, family_id, food_item_id, batch_number, quantity, 
       unit, purchase_date, expire_date, purchase_price, location, status, notes, 
       added_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inventoryId,
        familyId,
        inventoryData.food_item_id,
        inventoryData.batch_number || null,
        inventoryData.quantity,
        inventoryData.unit,
        inventoryData.purchase_date,
        inventoryData.expire_date || null,
        inventoryData.purchase_price || null,
        inventoryData.location || '冰箱',
        'available',
        inventoryData.notes || null,
        userId,
        now,
        now
      ]
    );

    const inventory = await this.findInventoryById(inventoryId);
    if (!inventory) {
      throw new Error('库存记录创建失败');
    }

    return inventory;
  }

  /**
   * 根据ID查找库存记录
   */
  static async findInventoryById(id: string): Promise<IInventory | null> {
    const inventory = await dbGet<IInventory>(
      'SELECT * FROM inventory WHERE id = ?',
      [id]
    );
    
    return inventory || null;
  }

  /**
   * 获取家庭库存列表
   */
  static async getFamilyInventory(familyId: string, userId: string, queryParams: InventoryQueryParams = {}): Promise<{
    items: Array<IInventory & { food_item: IFoodItem; category: IFoodCategory }>;
    pagination: { page: number; pageSize: number; total: number };
  }> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const {
      category_id,
      location,
      status,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
      page = 1,
      pageSize = 20
    } = queryParams;

    let whereClause = 'WHERE i.family_id = ?';
    const params: any[] = [familyId];

    // 构建查询条件
    if (category_id) {
      whereClause += ' AND fi.category_id = ?';
      params.push(category_id);
    }

    if (location) {
      whereClause += ' AND i.location = ?';
      params.push(location);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (fi.name LIKE ? OR fi.description LIKE ? OR i.notes LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 获取总数
    const countResult = await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM inventory i
       JOIN food_items fi ON i.food_item_id = fi.id
       ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // 验证排序字段（防SQL注入）
    const allowedSortFields = ['name', 'expire_date', 'quantity', 'created_at'];
    const safeSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order === 'ASC' ? 'ASC' : 'DESC';

    // 分页查询
    const offset = (page - 1) * pageSize;
    const items = await dbAll<any>(
      `SELECT i.*, fi.name as food_name, fi.unit as food_unit, fi.image as food_image,
              fc.name as category_name, fc.icon as category_icon, fc.color as category_color
       FROM inventory i
       JOIN food_items fi ON i.food_item_id = fi.id
       JOIN food_categories fc ON fi.category_id = fc.id
       ${whereClause} 
       ORDER BY ${safeSortBy === 'name' ? 'fi.name' : 'i.' + safeSortBy} ${safeSortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const formattedItems = items.map(row => ({
      id: row.id,
      family_id: row.family_id,
      food_item_id: row.food_item_id,
      batch_number: row.batch_number,
      quantity: row.quantity,
      unit: row.unit,
      purchase_date: row.purchase_date,
      expire_date: row.expire_date,
      purchase_price: row.purchase_price,
      location: row.location,
      status: row.status,
      notes: row.notes,
      added_by: row.added_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      consumed_at: row.consumed_at,
      food_item: {
        id: row.food_item_id,
        name: row.food_name,
        category_id: row.category_id,
        unit: row.food_unit,
        image: row.food_image
      } as IFoodItem,
      category: {
        id: row.category_id,
        name: row.category_name,
        icon: row.category_icon,
        color: row.category_color
      } as IFoodCategory
    }));

    return {
      items: formattedItems,
      pagination: {
        page,
        pageSize,
        total
      }
    };
  }

  /**
   * 获取即将过期的物品
   */
  static async getExpiringItems(familyId: string, days: number = 7): Promise<Array<IInventory & { food_item: IFoodItem; days_until_expiry: number }>> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    const results = await dbAll<any>(
      `SELECT i.*, fi.name as food_name, fi.unit as food_unit,
              CAST(julianday(i.expire_date) - julianday('now') as INTEGER) as days_until_expiry
       FROM inventory i
       JOIN food_items fi ON i.food_item_id = fi.id
       WHERE i.family_id = ? 
         AND i.status = 'available'
         AND i.expire_date IS NOT NULL
         AND i.expire_date <= ?
       ORDER BY i.expire_date ASC`,
      [familyId, futureDate.toISOString().split('T')[0]]
    );

    return results.map(row => ({
      ...row,
      food_item: {
        id: row.food_item_id,
        name: row.food_name,
        unit: row.food_unit
      } as IFoodItem,
      days_until_expiry: row.days_until_expiry
    }));
  }

  /**
   * 获取库存统计信息
   */
  static async getFamilyStatistics(familyId: string): Promise<InventoryStatistics> {
    const [totalItems, expiredItems, expiringItems] = await Promise.all([
      // 总库存记录数
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM inventory WHERE family_id = ? AND status = "available"', [familyId]),
      
      // 已过期物品数
      dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM inventory 
         WHERE family_id = ? AND status = 'available' AND expire_date IS NOT NULL 
         AND expire_date < date('now')`,
        [familyId]
      ),
      
      // 即将过期物品数（7天内）
      dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM inventory 
         WHERE family_id = ? AND status = 'available' AND expire_date IS NOT NULL
         AND expire_date <= date('now', '+7 days') AND expire_date >= date('now')`,
        [familyId]
      )
    ]);

    // 获取食材分类数量
    const categories = await dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM food_categories WHERE is_active = 1'
    );

    return {
      total_items: totalItems?.count || 0,
      total_categories: categories?.count || 0,
      expired_items: expiredItems?.count || 0,
      expiring_soon_items: expiringItems?.count || 0
    };
  }

  /**
   * 更新库存状态
   */
  static async updateInventoryStatus(id: string, status: string, userId: string): Promise<void> {
    const inventory = await this.findInventoryById(id);
    if (!inventory) {
      throw new NotFoundError('库存记录不存在');
    }

    const membership = await Family.getMembership(inventory.family_id, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'consumed') {
      updateData.consumed_at = new Date().toISOString();
    }

    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);

    await dbRun(
      `UPDATE inventory SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
  }
}

// 食材分类管理类
export class FoodCategory {
  /**
   * 获取所有分类
   */
  static async getAll(): Promise<IFoodCategory[]> {
    const categories = await dbAll<IFoodCategory>(
      'SELECT * FROM food_categories WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    
    return categories;
  }

  /**
   * 根据ID查找分类
   */
  static async findById(id: string): Promise<IFoodCategory | null> {
    const category = await dbGet<IFoodCategory>(
      'SELECT * FROM food_categories WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return category || null;
  }
}