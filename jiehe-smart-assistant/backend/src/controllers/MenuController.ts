import { Context } from 'koa';
import { 
  Menu, 
  CreateMenuData, 
  UpdateMenuData,
  CreateDishData,
  MenuQueryParams 
} from '../models/Menu';
import { ResponseUtil } from '../utils/response';
import { ValidationError, AuthenticationError, NotFoundError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { Validator, ValidationSchemas } from '../utils/validation';

// 菜单管理控制器
export class MenuController {
  /**
   * 创建菜单
   */
  static async createMenu(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const menuSchema = {
      title: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      menu_date: { 
        required: true, 
        type: 'string',
        custom: (value: string) => {
          const date = new Date(value);
          return !isNaN(date.getTime()) || '菜单日期格式无效'
        }
      },
      voting_deadline: { 
        type: 'string',
        custom: (value: string) => {
          if (!value) return true;
          const date = new Date(value);
          return !isNaN(date.getTime()) || '投票截止日期格式无效'
        }
      }
    };

    const result = Validator.validate(ctx.request.body, menuSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const menuData: CreateMenuData = result.data;

    try {
      const menu = await Menu.create(menuData, familyId, user.userId);
      
      logger.info('菜单创建成功', {
        menuId: menu.id,
        familyId,
        title: menu.title,
        menuDate: menu.menu_date,
        createdBy: user.userId,
        ip: ctx.ip
      });

      ResponseUtil.created(ctx, {
        id: menu.id,
        title: menu.title,
        description: menu.description,
        menu_date: menu.menu_date,
        status: menu.status,
        voting_deadline: menu.voting_deadline,
        created_at: menu.created_at
      }, '菜单创建成功');
    } catch (error) {
      logger.error('菜单创建失败', { error, menuData, familyId, userId: user.userId });
      throw error;
    }
  }  /**
   * 获取家庭菜单列表
   */
  static async getFamilyMenus(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const queryParams: MenuQueryParams = {
      status: ctx.query.status as any,
      date_from: ctx.query.date_from as string,
      date_to: ctx.query.date_to as string,
      created_by: ctx.query.created_by as string,
      sort_by: (ctx.query.sort_by as any) || 'menu_date',
      sort_order: (ctx.query.sort_order as any) || 'DESC',
      page: parseInt(ctx.query.page as string) || 1,
      page_size: parseInt(ctx.query.page_size as string) || 20
    };

    try {
      const result = await Menu.getFamilyMenus(familyId, user.userId, queryParams);
      
      // 兼容分页键名
      const pageInfo = { page: result.pagination.page, pageSize: result.pagination.page_size, total: result.pagination.total };
      ResponseUtil.paginated(ctx, result.menus, pageInfo, '获取菜单列表成功');
    } catch (error) {
      logger.error('获取菜单列表失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取菜单详情
   */
  static async getMenuDetails(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const menu = await Menu.findById(menuId);
      if (!menu) {
        throw new NotFoundError('菜单不存在');
      }

      // 获取菜品和投票统计
      const [dishes, statistics, userVotes] = await Promise.all([
        Menu.getMenuDishes(menuId, user.userId),
        Menu.getMenuStatistics(menuId, user.userId),
        Menu.getUserVotes(menuId, user.userId)
      ]);

      ResponseUtil.success(ctx, {
        ...menu,
        dishes,
        statistics,
        user_votes: userVotes
      }, '获取菜单详情成功');
    } catch (error) {
      logger.error('获取菜单详情失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新菜单
   */
  static async updateMenu(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const updateSchema = {
      title: { type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      menu_date: { 
        type: 'string',
        custom: (value: string) => {
          if (!value) return true;
          const date = new Date(value);
          return !isNaN(date.getTime()) || '菜单日期格式无效'
        }
      },
      status: { 
        type: 'string',
        enum: ['draft', 'active', 'voting', 'completed']
      },
      voting_deadline: { 
        type: 'string',
        custom: (value: string) => {
          if (!value) return true;
          const date = new Date(value);
          return !isNaN(date.getTime()) || '投票截止日期格式无效'
        }
      }
    };

    const result = Validator.validate(ctx.request.body, updateSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const updateData: UpdateMenuData = result.data;

    try {
      const updatedMenu = await Menu.update(menuId, updateData, user.userId);
      
      logger.info('菜单更新成功', {
        menuId,
        userId: user.userId,
        updateFields: Object.keys(updateData)
      });

      ResponseUtil.success(ctx, updatedMenu, '菜单更新成功');
    } catch (error) {
      logger.error('菜单更新失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 添加菜品
   */
  static async addDish(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const dishSchema = {
      name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
      description: { type: 'string', maxLength: 500 },
      category: { 
        required: true,
        type: 'string',
        enum: ['main', 'soup', 'appetizer', 'dessert', 'drink']
      },
      estimated_time: { type: 'number', min: 1, max: 300 },
      difficulty_level: { 
        required: true,
        type: 'number',
        min: 1,
        max: 5
      },
      ingredients: { 
        type: 'array',
        custom: (value: any) => {
          if (!Array.isArray(value)) return '食材列表必须是数组格式';
          return value.every(item => typeof item === 'string') || '食材列表中必须都是字符串';
        }
      },
      recipe_url: { type: 'string', maxLength: 500 },
      image_url: { type: 'string', maxLength: 500 }
    };

    const result = Validator.validate(ctx.request.body, dishSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const dishData: CreateDishData = result.data;

    try {
      const dish = await Menu.addDish(menuId, dishData, user.userId);
      
      logger.info('菜品添加成功', {
        dishId: dish.id,
        menuId,
        name: dish.name,
        category: dish.category,
        createdBy: user.userId
      });

      ResponseUtil.created(ctx, dish, '菜品添加成功');
    } catch (error) {
      logger.error('菜品添加失败', { dishData, menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 用户投票/点菜
   */
  static async voteForDish(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const { menuId, dishId } = ctx.params;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const voteSchema = {
      vote_type: { 
        required: true,
        type: 'string',
        enum: ['like', 'dislike', 'neutral']
      },
      priority: { 
        required: true,
        type: 'number',
        min: 1,
        max: 5
      },
      notes: { type: 'string', maxLength: 200 }
    };

    const result = Validator.validate(ctx.request.body, voteSchema);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const voteData = result.data;

    try {
      const vote = await Menu.vote(menuId, dishId, user.userId, voteData);
      
      logger.info('用户投票成功', {
        voteId: vote.id,
        menuId,
        dishId,
        userId: user.userId,
        voteType: vote.vote_type,
        priority: vote.priority
      });

      ResponseUtil.success(ctx, vote, '投票成功');
    } catch (error) {
      logger.error('用户投票失败', { menuId, dishId, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 获取菜单投票统计
   */
  static async getMenuStatistics(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const statistics = await Menu.getMenuStatistics(menuId, user.userId);
      
      ResponseUtil.success(ctx, statistics, '获取投票统计成功');
    } catch (error) {
      logger.error('获取投票统计失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 开始投票
   */
  static async startVoting(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const updatedMenu = await Menu.startVoting(menuId, user.userId);
      
      logger.info('菜单投票开始', {
        menuId,
        userId: user.userId,
        menuDate: updatedMenu.menu_date
      });

      ResponseUtil.success(ctx, updatedMenu, '投票已开始');
    } catch (error) {
      logger.error('开始投票失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 结束投票并生成最终菜单
   */
  static async finalizeMenu(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const result = await Menu.finalizeMenu(menuId, user.userId);
      
      logger.info('菜单投票结束', {
        menuId,
        userId: user.userId,
        finalDishesCount: result.final_dishes.length
      });

      ResponseUtil.success(ctx, result, '菜单已完成');
    } catch (error) {
      logger.error('结束投票失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 删除菜单
   */
  static async deleteMenu(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Menu.softDelete(menuId, user.userId);
      
      logger.info('菜单删除成功', {
        menuId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '菜单删除成功');
    } catch (error) {
      logger.error('菜单删除失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 删除菜品
   */
  static async removeDish(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const dishId = ctx.params.dishId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Menu.removeDish(dishId, user.userId);
      
      logger.info('菜品删除成功', {
        dishId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '菜品删除成功');
    } catch (error) {
      logger.error('菜品删除失败', { dishId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取用户投票记录
   */
  static async getUserVotes(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const votes = await Menu.getUserVotes(menuId, user.userId);
      
      ResponseUtil.success(ctx, votes, '获取用户投票记录成功');
    } catch (error) {
      logger.error('获取用户投票记录失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }


  /**
   * 获取最终点菜结果
   */
  static async getFinalOrderResult(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const result = await Menu.getFinalOrderResult(menuId, user.userId);
      
      ResponseUtil.success(ctx, result, '获取点菜结果成功');
    } catch (error) {
      logger.error('获取点菜结果失败', { menuId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 导出点菜结果
   */
  static async exportOrderResult(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const menuId = ctx.params.menuId;
    const format = (ctx.query.format as string) || 'json';
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const result = await Menu.getFinalOrderResult(menuId, user.userId);
      
      if (format === 'csv') {
        // 生成CSV格式
        let csv = '菜品名称,得票数,平均评分,点菜人数,推荐指数,备注\n';
        result.dishes.forEach((dish: any) => {
          const notes = (dish.top_notes || []).join('; ');
          csv += `"${dish.name}",${dish.vote_count},${dish.average_score.toFixed(1)},${dish.voter_count},${dish.recommendation_score.toFixed(1)},"${notes}"\n`;
        });
        
        ctx.set('Content-Type', 'text/csv; charset=utf-8');
        ctx.set('Content-Disposition', `attachment; filename="menu-${menuId}-result.csv"`);
        ctx.body = csv;
      } else {
        // 默认JSON格式
        ctx.set('Content-Type', 'application/json');
        ctx.set('Content-Disposition', `attachment; filename="menu-${menuId}-result.json"`);
        ctx.body = result;
      }
      
      logger.info('点菜结果导出成功', {
        menuId,
        userId: user.userId,
        format
      });
    } catch (error) {
      logger.error('导出点菜结果失败', { menuId, userId: user.userId, format, error });
      throw error;
    }
  }

  /**
   * 获取家庭历史点菜偏好分析
   */
  static async getFamilyPreferences(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const { days = 30 } = ctx.query;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const preferences = await Menu.getFamilyPreferences(user.familyId, Number(days));
      
      ResponseUtil.success(ctx, preferences, '获取家庭偏好分析成功');
    } catch (error) {
      logger.error('获取家庭偏好分析失败', { familyId: user.familyId, userId: user.userId, error });
      throw error;
    }
  }
}
