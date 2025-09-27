/**
 * useGestures手势识别功能测试
 * 测试多点触摸手势识别能力
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useGestures } from '@/composables/useGestures'
import { createMockTouchEvent, sleep } from '../utils'

describe('useGestures', () => {
  let mockElement: HTMLElement
  let targetRef: any

  beforeEach(() => {
    // 创建模拟DOM元素
    mockElement = document.createElement('div')
    document.body.appendChild(mockElement)
    targetRef = ref(mockElement)
    
    // 设置元素尺寸
    Object.defineProperty(mockElement, 'getBoundingClientRect', {
      value: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 300,
        height: 300,
        right: 300,
        bottom: 300,
      })),
    })
  })

  afterEach(() => {
    if (mockElement.parentNode) {
      mockElement.parentNode.removeChild(mockElement)
    }
    vi.clearAllMocks()
  })

  it('应该正确初始化手势识别', () => {
    const callbacks = {
      onTap: vi.fn(),
      onLongPress: vi.fn(),
      onPinch: vi.fn(),
      onRotate: vi.fn(),
      onPan: vi.fn(),
    }

    const gestures = useGestures(targetRef, {}, callbacks)

    expect(gestures.isGestureActive.value).toBe(false)
    expect(gestures.currentGesture.value).toBe('none')
  })

  it('应该检测单击手势', async () => {
    const onTap = vi.fn()
    const gestures = useGestures(targetRef, { tapThreshold: 50 }, { onTap })

    // 模拟快速点击
    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 150, clientY: 150 }
    ])
    mockElement.dispatchEvent(touchStart)

    await sleep(50)

    const touchEnd = createMockTouchEvent('touchend', [])
    mockElement.dispatchEvent(touchEnd)

    expect(onTap).toHaveBeenCalledWith({
      x: 150,
      y: 150,
      target: mockElement,
    })
  })

  it('应该检测长按手势', async () => {
    const onLongPress = vi.fn()
    const gestures = useGestures(targetRef, { longPressDelay: 100 }, { onLongPress })

    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 150, clientY: 150 }
    ])
    mockElement.dispatchEvent(touchStart)

    // 等待超过长按延迟时间
    await sleep(150)

    expect(onLongPress).toHaveBeenCalledWith({
      x: 150,
      y: 150,
      target: mockElement,
    })
    expect(gestures.currentGesture.value).toBe('longpress')
  })

  it('应该检测缩放手势', async () => {
    const onPinch = vi.fn()
    const gestures = useGestures(targetRef, {}, { onPinch })

    // 双指触摸开始
    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 150, identifier: 0 },
      { clientX: 200, clientY: 150, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchStart)

    await nextTick()

    // 双指收缩
    const touchMove = createMockTouchEvent('touchmove', [
      { clientX: 120, clientY: 150, identifier: 0 },
      { clientX: 180, clientY: 150, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchMove)

    expect(onPinch).toHaveBeenCalledWith({
      scale: expect.any(Number),
      center: { x: 150, y: 150 },
      delta: expect.any(Number),
    })
    expect(gestures.currentGesture.value).toBe('pinch')
  })

  it('应该检测旋转手势', async () => {
    const onRotate = vi.fn()
    const gestures = useGestures(targetRef, {}, { onRotate })

    // 双指触摸开始
    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 150, clientY: 100, identifier: 0 },
      { clientX: 150, clientY: 200, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchStart)

    await nextTick()

    // 旋转手势
    const touchMove = createMockTouchEvent('touchmove', [
      { clientX: 200, clientY: 150, identifier: 0 },
      { clientX: 100, clientY: 150, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchMove)

    expect(onRotate).toHaveBeenCalledWith({
      rotation: expect.any(Number),
      center: { x: 150, y: 150 },
      delta: expect.any(Number),
    })
    expect(gestures.currentGesture.value).toBe('rotate')
  })

  it('应该检测平移手势', async () => {
    const onPan = vi.fn()
    const gestures = useGestures(targetRef, { panThreshold: 10 }, { onPan })

    // 单指开始
    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 }
    ])
    mockElement.dispatchEvent(touchStart)

    await nextTick()

    // 移动超过阈值
    const touchMove = createMockTouchEvent('touchmove', [
      { clientX: 120, clientY: 110 }
    ])
    mockElement.dispatchEvent(touchMove)

    expect(onPan).toHaveBeenCalledWith({
      deltaX: 20,
      deltaY: 10,
      velocityX: expect.any(Number),
      velocityY: expect.any(Number),
      center: { x: 120, y: 110 },
    })
    expect(gestures.currentGesture.value).toBe('pan')
  })

  it('应该正确处理手势结束', async () => {
    const onTap = vi.fn()
    const gestures = useGestures(targetRef, {}, { onTap })

    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 150, clientY: 150 }
    ])
    mockElement.dispatchEvent(touchStart)

    expect(gestures.isGestureActive.value).toBe(true)

    const touchEnd = createMockTouchEvent('touchend', [])
    mockElement.dispatchEvent(touchEnd)

    await nextTick()

    expect(gestures.isGestureActive.value).toBe(false)
    expect(gestures.currentGesture.value).toBe('none')
  })

  it('应该支持阻止默认行为', () => {
    const gestures = useGestures(targetRef, { preventDefault: true })

    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 150, clientY: 150 }
    ])
    const preventDefaultSpy = vi.spyOn(touchStart, 'preventDefault')

    mockElement.dispatchEvent(touchStart)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('应该正确计算手势中心点', async () => {
    const onPinch = vi.fn()
    const gestures = useGestures(targetRef, {}, { onPinch })

    // 非对称双指触摸
    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 50, clientY: 100, identifier: 0 },
      { clientX: 250, clientY: 200, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchStart)

    await nextTick()

    const touchMove = createMockTouchEvent('touchmove', [
      { clientX: 60, clientY: 110, identifier: 0 },
      { clientX: 240, clientY: 190, identifier: 1 }
    ])
    mockElement.dispatchEvent(touchMove)

    expect(onPinch).toHaveBeenCalledWith({
      scale: expect.any(Number),
      center: { x: 150, y: 150 }, // 两点中心
      delta: expect.any(Number),
    })
  })

  it('应该支持自定义阈值配置', async () => {
    const onPan = vi.fn()
    const gestures = useGestures(targetRef, { panThreshold: 50 }, { onPan })

    const touchStart = createMockTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 }
    ])
    mockElement.dispatchEvent(touchStart)

    // 移动距离小于阈值
    const touchMove1 = createMockTouchEvent('touchmove', [
      { clientX: 130, clientY: 120 }
    ])
    mockElement.dispatchEvent(touchMove1)

    expect(onPan).not.toHaveBeenCalled()

    // 移动距离超过阈值
    const touchMove2 = createMockTouchEvent('touchmove', [
      { clientX: 160, clientY: 140 }
    ])
    mockElement.dispatchEvent(touchMove2)

    expect(onPan).toHaveBeenCalled()
  })

  it('应该在组件卸载时清理事件监听器', () => {
    const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener')
    
    const gestures = useGestures(targetRef)
    
    // 模拟组件卸载
    gestures.cleanup()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function))
  })
})