/**
 * 测试环境设置文件
 * 配置全局测试环境和模拟对象
 */

import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// 模拟浏览器API
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// 模拟ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// 模拟IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// 模拟触摸事件
Object.defineProperty(window, 'ontouchstart', {
  writable: true,
  value: undefined,
})

// 模拟设备像素比
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 2,
})

// 模拟Navigator API
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
})

Object.defineProperty(navigator, 'vendor', {
  writable: true,
  value: 'Apple Computer, Inc.',
})

Object.defineProperty(navigator, 'platform', {
  writable: true,
  value: 'iPhone',
})

// 模拟CSS环境变量支持
const mockGetComputedStyle = vi.fn(() => ({
  getPropertyValue: vi.fn(() => '20px'),
}))
Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
})

// 配置Vue Test Utils全局设置
config.global.stubs = {
  // 模拟路由器链接
  'router-link': true,
  'router-view': true,
}

// 模拟vibrate API
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn(),
})

// 模拟屏幕方向API
Object.defineProperty(screen, 'orientation', {
  writable: true,
  value: {
    angle: 0,
    type: 'portrait-primary',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})

// 模拟prefers-color-scheme媒体查询
const mockPrefersColorScheme = vi.fn(() => false)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => {
    if (query === '(prefers-color-scheme: dark)') {
      return {
        matches: mockPrefersColorScheme(),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  }),
})

export { mockPrefersColorScheme }