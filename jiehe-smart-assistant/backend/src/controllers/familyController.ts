import { Context } from 'koa';
import { Family, CreateFamilyData, UpdateFamilyData } from '../models/Family';
import { ResponseUtil } from '../utils/response';
import { ValidationError, AuthenticationError, NotFoundError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { Validator, ValidationSchemas } from '../utils/validation';

// 使用新的验证系统

// 家庭管理控制器
export class FamilyController {
  /**
   * ���建家庭
   */
  static async createFamily(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.createFamily);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const familyData: CreateFamilyData = result.data;

    try {
      const family = await Family.create(familyData, user.userId);
      
      logger.info('家庭创建成功', {
        familyId: family.id,
        familyName: family.name,
        createdBy: user.userId,
        ip: ctx.ip
      });

      ResponseUtil.created(ctx, {
        id: family.id,
        name: family.name,
        description: family.description,
        avatar: family.avatar,
        invite_code: family.invite_code,
        created_at: family.created_at,
        role: 'admin'
      }, '家庭创建成功');
    } catch (error) {
      logger.error('家庭创建失败', { error, familyData, userId: user.userId });
      throw error;
    }
  }  /**
   * 加入家庭
   */
  static async joinFamily(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.joinFamily);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const { inviteCode, nickname } = result.data;

    try {
      const member = await Family.joinFamily(inviteCode, user.userId, nickname);
      
      // 获取家庭信息
      const family = await Family.findById(member.family_id);
      
      logger.info('用户加入家庭成功', {
        familyId: member.family_id,
        userId: user.userId,
        inviteCode,
        ip: ctx.ip
      });

      ResponseUtil.success(ctx, {
        family: {
          id: family?.id,
          name: family?.name,
          description: family?.description,
          avatar: family?.avatar,
        },
        membership: {
          id: member.id,
          role: member.role,
          nickname: member.nickname,
          joined_at: member.joined_at,
        }
      }, '加入家庭成功');
    } catch (error) {
      logger.warn('加入家庭失败', { error: error.message, inviteCode, userId: user.userId });
      throw error;
    }
  }

  /**
   * 获取用户的家庭列表
   */
  static async getUserFamilies(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const families = await Family.getUserFamilies(user.userId);
      
      ResponseUtil.success(ctx, families, '获取家庭列表成功');
    } catch (error) {
      logger.error('获取家庭列表失败', { userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取家庭详情
   */
  static async getFamilyDetails(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      // 验证用户是家庭成员
      const membership = await Family.getMembership(familyId, user.userId);
      if (!membership) {
        throw new AuthenticationError('您不是该家庭的成员');
      }

      const family = await Family.findById(familyId);
      if (!family) {
        throw new NotFoundError('家庭不存在');
      }

      ResponseUtil.success(ctx, {
        id: family.id,
        name: family.name,
        description: family.description,
        avatar: family.avatar,
        invite_code: family.invite_code,
        created_at: family.created_at,
        settings: family.settings ? JSON.parse(family.settings) : null,
        userRole: membership.role,
        userPermissions: membership.permissions ? JSON.parse(membership.permissions) : null
      }, '获取家庭详情成功');
    } catch (error) {
      logger.error('获取家庭详情失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }  /**
   * 更新家庭信息
   */
  static async updateFamily(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.updateFamily);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const updateData: UpdateFamilyData = result.data;

    try {
      const updatedFamily = await Family.update(familyId, updateData, user.userId);
      
      logger.info('家庭信息更新成功', {
        familyId,
        userId: user.userId,
        updateFields: Object.keys(updateData)
      });

      ResponseUtil.success(ctx, {
        id: updatedFamily.id,
        name: updatedFamily.name,
        description: updatedFamily.description,
        avatar: updatedFamily.avatar,
        updated_at: updatedFamily.updated_at,
        settings: updatedFamily.settings ? JSON.parse(updatedFamily.settings) : null
      }, '家庭信息更新成功');
    } catch (error) {
      logger.error('家庭信息更新失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 获取家庭成员列表
   */
  static async getFamilyMembers(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      const members = await Family.getMembers(familyId, user.userId);
      
      ResponseUtil.success(ctx, members, '获取成员列表成功');
    } catch (error) {
      logger.error('获取成员列表失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新成员权限
   */
  static async updateMemberPermissions(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const result = Validator.validate(ctx.request.body, ValidationSchemas.updateMemberPermissions);
    if (!result.isValid) {
      throw new ValidationError('数据验证失败', result.errors);
    }

    const { userId: targetUserId, permissions } = result.data;

    try {
      await Family.updateMemberPermissions(familyId, targetUserId, permissions, user.userId);
      
      logger.info('成员权限更新成功', {
        familyId,
        operatorId: user.userId,
        targetUserId,
        permissions
      });

      ResponseUtil.success(ctx, null, '成员权限更新成功');
    } catch (error) {
      logger.error('成员权限更新失败', { familyId, operatorId: user.userId, targetUserId, error });
      throw error;
    }
  }

  /**
   * 移除家庭成员
   */
  static async removeMember(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    const targetUserId = ctx.params.userId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Family.removeMember(familyId, targetUserId, user.userId);
      
      logger.info('移除成员成功', {
        familyId,
        operatorId: user.userId,
        targetUserId
      });

      ResponseUtil.success(ctx, null, '成员移除成功');
    } catch (error) {
      logger.error('移除成员失败', { familyId, operatorId: user.userId, targetUserId, error });
      throw error;
    }
  }

  /**
   * 离开家庭
   */
  static async leaveFamily(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    const familyId = ctx.params.familyId;
    
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      await Family.leaveFamily(familyId, user.userId);
      
      logger.info('用户离开家庭', {
        familyId,
        userId: user.userId
      });

      ResponseUtil.success(ctx, null, '已离开家庭');
    } catch (error) {
      logger.error('离开家庭失败', { familyId, userId: user.userId, error });
      throw error;
    }
  }
}