<template>
  <div class="ai-assistant">
    <van-nav-bar title="智能助手" left-arrow @click-left="$router.go(-1)">
      <template #right>
        <van-icon name="setting-o" @click="showSettings = true" />
      </template>
    </van-nav-bar>

    <!-- AI服务状态 -->
    <div class="status-section">
      <van-cell-group>
        <van-cell 
          title="AI服务状态" 
          :value="serviceStatus.enabled ? '正常' : '未启用'"
          :label="serviceStatus.enabled ? `今日剩余预算: ¥${budgetInfo.dailyRemaining.toFixed(2)}` : 'AI功能需要配置才能使用'"
        >
          <template #icon>
            <van-icon 
              :name="serviceStatus.enabled ? 'success' : 'warning-o'" 
              :color="serviceStatus.enabled ? '#07c160' : '#ff976a'" 
            />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-actions">
      <div class="section-title">智能推荐</div>
      <van-grid :column-num="2" :border="false">
        <van-grid-item 
          v-for="action in quickActions" 
          :key="action.id"
          :icon="action.icon"
          :text="action.title"
          :to="action.route"
          @click="handleQuickAction(action)"
        />
      </van-grid>
    </div>

    <!-- 最近推荐 -->
    <div class="recent-recommendations" v-if="recentRecommendations.length > 0">
      <div class="section-title">
        最近推荐
        <van-button 
          type="primary" 
          size="mini" 
          plain 
          @click="loadRecentRecommendations"
          :loading="loadingRecent"
        >
          刷新
        </van-button>
      </div>
      
      <van-card
        v-for="recommendation in recentRecommendations"
        :key="recommendation.id"
        :title="recommendation.title"
        :desc="recommendation.summary"
        :thumb="recommendation.icon"
        @click="viewRecommendation(recommendation)"
      >
        <template #tags>
          <van-tag 
            :type="getRecommendationType(recommendation.type)"
            size="mini"
          >
            {{ getRecommendationTypeName(recommendation.type) }}
          </van-tag>
        </template>
        <template #footer>
          <van-button size="mini" @click="useRecommendation(recommendation)">
            采用建议
          </van-button>
          <van-button size="mini" plain @click="shareRecommendation(recommendation)">
            分享
          </van-button>
        </template>
      </van-card>
    </div>

    <!-- 使用统计 -->
    <div class="usage-stats" v-if="serviceStatus.enabled">
      <div class="section-title">使用统计</div>
      <van-grid :column-num="3" :border="false">
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">{{ usageStats.requestCount }}</div>
            <div class="stat-label">本月请求</div>
          </div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">¥{{ usageStats.totalCost.toFixed(2) }}</div>
            <div class="stat-label">本月花费</div>
          </div>
        </van-grid-item>
        <van-grid-item>
          <div class="stat-item">
            <div class="stat-number">{{ usageStats.cacheHitRate }}%</div>
            <div class="stat-label">缓存命中率</div>
          </div>
        </van-grid-item>
      </van-grid>
    </div>

    <!-- AI聊天入口 -->
    <div class="chat-section">
      <van-cell-group>
        <van-cell 
          title="AI智能问答" 
          label="与AI助手对话，获得个性化建议"
          is-link
          @click="openChat"
        >
          <template #icon>
            <van-icon name="chat-o" color="#1989fa" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 设置弹窗 -->
    <van-popup v-model:show="showSettings" position="bottom">
      <div class="settings-panel">
        <div class="settings-header">
          <span>AI助手设置</span>
          <van-icon name="cross" @click="showSettings = false" />
        </div>
        
        <div class="settings-content">
          <van-cell-group>
            <van-cell title="预算设置" is-link @click="showBudgetSettings = true" />
            <van-cell title="推荐偏好" is-link @click="showPreferences = true" />
            <van-cell title="缓存管理" is-link @click="showCacheSettings = true" />
            <van-cell title="使用帮助" is-link @click="showHelp = true" />
          </van-cell-group>
        </div>
      </div>
    </van-popup>

    <!-- 预算设置 -->
    <van-popup v-model:show="showBudgetSettings" position="bottom">
      <div class="budget-settings">
        <div class="settings-header">
          <span>预算设置</span>
          <van-icon name="cross" @click="showBudgetSettings = false" />
        </div>
        
        <div class="budget-info">
          <van-progress 
            :percentage="budgetUsagePercentage" 
            :color="getBudgetColor()"
            stroke-width="8"
          />
          <div class="budget-text">
            本月已使用: ¥{{ budgetInfo.monthlyUsed.toFixed(2) }} / ¥{{ budgetInfo.monthlyLimit.toFixed(2) }}
          </div>
        </div>

        <van-cell-group>
          <van-cell title="每日预算限制" :value="`¥${budgetInfo.dailyLimit}`" />
          <van-cell title="每月预算限制" :value="`¥${budgetInfo.monthlyLimit}`" />
          <van-cell title="今日剩余" :value="`¥${budgetInfo.dailyRemaining.toFixed(2)}`" />
          <van-cell title="本月剩余" :value="`¥${budgetInfo.monthlyRemaining.toFixed(2)}`" />
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 加载状态 -->
    <van-loading v-if="loading" type="spinner" vertical>
      加载中...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { aiApi } from '@/api/ai'
import { useUserStore } from '@/stores/user'
import { showToast, Dialog } from 'vant'
const router = useRouter()
const userStore = useUserStore()

// 数据状态
const loading = ref(false)
const loadingRecent = ref(false)
const serviceStatus = ref({ enabled: false })
const budgetInfo = ref({
  dailyUsed: 0,
  monthlyUsed: 0,
  dailyLimit: 10,
  monthlyLimit: 200,
  dailyRemaining: 10,
  monthlyRemaining: 200
})
const usageStats = ref({
  requestCount: 0,
  totalCost: 0,
  cacheHitRate: 0
})
const recentRecommendations = ref<any[]>([])

