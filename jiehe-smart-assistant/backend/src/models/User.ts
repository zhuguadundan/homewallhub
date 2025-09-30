import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll } from '../config/database';
import { NotFoundError, ConflictError } from '../middlewares/errorHandler';

// 用户接口
export interface IUser {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
  avatar?: string;
  phone?: string;
  nickname?: string;
  gender: number; // 0:未知, 1:男, 2:女
  birthday?: string;
  preferences?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  is_active: boolean;
  is_deleted: boolean;
}

// 创建用户的输入数据
export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  nickname?: string;
  phone?: string;
  gender?: number;
  birthday?: string;
}

// 更新用户的输入数据
export interface UpdateUserData {
  nickname?: string;
  avatar?: string;
  phone?: string;
  gender?: number;
  birthday?: string;
  preferences?: object;
}

// 用户模型类
export class User {
  /**
   * 创建新用户
   */
  static async create(userData: CreateUserData): Promise<IUser> {
    // 检查用户名和邮箱是否已存在
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND is_deleted = 0',
      [userData.username, userData.email]
    );

    if (existingUser) {
      throw new ConflictError('用户名或邮箱已被使用');
    }

    // 生成用户ID和密码哈希
    const userId = uuidv4().replace(/-/g, '');
    const passwordHash = await bcrypt.hash(userData.password, 12);
    const now = new Date().toISOString();

    // 插入用户数据
    await dbRun(
      `INSERT INTO users (id, username, email, password_hash, nickname, phone, gender, birthday, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.username,
        userData.email,
        passwordHash,
        userData.nickname || userData.username,
        userData.phone || null,
        userData.gender || 0,
        userData.birthday || null,
        now,
        now
      ]
    );

    // 获取创建的用户信息（不包含密码）
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户创建失败');
    }

    return user;
  }  /**
   * 根据ID查找用户
   */
  static async findById(id: string): Promise<IUser | null> {
    const user = await dbGet<IUser>(
      `SELECT id, username, email, avatar, phone, nickname, gender, birthday, 
              preferences, created_at, updated_at, last_login_at, is_active, is_deleted
       FROM users WHERE id = ? AND is_deleted = 0`,
      [id]
    );
    
    return user || null;
  }

  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username: string): Promise<IUser | null> {
    const user = await dbGet<IUser>(
      `SELECT id, username, email, avatar, phone, nickname, gender, birthday, 
              preferences, created_at, updated_at, last_login_at, is_active, is_deleted
       FROM users WHERE username = ? AND is_deleted = 0`,
      [username]
    );
    
    return user || null;
  }

  /**
   * 根据邮箱查找用户
   */
  static async findByEmail(email: string): Promise<IUser | null> {
    const user = await dbGet<IUser>(
      `SELECT id, username, email, avatar, phone, nickname, gender, birthday, 
              preferences, created_at, updated_at, last_login_at, is_active, is_deleted
       FROM users WHERE email = ? AND is_deleted = 0`,
      [email]
    );
    
    return user || null;
  }

  /**
   * 验证用户密码
   */
  static async verifyPassword(identifier: string, password: string): Promise<IUser | null> {
    // 支持用户名或邮箱登录
    const user = await dbGet<IUser & { password_hash: string }>(
      `SELECT id, username, email, password_hash, avatar, phone, nickname, gender, 
              birthday, preferences, created_at, updated_at, last_login_at, is_active, is_deleted
       FROM users WHERE (username = ? OR email = ?) AND is_deleted = 0`,
      [identifier, identifier]
    );

    if (!user || !user.is_active) {
      return null;
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // 更新最后登录时间
    await User.updateLastLogin(user.id);

    // 返回用户信息（不包含密码）
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }  /**
   * 更新用户信息
   */
  static async update(id: string, updateData: UpdateUserData): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 动态构建更新字段
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'preferences' && typeof value === 'object') {
          updateFields.push(`${key} = ?`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      return user;
    }

    // 添加更新时间
    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    await dbRun(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedUser = await User.findById(id);
    if (!updatedUser) {
      throw new Error('更新用户信息失败');
    }

    return updatedUser;
  }

  /**
   * 更新最后登录时间
   */
  static async updateLastLogin(id: string): Promise<void> {
    await dbRun(
      'UPDATE users SET last_login_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  /**
   * 修改密码
   */
  static async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await dbGet<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      throw new ConflictError('原密码错误');
    }

    // 生成新密码哈希
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    await dbRun(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [newPasswordHash, new Date().toISOString(), id]
    );
  }

  /**
   * 软删除用户
   */
  static async softDelete(id: string): Promise<void> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    await dbRun(
      'UPDATE users SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  }

  /**
   * 获取用户的家庭列表
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
}
