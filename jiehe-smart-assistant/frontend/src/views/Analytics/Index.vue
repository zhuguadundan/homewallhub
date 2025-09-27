<template>
  <div class="analytics-page">
    <!-- 页面标题 -->
    <van-nav-bar 
      title="数据分析" 
      class="nav-header"
    />

    <!-- 快速统计卡片 -->
    <van-cell-group inset class="quick-stats">
      <van-cell-group title="本月概览">
        <van-grid :column-num="2" :border="false">
          <van-grid-item 
            v-for="stat in quickStats" 
            :key="stat.key"
            :text="stat.label"
            class="stat-item"
          >
            <template #icon>
              <div class="stat-value" :class="stat.trend">
                <span class="value">{{ stat.value }}</span>
                <span class="unit">{{ stat.unit }}</span>
              </div>
            </template>
          </van-grid-item>
        </van-grid>
      </van-cell-group>
    </van-cell-group>

    <!-- 分析功能入口 -->
    <van-cell-group inset class="analysis-features">
      <van-cell-group title="分析功能">
        <van-cell 
          v-for="feature in analysisFeatures" 
          :key="feature.id"
          :title="feature.title"
          :label="feature.description"
          :icon="feature.icon"
          is-link
          @click="navigateToFeature(feature)"
          class="feature-item"
        >
          <template #right-icon>
            <van-badge 
              v-if="feature.hasUpdate" 
              :content="feature.updateCount"
              :offset="[0, 0]"
            >
              <van-icon name="arrow" />
            </van-badge>
            <van-icon v-else name="arrow" />
          </template>
        </van-cell>
      </van-cell-group>
    </van-cell-group>

    <!-- 最新洞察 -->
    <van-cell-group inset v-if="latestInsights.length > 0" class="insights-section">
      <van-cell-group title="最新洞察">
        <van-swipe 
          class="insights-swipe" 
          :autoplay="5000" 
          indicator-color="white"
          :show-indicators="latestInsights.length > 1"
        >
          <van-swipe-item 
            v-for="insight in latestInsights" 
            :key="insight.id"
            class="insight-card"
          >
            <div class="insight-content">
              <div class="insight-header">
                <van-tag :type="getInsightTypeColor(insight.type)" size="small">
                  {{ insight.type }}
                </van-tag>
                <span class="insight-date">{{ formatDate(insight.date) }}</span>
              </div>
              <h3 class="insight-title">{{ insight.title }}</h3>
              <p class="insight-description">{{ insight.description }}</p>
              <div class="insight-action">
                <van-button 
                  size="small" 
                  type="primary" 
                  plain
                  @click="viewInsightDetail(insight)"
                >
                  查看详情
                </van-button>
              </div>
            </div>
          </van-swipe-item>
        </van-swipe>
      </van-cell-group>
    </van-cell-group>

    <!-- 数据报告历史 -->
    <van-cell-group inset class="report-history">
      <van-cell-group title="历史报告">
        <van-cell 
          v-for="report in recentReports" 
          :key="report.id"
          :title="report.title"
          :label="`${report.type} · ${formatDate(report.createdAt)}`"
          is-link
          @click="viewReport(report)"
          class="report-item"
        >
          <template #icon>
            <van-icon :name="getReportIcon(report.type)" />
          </template>
          <template #right-icon>
            <van-tag 
              :type="getReportStatusColor(report.status)" 
              size="small"
            >
              {{ report.status }}
            </van-tag>
          </template>
        </van-cell>
        
        <van-cell 
          v-if="recentReports.length === 0"
          title="暂无历史报告"
          label="开始生成您的第一份分析报告"
          class="empty-state"
        />
        
        <van-cell 
          v-if="recentReports.length > 0"
          title="查看全部报告"
          is-link
          @click="$router.push('/analytics/reports')"
          class="view-all-cell"
        />
      </van-cell-group>
    </van-cell-group>

    <!-- 浮动操作按钮 -->
    <van-floating-bubble
      v-model:show="showFAB"
      icon="plus"
      magnetic="x"
      @click="showCreateOptions = true"
      class="fab-button"
    />

    <!-- 创建报告选项 -->
    <van-action-sheet
      v-model:show="showCreateOptions"
      :actions="createActions"
      cancel-text="取消"
      description="选择要生成的分析报告类型"
      @select="handleCreateAction"
    />

    <!-- 加载状态 -->
    <van-loading v-if="loading" class="loading-overlay" vertical>
      正在加载数据...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast } from 'vant'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const showFAB = ref(true)
const showCreateOptions = ref(false)

// 快速统计数据
const quickStats = ref([
  {
    key: 'totalMeals',
    label: '本月餐数',
    value: '0',
    unit: '餐',
    trend: 'neutral'
  },
  {
    key: 'totalSpending',
    label: '本月支出',
    value: '0',
    unit: '元',
    trend: 'neutral'
  },
  {
    key: 'nutritionScore',
    label: '营养评分',
    value: '0',
    unit: '分',
    trend: 'neutral'
  },
  {
    key: 'wastageRate',
    label: '浪费率',
    value: '0',
    unit: '%',
    trend: 'neutral'
  }
])

// 分析功能
const analysisFeatures = ref([
  {
    id: 'diet-analysis',
    title: '饮食分析',
    description: '分析饮食习惯、营养摄入和健康状况',
    icon: 'chart-trending-o',
    route: '/analytics/diet',
    hasUpdate: false,
    updateCount: 0
  },
  {
    id: 'cost-analysis', 
    title: '成本分析',
    description: '统计食材支出、预算管理和成本优化',
    icon: 'gold-coin-o',
    route: '/analytics/cost',
    hasUpdate: false,
    updateCount: 0
  },
  {
    id: 'inventory-analysis',
    title: '库存分析',
    description: '库存状态、使用趋势和采购建议',
    icon: 'records',
    route: '/analytics/inventory',
    hasUpdate: false,
    updateCount: 0
  },
  {
    id: 'comprehensive-report',
    title: '综合报告',
    description: '全面的家庭管理效率和生活质量分析',
    icon: 'description',
    route: '/analytics/comprehensive',
    hasUpdate: false,
    updateCount: 0
  }
])

