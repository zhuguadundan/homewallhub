<template>
  <div 
    ref="touchContainer"
    class="touch-optimized"
    :class="{ 
      'is-dragging': isDragging,
      'is-swiping': isSwiping,
      'is-long-pressing': isLongPressing
    }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <slot 
      :touch-state="{
        isDragging,
        isSwiping,
        isLongPressing,
        swipeDirection,
        dragDistance,
        touchPosition
      }"
    />
    
    <!-- 长按反馈 -->
    <div 
      v-if="showLongPressEffect && isLongPressing" 
      class="long-press-effect"
      :style="longPressEffectStyle"
    />
    
    <!-- 滑动指示器 -->
    <div v-if="showSwipeIndicator && isSwiping" class="swipe-indicator">
      <van-icon 
        :name="getSwipeIcon()" 
        :style="{ transform: `translateX(${swipeProgress}px)` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

interface TouchPosition {
  x: number
  y: number
}

interface Props {
  // 启用的手势
  enableSwipe?: boolean
  enableDrag?: boolean
  enableLongPress?: boolean
  
  // 手势阈值
  swipeThreshold?: number
  dragThreshold?: number
  longPressDelay?: number
  
  // 视觉反馈
  showLongPressEffect?: boolean
  showSwipeIndicator?: boolean
  hapticFeedback?: boolean
  
  // 防抖设置
  debounceDelay?: number
}

interface Emits {
  (e: 'swipe', direction: 'left' | 'right' | 'up' | 'down', distance: number): void
  (e: 'drag', position: TouchPosition, distance: number): void
  (e: 'longpress', position: TouchPosition): void
  (e: 'tap', position: TouchPosition): void
  (e: 'doubletap', position: TouchPosition): void
}

const props = withDefaults(defineProps<Props>(), {
  enableSwipe: true,
  enableDrag: true,
  enableLongPress: true,
  swipeThreshold: 50,
  dragThreshold: 10,
  longPressDelay: 500,
  showLongPressEffect: true,
  showSwipeIndicator: true,
  hapticFeedback: true,
  debounceDelay: 16
})

const emit = defineEmits<Emits>()

// 响应式状态
const touchContainer = ref<HTMLElement>()
const isDragging = ref(false)
const isSwiping = ref(false)
const isLongPressing = ref(false)

const touchState = reactive({
  startTime: 0,
  startPosition: { x: 0, y: 0 },
  currentPosition: { x: 0, y: 0 },
  lastPosition: { x: 0, y: 0 },
  lastTapTime: 0,
  longPressTimer: null as number | null
})

// 计算属性
const touchPosition = computed((): TouchPosition => touchState.currentPosition)
const dragDistance = computed(() => {
  const dx = touchState.currentPosition.x - touchState.startPosition.x
  const dy = touchState.currentPosition.y - touchState.startPosition.y
  return Math.sqrt(dx * dx + dy * dy)
})

const swipeDirection = computed(() => {
  const dx = touchState.currentPosition.x - touchState.startPosition.x
  const dy = touchState.currentPosition.y - touchState.startPosition.y
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  } else {
    return dy > 0 ? 'down' : 'up'
  }
})

const swipeProgress = computed(() => {
  const dx = touchState.currentPosition.x - touchState.startPosition.x
  return Math.min(Math.abs(dx), 100) * (dx > 0 ? 1 : -1)
})

const longPressEffectStyle = computed(() => ({
  left: `${touchState.startPosition.x - 25}px`,
  top: `${touchState.startPosition.y - 25}px`
}))

