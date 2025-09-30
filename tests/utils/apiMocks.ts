import type { Page, Route, Request } from '@playwright/test'

function isXhrOrFetch(req: Request): boolean {
  const t = req.resourceType()
  return t === 'xhr' || t === 'fetch'
}

function isApiUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString)
    return u.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

async function fulfillJson(route: Route, status: number, body: any) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * 覆盖常用后端端点，且仅拦截 XHR/Fetch 的 /api/* 请求；默认 GET 返回空成功，非 GET 放行
 */
export async function setupApiMocks(page: Page) {
  await page.route(isApiUrl, async (route) => {
    const req = route.request()
    if (!isXhrOrFetch(req)) return route.continue()

    const url = new URL(req.url())
    const method = req.method().toUpperCase()
    const p = url.pathname
    const now = new Date().toISOString()

    // 认证
    if (p === '/api/auth/login') {
      return fulfillJson(route, 200, {
        success: true,
        data: {
          user: { id: 'u_' + Date.now(), username: 'tester', email: 'tester@example.com' },
          tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' }
        },
        timestamp: now,
        path: p
      })
    }
    if (p === '/api/auth/register') {
      return fulfillJson(route, 201, {
        success: true,
        data: {
          user: { id: 'u_' + Date.now(), username: 'tester', email: 'tester@example.com', created_at: now, gender: 0 },
          tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' }
        },
        timestamp: now,
        path: p
      })
    }
    if (p === '/api/auth/profile') {
      return fulfillJson(route, 200, {
        success: true,
        data: { id: 'u_' + Date.now(), username: 'tester', email: 'tester@example.com', created_at: now, gender: 0 },
        timestamp: now,
        path: p
      })
    }

    // 家庭（根级）
    if (p === '/api/families') {
      if (method === 'POST') {
        return fulfillJson(route, 201, {
          success: true,
          data: { id: 'f_' + Date.now(), name: '测试家庭', invite_code: 'ABCDEFGH', created_at: now },
          timestamp: now,
          path: p
        })
      }
      return fulfillJson(route, 200, { success: true, data: [] })
    }

    // 留言（根级）
    if (p === '/api/messages') {
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'm_' + Date.now() }, timestamp: now })
      }
      return fulfillJson(route, 200, { success: true, data: { messages: [], pagination: { current_page: 1, total_pages: 1 } } })
    }

    // 日历（根级）
    if (p.endsWith('/api/calendar/events')) {
      if (method === 'GET') {
        return fulfillJson(route, 200, { success: true, data: { events: [], pagination: { current_page: 1, total_pages: 1 } } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'e_' + Date.now() }, timestamp: now })
      }
    }

    // 家庭命名空间资源
    if (/^\/api\/families\/[^/]+\/(tasks)(\/.*)?$/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, { success: true, data: { tasks: [], pagination: { current_page: 1, total_pages: 1 } } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 't_' + Date.now(), created_at: now } })
      }
    }
    if (/^\/api\/families\/[^/]+\/(inventory)(\/.*)?$/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, { success: true, data: { items: [], stats: {}, categories: [] } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'i_' + Date.now(), created_at: now } })
      }
    }
    if (/^\/api\/families\/[^/]+\/(events)(\/.*)?$/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, { success: true, data: { events: [], pagination: { current_page: 1, total_pages: 1 } } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'e_' + Date.now(), created_at: now } })
      }
    }
    if (/^\/api\/families\/[^/]+\/(messages)(\/.*)?$/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, { success: true, data: { messages: [], pagination: { current_page: 1, total_pages: 1 } } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'm_' + Date.now(), created_at: now } })
      }
    }

    // AI
    if (p.startsWith('/api/ai/')) {
      return fulfillJson(route, 200, { success: true, data: { recommendations: ['推荐1', '推荐2'], generated_at: now } })
    }

    // 默认
    if (method === 'GET') {
      return fulfillJson(route, 200, { success: true, data: {} })
    }
    return route.continue()
  })
}

/**
 * 增强版：提供更丰富的列表数据，适配模块功能测试的截图/交互
 */
export async function setupEnhancedApiMocks(page: Page) {
  await page.route(isApiUrl, async (route) => {
    const req = route.request()
    if (!isXhrOrFetch(req)) return route.continue()
    const url = new URL(req.url())
    const method = req.method().toUpperCase()
    const p = url.pathname
    const now = new Date().toISOString()

    if (p.startsWith('/api/auth/')) {
      return fulfillJson(route, 200, {
        success: true,
        data: {
          id: 'u_module_test',
          username: 'module_tester',
          families: [{ id: 'f_test', name: '测试家庭' }],
          currentFamily: { id: 'f_test', name: '测试家庭' }
        }
      })
    }

    if (/^\/api\/families\/[^/]+\/tasks/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, {
          success: true,
          data: {
            tasks: [
              { id: 't1', title: '测试任务1', status: 'pending', priority: 'medium' },
              { id: 't2', title: '测试任务2', status: 'in_progress', priority: 'high' }
            ],
            pagination: { current_page: 1, total_pages: 1 }
          }
        })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 't_' + Date.now() } })
      }
    }

    if (/^\/api\/families\/[^/]+\/inventory/.test(p)) {
      if (method === 'GET') {
        return fulfillJson(route, 200, {
          success: true,
          data: {
            items: [
              { id: 'i1', name: '测试物品1', current_stock: 5, min_stock_threshold: 2 },
              { id: 'i2', name: '测试物品2', current_stock: 1, min_stock_threshold: 5 }
            ],
            stats: { total_items: 2, low_stock_items: 1, expired_items: 0, expiring_soon_items: 0 },
            categories: [
              { id: '1', name: '蔬菜', icon: '🥬' },
              { id: '2', name: '水果', icon: '🍎' }
            ]
          }
        })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'i_' + Date.now() } })
      }
    }

    if (/^\/api\/families\/[^/]+\/events/.test(p)) {
      if (method === 'GET') {
        const mockEvents = [
          { id: 'e1', title: '测试事件1', start_time: now, end_time: now },
          { id: 'e2', title: '测试事件2', start_time: now, end_time: now }
        ]
        return fulfillJson(route, 200, { success: true, data: { events: mockEvents, pagination: { current_page: 1, total_pages: 1 } } })
      }
      if (method === 'POST') {
        return fulfillJson(route, 201, { success: true, data: { id: 'e_' + Date.now() } })
      }
    }

    if (/^\/api\/families(\/|$)/.test(p)) {
      return fulfillJson(route, 200, { success: true, data: [{ id: 'f_test', name: '测试家庭' }] })
    }

    if (p.startsWith('/api/ai/')) {
      return fulfillJson(route, 200, { success: true, data: { recommendations: ['推荐1', '推荐2'], generated_at: now } })
    }

    if (req.method().toUpperCase() === 'GET') {
      return fulfillJson(route, 200, { success: true, data: {} })
    }
    return route.continue()
  })
}

