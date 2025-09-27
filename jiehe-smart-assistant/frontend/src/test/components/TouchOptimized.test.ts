/**
 * TouchOptimized组件测试
 * 测试触摸交互和手势识别功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TouchOptimized from '@/components/TouchOptimized.vue'
import { createMockTouchEvent, mockDeviceInfo, sleep } from '../utils'

describe('TouchOptimized.vue', () => {
  let wrapper: any
  let mockNavigatorVibrate: any

  beforeEach(() => {
    mockDeviceInfo('mobile')
    mockNavigatorVibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: mockNavigatorVibrate,
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  it('应该正确渲染基本结构', () => {
    wrapper = mount(TouchOptimized, {
      props: {
        'haptic-feedback': true,
        'gesture-threshold': 10,
      },
      slots: {
        default: '<div class="test-content">测试内容</div>',
      },
    })

    expect(wrapper.find('.touch-optimized').exists()).toBe(true)
    expect(wrapper.find('.test-content').exists()).toBe(true)
    expect(wrapper.find('.touch-container').exists()).toBe(true)
  })

  it('应该在触摸开始时记录状态', async () => {
    wrapper = mount(TouchOptimized)
    const container = wrapper.find('.touch-container')

    const touchEvent = createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ])

    await container.trigger('touchstart', touchEvent)
    await nextTick()

    // 验证组件内部状态（通过检查类名变化）
    expect(wrapper.vm.touchState.isActive).toBe(true)
  })

  it('应该检测点击手势', async () => {
    const onTap = vi.fn()
    wrapper = mount(TouchOptimized, {
      props: {
        onTap,
      },
    })

    const container = wrapper.find('.touch-container')

    // 模拟快速点击
    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))
    
    await sleep(50) // 短暂停留

    await container.trigger('touchend', createMockTouchEvent('touchend', []))

    expect(onTap).toHaveBeenCalledWith({
      x: 100,
      y: 200,
    })
  })

  it('应该检测长按手势', async () => {
    const onLongPress = vi.fn()
    wrapper = mount(TouchOptimized, {
      props: {
        onLongPress,
        'long-press-duration': 100, // 缩短测试时间
      },
    })

    const container = wrapper.find('.touch-container')

    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))

    await sleep(150) // 等待超过长按时间

    expect(onLongPress).toHaveBeenCalledWith({
      x: 100,
      y: 200,
    })
  })

  it('应该检测滑动手势', async () => {
    const onSwipe = vi.fn()
    wrapper = mount(TouchOptimized, {
      props: {
        onSwipe,
        'gesture-threshold': 50,
      },
    })

    const container = wrapper.find('.touch-container')

    // 开始触摸
    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))

    // 移动
    await container.trigger('touchmove', createMockTouchEvent('touchmove', [
      { clientX: 200, clientY: 200 }
    ]))

    // 结束
    await container.trigger('touchend', createMockTouchEvent('touchend', []))

    expect(onSwipe).toHaveBeenCalledWith({
      direction: 'right',
      distance: 100,
      velocity: expect.any(Number),
    })
  })

  it('应该正确处理多点触摸', async () => {
    const onPinch = vi.fn()
    wrapper = mount(TouchOptimized, {
      props: {
        onPinch,
      },
    })

    const container = wrapper.find('.touch-container')

    // 双指触摸开始
    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200, identifier: 0 },
      { clientX: 200, clientY: 200, identifier: 1 }
    ]))

    // 双指收缩
    await container.trigger('touchmove', createMockTouchEvent('touchmove', [
      { clientX: 120, clientY: 200, identifier: 0 },
      { clientX: 180, clientY: 200, identifier: 1 }
    ]))

    expect(onPinch).toHaveBeenCalledWith({
      scale: expect.any(Number),
      center: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    })
  })

  it('应该在启用时提供触觉反馈', async () => {
    wrapper = mount(TouchOptimized, {
      props: {
        'haptic-feedback': true,
      },
    })

    const container = wrapper.find('.touch-container')

    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))

    // 验证触觉反馈
    expect(mockNavigatorVibrate).toHaveBeenCalledWith([10])
  })

  it('应该支持禁用触觉反馈', async () => {
    wrapper = mount(TouchOptimized, {
      props: {
        'haptic-feedback': false,
      },
    })

    const container = wrapper.find('.touch-container')

    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))

    expect(mockNavigatorVibrate).not.toHaveBeenCalled()
  })

  it('应该防止默认的触摸行为', async () => {
    wrapper = mount(TouchOptimized, {
      props: {
        'prevent-default': true,
      },
    })

    const container = wrapper.find('.touch-container')
    const mockPreventDefault = vi.fn()

    const touchEvent = createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ])
    touchEvent.preventDefault = mockPreventDefault

    await container.element.dispatchEvent(touchEvent)

    expect(mockPreventDefault).toHaveBeenCalled()
  })

  it('应该正确处理手势阈值配置', async () => {
    const onSwipe = vi.fn()
    wrapper = mount(TouchOptimized, {
      props: {
        onSwipe,
        'gesture-threshold': 100, // 设置较高的阈值
      },
    })

    const container = wrapper.find('.touch-container')

    // 小距离移动（低于阈值）
    await container.trigger('touchstart', createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 200 }
    ]))

    await container.trigger('touchmove', createMockTouchEvent('touchmove', [
      { clientX: 150, clientY: 200 }
    ]))

    await container.trigger('touchend', createMockTouchEvent('touchend', []))

    // 不应该触发滑动事件（距离小于阈值）
    expect(onSwipe).not.toHaveBeenCalled()
  })
})