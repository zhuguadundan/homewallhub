import { Context } from 'koa';
import Joi from 'joi';
import { User, CreateUserData } from '../models/User';
import { JwtUtil } from '../utils/jwt';
import { ResponseUtil } from '../utils/response';
import { AuthenticationError, ValidationError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

// 验证模式
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': '用户名只能包含字母和数字',
    'string.min': '用户名至少3个字符',
    'string.max': '用户名不能超过30个字符',
    'any.required': '用户名不能为空'
  }),
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱不能为空'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': '密码至少6个字符',
    'string.max': '密码不能超过128个字符',
    'any.required': '密码不能为空'
  }),
  nickname: Joi.string().max(50).optional(),
  phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional().messages({
    'string.pattern.base': '请输入有效的手机号码'
  }),
  gender: Joi.number().integer().min(0).max(2).optional(),
  birthday: Joi.date().iso().optional()
});

const loginSchema = Joi.object({
  identifier: Joi.string().required().messages({
    'any.required': '请输入用户名或邮箱'
  }),
  password: Joi.string().required().messages({
    'any.required': '请输入密码'
  })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': '刷新令牌不能为空'
  })
});

// 认证控制器
export class AuthController {
  /**
   * 用户注册
   */
  static async register(ctx: Context): Promise<void> {
    // 验证输入数据
    const { error, value } = registerSchema.validate(ctx.request.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const userData: CreateUserData = value;

    try {
      // 创建用户
      const user = await User.create(userData);
      
      // 生成JWT令牌
      const tokenPair = JwtUtil.generateTokenPair({
        userId: user.id,
        username: user.username,
      });

      // 记录注册日志
      logger.info('用户注册成功', {
        userId: user.id,
        username: user.username,
        email: user.email,
        ip: ctx.ip
      });

      ResponseUtil.created(ctx, {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
        },
        tokens: tokenPair
      }, '注册成功');
    } catch (error) {
      logger.error('用户注册失败', { error, userData: { ...userData, password: '[HIDDEN]' } });
      throw error;
    }
  }  /**
   * 用户登录
   */
  static async login(ctx: Context): Promise<void> {
    // 验证输入数据
    const { error, value } = loginSchema.validate(ctx.request.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { identifier, password } = value;

    try {
      // 验证用户凭据
      const user = await User.verifyPassword(identifier, password);
      if (!user) {
        throw new AuthenticationError('用户名或密码错误');
      }

      // 获取用户的家庭信息
      const families = await User.getUserFamilies(user.id);
      const defaultFamily = families.length > 0 ? families[0] : null;

      // 生成JWT令牌
      const tokenPair = JwtUtil.generateTokenPair({
        userId: user.id,
        username: user.username,
        familyId: defaultFamily?.id,
        role: defaultFamily?.role,
      });

      // 记录登录日志
      logger.info('用户登录成功', {
        userId: user.id,
        username: user.username,
        ip: ctx.ip,
        userAgent: ctx.get('User-Agent')
      });

      ResponseUtil.success(ctx, {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          families: families,
          currentFamily: defaultFamily
        },
        tokens: tokenPair
      }, '登录成功');
    } catch (error) {
      logger.warn('登录失败', { identifier, ip: ctx.ip, error: error.message });
      throw error;
    }
  }

