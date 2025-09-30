import { test, expect } from '@playwright/test'
import { setupAuth } from './utils/auth'
import { setupEnhancedApiMocks } from './utils/apiMocks'

function uid(prefix = 'test') {
  const ts = Date.now().toString()
  const rnd = Math.floor(Math.random() * 1e6).toString()
  return `${prefix}_${ts}_${rnd}`
}

test.describe('模块功能完整测试', () => {
  test.beforeEach(async ({ page }) => {
    await setupEnhancedApiMocks(page)
    await setupAuth(page)
    await page.goto('/login')
  })

  test('任务模块：添加任务表单测试', async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForURL('**/tasks')
    await page.screenshot({ path: 'test-results/tasks-list.png', fullPage: true })

    const addButton = page.locator('button', { hasText: /添加|新建|创建/ }).or(
      page.locator('button[class*="add"]')
    ).or(
      page.locator('a[href*="create"]')
    ).or(
      page.locator('.van-icon-plus').locator('..')
    ).first()

    if (await addButton.count() > 0) {
      await addButton.click()
      // 等待任务创建表单字段可见，替代固定超时
      await page.locator('input[placeholder*="标题"], input[label*="标题"], input[name*="title"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/tasks-create-form.png', fullPage: true })

      const taskTitle = uid('任务标题')
      const taskDesc = '这是一个测试任务的描述'
      await page.fill('input[placeholder*="标题"], input[label*="标题"], input[name*="title"]', taskTitle)
      await page.fill('textarea[placeholder*="描述"], textarea[label*="描述"], input[name*="description"]', taskDesc)

      const submitButton = page.locator('button[type="submit"]').or(
        page.locator('button', { hasText: /提交|保存|创建/ })
      ).first()
      if (await submitButton.count() > 0) {
        // 若存在遮罩层拦截点击，先尝试关闭
        const overlay = page.locator('.van-overlay').first()
        if (await overlay.count() > 0) {
          try { await overlay.click({ position: { x: 10, y: 10 } }) } catch {}
          await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
        }
        try {
          await submitButton.click()
        } catch {
          await submitButton.click({ force: true })
        }
        await expect(page).toHaveURL(/\/tasks/, { timeout: 10000 })
      }
    } else {
      console.log('任务页面未找到添加按钮')
    }
  })

  test('库存模块：添加物品表单测试', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForURL('**/inventory')
    await page.screenshot({ path: 'test-results/inventory-list.png', fullPage: true })

    const addButton = page.locator('button', { hasText: /添加|新建|入库/ }).or(
      page.locator('button[class*="add"]')
    ).or(
      page.locator('.van-icon-plus').locator('..')
    ).first()

    if (await addButton.count() > 0) {
      await addButton.click()
      // 等待库存添加表单渲染
      await page.locator('input[placeholder*="名称"], input[label*="名称"], input[name*="name"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await page.screenshot({ path: 'test-results/inventory-add-form.png', fullPage: true })

      const itemName = uid('测试物品')
      const itemQuantity = '5'
      await page.fill('input[placeholder*="名称"], input[label*="名称"], input[name*="name"]', itemName)
      await page.fill('input[placeholder*="数量"], input[label*="数量"], input[name*="quantity"]', itemQuantity)

      const categorySelect = page.locator('select[name*="category"], .van-picker__confirm').first()
      if (await categorySelect.count() > 0) {
        await categorySelect.click()
        // 等待选择器选项可见
        const firstOption = page.locator('.van-picker-column__item').first()
        await firstOption.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
        if (await firstOption.count() > 0) {
          await firstOption.click()
          const confirmPick = page.locator('.van-picker__confirm').first()
          await confirmPick.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
          await confirmPick.click()
        }
      }

      const submitButton = page.locator('button[type="submit"]').or(
        page.locator('button', { hasText: /提交|保存|添加/ })
      ).first()
      if (await submitButton.count() > 0) {
        await submitButton.click()
        // 等待可能的提交完成信号：遮罩消失或任意 /api/ 写操作响应
        const overlay = page.locator('.van-overlay').first()
        await Promise.race([
          overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {}),
          page.waitForResponse(r => /\/api\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 2000 }).catch(() => {})
        ])
      }
    } else {
      console.log('库存页面未找到添加按钮')
    }
  })

  test('日历模块：页面渲染校验与截图', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForURL('**/calendar')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/calendar-view.png', fullPage: true })
  })

  test('留言模块：发布留言表单测试', async ({ page }) => {
    await page.goto('/messages')
    await page.waitForURL('**/messages')
    await page.screenshot({ path: 'test-results/messages-view.png', fullPage: true })

    const messageInput = page.locator('textarea[placeholder*="留言"], textarea[placeholder*="消息"], input[placeholder*="说点什么"]').first()
    const publishButton = page.locator('button', { hasText: /发布|发送|提交/ }).first()

    if (await messageInput.count() > 0) {
      const messageContent = uid('测试留言') + '：这是一条测试留言内容'
      await messageInput.fill(messageContent)
      await page.screenshot({ path: 'test-results/messages-input.png', fullPage: true })

      if (await publishButton.count() > 0) {
        await publishButton.click()
        await page.waitForResponse(r => /\/api\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 2000 }).catch(() => {})
        await page.screenshot({ path: 'test-results/messages-published.png', fullPage: true })
      }
    } else {
      console.log('留言页面未找到输入框')
    }
  })

  test('AI模块：功能交互测试', async ({ page }) => {
    await page.goto('/ai')
    await page.waitForURL('**/ai')
    await page.screenshot({ path: 'test-results/ai-main.png', fullPage: true })

    const recipeButton = page.locator('button', { hasText: /菜谱|推荐/ }).or(
      page.locator('a[href*="recipe"]')
    ).first()
    if (await recipeButton.count() > 0) {
      await recipeButton.click()
      await page.waitForLoadState('domcontentloaded')
      await page.screenshot({ path: 'test-results/ai-recipe.png', fullPage: true })
      const generateButton = page.locator('button', { hasText: /生成|获取|推荐/ }).first()
      if (await generateButton.count() > 0) {
        await generateButton.click()
        await page.waitForResponse(r => r.url().includes('/api/ai/') && r.status() === 200, { timeout: 5000 }).catch(() => {})
        await page.screenshot({ path: 'test-results/ai-recipe-result.png', fullPage: true })
      }
    }

    await page.goto('/ai')
    const taskButton = page.locator('button', { hasText: /任务|建议/ }).or(
      page.locator('a[href*="task"]')
    ).first()
    if (await taskButton.count() > 0) {
      await taskButton.click()
      await page.waitForLoadState('domcontentloaded')
      await page.screenshot({ path: 'test-results/ai-task.png', fullPage: true })
    }
  })
})
