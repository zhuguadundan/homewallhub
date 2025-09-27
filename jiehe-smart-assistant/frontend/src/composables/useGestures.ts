/**
 * 手势操作组合式函数
 * 提供缩放、旋转、多点触控等高级手势支持
 */

import { ref, reactive, onMounted, onUnmounted, type Ref } from 'vue'

interface GestureState {
  scale: number
  rotation: number
  center: { x: number; y: number }
  isGesturing: boolean
  touchCount: number
}

interface GestureOptions {
  enablePinch?: boolean
  enableRotation?: boolean
  enablePan?: boolean
  minScale?: number
  maxScale?: number
  scaleSensitivity?: number
  rotationSensitivity?: number
}

interface GestureCallbacks {
  onPinchStart?: (scale: number) => void
  onPinch?: (scale: number, delta: number) => void
  onPinchEnd?: (scale: number) => void
  onRotationStart?: (rotation: number) => void
  onRotation?: (rotation: number, delta: number) => void
  onRotationEnd?: (rotation: number) => void
  onPanStart?: (center: { x: number; y: number }) => void
  onPan?: (center: { x: number; y: number }, delta: { x: number; y: number }) => void
  onPanEnd?: (center: { x: number; y: number }) => void
}

export function useGestures(
  target: Ref<HTMLElement | undefined>,
  options: GestureOptions = {},
  callbacks: GestureCallbacks = {}
) {
  const {
    enablePinch = true,
    enableRotation = true,
    enablePan = true,
    minScale = 0.5,
    maxScale = 5,
    scaleSensitivity = 1,
    rotationSensitivity = 1
  } = options

  const gestureState = reactive<GestureState>({
    scale: 1,
    rotation: 0,
    center: { x: 0, y: 0 },
    isGesturing: false,
    touchCount: 0
  })

  const lastGestureState = reactive({
    scale: 1,
    rotation: 0,
    center: { x: 0, y: 0 },
    distance: 0,
    angle: 0
  })

  // 计算两点间距离
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 计算两点间角度
  const getAngle = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.atan2(dy, dx) * 180 / Math.PI
  }

  // 计算两点中心
  const getCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
    const rect = target.value?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    return {
      x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
      y: (touch1.clientY + touch2.clientY) / 2 - rect.top
    }
  }

  // 触摸开始
  const handleTouchStart = (event: TouchEvent) => {
    event.preventDefault()
    
    gestureState.touchCount = event.touches.length
    gestureState.isGesturing = event.touches.length >= 2

    if (event.touches.length === 2) {
      const [touch1, touch2] = event.touches
      
      lastGestureState.distance = getDistance(touch1, touch2)
      lastGestureState.angle = getAngle(touch1, touch2)
      lastGestureState.center = getCenter(touch1, touch2)
      lastGestureState.scale = gestureState.scale
      lastGestureState.rotation = gestureState.rotation

      gestureState.center = lastGestureState.center

      if (enablePinch) {
        callbacks.onPinchStart?.(gestureState.scale)
      }
      if (enableRotation) {
        callbacks.onRotationStart?.(gestureState.rotation)
      }
      if (enablePan) {
        callbacks.onPanStart?.(gestureState.center)
      }
    }
  }

  // 触摸移动
  const handleTouchMove = (event: TouchEvent) => {
    event.preventDefault()

    if (event.touches.length === 2 && gestureState.isGesturing) {
      const [touch1, touch2] = event.touches
      
      const currentDistance = getDistance(touch1, touch2)
      const currentAngle = getAngle(touch1, touch2)
      const currentCenter = getCenter(touch1, touch2)

      // 缩放处理
      if (enablePinch && lastGestureState.distance > 0) {
        const scaleChange = (currentDistance / lastGestureState.distance) * scaleSensitivity
        const newScale = Math.max(minScale, Math.min(maxScale, lastGestureState.scale * scaleChange))
        const scaleDelta = newScale - gestureState.scale
        
        gestureState.scale = newScale
        callbacks.onPinch?.(newScale, scaleDelta)
      }

      // 旋转处理
      if (enableRotation) {
        let angleDelta = (currentAngle - lastGestureState.angle) * rotationSensitivity
        
        // 处理角度跨越 -180/180 边界
        if (angleDelta > 180) angleDelta -= 360
        if (angleDelta < -180) angleDelta += 360
        
        const newRotation = lastGestureState.rotation + angleDelta
        const rotationDelta = newRotation - gestureState.rotation
        
        gestureState.rotation = newRotation
        callbacks.onRotation?.(newRotation, rotationDelta)
      }

      // 平移处理
      if (enablePan) {
        const panDelta = {
          x: currentCenter.x - lastGestureState.center.x,
          y: currentCenter.y - lastGestureState.center.y
        }
        
        gestureState.center = currentCenter
        callbacks.onPan?.(currentCenter, panDelta)
      }
    }
  }

  // 触摸结束
  const handleTouchEnd = (event: TouchEvent) => {
    gestureState.touchCount = event.touches.length

    if (event.touches.length < 2 && gestureState.isGesturing) {
      gestureState.isGesturing = false

      if (enablePinch) {
        callbacks.onPinchEnd?.(gestureState.scale)
      }
      if (enableRotation) {
        callbacks.onRotationEnd?.(gestureState.rotation)
      }
      if (enablePan) {
        callbacks.onPanEnd?.(gestureState.center)
      }
    }
  }

  // 重置手势状态
  const resetGestures = () => {
    gestureState.scale = 1
    gestureState.rotation = 0
    gestureState.center = { x: 0, y: 0 }
    gestureState.isGesturing = false
    gestureState.touchCount = 0
  }

  // 获取变换矩阵
  const getTransform = () => {
    return `translate(${gestureState.center.x}px, ${gestureState.center.y}px) scale(${gestureState.scale}) rotate(${gestureState.rotation}deg)`
  }

  // 获取变换样式对象
  const getTransformStyle = () => ({
    transform: getTransform(),
    transformOrigin: 'center'
  })

  // 生命周期管理
  onMounted(() => {
    if (!target.value) return

    const element = target.value
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    // 禁用默认的触摸行为
    element.style.touchAction = 'none'
  })

  onUnmounted(() => {
    if (!target.value) return

    const element = target.value
    
    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchmove', handleTouchMove)
    element.removeEventListener('touchend', handleTouchEnd)
    element.removeEventListener('touchcancel', handleTouchEnd)
  })

  return {
    gestureState: readonly(gestureState),
    resetGestures,
    getTransform,
    getTransformStyle
  }
}

// 只读状态包装
function readonly<T extends object>(obj: T): Readonly<T> {
  return new Proxy(obj, {
    set() {
      console.warn('Gesture state is readonly')
      return false
    },
    defineProperty() {
      console.warn('Gesture state is readonly')
      return false
    },
    deleteProperty() {
      console.warn('Gesture state is readonly')
      return false
    }
  }) as Readonly<T>
}