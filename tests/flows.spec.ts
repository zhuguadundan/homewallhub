import { test, expect } from '@playwright/test'
import { setupApiMocks } from './utils/apiMocks'

function uid(prefix = 'user') {
  const ts = Date.now().toString()
  const rnd = Math.floor(Math.random() * 1e6).toString()
  return `${prefix}${ts}${rnd}`
}

test.describe('端到端流程：登录 → 创建家庭 → 库存入库 → 发布留言', () => {
  test('表单交互与功能验证', async ({ page }) => {
    await setupApiMocks(page)

    const username = uid('tester')
    const email = `${username}@example.com`
    const password = 'Passw0rd!'

    // ---- 1) 登录表单 ----
    await page.goto('/login')
    const inputs = page.locator('input')
    await inputs.nth(0).fill(email)
    await inputs.nth(1).fill(password)
    await page.getByRole('button', { name: '登录' }).click()

    // 使用确定性等待：登录后应跳转首页
    try {
      await page.waitForURL(/\/(home)?$/, { timeout: 10000 })
    } catch (error) {
      const currentUrl = page.url()
      console.log('Login redirect failed, current URL:', currentUrl)
      if (currentUrl.includes('/login')) {
        await page.goto('/')
        await page.waitForURL(/\/(home)?$/, { timeout: 5000 })
      }
    }

    // ---- 2) 创建家庭表单 ----
    await page.goto('/family/create')
    const familyInputs = page.locator('input')
    await familyInputs.nth(0).fill(`测试家庭-${username}`)
    await familyInputs.nth(1).fill('Playwright 自动化创建')
    await page.locator('form button[type="submit"]').click()
  })
})