// 界面状态
const showSettings = ref(false)
const showBudgetSettings = ref(false)
const showPreferences = ref(false)
const showCacheSettings = ref(false)
const showHelp = ref(false)

// 快捷操作
const quickActions = [
  {
    id: 'recipe',
    title: '菜谱推荐',
    icon: 'food-o',
    route: '/ai/recipe-recommendation',
    description: '基于库存智能推荐菜谱'
  },
  {
    id: 'task',
    title: '任务建议',
    icon: 'todo-list-o',
    route: '/ai/task-suggestion',
    description: '智能分析并推荐家庭任务'
  },
  {
    id: 'shopping',
    title: '购物清单',
    icon: 'shopping-cart-o',
    route: '/ai/shopping-list',
    description: '智能生成购物清单'
  },
  {
    id: 'assistant',
    title: '智能问答',
    icon: 'chat-o',
    route: '/ai/chat',
    description: '与AI助手自由对话'
  }
]

// 计算属性
const budgetUsagePercentage = computed(() => {
  if (budgetInfo.value.monthlyLimit === 0) return 0
  return Math.round((budgetInfo.value.monthlyUsed / budgetInfo.value.monthlyLimit) * 100)
})

// 方法
const loadServiceStatus = async () => {
  try {
    const response = await aiApi.getServiceStatus()
    serviceStatus.value = response.data
    
    if (response.data.budgetUsage) {
      budgetInfo.value = {
        ...budgetInfo.value,
        ...response.data.budgetUsage
      }
    }
    
    if (response.data.cacheStats) {
      usageStats.value.cacheHitRate = Math.round(response.data.cacheStats.hitRate * 100)
    }
  } catch (error) {
    console.error('加载AI服务状态失败:', error)
  }
}

const loadUsageStats = async () => {
  try {
    const response = await aiApi.getBudgetUsage()
    usageStats.value = {
      requestCount: response.data.current.requestCount,
      totalCost: response.data.current.monthlyUsed,
      cacheHitRate: usageStats.value.cacheHitRate
    }
  } catch (error) {
    console.error('加载使用统计失败:', error)
  }
}

const loadRecentRecommendations = async () => {
  try {
    loadingRecent.value = true
    
    // 这里可以调用API获取最近的推荐记录
    // 暂时使用模拟数据
    recentRecommendations.value = [
      {
        id: '1',
        title: '番茄炒蛋',
        summary: '基于现有库存推荐的经典家常菜',
        type: 'recipe',
        icon: '🍅',
        createdAt: new Date()
      },
      {
        id: '2',
        title: '家居整理任务',
        summary: '根据工作量分析推荐的整理任务',
        type: 'task',
        icon: '🏠',
        createdAt: new Date()
      }
    ]
  } catch (error) {
    console.error('加载最近推荐失败:', error)
  } finally {
    loadingRecent.value = false
  }
}

const handleQuickAction = (action: any) => {
  if (!serviceStatus.value.enabled && action.id !== 'assistant') {
    showToast('AI服务未启用')
    return
  }
  
  router.push(action.route)
}

const openChat = () => {
  router.push('/ai/chat')
}

const viewRecommendation = (recommendation: any) => {
  // 跳转到详情页或直接显示详情
  Dialog.alert({
    title: recommendation.title,
    message: recommendation.summary,
    theme: 'round-button'
  })
}

const useRecommendation = (recommendation: any) => {
  // 根据推荐类型执行相应操作
  switch (recommendation.type) {
    case 'recipe':
      router.push(`/menu/recipes/${recommendation.id}`)
      break
    case 'task':
      router.push(`/tasks/create?suggestion=${recommendation.id}`)
      break
    case 'shopping':
      router.push(`/inventory/shopping?list=${recommendation.id}`)
      break
  }
}

const shareRecommendation = (recommendation: any) => {
  // 分享推荐
  // 简化处理：提示用户使用系统分享功能
  showToast('请使用系统分享功能分享该推荐')
}

const getRecommendationType = (type: string) => {
  const typeMap: Record<string, string> = {
    recipe: 'primary',
    task: 'success',
    shopping: 'warning',
    general: 'default'
  }
  return typeMap[type] || 'default'
}

const getRecommendationTypeName = (type: string) => {
  const nameMap: Record<string, string> = {
    recipe: '菜谱',
    task: '任务',
    shopping: '购物',
    general: '通用'
  }
  return nameMap[type] || '推荐'
}

const getBudgetColor = () => {
  const percentage = budgetUsagePercentage.value
  if (percentage >= 90) return '#ee0a24'
  if (percentage >= 70) return '#ff976a'
  return '#07c160'
}

onMounted(() => {
  loadServiceStatus()
  loadUsageStats()
  loadRecentRecommendations()
})
</script>

<style scoped>
.ai-assistant {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.status-section {
  margin-bottom: 12px;
}

.quick-actions {
  background: white;
  margin-bottom: 12px;
  padding: 16px 16px 8px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}

.recent-recommendations {
  background: white;
  margin-bottom: 12px;
  padding: 16px;
}

.usage-stats {
  background: white;
  margin-bottom: 12px;
  padding: 16px 16px 8px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}

.chat-section {
  background: white;
  margin-bottom: 12px;
}

.settings-panel {
  max-height: 70vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ebedf0;
  font-weight: 600;
}

.settings-content {
  padding: 16px;
}

.budget-settings {
  max-height: 80vh;
  overflow-y: auto;
}

.budget-info {
  padding: 20px;
  text-align: center;
}

.budget-text {
  margin-top: 12px;
  font-size: 14px;
  color: #646566;
}
</style>