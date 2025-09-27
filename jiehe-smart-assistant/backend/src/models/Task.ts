import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll, executeInTransaction } from '../config/database';
import { NotFoundError, ConflictError, AuthorizationError } from '../middlewares/errorHandler';
import { Family } from './Family';

// 任务接口
export interface ITask {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  category: string;
  priority: 1 | 2 | 3; // 1:高 2:中 3:低
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  completed_at?: string;
  estimated_minutes: number;
  actual_minutes?: number;
  recurrence_rule?: string;
  tags?: string;
  attachments?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

// 创建任务的输入数据
export interface CreateTaskData {
  title: string;
  description?: string;
  category?: string;
  priority?: 1 | 2 | 3;
  assigned_to?: string;
  due_date?: string;
  estimated_minutes?: number;
  recurrence_rule?: object;
  tags?: string[];
  attachments?: any[];
}

// 更新任务的输入数据
export interface UpdateTaskData {
  title?: string;
  description?: string;
  category?: string;
  priority?: 1 | 2 | 3;
  assigned_to?: string;
  due_date?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  tags?: string[];
  attachments?: any[];
}

// 任务查询参数
export interface TaskQueryParams {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  created_by?: string;
  category?: string;
  priority?: 1 | 2 | 3;
  due_date_from?: string;
  due_date_to?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'due_date' | 'priority' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
}

// 任务统计接口
export interface TaskStatistics {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  today: number;
  this_week: number;
  by_assignee: Array<{
    user_id: string;
    username: string;
    total: number;
    completed: number;
  }>;
  by_category: Array<{
    category: string;
    total: number;
    completed: number;
  }>;
}

// 任务模型类
export class Task {
  /**
   * 创建新任务
   */
  static async create(taskData: CreateTaskData, familyId: string, creatorId: string): Promise<ITask> {
    // 验证用户是家庭成员且有权限创建任务
    const membership = await Family.getMembership(familyId, creatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    if (membership.role !== 'admin' && !permissions.can_manage_tasks) {
      throw new AuthorizationError('您没有权限创建任务');
    }

    // 如果指定了任务分配人，验证其是否为家庭成员
    if (taskData.assigned_to) {
      const assigneeMembership = await Family.getMembership(familyId, taskData.assigned_to);
      if (!assigneeMembership) {
        throw new ConflictError('指定的任务分配人不是家庭成员');
      }
    }

    const taskId = uuidv4().replace(/-/g, '');
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO tasks (
        id, family_id, title, description, category, priority, assigned_to, created_by,
        due_date, estimated_minutes, recurrence_rule, tags, attachments, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        familyId,
        taskData.title,
        taskData.description || null,
        taskData.category || 'general',
        taskData.priority || 2,
        taskData.assigned_to || null,
        creatorId,
        taskData.due_date || null,
        taskData.estimated_minutes || 30,
        taskData.recurrence_rule ? JSON.stringify(taskData.recurrence_rule) : null,
        taskData.tags ? taskData.tags.join(',') : null,
        taskData.attachments ? JSON.stringify(taskData.attachments) : null,
        now,
        now
      ]
    );

    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error('任务创建失败');
    }

    return task;
  }  /**
   * 根据ID查找任务
   */
  static async findById(id: string): Promise<ITask | null> {
    const task = await dbGet<ITask>(
      'SELECT * FROM tasks WHERE id = ? AND is_deleted = 0',
      [id]
    );
    
    return task || null;
  }

