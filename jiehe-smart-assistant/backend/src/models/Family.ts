import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll, executeInTransaction } from '../config/database';
import { NotFoundError, ConflictError, AuthorizationError } from '../middlewares/errorHandler';

// 家庭接口
export interface IFamily {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  invite_code: string;
  created_by: string;
  settings?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 家庭成员接口
export interface IFamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'child';
  nickname?: string;
  permissions?: string;
  joined_at: string;
  is_active: boolean;
  user?: any;
}

// 创建家庭的输入数据
export interface CreateFamilyData {
  name: string;
  description?: string;
  avatar?: string;
}

// 更新家庭的输入数据
export interface UpdateFamilyData {
  name?: string;
  description?: string;
  avatar?: string;
  settings?: object;
}

// 家庭成员权限配置
export interface MemberPermissions {
  can_manage_tasks: boolean;
  can_manage_inventory: boolean;
  can_manage_menu: boolean;
  can_manage_calendar: boolean;
  can_manage_messages: boolean;
  can_invite_members: boolean;
}

// 家庭模型类
export class Family {
  /**
   * 创建新家庭
   */
  static async create(familyData: CreateFamilyData, creatorId: string): Promise<IFamily> {
    const familyId = uuidv4().replace(/-/g, '');
    const inviteCode = this.generateInviteCode();
    const now = new Date().toISOString();

    return executeInTransaction(async () => {
      // 创建家庭
      await dbRun(
        `INSERT INTO families (id, name, description, avatar, invite_code, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          familyId,
          familyData.name,
          familyData.description || null,
          familyData.avatar || null,
          inviteCode,
          creatorId,
          now,
          now
        ]
      );

      // 添加创建者为管理员
      const memberId = uuidv4().replace(/-/g, '');
      const defaultPermissions: MemberPermissions = {
        can_manage_tasks: true,
        can_manage_inventory: true,
        can_manage_menu: true,
        can_manage_calendar: true,
        can_manage_messages: true,
        can_invite_members: true,
      };

      await dbRun(
        `INSERT INTO family_members (id, family_id, user_id, role, permissions, joined_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          memberId,
          familyId,
          creatorId,
          'admin',
          JSON.stringify(defaultPermissions),
          now
        ]
      );

      // 创建默认留言分类
      await this.createDefaultMessageCategories(familyId);

      const family = await Family.findById(familyId);
      if (!family) {
        throw new Error('家庭创建失败');
      }

      return family;
    });
  }  /**
   * 根据ID查找家庭
   */
  static async findById(id: string): Promise<IFamily | null> {
    const family = await dbGet<IFamily>(
      'SELECT * FROM families WHERE id = ? AND is_active = 1',
      [id]
    );
    
    return family || null;
  }

  /**
   * 根据邀请码查找家庭
   */
  static async findByInviteCode(inviteCode: string): Promise<IFamily | null> {
    const family = await dbGet<IFamily>(
      'SELECT * FROM families WHERE invite_code = ? AND is_active = 1',
      [inviteCode]
    );
    
    return family || null;
  }

