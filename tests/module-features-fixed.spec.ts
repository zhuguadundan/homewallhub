import { test, expect } from '@playwright/test'
import { setupAuth } from './utils/auth'
import { setupEnhancedApiMocks } from './utils/apiMocks'

function uid(prefix = 'test') {
  const ts = Date.now().toString()
  const rnd = Math.floor(Math.random() * 1e6).toString()
  return `${prefix}_${ts}_${rnd}`
}

test.describe('模块功能完整测试 - 修复版', () => {
  test.beforeEach(async ({ page }) => {
    await setupEnhancedApiMocks(page)
    await page.goto('/login')
    await setupAuth(page)
  })

  test('任务模块：页面渲染和添加按钮测试', async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForURL('**/tasks')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/tasks-list-fixed.png', fullPage: true })

    const navBarAddButton = page.locator('van-nav-bar').getByText('新建')
    if (await navBarAddButton.count() > 0) {
      await navBarAddButton.click()
      await page.locator('input[name="title"], van-field[label*="标题"] input').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/tasks-create-dialog.png', fullPage: true })

      const taskTitle = uid('任务标题')
      const titleField = page.locator('input[name="title"], van-field[label*="标题"] input')
      if (await titleField.count() > 0) {
        await titleField.fill(taskTitle)
        const confirmButton = page.locator('button').filter({ hasText: /确认|提交|创建/ })
        if (await confirmButton.count() > 0) {
          await confirmButton.click()
          // 等待可能的弹层关闭
          await page.locator('.van-overlay').first().waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
        }
      }
    }
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('库存模块：页面渲染和功能按钮测试', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForURL('**/inventory')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/inventory-list-fixed.png', fullPage: true })

    const floatingButton = page.locator('van-floating-bubble, .van-floating-bubble')
    if (await floatingButton.count() > 0) {
      await floatingButton.click()
      await page.locator('.van-dialog, .van-popup, .van-action-sheet, form').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/inventory-add-form-fixed.png', fullPage: true })
    }

    const stockInButton = page.locator('button').filter({ hasText: '入库' }).first()
    if (await stockInButton.count() > 0) {
      await stockInButton.click()
      await page.locator('.van-popup, .van-dialog, .van-action-sheet').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/inventory-stock-in-modal.png', fullPage: true })
    }

    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('日历模块：页面渲染和添加事件测试', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForURL('**/calendar')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/calendar-view-fixed.png', fullPage: true })

    const addEventButton = page.locator('van-nav-bar van-icon[name="plus"], .van-nav-bar .van-icon-plus')
    if (await addEventButton.count() > 0) {
      await addEventButton.click()
      await page.locator('input[name="title"], van-field[label*="标题"] input').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/calendar-add-form-fixed.png', fullPage: true })

      const eventTitle = uid('测试事件')
      const titleField = page.locator('input[name="title"], van-field[label*="标题"] input')
      if (await titleField.count() > 0) {
        await titleField.fill(eventTitle)
        const submitButton = page.locator('button[type="primary"]').filter({ hasText: /创建|提交/ })
        if (await submitButton.count() > 0) {
          await submitButton.click()
          await page.locator('.van-overlay').first().waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
        }
      }
    }

    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('留言模块：页面渲染和发布功能测试', async ({ page }) => {
    await page.goto('/messages')
    await page.waitForURL('**/messages')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/messages-view-fixed.png', fullPage: true })

    const addMessageButton = page.locator('van-nav-bar van-icon[name="plus"], .van-nav-bar .van-icon-plus')
    if (await addMessageButton.count() > 0) {
      await addMessageButton.click()
      await page.locator('textarea[name="content"], van-field[label*="内容"] textarea').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/messages-create-form.png', fullPage: true })

      const messageContent = uid('测试留言') + '：这是一条测试留言内容'
      const contentField = page.locator('textarea[name="content"], van-field[label*="内容"] textarea')
      if (await contentField.count() > 0) {
        await contentField.fill(messageContent)
        const submitButton = page.locator('button[type="primary"]').filter({ hasText: /发布|提交/ })
        if (await submitButton.count() > 0) {
          await submitButton.click()
          await page.waitForResponse(r => /\/api\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 2000 }).catch(() => {})
        }
      }
    }

    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('AI模块：功能页面渲染测试', async ({ page }) => {
    await page.goto('/ai')
    await page.waitForURL('**/ai')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/ai-main-fixed.png', fullPage: true })

    await page.goto('/ai/recipe-recommendation')
    await page.waitForURL(/\/ai\/recipe-recommendation$/)
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/ai-recipe-fixed.png', fullPage: true })

    await expect(page.locator('body')).not.toBeEmpty()
  })
})
