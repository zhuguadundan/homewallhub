/**
 * 测试工具函数
 * 提供常用的测试辅助方法
 */

import { vi } from 'vitest'

/**
 * 创建模拟触摸事件
 */
export function createMockTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number; identifier?: number }> = []
): TouchEvent {
  const touchList = touches.map((touch, index) => ({
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    identifier: touch.identifier ?? index,
    target: document.body,
    radiusX: 10,
    radiusY: 10,
    rotationAngle: 0,
    force: 1,
  }))

  const event = new Event(type, { bubbles: true, cancelable: true }) as any
  event.touches = touchList
  event.targetTouches = touchList
  event.changedTouches = touchList
  
  return event as TouchEvent
}

/**
 * 模拟设备信息
 */
export function mockDeviceInfo(deviceType: 'mobile' | 'tablet' | 'desktop') {
  const configs = {
    mobile: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      screen: { width: 375, height: 812 },
      viewport: { width: 375, height: 812 },
    },
    tablet: {
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      screen: { width: 768, height: 1024 },
      viewport: { width: 768, height: 1024 },
    },
    desktop: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      screen: { width: 1920, height: 1080 },
      viewport: { width: 1200, height: 800 },
    },
  }

  const config = configs[deviceType]
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: config.userAgent,
  })

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: config.viewport.width,
  })

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: config.viewport.height,
  })

  Object.defineProperty(screen, 'width', {
    writable: true,
    value: config.screen.width,
  })

  Object.defineProperty(screen, 'height', {
    writable: true,
    value: config.screen.height,
  })
}

/**
 * 等待下一个微任务
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 模拟window.resize事件
 */
export function triggerResize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: height,
  })
  
  window.dispatchEvent(new Event('resize'))
}

/**
 * 模拟屏幕方向变化
 */
export function triggerOrientationChange(orientation: 'portrait' | 'landscape') {
  const orientationData = {
    portrait: { angle: 0, type: 'portrait-primary' },
    landscape: { angle: 90, type: 'landscape-primary' },
  }

  Object.defineProperty(screen, 'orientation', {
    writable: true,
    value: {
      ...orientationData[orientation],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })

  window.dispatchEvent(new Event('orientationchange'))
}