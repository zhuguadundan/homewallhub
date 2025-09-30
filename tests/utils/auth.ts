import type { Page } from '@playwright/test'

type UserPayload = {
  user_id?: string
  username?: string
  expSec?: number
}

export function buildMockJWT(user: UserPayload = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
  const nowSec = Math.floor(Date.now() / 1000)
  const payloadObj = {
    exp: nowSec + (user.expSec ?? 3600),
    iat: nowSec,
    user_id: user.user_id ?? `u_${Date.now()}`,
    username: user.username ?? 'tester'
  }
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64')
  // 签名对测试无意义，放置占位符
  return `${header}.${payload}.mock_signature_for_testing`
}

/**
 * 注入本地存储中的认证令牌，优先在导航前使用 addInitScript，确保路由守卫首帧可用
 */
export async function setupAuth(page: Page, user: UserPayload = {}): Promise<{ access: string; refresh: string }> {
  const access = buildMockJWT(user)
  const refresh = 'refresh.mock_signature'
  await page.addInitScript((a: string, r: string) => {
    try {
      localStorage.setItem('jssa_access_token', a)
      localStorage.setItem('jssa_refresh_token', r)
    } catch {}
  }, access, refresh)
  return { access, refresh }
}

/**
 * 旧测试兼容：在已加载页面后再设置 token
 */
export async function setupAuthAfterGoto(page: Page, user: UserPayload = {}): Promise<{ access: string; refresh: string }> {
  const access = buildMockJWT(user)
  const refresh = 'refresh.mock_signature'
  await page.evaluate(([a, r]) => {
    localStorage.setItem('jssa_access_token', a as string)
    localStorage.setItem('jssa_refresh_token', r as string)
  }, [access, refresh])
  return { access, refresh }
}

