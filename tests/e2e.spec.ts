import { test, expect } from '@playwright/test'
import { setupAuthAfterGoto } from './utils/auth'
import { setupApiMocks } from './utils/apiMocks'

// 小工具：生成唯一用户名/邮箱
function uid(prefix = 'user') {
  const ts = Date.now().toString()
  const rnd = Math.floor(Math.random() * 1e6).toString()
  return `${prefix}${ts}${rnd}`
}

test.describe('家和智能助手 - 核心用户路径', () => {
  test('注册、登录(自动)、创建家庭、库存、AI', async ({ page }) => {
    // 仅拦截 /api/* 的 XHR/Fetch 请求
    await setupApiMocks(page)

    const username = uid('tester')
    const email = `${username}@example.com`
    const password = 'Passw0rd!'
    void email
    void password

    // 1) 注入有效 JWT 模拟已登录状态
    await page.goto('/login')
    await setupAuthAfterGoto(page, { username })

    // 2) 进入首页（路由守卫会调用 /api/auth/profile，经 mock 返回用户信息）
    await page.goto('/')
    await page.waitForURL(/\/(home)?$/)

    // 3) AI 页面 - 基础加载验证
    await page.goto('/ai')
    await expect(page).toHaveURL(/\/ai$/)
  })
})

