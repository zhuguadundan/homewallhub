import { test, expect } from '@playwright/test'
import { setupApiMocks } from './utils/apiMocks'

test.describe('简化页面渲染测试', () => {
  test('基础页面渲染验证', async ({ page }) => {
    await setupApiMocks(page)

    // 注入认证token
    await page.goto('/login')
    await page.evaluate(() => {
      localStorage.setItem('jssa_access_token', 'mock.jwt.token')
      localStorage.setItem('jssa_refresh_token', 'mock.refresh.token')
    })

    console.log('开始测试登录页面...')
    await page.goto('/login')
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
    await page.screenshot({ path: 'test-results/simple-login.png' })

    console.log('开始测试首页...')
    await page.goto('/')
    await page.waitForURL(/\/(home)?$/)
    await page.screenshot({ path: 'test-results/simple-home.png' })

    console.log('开始测试任务页面...')
    await page.goto('/tasks')
    await page.waitForURL('**/tasks')
    await page.screenshot({ path: 'test-results/simple-tasks.png' })

    console.log('开始测试库存页面...')
    await page.goto('/inventory')
    await page.waitForURL('**/inventory')
    await page.screenshot({ path: 'test-results/simple-inventory.png' })

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.length > 0 || document.body.children.length > 0
    })
    console.log('页面是否有内容:', hasContent)

    const errors = await page.evaluate(() => {
      const errors: string[] = []
      if (window.console && window.console.error) {
        errors.push('控制台可能有错误')
      }
      return errors
    })
    console.log('检查到的问题:', errors)

    await expect(page).toHaveTitle(/.+/)
  })

  test('检查Vite开发服务器状态', async ({ page }) => {
    await page.goto('/')
    const viteClient = await page.evaluate(() => {
      // @ts-ignore
      return (window as any).__vite_is_modern_browser !== undefined
    })
    console.log('Vite客户端状态:', viteClient)

    const moduleErrors = await page.evaluate(() => {
      const errors: string[] = []
      const scripts = document.querySelectorAll('script[type="module"]')
      scripts.forEach(script => {
        const src = (script as HTMLScriptElement).src
        if (src && src.includes('undefined')) {
          errors.push(`模块路径错误: ${src}`)
        }
      })
      return errors
    })
    console.log('模块加载问题:', moduleErrors)

    await page.screenshot({ path: 'test-results/vite-debug.png' })
  })
})