  /**
   * 刷新令牌
   */
  static async refresh(ctx: Context): Promise<void> {
    // 验证输入数据
    const { error, value } = refreshTokenSchema.validate(ctx.request.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { refreshToken } = value;

    try {
      // 验证刷新令牌
      const payload = JwtUtil.verifyRefreshToken(refreshToken);
      
      // 检查用户是否仍然存在且激活
      const user = await User.findById(payload.userId);
      if (!user || !user.is_active) {
        throw new AuthenticationError('用户不存在或已被禁用');
      }

      // 获取用户的家庭信息
      const families = await User.getUserFamilies(user.id);
      const defaultFamily = families.length > 0 ? families[0] : null;

      // 生成新的令牌对
      const newTokenPair = JwtUtil.generateTokenPair({
        userId: user.id,
        username: user.username,
        familyId: defaultFamily?.id,
        role: defaultFamily?.role,
      });

      ResponseUtil.success(ctx, {
        tokens: newTokenPair
      }, '令牌刷新成功');
    } catch (error) {
      logger.warn('令牌刷新失败', { error: error.message, ip: ctx.ip });
      throw error;
    }
  }  /**
   * 获取当前用户信息
   */
  static async getProfile(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    try {
      // 获取完整用户信息
      const fullUser = await User.findById(user.userId);
      if (!fullUser) {
        throw new AuthenticationError('用户不存在');
      }

      // 获取用户的家庭信息
      const families = await User.getUserFamilies(user.userId);

      ResponseUtil.success(ctx, {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        nickname: fullUser.nickname,
        avatar: fullUser.avatar,
        phone: fullUser.phone,
        gender: fullUser.gender,
        birthday: fullUser.birthday,
        preferences: fullUser.preferences ? JSON.parse(fullUser.preferences) : null,
        families: families,
        created_at: fullUser.created_at,
        last_login_at: fullUser.last_login_at
      }, '获取用户信息成功');
    } catch (error) {
      logger.error('获取用户信息失败', { userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 更新用户信息
   */
  static async updateProfile(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const updateSchema = Joi.object({
      nickname: Joi.string().max(50).optional(),
      phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional().allow('').messages({
        'string.pattern.base': '请输入有效的手机号码'
      }),
      gender: Joi.number().integer().min(0).max(2).optional(),
      birthday: Joi.date().iso().optional().allow(''),
      preferences: Joi.object().optional()
    });

    const { error, value } = updateSchema.validate(ctx.request.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    try {
      // 处理空字符串
      const updateData = { ...value };
      if (updateData.phone === '') updateData.phone = null;
      if (updateData.birthday === '') updateData.birthday = null;

      const updatedUser = await User.update(user.userId, updateData);

      logger.info('用户信息更新成功', {
        userId: user.userId,
        updateData: Object.keys(updateData)
      });

      ResponseUtil.success(ctx, {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        birthday: updatedUser.birthday,
        preferences: updatedUser.preferences ? JSON.parse(updatedUser.preferences) : null
      }, '用户信息更新成功');
    } catch (error) {
      logger.error('用户信息更新失败', { userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 修改密码
   */
  static async changePassword(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    if (!user) {
      throw new AuthenticationError('未认证的用户');
    }

    // 验证输入数据
    const changePasswordSchema = Joi.object({
      oldPassword: Joi.string().required().messages({
        'any.required': '请输入当前密码'
      }),
      newPassword: Joi.string().min(6).max(128).required().messages({
        'string.min': '新密码至少6个字符',
        'string.max': '新密码不能超过128个字符',
        'any.required': '请输入新密码'
      })
    });

    const { error, value } = changePasswordSchema.validate(ctx.request.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { oldPassword, newPassword } = value;

    try {
      await User.changePassword(user.userId, oldPassword, newPassword);

      logger.info('用户密码修改成功', { userId: user.userId });

      ResponseUtil.success(ctx, null, '密码修改成功');
    } catch (error) {
      logger.error('密码修改失败', { userId: user.userId, error });
      throw error;
    }
  }

  /**
   * 用户登出
   */
  static async logout(ctx: Context): Promise<void> {
    const user = ctx.state.user;
    
    // 记录登出日志
    if (user) {
      logger.info('用户登出', { userId: user.userId, username: user.username });
    }

    // 注意：在JWT无状态设计中，登出主要是前端清除token
    // 如果需要服务端token黑名单，可以在这里添加到黑名单
    
    ResponseUtil.success(ctx, null, '登出成功');
  }
}