// 最新洞察
const latestInsights = ref([
  {
    id: '1',
    type: '营养建议',
    title: '蛋白质摄入不足',
    description: '本周蛋白质摄入量较推荐值偏低，建议增加肉类、蛋类或豆类食品的摄入。',
    date: new Date().toISOString(),
    actionUrl: '/analytics/diet'
  }
])

// 历史报告
const recentReports = ref([
  {
    id: '1',
    title: '11月饮食分析报告',
    type: '饮食分析',
    status: '已完成',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
])

// 创建操作选项
const createActions = [
  { name: '饮食分析报告', value: 'diet-analysis' },
  { name: '成本分析报告', value: 'cost-analysis' },
  { name: '库存分析报告', value: 'inventory-analysis' },
  { name: '综合分析报告', value: 'comprehensive-report' }
]

onMounted(() => {
  loadQuickStats()
  loadLatestInsights()
  loadRecentReports()
})

const loadQuickStats = async () => {
  try {
    const response = await fetch('/api/analytics/quick-stats?timeRange=month', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      
      if (data.success) {
        updateQuickStats(data.data)
      }
    }
  } catch (error) {
    console.error('加载快速统计失败:', error)
    // 使用模拟数据
    updateQuickStats({
      diet: { totalMeals: 45, nutritionScore: 78 },
      cost: { totalSpending: 892.5, wastageRate: 12 }
    })
  }
}

const updateQuickStats = (data: any) => {
  quickStats.value[0].value = data.diet?.totalMeals?.toString() || '45'
  quickStats.value[1].value = data.cost?.totalSpending?.toString() || '892.5'
  quickStats.value[2].value = data.diet?.nutritionScore?.toString() || '78'
  quickStats.value[3].value = data.cost?.wastageRate?.toString() || '12'
  
  // 更新趋势
  quickStats.value[2].trend = (data.diet?.nutritionScore || 78) >= 80 ? 'positive' : 'neutral'
  quickStats.value[3].trend = (data.cost?.wastageRate || 12) <= 10 ? 'positive' : 'negative'
}

const loadLatestInsights = async () => {
  try {
    // 这里可以调用获取最新洞察的API
    // const response = await api.getLatestInsights()
    // latestInsights.value = response.data
  } catch (error) {
    console.error('加载最新洞察失败:', error)
  }
}

const loadRecentReports = async () => {
  try {
    // 这里可以调用获取历史报告的API
    // const response = await api.getRecentReports()
    // recentReports.value = response.data
  } catch (error) {
    console.error('加载历史报告失败:', error)
  }
}

const navigateToFeature = (feature: any) => {
  router.push(feature.route)
}

const handleCreateAction = (action: any) => {
  showCreateOptions.value = false
  
  switch (action.value) {
    case 'diet-analysis':
      router.push('/analytics/diet/create')
      break
    case 'cost-analysis':
      router.push('/analytics/cost/create')
      break
    case 'inventory-analysis':
      router.push('/analytics/inventory/create')
      break
    case 'comprehensive-report':
      router.push('/analytics/comprehensive/create')
      break
  }
}

const viewInsightDetail = (insight: any) => {
  router.push(insight.actionUrl)
}

const viewReport = (report: any) => {
  router.push(`/analytics/reports/${report.id}`)
}

const getInsightTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    '营养建议': 'primary',
    '成本优化': 'success',
    '库存提醒': 'warning',
    '健康提醒': 'danger'
  }
  return colorMap[type] || 'default'
}

const getReportIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    '饮食分析': 'chart-trending-o',
    '成本分析': 'gold-coin-o',
    '库存分析': 'records',
    '综合报告': 'description'
  }
  return iconMap[type] || 'description'
}

const getReportStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    '已完成': 'success',
    '生成中': 'warning',
    '失败': 'danger'
  }
  return colorMap[status] || 'default'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return '今天'
  if (diffDays === 2) return '昨天'
  if (diffDays <= 7) return `${diffDays}天前`
  
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.analytics-page {
  padding-bottom: 20px;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.nav-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.quick-stats {
  margin: 16px 0;
}

.stat-item {
  padding: 8px;
}

.stat-value {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value .value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.stat-value.positive .value {
  color: #07c160;
}

.stat-value.negative .value {
  color: #ee0a24;
}

.stat-value .unit {
  font-size: 12px;
  color: #666;
}

.analysis-features {
  margin: 16px 0;
}

.feature-item {
  --van-cell-icon-size: 24px;
}

.insights-section {
  margin: 16px 0;
}

.insights-swipe {
  height: 180px;
  background: #fff;
  border-radius: 8px;
}

.insight-card {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.insight-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.insight-date {
  font-size: 12px;
  color: #666;
}

.insight-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #333;
}

.insight-description {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  flex: 1;
  margin: 0 0 12px 0;
}

.insight-action {
  margin-top: auto;
}

.report-history {
  margin: 16px 0;
}

.report-item {
  --van-cell-icon-size: 20px;
}

.empty-state {
  text-align: center;
  color: #999;
}

.view-all-cell {
  border-top: 1px solid #ebedf0;
  margin-top: 8px;
}

.fab-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}
</style>