  /**
   * 获取任务详情（包含关联用户信息）
   */
  static async getTaskWithDetails(id: string, requesterId: string): Promise<any | null> {
    const task = await dbGet<any>(
      `SELECT t.*, 
              u_creator.username as creator_username, u_creator.nickname as creator_nickname,
              u_assignee.username as assignee_username, u_assignee.nickname as assignee_nickname
       FROM tasks t
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
       WHERE t.id = ? AND t.is_deleted = 0`,
      [id]
    );

    if (!task) {
      return null;
    }

    // 验证请求者是否为家庭成员
    const membership = await Family.getMembership(task.family_id, requesterId);
    if (!membership) {
      throw new AuthorizationError('您没有权限查看此任务');
    }

    return {
      ...task,
      tags: task.tags ? task.tags.split(',') : [],
      attachments: task.attachments ? JSON.parse(task.attachments) : [],
      recurrence_rule: task.recurrence_rule ? JSON.parse(task.recurrence_rule) : null,
      creator: {
        username: task.creator_username,
        nickname: task.creator_nickname,
      },
      assignee: task.assigned_to ? {
        username: task.assignee_username,
        nickname: task.assignee_nickname,
      } : null,
    };
  }

  /**
   * 查询家庭任务列表
   */
  static async getFamilyTasks(
    familyId: string, 
    requesterId: string, 
    params: TaskQueryParams = {}
  ): Promise<{ tasks: any[]; total: number; pagination: any }> {
    // 验证请求者是家庭成员
    const membership = await Family.getMembership(familyId, requesterId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const {
      status,
      assigned_to,
      created_by,
      category,
      priority,
      due_date_from,
      due_date_to,
      tags,
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = params;

    // 构建查询条件
    let whereClause = 'WHERE t.family_id = ? AND t.is_deleted = 0';
    const whereValues = [familyId];

    if (status) {
      whereClause += ' AND t.status = ?';
      whereValues.push(status);
    }

    if (assigned_to) {
      whereClause += ' AND t.assigned_to = ?';
      whereValues.push(assigned_to);
    }

    if (created_by) {
      whereClause += ' AND t.created_by = ?';
      whereValues.push(created_by);
    }

    if (category) {
      whereClause += ' AND t.category = ?';
      whereValues.push(category);
    }

    if (priority) {
      whereClause += ' AND t.priority = ?';
      whereValues.push(priority);
    }

    if (due_date_from) {
      whereClause += ' AND t.due_date >= ?';
      whereValues.push(due_date_from);
    }

    if (due_date_to) {
      whereClause += ' AND t.due_date <= ?';
      whereValues.push(due_date_to);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 't.tags LIKE ?').join(' OR ');
      whereClause += ` AND (${tagConditions})`;
      tags.forEach(tag => whereValues.push(`%${tag}%`));
    }

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      ${whereClause}
    `;
    const countResult = await dbGet<{ total: number }>(countQuery, whereValues);
    const total = countResult?.total || 0;

    // 获取任务列表
    const offset = (page - 1) * pageSize;
    const tasksQuery = `
      SELECT t.*, 
             u_creator.username as creator_username, u_creator.nickname as creator_nickname,
             u_assignee.username as assignee_username, u_assignee.nickname as assignee_nickname
      FROM tasks t
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
      ${whereClause}
      ORDER BY t.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const tasksResult = await dbAll<any>(tasksQuery, [...whereValues, pageSize, offset]);

    const tasks = tasksResult.map(task => ({
      ...task,
      tags: task.tags ? task.tags.split(',') : [],
      attachments: task.attachments ? JSON.parse(task.attachments) : [],
      recurrence_rule: task.recurrence_rule ? JSON.parse(task.recurrence_rule) : null,
      creator: {
        username: task.creator_username,
        nickname: task.creator_nickname,
      },
      assignee: task.assigned_to ? {
        username: task.assignee_username,
        nickname: task.assignee_nickname,
      } : null,
    }));

    return {
      tasks,
      total,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        total
      }
    };
  }  /**
   * 更新任务
   */
  static async update(id: string, updateData: UpdateTaskData, operatorId: string): Promise<ITask> {
    const task = await Task.findById(id);
    if (!task) {
      throw new NotFoundError('任务不存在');
    }

    // 验证权限
    const membership = await Family.getMembership(task.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    // 检查操作权限：任务创建者、被分配者或有管理权限的用户可以更新
    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    const canUpdate = task.created_by === operatorId || 
                     task.assigned_to === operatorId ||
                     membership.role === 'admin' ||
                     permissions.can_manage_tasks;

    if (!canUpdate) {
      throw new AuthorizationError('您没有权限修改此任务');
    }

    // 如果更新分配人，验证新分配人是否为家庭成员
    if (updateData.assigned_to && updateData.assigned_to !== task.assigned_to) {
      const assigneeMembership = await Family.getMembership(task.family_id, updateData.assigned_to);
      if (!assigneeMembership) {
        throw new ConflictError('指定的任务分配人不是家庭成员');
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 动态构建更新字段
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        switch (key) {
          case 'tags':
            updateFields.push(`${key} = ?`);
            updateValues.push(Array.isArray(value) ? value.join(',') : value);
            break;
          case 'attachments':
            updateFields.push(`${key} = ?`);
            updateValues.push(JSON.stringify(value));
            break;
          default:
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
        }
      }
    });

    // 如果任务状态更新为已完成，记录完成时间
    if (updateData.status === 'completed' && task.status !== 'completed') {
      updateFields.push('completed_at = ?');
      updateValues.push(new Date().toISOString());
    }

    // 如果任务状态从已完成改为其他状态，清除完成时间
    if (updateData.status && updateData.status !== 'completed' && task.status === 'completed') {
      updateFields.push('completed_at = ?');
      updateValues.push(null);
    }

    if (updateFields.length === 0) {
      return task;
    }

    // 添加更新时间
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await dbRun(
      `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedTask = await Task.findById(id);
    if (!updatedTask) {
      throw new Error('任务更新失败');
    }

    return updatedTask;
  }

  /**
   * 分配任务
   */
  static async assignTask(id: string, assigneeId: string, operatorId: string): Promise<ITask> {
    const task = await Task.findById(id);
    if (!task) {
      throw new NotFoundError('任务不存在');
    }

    // 验证操作权限
    const membership = await Family.getMembership(task.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    const canAssign = task.created_by === operatorId ||
                     membership.role === 'admin' ||
                     permissions.can_manage_tasks;

    if (!canAssign) {
      throw new AuthorizationError('您没有权限分配此任务');
    }

    // 验证被分配人是家庭成员
    const assigneeMembership = await Family.getMembership(task.family_id, assigneeId);
    if (!assigneeMembership) {
      throw new ConflictError('指定的分配人不是家庭成员');
    }

    await dbRun(
      'UPDATE tasks SET assigned_to = ?, updated_at = ? WHERE id = ?',
      [assigneeId, new Date().toISOString(), id]
    );

    const updatedTask = await Task.findById(id);
    if (!updatedTask) {
      throw new Error('任务分配失败');
    }

    return updatedTask;
  }

  /**
   * 删除任务（软删除）
   */
  static async softDelete(id: string, operatorId: string): Promise<void> {
    const task = await Task.findById(id);
    if (!task) {
      throw new NotFoundError('任务不存在');
    }

    // 验证权限：只有任务创建者或管理员可以删除
    const membership = await Family.getMembership(task.family_id, operatorId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const permissions = membership.permissions ? JSON.parse(membership.permissions) : {};
    const canDelete = task.created_by === operatorId ||
                     membership.role === 'admin' ||
                     permissions.can_manage_tasks;

    if (!canDelete) {
      throw new AuthorizationError('您没有权限删除此任务');
    }

    await dbRun(
      'UPDATE tasks SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }  /**
   * 获取家庭任务统计
   */
  static async getFamilyStatistics(familyId: string, requesterId: string): Promise<TaskStatistics> {
    // 验证请求者是家庭成员
    const membership = await Family.getMembership(familyId, requesterId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 基础统计
    const basicStats = await dbGet<any>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN due_date < date('now') AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN date(created_at) = ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(created_at) >= ? THEN 1 ELSE 0 END) as this_week
      FROM tasks 
      WHERE family_id = ? AND is_deleted = 0
    `, [today, weekStart, familyId]);

    // 按分配人统计
    const byAssignee = await dbAll<any>(`
      SELECT 
        t.assigned_to as user_id,
        u.username,
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.family_id = ? AND t.is_deleted = 0 AND t.assigned_to IS NOT NULL
      GROUP BY t.assigned_to, u.username
      ORDER BY total DESC
    `, [familyId]);

    // 按分类统计
    const byCategory = await dbAll<any>(`
      SELECT 
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks 
      WHERE family_id = ? AND is_deleted = 0
      GROUP BY category
      ORDER BY total DESC
    `, [familyId]);

    return {
      total: basicStats?.total || 0,
      pending: basicStats?.pending || 0,
      in_progress: basicStats?.in_progress || 0,
      completed: basicStats?.completed || 0,
      cancelled: basicStats?.cancelled || 0,
      overdue: basicStats?.overdue || 0,
      today: basicStats?.today || 0,
      this_week: basicStats?.this_week || 0,
      by_assignee: byAssignee || [],
      by_category: byCategory || [],
    };
  }

