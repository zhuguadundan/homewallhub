import { http } from '@/utils/request';
import type { 
  ApiResponse,
  AuthResponse,
  User,
  RegisterData,
  LoginData,
  UpdateProfileData,
  ChangePasswordData,
  Tokens
} from '@/types/api';

// 认证相关API
export const authApi = {
  // 用户注册
  register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    return http.post('/auth/register', data);
  },

  // 用户登录
  login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    return http.post('/auth/login', data);
  },

  // 刷新令牌
  refresh(refreshToken: string): Promise<ApiResponse<{ tokens: Tokens }>> {
    return http.post('/auth/refresh', { refreshToken });
  },

  // 获取用户信息
  getProfile(): Promise<ApiResponse<User>> {
    return http.get('/auth/profile');
  },

  // 更新用户信息
  updateProfile(data: UpdateProfileData): Promise<ApiResponse<User>> {
    return http.put('/auth/profile', data);
  },

  // 修改密码
  changePassword(data: ChangePasswordData): Promise<ApiResponse> {
    return http.put('/auth/password', data);
  },

  // 用户登出
  logout(): Promise<ApiResponse> {
    return http.post('/auth/logout');
  },
};