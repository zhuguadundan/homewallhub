import { Context } from 'koa';
import { Task, CreateTaskData, UpdateTaskData, TaskQueryParams } from '../models/Task';
import { ResponseUtil } from '../utils/response';
import { ValidationError, AuthenticationError, NotFoundError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { Validator, ValidationSchemas } from '../utils/validation';

// 删除重复的Joi验证模式，统一使用Validator

// 任务管理控制器
export class TaskController {
  /**
   * 创建任务
   */
  static async createTask(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.createTask);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const taskData: CreateTaskData = result.data;
    
    // 处理空字符串
    if (taskData.assigned_to === '') taskData.assigned_to = undefined;
    if (taskData.due_date === '') taskData.due_date = undefined;

    try {
      const task = await Task.create(taskData, familyId, user.userId);
      
      logger.info('任务创建成功', {
        taskId: task.id,
        familyId,
        title: task.title,
        createdBy: user.userId,
        assignedTo: task.assigned_to,
        ip: ctx.ip
      });

      ResponseUtil.created(ctx, {
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        status: task.status,
        assigned_to: task.assigned_to,
        due_date: task.due_date,
        estimated_minutes: task.estimated_minutes,
        tags: task.tags ? task.tags.split(',') : [],
        created_at: task.created_at
      }, '任务创建成功');
    } catch (error) {
      logger.error('任务创建失败', { error, taskData, familyId, userId: user.userId });
      throw error;
    }
  }  /**
   * 获取家庭任务列表
   */
  static async getFamilyTasks(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证查询参数
    const querySchema = {
      status: { required: false, type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
      assigned_to: { required: false, type: 'string' },
      page: { required: false, type: 'number', min: 1 },
      pageSize: { required: false, type: 'number', min: 1, max: 100 }
    } as any;
    
    const validation = Validator.validate(ctx.query, querySchema);
    if (!validation.isValid) {
      throw new ValidationError('查询参数验证失败', validation.errors);
    }

    const queryParams: TaskQueryParams = validation.data;

    try {
      const result = await Task.getFamilyTasks(familyId, user.userId, queryParams);
      
      ResponseUtil.paginated(ctx, result.tasks, {
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total
      }, '获取任务列表成功');
    } catch (error) {
      logger.error('获取任务列表失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取任务详情
   */
  static async getTaskDetails(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const taskId = ctx.params.taskId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const task = await Task.getTaskWithDetails(taskId, user.userId);
      if (!task) {
        throw new NotFoundError('任务不存在');
      }

      ResponseUtil.success(ctx, task, '获取任务详情成功');
    } catch (error) {
      logger.error('获取任务详情失败', { taskId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新任务
   */
  static async updateTask(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const taskId = ctx.params.taskId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.updateTask);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const updateData: UpdateTaskData = result.data;
    
    // 处理空字符串
    if (updateData.assigned_to === '') updateData.assigned_to = undefined;
    if (updateData.due_date === '') updateData.due_date = undefined;
    if (updateData.description === '') updateData.description = undefined;

    try {
      const updatedTask = await Task.update(taskId, updateData, user.userId);
      
      logger.info('任务更新成功', {
        taskId,
        userId: user.userId,
        updateFields: Object.keys(updateData)
      });

      ResponseUtil.success(ctx, {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        category: updatedTask.category,
        priority: updatedTask.priority,
        status: updatedTask.status,
        assigned_to: updatedTask.assigned_to,
        due_date: updatedTask.due_date,
        estimated_minutes: updatedTask.estimated_minutes,
        actual_minutes: updatedTask.actual_minutes,
        completed_at: updatedTask.completed_at,
        updated_at: updatedTask.updated_at
      }, '任务更新成功');
    } catch (error) {
      logger.error('任务更新失败', { taskId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 分配任务
   */
  static async assignTask(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const taskId = ctx.params.taskId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const assignSchema = {
      assigneeId: { required: true, type: 'string' }
    } as any;

    const validation = Validator.validate(ctx.request.body, assignSchema);
    if (!validation.isValid) {
      throw new ValidationError('分配参数验证失败', validation.errors);
    }

    const { assigneeId } = validation.data;

    try {
      const updatedTask = await Task.assignTask(taskId, assigneeId, user.userId);
      
      logger.info('任务分配成功', {
        taskId,
        assigneeId,
        operatorId: user.userId
      });

      ResponseUtil.success(ctx, {
        id: updatedTask.id,
        assigned_to: updatedTask.assigned_to,
        updated_at: updatedTask.updated_at
      }, '任务分配成功');
    } catch (error) {
      logger.error('任务分配失败', { taskId, assigneeId, operatorId: user.userId, error });
      throw error;
    }
  }  /**
   * 删除任务
   */
  static async deleteTask(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const taskId = ctx.params.taskId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Task.softDelete(taskId, user.userId);
      
      logger.info('任务删除成功', {
        taskId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '任务删除成功');
    } catch (error) {
      logger.error('任务删除失败', { taskId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取家庭任务统计
   */
  static async getFamilyStatistics(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const statistics = await Task.getFamilyStatistics(familyId, user.userId);
      
      ResponseUtil.success(ctx, statistics, '获取任务统计成功');
    } catch (error) {
      logger.error('获取任务统计失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取用户任务列表
   */
  static async getUserTasks(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const familyId = ctx.query.familyId as string;
    const status = ctx.query.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined;

    try {
      const result = await Task.getUserTasks(user.userId, familyId, { status });
      
      ResponseUtil.success(ctx, result, '获取用户任务列表成功');
    } catch (error) {
      logger.error('获取用户任务列表失败', { userId: user.userId, familyId, error });
      throw error;
    }
  }

  /**
   * 获取即将到期的任务
   */
  static async getUpcomingTasks(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const days = parseInt(ctx.query.days as string) || 3;

    try {
      const tasks = await Task.getUpcomingTasks(familyId, user.userId, days);
      
      ResponseUtil.success(ctx, tasks, '获取即将到期任务成功');
    } catch (error) {
      logger.error('获取即将到期任务失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 批量更新任务状态
   */
  static async batchUpdateStatus(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const batchSchema = {
      taskIds: { required: true, type: 'array', custom: (value: any) => Array.isArray(value) && value.length > 0 || 'taskIds 不能为空' },
      status: { required: true, type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] }
    } as any;

    const validation = Validator.validate(ctx.request.body, batchSchema);
    if (!validation.isValid) {
      throw new ValidationError('批量更新参数验证失败', validation.errors);
    }

    const { taskIds, status } = validation.data;

    try {
      await Task.batchUpdateStatus(taskIds, status, user.userId);
      
      logger.info('批量更新任务状态成功', {
        taskIds,
        status,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '批量更新任务状态成功');
    } catch (error) {
      logger.error('批量更新任务状态失败', { taskIds, status, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  static async updateTaskStatus(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const taskId = ctx.params.taskId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    const statusSchema = {
      status: { required: true, type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
      actual_minutes: { required: false, type: 'number', min: 0 }
    } as any;

    const validation = Validator.validate(ctx.request.body, statusSchema);
    if (!validation.isValid) {
      throw new ValidationError('状态更新参数验证失败', validation.errors);
    }

    const updateData: UpdateTaskData = validation.data;

    try {
      const updatedTask = await Task.update(taskId, updateData, user.userId);
      
      logger.info('任务状态更新成功', {
        taskId,
        status: updateData.status,
        userId: user.userId
      });

      ResponseUtil.success(ctx, {
        id: updatedTask.id,
        status: updatedTask.status,
        completed_at: updatedTask.completed_at,
        actual_minutes: updatedTask.actual_minutes,
        updated_at: updatedTask.updated_at
      }, '任务状态更新成功');
    } catch (error) {
      logger.error('任务状态更新失败', { taskId, userId: user.userId, error });
      throw error;
    }
  }
}