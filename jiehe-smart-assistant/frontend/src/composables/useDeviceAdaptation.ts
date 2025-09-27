/**
 * 设备自适应组合式函数
 * 检测设备类型、屏幕尺寸、系统特性等并提供适配方案
 */

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

interface DeviceInfo {
  // 设备类型
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isPWA: boolean
  
  // 操作系统
  isIOS: boolean
  isAndroid: boolean
  isWindows: boolean
  isMacOS: boolean
  
  // 浏览器
  isSafari: boolean
  isChrome: boolean
  isFirefox: boolean
  isEdge: boolean
  
  // 屏幕特性
  screenWidth: number
  screenHeight: number
  pixelRatio: number
  orientation: 'portrait' | 'landscape'
  
  // 网络和性能
  connectionType: string
  isOnline: boolean
  isSlow: boolean
  
  // 交互特性
  hasTouch: boolean
  hasHover: boolean
  prefersReducedMotion: boolean
  prefersDarkMode: boolean
}

interface ViewportInfo {
  width: number
  height: number
  safeAreaTop: number
  safeAreaBottom: number
  safeAreaLeft: number
  safeAreaRight: number
}

export function useDeviceAdaptation() {
  const deviceInfo = reactive<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isPWA: false,
    
    isIOS: false,
    isAndroid: false,
    isWindows: false,
    isMacOS: false,
    
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isEdge: false,
    
    screenWidth: 0,
    screenHeight: 0,
    pixelRatio: 1,
    orientation: 'portrait',
    
    connectionType: 'unknown',
    isOnline: true,
    isSlow: false,
    
    hasTouch: false,
    hasHover: false,
    prefersReducedMotion: false,
    prefersDarkMode: false
  })

  const viewportInfo = reactive<ViewportInfo>({
    width: 0,
    height: 0,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    safeAreaLeft: 0,
    safeAreaRight: 0
  })

  // 检测设备类型
  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    const width = window.innerWidth
    
    // 移动设备检测
    deviceInfo.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || width < 768
    
    // 平板检测
    deviceInfo.isTablet = (/ipad/i.test(userAgent) || (width >= 768 && width < 1024)) && !deviceInfo.isMobile
    
    // 桌面检测
    deviceInfo.isDesktop = !deviceInfo.isMobile && !deviceInfo.isTablet
    
    // PWA检测
    deviceInfo.isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true
  }

  // 检测操作系统
  const detectOS = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    
    deviceInfo.isIOS = /iphone|ipad|ipod/.test(userAgent) || /iphone|ipad|ipod/.test(platform)
    deviceInfo.isAndroid = /android/.test(userAgent)
    deviceInfo.isWindows = /win/.test(platform)
    deviceInfo.isMacOS = /mac/.test(platform) && !deviceInfo.isIOS
  }

  // 检测浏览器
  const detectBrowser = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    
    deviceInfo.isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)
    deviceInfo.isChrome = /chrome/.test(userAgent) && !/edge/.test(userAgent)
    deviceInfo.isFirefox = /firefox/.test(userAgent)
    deviceInfo.isEdge = /edge/.test(userAgent)
  }

  // 检测屏幕特性
  const detectScreenFeatures = () => {
    deviceInfo.screenWidth = window.screen.width
    deviceInfo.screenHeight = window.screen.height
    deviceInfo.pixelRatio = window.devicePixelRatio || 1
    
    updateOrientation()
  }

  // 更新屏幕方向
  const updateOrientation = () => {
    deviceInfo.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  }

  // 检测网络和性能
  const detectNetworkAndPerformance = () => {
    deviceInfo.isOnline = navigator.onLine
    
    // 网络连接类型
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      deviceInfo.connectionType = connection.effectiveType || connection.type || 'unknown'
      deviceInfo.isSlow = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
    }
  }

  // 检测交互特性
  const detectInteractionFeatures = () => {
    deviceInfo.hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    deviceInfo.hasHover = window.matchMedia('(hover: hover)').matches
    deviceInfo.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    deviceInfo.prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // 更新视口信息
  const updateViewportInfo = () => {
    viewportInfo.width = window.innerWidth
    viewportInfo.height = window.innerHeight
    
    // 安全区域检测
    if (CSS.supports('padding-top: env(safe-area-inset-top)')) {
      const computedStyle = getComputedStyle(document.documentElement)
      viewportInfo.safeAreaTop = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0
      viewportInfo.safeAreaBottom = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0
      viewportInfo.safeAreaLeft = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0
      viewportInfo.safeAreaRight = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0
    }
  }

  // 初始化检测
  const initializeDetection = () => {
    detectDeviceType()
    detectOS()
    detectBrowser()
    detectScreenFeatures()
    detectNetworkAndPerformance()
    detectInteractionFeatures()
    updateViewportInfo()
  }

  // 事件监听器
  const handleResize = () => {
    detectDeviceType()
    updateOrientation()
    updateViewportInfo()
  }

  const handleOrientationChange = () => {
    setTimeout(() => {
      updateOrientation()
      updateViewportInfo()
    }, 100) // 延迟确保方向变化完成
  }

  const handleOnlineStatusChange = () => {
    deviceInfo.isOnline = navigator.onLine
  }

  // 计算属性
  const breakpoint = computed(() => {
    const width = viewportInfo.width
    if (width < 375) return 'xs'
    if (width < 768) return 'sm'
    if (width < 1024) return 'md'
    if (width < 1200) return 'lg'
    if (width < 1600) return 'xl'
    return 'xxl'
  })

  const deviceClass = computed(() => {
    const classes = []
    
    if (deviceInfo.isMobile) classes.push('device-mobile')
    if (deviceInfo.isTablet) classes.push('device-tablet')
    if (deviceInfo.isDesktop) classes.push('device-desktop')
    if (deviceInfo.isPWA) classes.push('device-pwa')
    
    if (deviceInfo.isIOS) classes.push('os-ios')
    if (deviceInfo.isAndroid) classes.push('os-android')
    
    if (deviceInfo.hasTouch) classes.push('has-touch')
    if (deviceInfo.hasHover) classes.push('has-hover')
    
    classes.push(`breakpoint-${breakpoint.value}`)
    classes.push(`orientation-${deviceInfo.orientation}`)
    
    if (deviceInfo.prefersReducedMotion) classes.push('reduced-motion')
    if (deviceInfo.prefersDarkMode) classes.push('dark-mode')
    
    return classes.join(' ')
  })

  const isSmallScreen = computed(() => breakpoint.value === 'xs' || breakpoint.value === 'sm')
  const isMediumScreen = computed(() => breakpoint.value === 'md')
  const isLargeScreen = computed(() => ['lg', 'xl', 'xxl'].includes(breakpoint.value))

  // 获取优化建议
  const getOptimizationSuggestions = () => {
    const suggestions = []
    
    if (deviceInfo.isSlow) {
      suggestions.push('启用图片懒加载')
      suggestions.push('减少动画效果')
      suggestions.push('优化字体加载')
    }
    
    if (deviceInfo.pixelRatio > 2) {
      suggestions.push('使用高清图片')
    }
    
    if (!deviceInfo.hasHover) {
      suggestions.push('优化触摸交互')
      suggestions.push('增大点击目标')
    }
    
    if (deviceInfo.prefersReducedMotion) {
      suggestions.push('禁用动画')
    }
    
    return suggestions
  }

  // 生命周期
  onMounted(() => {
    initializeDetection()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    window.addEventListener('online', handleOnlineStatusChange)
    window.addEventListener('offline', handleOnlineStatusChange)
    
    // 监听媒体查询变化
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      deviceInfo.prefersDarkMode = e.matches
    }
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      deviceInfo.prefersReducedMotion = e.matches
    }
    
    darkModeQuery.addEventListener('change', handleDarkModeChange)
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
    
    // 监听网络变化
    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', detectNetworkAndPerformance)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleOrientationChange)
    window.removeEventListener('online', handleOnlineStatusChange)
    window.removeEventListener('offline', handleOnlineStatusChange)
  })

  return {
    deviceInfo: readonly(deviceInfo),
    viewportInfo: readonly(viewportInfo),
    breakpoint,
    deviceClass,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    getOptimizationSuggestions,
    updateViewportInfo
  }
}

// 只读包装函数
function readonly<T extends object>(obj: T): Readonly<T> {
  return new Proxy(obj, {
    set() {
      console.warn('Device info is readonly')
      return false
    }
  }) as Readonly<T>
}