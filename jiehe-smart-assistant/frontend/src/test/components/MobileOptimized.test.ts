/**
 * MobileOptimized组件测试
 * 测试移动端布局和适配功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MobileOptimized from '@/components/MobileOptimized.vue'
import { mockDeviceInfo, triggerResize, triggerOrientationChange } from '../utils'

describe('MobileOptimized.vue', () => {
  let wrapper: any

  beforeEach(() => {
    mockDeviceInfo('mobile')
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  it('应该正确渲染移动端布局', () => {
    wrapper = mount(MobileOptimized, {
      slots: {
        default: '<div class="test-content">测试内容</div>',
      },
    })

    expect(wrapper.find('.mobile-optimized').exists()).toBe(true)
    expect(wrapper.find('.test-content').exists()).toBe(true)
    expect(wrapper.classes()).toContain('mobile-device')
  })

  it('应该根据设备类型应用正确的类名', async () => {
    // 测试移动设备
    mockDeviceInfo('mobile')
    wrapper = mount(MobileOptimized)
    await nextTick()

    expect(wrapper.classes()).toContain('mobile-device')
    
    // 测试平板设备
    wrapper.unmount()
    mockDeviceInfo('tablet')
    wrapper = mount(MobileOptimized)
    await nextTick()

    expect(wrapper.classes()).toContain('tablet-device')

    // 测试桌面设备
    wrapper.unmount()
    mockDeviceInfo('desktop')
    wrapper = mount(MobileOptimized)
    await nextTick()

    expect(wrapper.classes()).toContain('desktop-device')
  })

  it('应该检测安全区域支持', () => {
    // 模拟支持安全区域的设备
    Object.defineProperty(window, 'getComputedStyle', {
      value: vi.fn(() => ({
        getPropertyValue: vi.fn((prop: string) => {
          if (prop === 'padding-top') return '44px' // 模拟刘海屏
          return '0px'
        }),
      })),
    })

    wrapper = mount(MobileOptimized)

    expect(wrapper.classes()).toContain('safe-area-enabled')
  })

  it('应该响应屏幕方向变化', async () => {
    wrapper = mount(MobileOptimized)

    // 切换到横屏
    triggerOrientationChange('landscape')
    await nextTick()

    expect(wrapper.classes()).toContain('landscape-mode')

    // 切换回竖屏
    triggerOrientationChange('portrait')
    await nextTick()

    expect(wrapper.classes()).not.toContain('landscape-mode')
  })

  it('应该检测PWA模式', () => {
    // 模拟PWA环境
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(display-mode: standalone)') {
          return { matches: true }
        }
        return { matches: false }
      }),
    })

    wrapper = mount(MobileOptimized)

    expect(wrapper.classes()).toContain('pwa-mode')
  })

  it('应该生成正确的动态样式', () => {
    wrapper = mount(MobileOptimized)

    const style = wrapper.vm.dynamicStyles
    
    expect(style).toHaveProperty('--viewport-width')
    expect(style).toHaveProperty('--viewport-height')
    expect(style).toHaveProperty('--device-pixel-ratio')
  })

  it('应该响应窗口大小变化', async () => {
    wrapper = mount(MobileOptimized)

    const initialWidth = wrapper.vm.viewportWidth

    // 触发窗口大小变化
    triggerResize(800, 600)
    await nextTick()

    expect(wrapper.vm.viewportWidth).toBe(800)
    expect(wrapper.vm.viewportHeight).toBe(600)
  })

  it('应该支持自定义className', () => {
    wrapper = mount(MobileOptimized, {
      props: {
        class: 'custom-class',
      },
    })

    expect(wrapper.classes()).toContain('custom-class')
    expect(wrapper.classes()).toContain('mobile-optimized')
  })

  it('应该传递自定义样式', () => {
    const customStyle = {
      backgroundColor: 'red',
      margin: '10px',
    }

    wrapper = mount(MobileOptimized, {
      props: {
        style: customStyle,
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('background-color: red')
    expect(style).toContain('margin: 10px')
  })

  it('应该在组件销毁时清理事件监听器', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    wrapper = mount(MobileOptimized)
    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })

  it('应该支持减少动画的用户偏好', () => {
    // 模拟用户偏好减少动画
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return { matches: true }
        }
        return { matches: false }
      }),
    })

    wrapper = mount(MobileOptimized)

    expect(wrapper.classes()).toContain('reduced-motion')
  })

  it('应该支持暗色主题检测', () => {
    // 模拟暗色主题偏好
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn((query: string) => {
        if (query === '(prefers-color-scheme: dark)') {
          return { matches: true }
        }
        return { matches: false }
      }),
    })

    wrapper = mount(MobileOptimized)

    expect(wrapper.classes()).toContain('dark-theme')
  })

  it('应该正确处理触摸设备检测', () => {
    // 模拟触摸设备
    Object.defineProperty(window, 'ontouchstart', {
      value: {},
    })

    wrapper = mount(MobileOptimized)

    expect(wrapper.classes()).toContain('touch-device')
  })
})