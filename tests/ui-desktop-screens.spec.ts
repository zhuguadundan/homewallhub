import { test, expect } from '@playwright/test'
import { setupApiMocks } from './utils/apiMocks'
import { setupAuthAfterGoto } from './utils/auth'

// 桌面端视图 + 截图验证核心导航与页面渲染
test.describe('桌面端 UI 可用性与导航截图', () => {
  test('首页 → 菜谱/库存/日历/留言 导航与截图', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })

    // 精确拦截 API
    await setupApiMocks(page)

    // 注入有效 JWT，绕过路由守卫
    await page.goto('/login')
    await setupAuthAfterGoto(page, { user_id: 'u_ui_test', username: 'ui_tester' })

    // 进入首页
    await page.goto('/home')
    await page.waitForURL(/\/home$/)
    await page.screenshot({ path: 'test-results/desktop-home.png', fullPage: true })

    await page.goto('/ai/recipe-recommendation', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/ai\/recipe-recommendation$/)
    await page.screenshot({ path: 'test-results/desktop-ai-recipe.png', fullPage: true })

    await page.goto('/inventory', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/inventory$/)
    await page.screenshot({ path: 'test-results/desktop-inventory.png', fullPage: true })

    await page.goto('/calendar', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/calendar$/)
    await page.screenshot({ path: 'test-results/desktop-calendar.png', fullPage: true })

    await page.goto('/messages', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/messages$/)
    await page.screenshot({ path: 'test-results/desktop-messages.png', fullPage: true })
  })
})
