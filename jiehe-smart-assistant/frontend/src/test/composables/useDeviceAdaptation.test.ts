/**
 * useDeviceAdaptation设备适配功能测试
 * 测试设备检测和适配能力
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useDeviceAdaptation } from '@/composables/useDeviceAdaptation'
import { mockDeviceInfo, triggerResize, triggerOrientationChange } from '../utils'

describe('useDeviceAdaptation', () => {
  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该正确检测移动设备', () => {
    mockDeviceInfo('mobile')
    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.isMobile).toBe(true)
    expect(device.deviceInfo.value.isTablet).toBe(false)
    expect(device.deviceInfo.value.isDesktop).toBe(false)
  })

  it('应该正确检测平板设备', () => {
    mockDeviceInfo('tablet')
    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.isMobile).toBe(false)
    expect(device.deviceInfo.value.isTablet).toBe(true)
    expect(device.deviceInfo.value.isDesktop).toBe(false)
  })

  it('应该正确检测桌面设备', () => {
    mockDeviceInfo('desktop')
    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.isMobile).toBe(false)
    expect(device.deviceInfo.value.isTablet).toBe(false)
    expect(device.deviceInfo.value.isDesktop).toBe(true)
  })

  it('应该检测触摸支持', () => {
    // 模拟支持触摸的设备
    Object.defineProperty(window, 'ontouchstart', {
      value: {},
      configurable: true,
    })

    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.hasTouch).toBe(true)
  })

  it('应该检测PWA模式', () => {
    // 模拟PWA环境
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(display-mode: standalone)') {
          return { 
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }
        }
        return { 
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      }),
    })

    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.isPWA).toBe(true)
  })

  it('应该检测用户的动画偏好', () => {
    // 模拟用户偏好减少动画
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return { 
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }
        }
        return { 
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      }),
    })

    const device = useDeviceAdaptation()

    expect(device.deviceInfo.value.prefersReducedMotion).toBe(true)
  })

  it('应该响应屏幕方向变化', async () => {
    const device = useDeviceAdaptation()

    // 初始应该是竖屏
    expect(device.orientation.value).toBe('portrait')

    // 切换到横屏
    triggerOrientationChange('landscape')
    await nextTick()

    expect(device.orientation.value).toBe('landscape')
  })

  it('应该响应窗口大小变化', async () => {
    const device = useDeviceAdaptation()

    const initialWidth = device.viewport.value.width

    // 改变窗口大小
    triggerResize(800, 600)
    await nextTick()

    expect(device.viewport.value.width).toBe(800)
    expect(device.viewport.value.height).toBe(600)
    expect(device.viewport.value.width).not.toBe(initialWidth)
  })

  it('应该根据屏幕大小确定设备类型', () => {
    // 测试手机尺寸
    triggerResize(375, 812)
    const mobileDevice = useDeviceAdaptation()
    expect(mobileDevice.deviceType.value).toBe('mobile')

    // 测试平板尺寸
    triggerResize(768, 1024)
    const tabletDevice = useDeviceAdaptation()
    expect(tabletDevice.deviceType.value).toBe('tablet')

    // 测试桌面尺寸
    triggerResize(1920, 1080)
    const desktopDevice = useDeviceAdaptation()
    expect(desktopDevice.deviceType.value).toBe('desktop')
  })

  it('应该提供正确的断点信息', () => {
    const device = useDeviceAdaptation()

    // 测试小屏幕
    triggerResize(320, 568)
    expect(device.breakpoint.value).toBe('xs')

    // 测试中等屏幕
    triggerResize(768, 1024)
    expect(device.breakpoint.value).toBe('md')

    // 测试大屏幕
    triggerResize(1200, 800)
    expect(device.breakpoint.value).toBe('lg')

    // 测试超大屏幕
    triggerResize(1920, 1080)
    expect(device.breakpoint.value).toBe('xl')
  })

  it('应该检测安全区域支持', () => {
    // 模拟支持安全区域的设备
    Object.defineProperty(window, 'getComputedStyle', {
      value: vi.fn(() => ({
        getPropertyValue: vi.fn((prop: string) => {
          if (prop === 'padding-top') return '44px' // 模拟状态栏高度
          return '0px'
        }),
      })),
    })

    const device = useDeviceAdaptation()

    expect(device.safeArea.value.top).toBe(44)
  })

  it('应该提供设备性能等级', () => {
    // 模拟高性能设备
    Object.defineProperty(navigator, 'deviceMemory', {
      value: 8,
      configurable: true,
    })
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 8,
      configurable: true,
    })

    const device = useDeviceAdaptation()

    expect(device.performanceLevel.value).toBe('high')
  })

  it('应该检测网络连接状态', () => {
    // 模拟网络连接信息
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
      },
      configurable: true,
    })

    const device = useDeviceAdaptation()

    expect(device.networkInfo.value.effectiveType).toBe('4g')
    expect(device.networkInfo.value.downlink).toBe(10)
  })

  it('应该检测暗色主题偏好', () => {
    // 模拟暗色主题偏好
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(prefers-color-scheme: dark)') {
          return { 
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }
        }
        return { 
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      }),
    })

    const device = useDeviceAdaptation()

    expect(device.colorScheme.value).toBe('dark')
  })

  it('应该提供设备像素比信息', () => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      configurable: true,
    })

    const device = useDeviceAdaptation()

    expect(device.pixelRatio.value).toBe(2)
  })

  it('应该在组件卸载时清理事件监听器', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    
    const device = useDeviceAdaptation()
    
    // 模拟组件卸载
    device.cleanup()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })

  it('应该支持自定义配置', () => {
    const customConfig = {
      breakpoints: {
        xs: 0,
        sm: 600,
        md: 900,
        lg: 1200,
        xl: 1800,
      },
      debounceDelay: 100,
    }

    const device = useDeviceAdaptation(customConfig)

    // 测试自定义断点
    triggerResize(800, 600)
    expect(device.breakpoint.value).toBe('sm') // 根据自定义断点
  })

  it('应该正确处理不支持的API', () => {
    // 移除某些API支持
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(navigator, 'deviceMemory', {
      value: undefined,
      configurable: true,
    })

    const device = useDeviceAdaptation()

    // 应该有默认值而不是错误
    expect(device.networkInfo.value).toBeDefined()
    expect(device.performanceLevel.value).toBeDefined()
  })
})