  /**
   * 获取用户的任务列表
   */
  static async getUserTasks(
    userId: string, 
    familyId?: string,
    params: Omit<TaskQueryParams, 'assigned_to'> = {}
  ): Promise<{ tasks: any[]; total: number }> {
    let whereClause = 'WHERE (t.assigned_to = ? OR t.created_by = ?) AND t.is_deleted = 0';
    const whereValues = [userId, userId];

    if (familyId) {
      whereClause += ' AND t.family_id = ?';
      whereValues.push(familyId);
    }

    if (params.status) {
      whereClause += ' AND t.status = ?';
      whereValues.push(params.status);
    }

    // 获取任务列表
    const tasksQuery = `
      SELECT t.*, f.name as family_name,
             u_creator.username as creator_username,
             u_assignee.username as assignee_username
      FROM tasks t
      JOIN families f ON t.family_id = f.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
      ${whereClause}
      ORDER BY t.${params.sortBy || 'created_at'} ${params.sortOrder || 'DESC'}
      LIMIT ${params.pageSize || 50}
    `;

    const tasks = await dbAll<any>(tasksQuery, whereValues);

    return {
      tasks: tasks.map(task => ({
        ...task,
        tags: task.tags ? task.tags.split(',') : [],
        attachments: task.attachments ? JSON.parse(task.attachments) : [],
        recurrence_rule: task.recurrence_rule ? JSON.parse(task.recurrence_rule) : null,
      })),
      total: tasks.length
    };
  }