  /**
   * 更新家庭信息
   */
  static async update(id: string, updateData: UpdateFamilyData, operatorId: string): Promise<IFamily> {
    // 检查操作权限
    const membership = await this.getMembership(id, operatorId);
    if (!membership || membership.role !== 'admin') {
      throw new AuthorizationError('只有管理员才能修改家庭信息');
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 动态构建更新字段
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'settings' && typeof value === 'object') {
          updateFields.push(`${key} = ?`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      const family = await Family.findById(id);
      if (!family) {
        throw new NotFoundError('家庭不存在');
      }
      return family;
    }

    // ��加更新时间
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await dbRun(
      `UPDATE families SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedFamily = await Family.findById(id);
    if (!updatedFamily) {
      throw new Error('更新家庭信息失败');
    }

    return updatedFamily;
  }

  /**
   * 加入家庭
   */
  static async joinFamily(inviteCode: string, userId: string, nickname?: string): Promise<IFamilyMember> {
    const family = await this.findByInviteCode(inviteCode);
    if (!family) {
      throw new NotFoundError('邀请码无效或家庭不存在');
    }

    // 检查是否已经是成员
    const existingMember = await this.getMembership(family.id, userId);
    if (existingMember) {
      if (existingMember.is_active) {
        throw new ConflictError('您已经是该家庭的成员');
      } else {
        // 重新激活成员身份
        await dbRun(
          'UPDATE family_members SET is_active = 1, joined_at = ? WHERE family_id = ? AND user_id = ?',
          [new Date().toISOString(), family.id, userId]
        );
        
        const member = await this.getMembership(family.id, userId);
        if (!member) {
          throw new Error('加入家庭失败');
        }
        return member;
      }
    }

    // 添加新成员
    const memberId = uuidv4().replace(/-/g, '');
    const defaultPermissions: MemberPermissions = {
      can_manage_tasks: false,
      can_manage_inventory: true,
      can_manage_menu: true,
      can_manage_calendar: false,
      can_manage_messages: true,
      can_invite_members: false,
    };

    await dbRun(
      `INSERT INTO family_members (id, family_id, user_id, role, nickname, permissions, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        family.id,
        userId,
        'member',
        nickname || null,
        JSON.stringify(defaultPermissions),
        new Date().toISOString()
      ]
    );

    const member = await this.getMembership(family.id, userId);
    if (!member) {
      throw new Error('加入家庭失败');
    }

    return member;
  }  /**
   * 获取家庭成员列表
   */
  static async getMembers(familyId: string, requesterId: string): Promise<IFamilyMember[]> {
    // 验证请求者是家庭成员
    const requesterMembership = await this.getMembership(familyId, requesterId);
    if (!requesterMembership) {
      throw new AuthorizationError('您不是该家庭的成员');
    }

    const members = await dbAll<IFamilyMember & { username: string; email: string; avatar?: string; user_nickname?: string }>(
      `SELECT fm.*, u.username, u.email, u.avatar, u.nickname as user_nickname
       FROM family_members fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_id = ? AND fm.is_active = 1
       ORDER BY fm.joined_at ASC`,
      [familyId]
    );

    return members.map(member => ({
      id: member.id,
      family_id: member.family_id,
      user_id: member.user_id,
      role: member.role,
      nickname: member.nickname,
      permissions: member.permissions,
      joined_at: member.joined_at,
      is_active: member.is_active,
      user: {
        username: member.username,
        email: member.email,
        avatar: member.avatar,
        nickname: member.user_nickname,
      }
    }));
  }

  /**
   * 获取用户在家庭中的成员关系
   */
  static async getMembership(familyId: string, userId: string): Promise<IFamilyMember | null> {
    const member = await dbGet<IFamilyMember>(
      'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND is_active = 1',
      [familyId, userId]
    );
    
    return member || null;
  }

  /**
   * 获取用户的家庭列表（用于前端展示）
   */
  static async getUserFamilies(userId: string): Promise<any[]> {
    return await dbAll(
      `SELECT f.id, f.name, f.description, f.avatar, f.created_at,
              fm.role, fm.joined_at, fm.nickname as member_nickname
       FROM families f
       JOIN family_members fm ON f.id = fm.family_id
       WHERE fm.user_id = ? AND fm.is_active = 1 AND f.is_active = 1
       ORDER BY fm.joined_at DESC`,
      [userId]
    );
  }

  /**
   * 获取用户所属的所有家庭ID列表
   */
  static async getUserFamilyIds(userId: string): Promise<string[]> {
    const families = await dbAll<{ family_id: string }>(
      'SELECT family_id FROM family_members WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    
    return families.map(f => f.family_id);
  }

  /**
   * 更新成员权限
   */
  static async updateMemberPermissions(
    familyId: string, 
    targetUserId: string, 
    permissions: Partial<MemberPermissions>, 
    operatorId: string
  ): Promise<void> {
    // 验证操作者权限
    const operatorMembership = await this.getMembership(familyId, operatorId);
    if (!operatorMembership || operatorMembership.role !== 'admin') {
      throw new AuthorizationError('只有管理员才能修改成员权限');
    }

    // 获取目标成员信息
    const targetMember = await this.getMembership(familyId, targetUserId);
    if (!targetMember) {
      throw new NotFoundError('目标成员不存在');
    }

    // 不能修改管理员权限
    if (targetMember.role === 'admin') {
      throw new AuthorizationError('不能修改管理员权限');
    }

    // 合并权限
    const currentPermissions = targetMember.permissions ? JSON.parse(targetMember.permissions) : {};
    const newPermissions = { ...currentPermissions, ...permissions };

    await dbRun(
      'UPDATE family_members SET permissions = ? WHERE family_id = ? AND user_id = ?',
      [JSON.stringify(newPermissions), familyId, targetUserId]
    );
  }

  /**
   * 移除家庭成员
   */
  static async removeMember(familyId: string, targetUserId: string, operatorId: string): Promise<void> {
    // 验证操作者权限
    const operatorMembership = await this.getMembership(familyId, operatorId);
    if (!operatorMembership || operatorMembership.role !== 'admin') {
      throw new AuthorizationError('只有管理员才能移除成员');
    }

    // 不能移除自己
    if (targetUserId === operatorId) {
      throw new ConflictError('不能移除自己');
    }

    // 获取目标成员信息
    const targetMember = await this.getMembership(familyId, targetUserId);
    if (!targetMember) {
      throw new NotFoundError('目标成员不存在');
    }

    // 不能移除其他管理员
    if (targetMember.role === 'admin') {
      throw new AuthorizationError('不能移除其他管理员');
    }

    // 软删除成员
    await dbRun(
      'UPDATE family_members SET is_active = 0 WHERE family_id = ? AND user_id = ?',
      [familyId, targetUserId]
    );
  }

  /**
   * 离开家庭
   */
  static async leaveFamily(familyId: string, userId: string): Promise<void> {
    const membership = await this.getMembership(familyId, userId);
    if (!membership) {
      throw new NotFoundError('您不是该家庭的成员');
    }

    // 检查是否为唯一管理员
    if (membership.role === 'admin') {
      const adminCount = await dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM family_members WHERE family_id = ? AND role = ? AND is_active = 1',
        [familyId, 'admin']
      );

      if (adminCount && adminCount.count <= 1) {
        throw new ConflictError('您是唯一的管理员，请先转让管理权或解散家庭');
      }
    }

    // 离开家庭
    await dbRun(
      'UPDATE family_members SET is_active = 0 WHERE family_id = ? AND user_id = ?',
      [familyId, userId]
    );
  }

  /**
   * 生成邀请码
   */
  private static generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 创建默认留言分类
   */
  private static async createDefaultMessageCategories(familyId: string): Promise<void> {
    const defaultCategories = [
      { name: '重要通知', icon: '📢', color: '#f5222d', sort_order: 1 },
      { name: '日常聊天', icon: '💬', color: '#1890ff', sort_order: 2 },
      { name: '温馨提醒', icon: '💡', color: '#fa8c16', sort_order: 3 },
      { name: '家务安排', icon: '🧹', color: '#52c41a', sort_order: 4 },
      { name: '购物清单', icon: '🛒', color: '#722ed1', sort_order: 5 },
    ];

    for (const category of defaultCategories) {
      const categoryId = uuidv4().replace(/-/g, '');
      await dbRun(
        'INSERT INTO message_categories (id, family_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [categoryId, familyId, category.name, category.icon, category.color, category.sort_order]
      );
    }
  }
}