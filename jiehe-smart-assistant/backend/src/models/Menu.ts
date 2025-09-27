import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll, executeInTransaction } from '../config/database';
import { NotFoundError, ConflictError, AuthorizationError } from '../middlewares/errorHandler';
import { Family } from './Family';

// 菜单接口
export interface IMenu {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  menu_date: string; // YYYY-MM-DD格式
  status: 'draft' | 'active' | 'voting' | 'completed';
  voting_deadline?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 菜品接口
export interface IDish {
  id: string;
  menu_id: string;
  name: string;
  description?: string;
  category: 'main' | 'soup' | 'appetizer' | 'dessert' | 'drink';
  estimated_time?: number; // 预估制作时间（分钟）
  difficulty_level: 1 | 2 | 3 | 4 | 5; // 难度等级
  ingredients?: string; // JSON字符串，存储所需食材
  recipe_url?: string;
  image_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 点菜记录接口
export interface IMenuVote {
  id: string;
  menu_id: string;
  dish_id: string;
  user_id: string;
  vote_type: 'like' | 'dislike' | 'neutral';
  priority: number; // 1-5优先级
  notes?: string; // 备注（如过敏信息等）
  voted_at: string;
  updated_at: string;
}

// 菜单统计接口
export interface IMenuStatistics {
  menu_id: string;
  dish_id: string;
  dish_name: string;
  total_votes: number;
  like_votes: number;
  dislike_votes: number;
  neutral_votes: number;
  avg_priority: number;
  final_score: number; // 综合评分
}

// 创建菜单输入数据
export interface CreateMenuData {
  title: string;
  description?: string;
  menu_date: string;
  voting_deadline?: string;
}

// 更新菜单输入数据
export interface UpdateMenuData {
  title?: string;
  description?: string;
  menu_date?: string;
  status?: 'draft' | 'active' | 'voting' | 'completed';
  voting_deadline?: string;
}

// 创建菜品输入数据
export interface CreateDishData {
  name: string;
  description?: string;
  category: 'main' | 'soup' | 'appetizer' | 'dessert' | 'drink';
  estimated_time?: number;
  difficulty_level: 1 | 2 | 3 | 4 | 5;
  ingredients?: string[];
  recipe_url?: string;
  image_url?: string;
}// 菜单查询参数
export interface MenuQueryParams {
  status?: 'draft' | 'active' | 'voting' | 'completed';
  date_from?: string;
  date_to?: string;
  created_by?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'menu_date' | 'created_at' | 'updated_at';
  sort_order?: 'ASC' | 'DESC';
}

// 菜单管理类
export class Menu {
  /**
   * 创建菜单
   */
  static async create(menuData: CreateMenuData, familyId: string, creatorId: string): Promise<IMenu> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, creatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 验证菜单管理权限
    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu) {
      throw new AuthorizationError('您没有菜单管理权限');
    }

    // 检查同一日期是否已有活跃菜单
    const existingMenu = await dbGet<IMenu>(
      'SELECT * FROM menus WHERE family_id = ? AND menu_date = ? AND status != ? AND is_active = 1',
      [familyId, menuData.menu_date, 'completed']
    );

    if (existingMenu) {
      throw new ConflictError('该日期已有活跃菜单，请先完成或取消现有菜单');
    }

    const menuId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO menus (id, family_id, title, description, menu_date, status, 
       voting_deadline, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        menuId,
        familyId,
        menuData.title,
        menuData.description || null,
        menuData.menu_date,
        'draft',
        menuData.voting_deadline || null,
        creatorId,
        now,
        now
      ]
    );

    const menu = await Menu.findById(menuId);
    if (!menu) {
      throw new Error('菜单创建失败');
    }