// 触摸事件处理
const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  const rect = touchContainer.value!.getBoundingClientRect()
  
  touchState.startTime = Date.now()
  touchState.startPosition = {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  }
  touchState.currentPosition = { ...touchState.startPosition }
  touchState.lastPosition = { ...touchState.startPosition }
  
  // 启动长按检测
  if (props.enableLongPress) {
    touchState.longPressTimer = setTimeout(() => {
      if (!isDragging.value && !isSwiping.value) {
        isLongPressing.value = true
        
        if (props.hapticFeedback && 'vibrate' in navigator) {
          navigator.vibrate(50)
        }
        
        emit('longpress', touchState.startPosition)
      }
    }, props.longPressDelay)
  }
}

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault()
  
  const touch = event.touches[0]
  const rect = touchContainer.value!.getBoundingClientRect()
  
  touchState.currentPosition = {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  }
  
  const distance = dragDistance.value
  
  // 检测拖拽
  if (props.enableDrag && distance > props.dragThreshold) {
    if (!isDragging.value) {
      isDragging.value = true
      clearLongPressTimer()
    }
    
    emit('drag', touchState.currentPosition, distance)
  }
  
  // 检测滑动
  if (props.enableSwipe && distance > props.swipeThreshold) {
    if (!isSwiping.value) {
      isSwiping.value = true
      clearLongPressTimer()
    }
  }
  
  touchState.lastPosition = { ...touchState.currentPosition }
}

const handleTouchEnd = (event: TouchEvent) => {
  const endTime = Date.now()
  const touchDuration = endTime - touchState.startTime
  const distance = dragDistance.value
  
  // 处理滑动
  if (isSwiping.value && distance > props.swipeThreshold) {
    emit('swipe', swipeDirection.value, distance)
    
    if (props.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(30)
    }
  }
  
  // 处理点击
  if (!isDragging.value && !isSwiping.value && !isLongPressing.value && distance < props.dragThreshold) {
    const timeSinceLastTap = endTime - touchState.lastTapTime
    
    if (timeSinceLastTap < 300) {
      // 双击
      emit('doubletap', touchState.startPosition)
    } else {
      // 单击
      setTimeout(() => {
        if (Date.now() - touchState.lastTapTime >= 300) {
          emit('tap', touchState.startPosition)
        }
      }, 300)
    }
    
    touchState.lastTapTime = endTime
  }
  
  resetTouchState()
}

const handleTouchCancel = () => {
  resetTouchState()
}

// 辅助函数
const clearLongPressTimer = () => {
  if (touchState.longPressTimer) {
    clearTimeout(touchState.longPressTimer)
    touchState.longPressTimer = null
  }
}

const resetTouchState = () => {
  isDragging.value = false
  isSwiping.value = false
  isLongPressing.value = false
  clearLongPressTimer()
}

const getSwipeIcon = () => {
  switch (swipeDirection.value) {
    case 'left': return 'arrow-left'
    case 'right': return 'arrow'
    case 'up': return 'arrow-up'
    case 'down': return 'arrow-down'
    default: return 'arrow'
  }
}

// 生命周期
onMounted(() => {
  // 禁用默认的触摸行为
  if (touchContainer.value) {
    touchContainer.value.style.touchAction = 'none'
  }
})

onUnmounted(() => {
  clearLongPressTimer()
})
</script>

<style scoped>
.touch-optimized {
  position: relative;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: transform 0.1s ease-out;
}

.is-dragging {
  z-index: 10;
}

.is-swiping {
  overflow: hidden;
}

.is-long-pressing {
  z-index: 20;
}

.long-press-effect {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(25, 137, 250, 0.2);
  pointer-events: none;
  animation: longPressRipple 0.5s ease-out;
  z-index: 1;
}

.swipe-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--van-primary-color);
  font-size: 24px;
  pointer-events: none;
  z-index: 2;
  transition: all 0.1s ease-out;
}

@keyframes longPressRipple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* 触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .touch-optimized {
    /* 增大触摸目标 */
    min-height: 44px;
    min-width: 44px;
  }
  
  .touch-optimized:active {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

/* 高DPI屏幕优化 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .long-press-effect {
    box-shadow: 0 0 0 1px rgba(25, 137, 250, 0.1);
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .touch-optimized:active {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .long-press-effect {
    background: rgba(255, 255, 255, 0.2);
  }
}

/* 动画减少偏好 */
@media (prefers-reduced-motion: reduce) {
  .touch-optimized,
  .swipe-indicator {
    transition: none;
  }
  
  .long-press-effect {
    animation: none;
  }
}
</style>