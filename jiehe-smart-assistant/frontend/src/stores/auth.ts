import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { LoginData, RegisterData, Tokens, User } from '@/types/api'
import { useUserStore } from '@/stores/user'

// 本地存储键名
const LS_ACCESS = 'jssa_access_token'
const LS_REFRESH = 'jssa_refresh_token'

export const useAuthStore = defineStore('auth', () => {
  // 令牌状态
  const accessToken = ref<string>('')
  const refreshToken = ref<string>('')

  // 是否已认证
  const isAuthenticated = computed(() => !!accessToken.value)

  // 设置令牌并持久化
  const setTokens = (tokens: Tokens) => {
    accessToken.value = tokens.accessToken || ''
    refreshToken.value = tokens.refreshToken || ''
    if (accessToken.value) localStorage.setItem(LS_ACCESS, accessToken.value)
    if (refreshToken.value) localStorage.setItem(LS_REFRESH, refreshToken.value)
  }

  // 清除认证信息
  const clearAuth = () => {
    accessToken.value = ''
    refreshToken.value = ''
    localStorage.removeItem(LS_ACCESS)
    localStorage.removeItem(LS_REFRESH)
    // 同步清理用户信息
    const userStore = useUserStore()
    userStore.clearUser()
  }

  // 尝试从本地恢复令牌并验证
  const initializeAuth = async () => {
    const at = localStorage.getItem(LS_ACCESS) || ''
    const rt = localStorage.getItem(LS_REFRESH) || ''

    if (!at || !rt) {
      clearAuth()
      return false
    }

    accessToken.value = at
    refreshToken.value = rt

    // 验证token是否有效并获取用户信息
    try {
      // 简单的token格式验证（检查是否是JWT格式）
      const tokenParts = at.split('.')
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format')
      }

      // 检查token是否过期
      const payload = JSON.parse(atob(tokenParts[1]))
      const currentTime = Math.floor(Date.now() / 1000)

      if (payload.exp && payload.exp < currentTime) {
        // Token过期，尝试刷新
        await refreshAccessToken()
      }

      // 验证token有效性并获取用户信息
      const { authApi } = await import('@/api/auth')
      const userResult = await authApi.getProfile()

      if (userResult.success && userResult.data) {
        const userStore = useUserStore()
        await userStore.setUser(userResult.data)
        return true
      } else {
        throw new Error('Failed to get user profile')
      }

    } catch (error) {
      // Token无效或获取用户信息失败，清除认证信息
      clearAuth()
      return false
    }
  }

  // 检查认证状态（兼容性方法）
  const checkAuthStatus = async () => {
    await initializeAuth()
  }

  // 刷新访问令牌
  const refreshAccessToken = async () => {
    if (!refreshToken.value) throw new Error('无刷新令牌，无法刷新')
    const res = await authApi.refresh(refreshToken.value)
    if (res.success && res.data?.tokens) {
      setTokens(res.data.tokens)
      return res.data.tokens
    }
    throw new Error('刷新令牌失败')
  }

  // 登录流程：设置令牌与用户
  const login = async (data: LoginData) => {
    const res = await authApi.login(data)
    if (res.success && res.data) {
      const userStore = useUserStore()
      setTokens(res.data.tokens)
      await userStore.setUser(res.data.user)
      return res.data
    }
    throw new Error(res.message || '登录失败')
  }

  // 注册（可选：直接登录）
  const register = async (data: RegisterData) => {
    const res = await authApi.register(data)
    if (res.success && res.data) {
      const userStore = useUserStore()
      setTokens(res.data.tokens)
      await userStore.setUser(res.data.user)
      return res.data
    }
    throw new Error(res.message || '注册失败')
  }

  // 登出
  const logout = async () => {
    try { await authApi.logout() } catch {/* 忽略错误 */}
    clearAuth()
  }

  return {
    // 状态
    accessToken,
    refreshToken,
    isAuthenticated,
    // 方法
    setTokens,
    clearAuth,
    initializeAuth,
    checkAuthStatus,
    refreshAccessToken,
    login,
    register,
    logout,
  }
})

