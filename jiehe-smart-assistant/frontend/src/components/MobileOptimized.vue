<template>
  <div 
    class="mobile-optimized"
    :class="[deviceClass, {
      'safe-area-enabled': hasSafeArea,
      'landscape-mode': isLandscape,
      'pwa-mode': isPWA
    }]"
    :style="dynamicStyles"
  >
    <!-- 状态栏占位符 (iOS) -->
    <div v-if="needsStatusBarPadding" class="status-bar-placeholder" />
    
    <!-- 主内容区域 -->
    <div class="content-area" :style="contentAreaStyles">
      <slot />
    </div>
    
    <!-- 底部安全区域占位符 -->
    <div v-if="needsBottomPadding" class="bottom-safe-area" />
    
    <!-- 移动端快捷操作浮层 -->
    <van-floating-panel
      v-if="showFloatingPanelLocal && isSmallScreen"
      v-model:height="panelHeight"
      :anchors="[100, Math.round(0.4 * viewportHeight), Math.round(0.7 * viewportHeight)]"
      :content-draggable="false"
    >
      <div class="floating-panel-content">
        <div class="panel-header">
          <h4>快捷操作</h4>
          <van-button size="mini" @click="showFloatingPanelLocal = false">
            <van-icon name="cross" />
          </van-button>
        </div>
        
        <van-grid :column-num="3" :border="false">
          <van-grid-item
            v-for="action in quickActions"
            :key="action.id"
            :icon="action.icon"
            :text="action.text"
            @click="handleQuickAction(action)"
          />
        </van-grid>
      </div>
    </van-floating-panel>
    
    <!-- 手势提示层 -->
    <div v-if="showGestureHints" class="gesture-hints">
      <div class="hint-item" v-for="hint in activeHints" :key="hint.id">
        <van-icon :name="hint.icon" />
        <span>{{ hint.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDeviceAdaptation } from '@/composables/useDeviceAdaptation'
import { useRouter } from 'vue-router'

interface QuickAction {
  id: string
  icon: string
  text: string
  route?: string
  action?: () => void
}

interface Props {
  showFloatingPanel?: boolean
  enableGestureHints?: boolean
  quickActions?: QuickAction[]
}

const props = withDefaults(defineProps<Props>(), {
  showFloatingPanel: true,
  enableGestureHints: true,
  quickActions: () => [
    { id: 'tasks', icon: 'todo-list-o', text: '任务', route: '/tasks' },
    { id: 'inventory', icon: 'bag-o', text: '库存', route: '/inventory' },
    { id: 'ai', icon: 'manager-o', text: 'AI助手', route: '/ai' },
    { id: 'family', icon: 'friends-o', text: '家庭', route: '/family' },
    { id: 'calendar', icon: 'calendar-o', text: '日历', route: '/calendar' },
    { id: 'analytics', icon: 'chart-trending-o', text: '分析', route: '/analytics' }
  ]
})

const router = useRouter()
const { 
  deviceInfo, 
  viewportInfo, 
  deviceClass, 
  isSmallScreen,
  breakpoint 
} = useDeviceAdaptation()

// 响应式状态
const panelHeight = ref(100)
const showGestureHints = ref(false)
const showFloatingPanelLocal = ref<boolean>(props.showFloatingPanel)

watch(() => props.showFloatingPanel, (val) => {
  showFloatingPanelLocal.value = val
})

// 计算属性
const hasSafeArea = computed(() => 
  viewportInfo.safeAreaTop > 0 || 
  viewportInfo.safeAreaBottom > 0 ||
  viewportInfo.safeAreaLeft > 0 || 
  viewportInfo.safeAreaRight > 0
)

const needsStatusBarPadding = computed(() => 
  deviceInfo.isIOS && deviceInfo.isPWA && viewportInfo.safeAreaTop > 0
)

const needsBottomPadding = computed(() => 
  deviceInfo.isIOS && viewportInfo.safeAreaBottom > 0
)

const isLandscape = computed(() => deviceInfo.orientation === 'landscape')
const isPWA = computed(() => deviceInfo.isPWA)
const viewportHeight = computed(() => viewportInfo.height)

const dynamicStyles = computed(() => ({
  '--safe-area-top': `${viewportInfo.safeAreaTop}px`,
  '--safe-area-bottom': `${viewportInfo.safeAreaBottom}px`,
  '--safe-area-left': `${viewportInfo.safeAreaLeft}px`,
  '--safe-area-right': `${viewportInfo.safeAreaRight}px`,
  '--viewport-height': `${viewportInfo.height}px`,
  '--viewport-width': `${viewportInfo.width}px`
}))

const contentAreaStyles = computed(() => {
  const styles: any = {}
  
  // 安全区域适配
  if (hasSafeArea.value) {
    styles.paddingTop = `max(var(--safe-area-top), 0px)`
    styles.paddingBottom = `max(var(--safe-area-bottom), 0px)`
    styles.paddingLeft = `max(var(--safe-area-left), 0px)`
    styles.paddingRight = `max(var(--safe-area-right), 0px)`
  }
  
  // 横屏模式调整
  if (isLandscape.value && isSmallScreen.value) {
    styles.paddingTop = `max(${styles.paddingTop || '0px'}, 10px)`
    styles.paddingBottom = `max(${styles.paddingBottom || '0px'}, 10px)`
  }
  
  return styles
})

const activeHints = computed(() => {
  const hints = []
  
  if (deviceInfo.hasTouch && isSmallScreen.value) {
    hints.push(
      { id: 'swipe', icon: 'replay', text: '左右滑动切换' },
      { id: 'longpress', icon: 'pause-circle', text: '长按显示菜单' }
    )
  }
  
  if (deviceInfo.orientation === 'landscape') {
    hints.push(
      { id: 'rotate', icon: 'replay', text: '旋转设备获得更好体验' }
    )
  }
  
  return hints
})

// 方法
const handleQuickAction = (action: QuickAction) => {
  if (action.route) {
    router.push(action.route)
  } else if (action.action) {
    action.action()
  }
}

// 监听器
watch(
  () => deviceInfo.orientation,
  (newOrientation) => {
    // 方向改变时的处理
    if (newOrientation === 'landscape' && isSmallScreen.value) {
      // 横屏时隐藏浮动面板
      panelHeight.value = 100
    }
  }
)

watch(
  () => deviceInfo.hasTouch,
  (hasTouch) => {
    // 首次检测到触摸时显示手势提示
    if (hasTouch && props.enableGestureHints) {
      showGestureHints.value = true
      setTimeout(() => {
        showGestureHints.value = false
      }, 5000)
    }
  }
)

onMounted(() => {
  // 首次加载时的优化提示
  if (isSmallScreen.value && props.enableGestureHints) {
    setTimeout(() => {
      showGestureHints.value = true
      setTimeout(() => {
        showGestureHints.value = false
      }, 3000)
    }, 2000)
  }
})
</script>

<style scoped>
.mobile-optimized {
  min-height: 100vh;
  min-height: var(--viewport-height, 100vh);
  position: relative;
  overflow-x: hidden;
}

.safe-area-enabled {
  /* 安全区域支持 */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.status-bar-placeholder {
  height: var(--safe-area-top);
  background: var(--van-nav-bar-background);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.content-area {
  position: relative;
  min-height: 100%;
  transition: all 0.3s ease;
}

.bottom-safe-area {
  height: var(--safe-area-bottom);
  background: var(--van-tabbar-background);
}

.floating-panel-content {
  padding: 16px;
  background: white;
  border-radius: 16px 16px 0 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.panel-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.gesture-hints {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 20px;
  z-index: 1001;
  animation: fadeInUp 0.3s ease-out;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin: 4px 0;
}

/* 横屏模式优化 */
.landscape-mode {
  .content-area {
    padding-left: max(var(--safe-area-left), 16px);
    padding-right: max(var(--safe-area-right), 16px);
  }
  
  .floating-panel-content {
    padding: 12px;
  }
  
  .gesture-hints {
    bottom: 60px;
  }
}

/* PWA模式优化 */
.pwa-mode {
  .content-area {
    padding-top: max(var(--safe-area-top), 0px);
  }
}

/* 设备特定优化 */
.device-mobile {
  font-size: 14px;
  
  .floating-panel-content {
    padding: 12px;
  }
}

.device-tablet {
  .floating-panel-content {
    padding: 20px;
    max-width: 400px;
    margin: 0 auto;
  }
}

/* 操作系统特定优化 */
.os-ios {
  .content-area {
    /* iOS特定的弹性滚动 */
    -webkit-overflow-scrolling: touch;
  }
}

.os-android {
  .gesture-hints {
    /* Android特定的材料设计风格 */
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  }
}

/* 触摸优化 */
.has-touch {
  .panel-header button,
  .hint-item {
    min-height: 44px;
    min-width: 44px;
  }
}

/* 暗色模式 */
.dark-mode {
  .floating-panel-content {
    background: #1e1e1e;
    color: white;
  }
  
  .panel-header {
    border-bottom-color: #333;
  }
}

/* 动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* 减少动画偏好 */
.reduced-motion {
  .content-area,
  .gesture-hints {
    transition: none;
    animation: none;
  }
}

/* 断点特定样式 */
.breakpoint-xs {
  font-size: 12px;
}

.breakpoint-sm {
  font-size: 14px;
}

.breakpoint-md {
  font-size: 16px;
}

.breakpoint-lg {
  font-size: 18px;
}
</style>