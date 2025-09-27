<template>
  <div v-if="showIndicator" class="offline-indicator">
    <!-- 离线状态栏 -->
    <van-notice-bar
      v-if="!isOnline"
      left-icon="warning-o"
      :text="offlineText"
      color="#ee0a24"
      background="#ffeee8"
      :scrollable="false"
    />
    
    <!-- 同步状态栏 -->
    <van-notice-bar
      v-if="syncStatus.show"
      :left-icon="syncStatus.icon"
      :text="syncStatus.text"
      :color="syncStatus.color"
      :background="syncStatus.background"
      :scrollable="false"
    />

    <!-- 离线数据统计浮窗 -->
    <van-floating-bubble
      v-if="showStats && offlineStats.pendingActions > 0"
      :offset="{ x: 'calc(100vw - 80px)', y: '100px' }"
      icon="info-o"
      @click="showStatsPopup = true"
    >
      <template #button>
        <div class="stats-bubble">
          <van-badge :content="offlineStats.pendingActions" />
        </div>
      </template>
    </van-floating-bubble>

    <!-- 统计信息弹窗 -->
    <van-popup 
      v-model:show="showStatsPopup" 
      position="bottom" 
      :style="{ height: '40%' }"
      round
    >
      <div class="stats-popup">
        <div class="popup-header">
          <h3>离线数据统计</h3>
          <van-button 
            size="small" 
            type="primary" 
            @click="syncNow"
            :loading="syncing"
          >
            立即同步
          </van-button>
        </div>
        
        <van-cell-group>
          <van-cell 
            title="待同步操作" 
            :value="offlineStats.pendingActions"
            icon="clock-o"
          />
          <van-cell 
            title="队列中请求" 
            :value="offlineStats.queuedRequests"
            icon="send-gift-o"
          />
          <van-cell 
            title="缓存数据" 
            :value="offlineStats.cachedItems"
            icon="records"
          />
          <van-cell 
            title="失败操作" 
            :value="offlineStats.failedActions"
            icon="warning-o"
          />
        </van-cell-group>

        <div class="popup-actions">
          <van-button 
            block 
            type="danger" 
            plain
            @click="clearOfflineData"
          >
            清空离线数据
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { offlineManager } from '@/utils/offlineManager'

interface Props {
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true
})

// 响应式数据
const isOnline = ref(navigator.onLine)
const showIndicator = ref(true)
const showStatsPopup = ref(false)
const syncing = ref(false)

const offlineStats = reactive({
  pendingActions: 0,
  queuedRequests: 0,
  cachedItems: 0,
  failedActions: 0
})

const syncStatus = reactive({
  show: false,
  icon: 'success',
  text: '',
  color: '#07c160',
  background: '#e8f5e8'
})

// 计算属性
const offlineText = ref('您当前处于离线状态，数据将在恢复网络后自动同步')

let statsUpdateInterval: number | null = null

onMounted(() => {
  setupNetworkListeners()
  updateOfflineStats()
  
  // 定期更新统计信息
  statsUpdateInterval = setInterval(updateOfflineStats, 5000)
})

onUnmounted(() => {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval)
  }
})

/**
 * 设置网络状态监听
 */
const setupNetworkListeners = () => {
  const handleOnline = () => {
    isOnline.value = true
    showSyncStatus('网络已恢复，正在同步数据...', 'loading')
    
    // 自动同步
    setTimeout(async () => {
      try {
        await offlineManager.syncOfflineActions()
        showSyncStatus('数据同步完成', 'success')
        updateOfflineStats()
        
        setTimeout(() => {
          syncStatus.show = false
        }, 3000)
      } catch (error) {
        showSyncStatus('同步失败，请稍后重试', 'warning')
      }
    }, 1000)
  }

  const handleOffline = () => {
    isOnline.value = false
    syncStatus.show = false
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

/**
 * 显示同步状态
 */
const showSyncStatus = (text: string, type: 'success' | 'warning' | 'loading') => {
  syncStatus.show = true
  syncStatus.text = text
  
  switch (type) {
    case 'success':
      syncStatus.icon = 'success'
      syncStatus.color = '#07c160'
      syncStatus.background = '#e8f5e8'
      break
    case 'warning':
      syncStatus.icon = 'warning-o'
      syncStatus.color = '#ee0a24'
      syncStatus.background = '#ffeee8'
      break
    case 'loading':
      syncStatus.icon = 'loading'
      syncStatus.color = '#1989fa'
      syncStatus.background = '#e8f4ff'
      break
  }
}

/**
 * 更新离线统计信息
 */
const updateOfflineStats = async () => {
  try {
    const stats = await offlineManager.getOfflineStats()
    Object.assign(offlineStats, stats)
  } catch (error) {
    console.error('更新离线统计失败:', error)
  }
}

/**
 * 立即同步
 */
const syncNow = async () => {
  if (!isOnline.value) {
    showToast('请检查网络连接')
    return
  }

  syncing.value = true
  
  try {
    await offlineManager.syncOfflineActions()
    showToast('同步完成')
    updateOfflineStats()
  } catch (error) {
    showToast('同步失败')
  } finally {
    syncing.value = false
  }
}

/**
 * 清空离线数据
 */
const clearOfflineData = async () => {
  const confirmed = await showConfirmDialog({
    title: '确认清空',
    message: '确定要清空所有离线数据吗？此操作无法撤销。',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).catch(() => false)

  if (confirmed) {
    try {
      await offlineManager.clearAllOfflineData()
      showToast('离线数据已清空')
      updateOfflineStats()
      showStatsPopup.value = false
    } catch (error) {
      showToast('清空失败')
    }
  }
}
</script>

<style scoped>
.offline-indicator {
  position: relative;
  z-index: 1000;
}

.stats-bubble {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  color: white;
}

.stats-popup {
  padding: 16px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.popup-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.popup-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebedf0;
}

/* 动画效果 */
.van-notice-bar {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>