    return menu;
  }

  /**
   * 根据ID查找菜单
   */
  static async findById(id: string): Promise<IMenu | null> {
    const menu = await dbGet<IMenu>(
      'SELECT * FROM menus WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return menu || null;
  }  /**
   * 获取家庭菜单列表
   */
  static async getFamilyMenus(familyId: string, userId: string, queryParams: MenuQueryParams = {}): Promise<{
    menus: IMenu[];
    pagination: { page: number; page_size: number; total: number };
  }> {
    // 验证家庭成员权限
    const membership = await Family.getMembership(familyId, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const {
      status,
      date_from,
      date_to,
      created_by,
      sort_by = 'menu_date',
      sort_order = 'DESC',
      page = 1,
      page_size = 20
    } = queryParams;

    let whereClause = 'WHERE family_id = ? AND is_active = 1';
    const params: any[] = [familyId];

    // 构建查询条件
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (date_from) {
      whereClause += ' AND menu_date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND menu_date <= ?';
      params.push(date_to);
    }

    if (created_by) {
      whereClause += ' AND created_by = ?';
      params.push(created_by);
    }

    // 获取总数
    const countResult = await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM menus ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // 分页查询
    const offset = (page - 1) * page_size;
    const menus = await dbAll<IMenu>(
      `SELECT * FROM menus ${whereClause} 
       ORDER BY ${sort_by} ${sort_order} 
       LIMIT ? OFFSET ?`,
      [...params, page_size, offset]
    );

    return {
      menus,
      pagination: {
        page,
        page_size,
        total
      }
    };
  }

  /**
   * 更新菜单
   */
  static async update(id: string, updateData: UpdateMenuData, operatorId: string): Promise<IMenu> {
    const menu = await this.findById(id);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 只有创建者或管理员能修改菜单
    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && menu.created_by !== operatorId) {
      throw new AuthorizationError('您没有修改此菜单的权限');
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 动态构建更新字段
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return menu;
    }

    // 添加更新时间
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await dbRun(
      `UPDATE menus SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedMenu = await this.findById(id);
    if (!updatedMenu) {
      throw new Error('更新菜单失败');
    }

    return updatedMenu;
  }  /**
   * 添加菜品到菜单
   */
  static async addDish(menuId: string, dishData: CreateDishData, operatorId: string): Promise<IDish> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && menu.created_by !== operatorId) {
      throw new AuthorizationError('您没有修改此菜单的权限');
    }

    const dishId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO dishes (id, menu_id, name, description, category, estimated_time, 
       difficulty_level, ingredients, recipe_url, image_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dishId,
        menuId,
        dishData.name,
        dishData.description || null,
        dishData.category,
        dishData.estimated_time || null,
        dishData.difficulty_level,
        dishData.ingredients ? JSON.stringify(dishData.ingredients) : null,
        dishData.recipe_url || null,
        dishData.image_url || null,
        operatorId,
        now,
        now
      ]
    );

    const dish = await this.findDishById(dishId);
    if (!dish) {
      throw new Error('菜品添加失败');
    }

    return dish;
  }

  /**
   * 根据ID查找菜品
   */
  static async findDishById(id: string): Promise<IDish | null> {
    const dish = await dbGet<IDish>(
      'SELECT * FROM dishes WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return dish || null;
  }

  /**
   * 获取菜单的所有菜品
   */
  static async getMenuDishes(menuId: string, userId: string): Promise<IDish[]> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证家庭成员权限
    const membership = await Family.getMembership(menu.family_id, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const dishes = await dbAll<IDish>(
      `SELECT * FROM dishes 
       WHERE menu_id = ? AND is_active = 1 
       ORDER BY category ASC, created_at ASC`,
      [menuId]
    );
    
    return dishes;
  }  /**
   * 用户投票/点菜
   */
  static async vote(
    menuId: string, 
    dishId: string, 
    userId: string, 
    voteData: {
      vote_type: 'like' | 'dislike' | 'neutral';
      priority: number;
      notes?: string;
    }
  ): Promise<IMenuVote> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    if (menu.status !== 'voting') {
      throw new ConflictError('该菜单当前不在投票阶段');
    }

    // 验证家庭成员权限
    const membership = await Family.getMembership(menu.family_id, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 验证菜品存在
    const dish = await this.findDishById(dishId);
    if (!dish || dish.menu_id !== menuId) {
      throw new NotFoundError('菜品不存在');
    }

    // 检查是否已经投过票
    const existingVote = await dbGet<IMenuVote>(
      'SELECT * FROM menu_votes WHERE menu_id = ? AND dish_id = ? AND user_id = ?',
      [menuId, dishId, userId]
    );

    const now = new Date().toISOString();

    if (existingVote) {
      // 更新现有投票
      await dbRun(
        `UPDATE menu_votes SET vote_type = ?, priority = ?, notes = ?, updated_at = ? 
         WHERE id = ?`,
        [voteData.vote_type, voteData.priority, voteData.notes || null, now, existingVote.id]
      );

      const updatedVote = await dbGet<IMenuVote>(
        'SELECT * FROM menu_votes WHERE id = ?',
        [existingVote.id]
      );

      return updatedVote!;
    } else {
      // 创建新投票
      const voteId = uuidv4().replace(/-/g, '');
      
      await dbRun(
        `INSERT INTO menu_votes (id, menu_id, dish_id, user_id, vote_type, priority, notes, voted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          voteId,
          menuId,
          dishId,
          userId,
          voteData.vote_type,
          voteData.priority,
          voteData.notes || null,
          now,
          now
        ]
      );

      const vote = await dbGet<IMenuVote>(
        'SELECT * FROM menu_votes WHERE id = ?',
        [voteId]
      );

      return vote!;
    }
  }

  /**
   * 获取菜单投票统计
   */
  static async getMenuStatistics(menuId: string, userId: string): Promise<IMenuStatistics[]> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证家庭成员权限
    const membership = await Family.getMembership(menu.family_id, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const statistics = await dbAll<any>(
      `SELECT 
        d.id as dish_id,
        d.name as dish_name,
        d.category,
        COUNT(mv.id) as total_votes,
        SUM(CASE WHEN mv.vote_type = 'like' THEN 1 ELSE 0 END) as like_votes,
        SUM(CASE WHEN mv.vote_type = 'dislike' THEN 1 ELSE 0 END) as dislike_votes,
        SUM(CASE WHEN mv.vote_type = 'neutral' THEN 1 ELSE 0 END) as neutral_votes,
        AVG(CASE WHEN mv.vote_type != 'dislike' THEN mv.priority ELSE 0 END) as avg_priority,
        (SUM(CASE WHEN mv.vote_type = 'like' THEN mv.priority * 2 
                  WHEN mv.vote_type = 'neutral' THEN mv.priority 
                  ELSE 0 END) * 1.0 / NULLIF(COUNT(mv.id), 0)) as final_score
       FROM dishes d
       LEFT JOIN menu_votes mv ON d.id = mv.dish_id
       WHERE d.menu_id = ? AND d.is_active = 1
       GROUP BY d.id, d.name, d.category
       ORDER BY final_score DESC NULLS LAST, like_votes DESC`,
      [menuId]
    );

    return statistics.map(row => ({
      menu_id: menuId,
      dish_id: row.dish_id,
      dish_name: row.dish_name,
      total_votes: row.total_votes || 0,
      like_votes: row.like_votes || 0,
      dislike_votes: row.dislike_votes || 0,
      neutral_votes: row.neutral_votes || 0,
      avg_priority: row.avg_priority || 0,
      final_score: row.final_score || 0
    }));
  }  /**
   * 获取用户的投票记录
   */
  static async getUserVotes(menuId: string, userId: string): Promise<IMenuVote[]> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证家庭成员权限
    const membership = await Family.getMembership(menu.family_id, userId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const votes = await dbAll<IMenuVote>(
      'SELECT * FROM menu_votes WHERE menu_id = ? AND user_id = ? ORDER BY voted_at DESC',
      [menuId, userId]
    );
    
    return votes;
  }

  /**
   * 开始投票
   */
  static async startVoting(menuId: string, operatorId: string): Promise<IMenu> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    if (menu.status !== 'draft') {
      throw new ConflictError('只能对草稿状态的菜单开始投票');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && menu.created_by !== operatorId) {
      throw new AuthorizationError('您没有启动投票的权限');
    }

    // 检查是否有菜品
    const dishes = await this.getMenuDishes(menuId, operatorId);
    if (dishes.length === 0) {
      throw new ConflictError('菜单中没有菜品，无法开始投票');
    }

    return await this.update(menuId, { status: 'voting' }, operatorId);
  }

  /**
   * 结束投票并生成最终菜单
   */
  static async finalizeMenu(menuId: string, operatorId: string): Promise<{
    menu: IMenu;
    final_dishes: IMenuStatistics[];
  }> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    if (menu.status !== 'voting') {
      throw new ConflictError('只能结束投票状态的菜单');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && menu.created_by !== operatorId) {
      throw new AuthorizationError('您没有结束投票的权限');
    }

    // 获取投票统计
    const statistics = await this.getMenuStatistics(menuId, operatorId);
    
    // 更新菜单状态
    const finalizedMenu = await this.update(menuId, { status: 'completed' }, operatorId);

    return {
      menu: finalizedMenu,
      final_dishes: statistics
    };
  }

  /**
   * 软删除菜单
   */
  static async softDelete(id: string, operatorId: string): Promise<void> {
    const menu = await this.findById(id);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && menu.created_by !== operatorId) {
      throw new AuthorizationError('您没有删除此菜单的权限');
    }

    await dbRun(
      'UPDATE menus SET is_active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  /**
   * 删除菜品
   */
  static async removeDish(dishId: string, operatorId: string): Promise<void> {
    const dish = await this.findDishById(dishId);
    if (!dish) {
      throw new NotFoundError('菜品不存在');
    }

    const menu = await this.findById(dish.menu_id);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证操作权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_menu && 
        menu.created_by !== operatorId && dish.created_by !== operatorId) {
      throw new AuthorizationError('您没有删除此菜品的权限');
    }

    await dbRun(
      'UPDATE dishes SET is_active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), dishId]
    );
  }

  /**
   * 获取最终点菜结果（带统计分析）
   */
  static async getFinalOrderResult(menuId: string, operatorId: string): Promise<any> {
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError('菜单不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(menu.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 获取菜品统计
    const dishStats = await dbAll(`
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        d.estimated_price,
        COUNT(DISTINCT mv.id) as vote_count,
        AVG(CASE 
          WHEN mv.vote_type = 'like' THEN mv.priority 
          WHEN mv.vote_type = 'dislike' THEN -mv.priority
          ELSE 0 
        END) as average_score,
        COUNT(DISTINCT mv.user_id) as voter_count,
        SUM(CASE WHEN mv.vote_type = 'like' THEN 1 ELSE 0 END) as like_count,
        SUM(CASE WHEN mv.vote_type = 'dislike' THEN 1 ELSE 0 END) as dislike_count,
        SUM(CASE WHEN mv.vote_type = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
        GROUP_CONCAT(DISTINCT mv.notes) as all_notes
      FROM dishes d
      LEFT JOIN menu_votes mv ON d.id = mv.dish_id AND mv.is_active = 1
      WHERE d.menu_id = ? AND d.is_active = 1
      GROUP BY d.id
      ORDER BY average_score DESC, vote_count DESC
    `, [menuId]);

    // 计算推荐指数 (综合得分和参与度)
    const processedDishes = dishStats.map((dish: any) => {
      const participationRate = dish.voter_count / (dish.vote_count || 1);
      const recommendationScore = (dish.average_score || 0) * 0.7 + participationRate * 0.3;
      
      const notes = dish.all_notes ? 
        dish.all_notes.split(',').filter((note: string) => note.trim()) : [];
      
      return {
        ...dish,
        average_score: dish.average_score || 0,
        recommendation_score: recommendationScore,
        top_notes: notes.slice(0, 3),
        estimated_price: dish.estimated_price || 0
      };
    });

    // 获取投票概况
    const voteOverview = await dbGet(`
      SELECT 
        COUNT(DISTINCT mv.user_id) as total_voters,
        COUNT(*) as total_votes,
        m.target_date
      FROM menus m
      LEFT JOIN dishes d ON m.id = d.menu_id AND d.is_active = 1
      LEFT JOIN menu_votes mv ON d.id = mv.dish_id AND mv.is_active = 1
      WHERE m.id = ?
      GROUP BY m.id
    `, [menuId]);

    return {
      menu: {
        id: menu.id,
        name: menu.name,
        description: menu.description,
        target_date: menu.target_date,
        status: menu.status
      },
      overview: voteOverview || { total_voters: 0, total_votes: 0 },
      dishes: processedDishes,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * 获取家庭偏好分析
   */
  static async getFamilyPreferences(familyId: string, days: number = 30): Promise<any> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 获取热门菜品类别
    const categoryStats = await dbAll(`
      SELECT 
        d.category,
        COUNT(*) as order_count,
        AVG(CASE 
          WHEN mv.vote_type = 'like' THEN mv.priority 
          WHEN mv.vote_type = 'dislike' THEN -mv.priority
          ELSE 0 
        END) as avg_score
      FROM menus m
      JOIN dishes d ON m.id = d.menu_id AND d.is_active = 1
      JOIN menu_votes mv ON d.id = mv.dish_id AND mv.is_active = 1
      WHERE m.family_id = ? 
        AND m.created_at >= ?
        AND m.status IN ('completed', 'finalized')
      GROUP BY d.category
      ORDER BY avg_score DESC, order_count DESC
    `, [familyId, cutoffDate.toISOString()]);

    // 获取最受欢迎的菜品
    const popularDishes = await dbAll(`
      SELECT 
        d.name,
        d.category,
        COUNT(*) as vote_count,
        AVG(CASE 
          WHEN mv.vote_type = 'like' THEN mv.priority 
          WHEN mv.vote_type = 'dislike' THEN -mv.priority
          ELSE 0 
        END) as avg_score
      FROM menus m
      JOIN dishes d ON m.id = d.menu_id AND d.is_active = 1
      JOIN menu_votes mv ON d.id = mv.dish_id AND mv.is_active = 1
      WHERE m.family_id = ? 
        AND m.created_at >= ?
        AND mv.vote_type = 'like'
      GROUP BY d.name, d.category
      HAVING vote_count >= 2
      ORDER BY avg_score DESC, vote_count DESC
      LIMIT 10
    `, [familyId, cutoffDate.toISOString()]);

    // 获取活跃投票者
    const activeVoters = await dbAll(`
      SELECT 
        u.name,
        COUNT(DISTINCT mv.id) as vote_count,
        COUNT(DISTINCT m.id) as menu_count
      FROM users u
      JOIN menu_votes mv ON u.id = mv.user_id AND mv.is_active = 1
      JOIN dishes d ON mv.dish_id = d.id AND d.is_active = 1
      JOIN menus m ON d.menu_id = m.id
      WHERE m.family_id = ? 
        AND m.created_at >= ?
      GROUP BY u.id, u.name
      ORDER BY vote_count DESC
    `, [familyId, cutoffDate.toISOString()]);

    return {
      analysis_period: {
        days,
        from: cutoffDate.toISOString(),
        to: new Date().toISOString()
      },
      category_preferences: categoryStats,
      popular_dishes: popularDishes,
      active_voters: activeVoters,
      generated_at: new Date().toISOString()
    };
  }
}