  /**
   * 获取即将到期的任务
   */
  static async getUpcomingTasks(familyId: string, requesterId: string, days: number = 3): Promise<any[]> {
    const membership = await Family.getMembership(familyId, requesterId);
    if (!membership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const tasks = await dbAll<any>(`
      SELECT t.*, 
             u_creator.username as creator_username,
             u_assignee.username as assignee_username
      FROM tasks t
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
      WHERE t.family_id = ? 
        AND t.is_deleted = 0
        AND t.status NOT IN ('completed', 'cancelled')
        AND t.due_date IS NOT NULL
        AND date(t.due_date) <= date(?)
      ORDER BY t.due_date ASC
    `, [familyId, endDate.toISOString()]);

    return tasks.map(task => ({
      ...task,
      tags: task.tags ? task.tags.split(',') : [],
      attachments: task.attachments ? JSON.parse(task.attachments) : [],
      recurrence_rule: task.recurrence_rule ? JSON.parse(task.recurrence_rule) : null,
      creator: { username: task.creator_username },
      assignee: task.assigned_to ? { username: task.assignee_username } : null,
    }));
  }

  /**
   * 批量更新任务状态
   */
  static async batchUpdateStatus(
    taskIds: string[], 
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    operatorId: string
  ): Promise<void> {
    if (taskIds.length === 0) return;

    return executeInTransaction(async () => {
      for (const taskId of taskIds) {
        const task = await Task.findById(taskId);
        if (task) {
          await Task.update(taskId, { status }, operatorId);
        }
      }
    });
  }
}