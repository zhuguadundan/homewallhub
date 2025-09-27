<template>
  <div class="inventory-analysis-page">
    <!-- 页面标题 -->
    <van-nav-bar 
      title="库存分析" 
      left-arrow 
      @click-left="$router.back()"
      class="nav-header"
    />

    <!-- 时间范围选择 -->
    <van-cell-group inset class="time-range-selector">
      <van-cell>
        <van-segmented-control 
          v-model="activeTimeRange"
          :options="timeRangeOptions"
          @change="handleTimeRangeChange"
        />
      </van-cell>
    </van-cell-group>

    <!-- 库存概览统计 -->
    <van-cell-group inset class="inventory-overview">
      <van-cell-group title="库存概览">
        <van-grid :column-num="2" :border="false">
          <van-grid-item 
            v-for="stat in overviewStats" 
            :key="stat.key"
            :text="stat.label"
            class="overview-item"
          >
            <template #icon>
              <div class="stat-display">
                <div class="stat-value" :class="stat.trend">{{ stat.value }}</div>
                <div class="stat-unit">{{ stat.unit }}</div>
                <div class="stat-change" v-if="stat.change">{{ stat.change }}</div>
              </div>
            </template>
          </van-grid-item>
        </van-grid>
      </van-cell-group>
    </van-cell-group>

    <!-- 库存状态分布图 -->
    <van-cell-group inset class="status-distribution">
      <van-cell-group title="库存状态分布">
        <div class="chart-container">
          <canvas ref="statusChart" class="chart-canvas"></canvas>
        </div>
        <van-grid :column-num="3" :border="false" class="legend-grid">
          <van-grid-item 
            v-for="item in statusLegend" 
            :key="item.key"
            class="legend-item"
          >
            <div class="legend-color" :style="{ backgroundColor: item.color }"></div>
            <div class="legend-text">
              <div class="legend-label">{{ item.label }}</div>
              <div class="legend-value">{{ item.value }}项</div>
            </div>
          </van-grid-item>
        </van-grid>
      </van-cell-group>
    </van-cell-group>

    <!-- 类别分析 -->
    <van-cell-group inset class="category-analysis">
      <van-cell-group title="类别分析">
        <div class="chart-container">
          <canvas ref="categoryChart" class="chart-canvas"></canvas>
        </div>
        <van-list class="category-list">
          <van-cell 
            v-for="category in categoryData" 
            :key="category.name"
            :title="category.name"
            :label="`${category.percentage}% · ${category.itemCount}项`"
            class="category-item"
          >
            <template #icon>
              <div class="category-icon" :style="{ backgroundColor: category.color }">
                <van-icon :name="getCategoryIcon(category.name)" color="white" size="16" />
              </div>
            </template>
            <template #value>
              <div class="category-stats">
                <div class="category-value">¥{{ category.totalValue }}</div>
                <van-tag 
                  :type="category.wastageRate > 20 ? 'danger' : category.wastageRate > 10 ? 'warning' : 'success'"
                  size="small"
                >
                  浪费率 {{ category.wastageRate }}%
                </van-tag>
              </div>
            </template>
          </van-cell>
        </van-list>
      </van-cell-group>
    </van-cell-group>

    <!-- 过期趋势分析 -->
    <van-cell-group inset class="expiration-trend">
      <van-cell-group title="过期趋势分析">
        <div class="chart-container">
          <canvas ref="expirationChart" class="chart-canvas"></canvas>
        </div>
        <van-grid :column-num="3" :border="false" class="trend-summary">
          <van-grid-item 
            v-for="trend in expirationTrends" 
            :key="trend.period"
            :text="trend.period"
            class="trend-item"
          >
            <template #icon>
              <div class="trend-value" :class="trend.trend">
                <span class="value">{{ trend.count }}</span>
                <span class="unit">项</span>
                <van-icon 
                  :name="trend.trend === 'up' ? 'arrow-up' : trend.trend === 'down' ? 'arrow-down' : 'minus'" 
                  size="12"
                />
              </div>
            </template>
          </van-grid-item>
        </van-grid>
      </van-cell-group>
    </van-cell-group>

    <!-- 使用频率分析 -->
    <van-cell-group inset class="usage-frequency">
      <van-cell-group title="使用频率分析">
        <van-tabs v-model:active="activeUsageTab" class="usage-tabs">
          <van-tab title="高频使用" name="high">
            <div class="usage-list">
              <van-cell 
                v-for="item in highFrequencyItems" 
                :key="item.name"
                :title="item.name"
                :label="`${item.category} · 使用${item.usageCount}次`"
                class="usage-item"
              >
                <template #value>
                  <div class="usage-stats">
                    <div class="frequency-bar">
                      <div 
                        class="frequency-fill" 
                        :style="{ width: `${item.frequencyPercent}%` }"
                      ></div>
                    </div>
                    <span class="frequency-text">{{ item.avgInterval }}天/次</span>
                  </div>
                </template>
              </van-cell>
            </div>
          </van-tab>
          
          <van-tab title="低频使用" name="low">
            <div class="usage-list">
              <van-cell 
                v-for="item in lowFrequencyItems" 
                :key="item.name"
                :title="item.name"
                :label="`${item.category} · 使用${item.usageCount}次`"
                class="usage-item"
              >
                <template #value>
                  <div class="usage-stats">
                    <van-tag type="warning" size="small">建议减少采购</van-tag>
                  </div>
                </template>
              </van-cell>
            </div>
          </van-tab>
          
          <van-tab title="未使用" name="unused">
            <div class="usage-list">
              <van-cell 
                v-for="item in unusedItems" 
                :key="item.name"
                :title="item.name"
                :label="`${item.category} · 已储存${item.storageDays}天`"
                class="usage-item"
              >
                <template #value>
                  <div class="usage-stats">
                    <van-tag type="danger" size="small">考虑处理</van-tag>
                  </div>
                </template>
              </van-cell>
            </div>
          </van-tab>
        </van-tabs>
      </van-cell-group>
    </van-cell-group>

    <!-- 智能建议 -->
    <van-cell-group inset class="smart-recommendations">
      <van-cell-group title="智能建议">
        <van-notice-bar
          v-for="recommendation in recommendations"
          :key="recommendation.id"
          :text="recommendation.text"
          :type="recommendation.type"
          :icon="recommendation.icon"
          closeable
          class="recommendation-notice"
        />
      </van-cell-group>
    </van-cell-group>

    <!-- 操作按钮 -->
    <van-cell-group inset class="action-buttons">
      <van-button 
        type="primary" 
        block 
        @click="generateReport"
        :loading="isGeneratingReport"
        class="action-button"
      >
        生成详细报告
      </van-button>
      
      <van-button 
        plain 
        block 
        @click="exportData"
        class="action-button"
      >
        导出数据
      </van-button>
    </van-cell-group>

    <!-- 加载状态 -->
    <van-loading v-if="loading" class="loading-overlay" vertical>
      正在分析库存数据...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const isGeneratingReport = ref(false)
const activeTimeRange = ref(0)
const activeUsageTab = ref('high')

// DOM 引用
const statusChart = ref<HTMLCanvasElement | null>(null)
const categoryChart = ref<HTMLCanvasElement | null>(null)
const expirationChart = ref<HTMLCanvasElement | null>(null)

// 时间范围选项
const timeRangeOptions = [
  { text: '本周', value: 'week' },
  { text: '本月', value: 'month' },
  { text: '本季', value: 'quarter' }
]

// 概览统计
const overviewStats = ref([
  {
    key: 'totalItems',
    label: '总物品数',
    value: '156',
    unit: '项',
    trend: 'neutral',
    change: '+12 vs 上月'
  },
  {
    key: 'totalValue',
    label: '总价值',
    value: '2,450',
    unit: '元',
    trend: 'positive',
    change: '+8.5% vs 上月'
  },
  {
    key: 'expiringItems',
    label: '即将过期',
    value: '8',
    unit: '项',
    trend: 'warning',
    change: '7天内'
  },
  {
    key: 'lowStockItems',
    label: '库存不足',
    value: '5',
    unit: '项',
    trend: 'negative',
    change: '需要补充'
  }
])

// 状态分布数据
const statusLegend = ref([
  { key: 'normal', label: '正常', value: 120, color: '#07c160' },
  { key: 'warning', label: '即将过期', value: 8, color: '#ff976a' },
  { key: 'expired', label: '已过期', value: 3, color: '#ee0a24' }
])

// 类别数据
const categoryData = ref([
  {
    name: '蔬菜',
    percentage: 35,
    itemCount: 45,
    totalValue: 680,
    wastageRate: 15,
    color: '#07c160'
  },
  {
    name: '肉类',
    percentage: 25,
    itemCount: 28,
    totalValue: 980,
    wastageRate: 8,
    color: '#ee0a24'
  },
  {
    name: '水果',
    percentage: 20,
    itemCount: 32,
    totalValue: 420,
    wastageRate: 22,
    color: '#ff976a'
  },
  {
    name: '调料',
    percentage: 12,
    itemCount: 24,
    totalValue: 180,
    wastageRate: 5,
    color: '#1989fa'
  },
  {
    name: '其他',
    percentage: 8,
    itemCount: 15,
    totalValue: 190,
    wastageRate: 12,
    color: '#666'
  }
])

// 过期趋势
const expirationTrends = ref([
  { period: '今天', count: 2, trend: 'warning' },
  { period: '3天内', count: 6, trend: 'up' },
  { period: '一周内', count: 8, trend: 'down' }
])

// 使用频率数据
const highFrequencyItems = ref([
  {
    name: '大米',
    category: '主食',
    usageCount: 25,
    frequencyPercent: 90,
    avgInterval: 1.2
  },
  {
    name: '鸡蛋',
    category: '蛋类',
    usageCount: 20,
    frequencyPercent: 80,
    avgInterval: 1.5
  }
])

const lowFrequencyItems = ref([
  {
    name: '特殊调料',
    category: '调料',
    usageCount: 2,
    frequencyPercent: 10,
    avgInterval: 15
  }
])

const unusedItems = ref([
  {
    name: '过期酱料',
    category: '调料',
    storageDays: 45,
    usageCount: 0
  }
])

// 智能建议
const recommendations = ref([
  {
    id: '1',
    text: '蔬菜类浪费率偏高（15%），建议改善储存方式或减少采购量',
    type: 'warning',
    icon: 'warning'
  },
  {
    id: '2',
    text: '8项物品即将在7天内过期，建议尽快使用或制定消费计划',
    type: 'danger',
    icon: 'info'
  },
  {
    id: '3',
    text: '肉类管理效果良好，浪费率仅8%，可作为其他类别的参考',
    type: 'success',
    icon: 'success'
  }
])

onMounted(() => {
  loadInventoryData()
  nextTick(() => {
    initCharts()
  })
})

const loadInventoryData = async () => {
  loading.value = true
  
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 这里会调用实际的库存分析API
    // const response = await fetch('/api/analytics/inventory-analysis', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${localStorage.getItem('token')}`
    //   },
    //   body: JSON.stringify({
    //     timeRange: timeRangeOptions[activeTimeRange.value].value,
    //     analysisType: 'comprehensive'
    //   })
    // })
    
    showSuccessToast('库存数据加载完成')
    
  } catch (error) {
    console.error('加载库存数据失败:', error)
    showToast('加载失败，显示模拟数据')
  } finally {
    loading.value = false
  }
}

const initCharts = () => {
  // 初始化状态分布饼图
  if (statusChart.value) {
    const ctx = statusChart.value.getContext('2d')
    if (ctx) {
      drawPieChart(ctx, statusLegend.value)
    }
  }

  // 初始化类别柱状图
  if (categoryChart.value) {
    const ctx = categoryChart.value.getContext('2d')
    if (ctx) {
      drawBarChart(ctx, categoryData.value)
    }
  }

  // 初始化过期趋势折线图
  if (expirationChart.value) {
    const ctx = expirationChart.value.getContext('2d')
    if (ctx) {
      drawLineChart(ctx, expirationTrends.value)
    }
  }
}

const drawPieChart = (ctx: CanvasRenderingContext2D, data: any[]) => {
  const canvas = ctx.canvas
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = Math.min(centerX, centerY) - 20

  let currentAngle = -Math.PI / 2
  const total = data.reduce((sum, item) => sum + item.value, 0)

  data.forEach(item => {
    const sliceAngle = (item.value / total) * 2 * Math.PI
    
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.closePath()
    ctx.fillStyle = item.color
    ctx.fill()
    
    currentAngle += sliceAngle
  })
}

const drawBarChart = (ctx: CanvasRenderingContext2D, data: any[]) => {
  const canvas = ctx.canvas
  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2
  const barWidth = chartWidth / data.length - 10

  const maxValue = Math.max(...data.map(item => item.percentage))

  data.forEach((item, index) => {
    const barHeight = (item.percentage / maxValue) * chartHeight
    const x = padding + index * (barWidth + 10)
    const y = canvas.height - padding - barHeight

    ctx.fillStyle = item.color
    ctx.fillRect(x, y, barWidth, barHeight)
    
    // 绘制标签
    ctx.fillStyle = '#333'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(item.name, x + barWidth / 2, canvas.height - 10)
  })
}

const drawLineChart = (ctx: CanvasRenderingContext2D, data: any[]) => {
  const canvas = ctx.canvas
  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  const maxValue = Math.max(...data.map(item => item.count))
  const stepX = chartWidth / (data.length - 1)

  ctx.beginPath()
  ctx.strokeStyle = '#1989fa'
  ctx.lineWidth = 2

  data.forEach((item, index) => {
    const x = padding + index * stepX
    const y = canvas.height - padding - (item.count / maxValue) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    // 绘制数据点
    ctx.fillStyle = '#1989fa'
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()
  })
  
  ctx.stroke()
}

const handleTimeRangeChange = (index: number) => {
  activeTimeRange.value = index
  loadInventoryData()
}

const getCategoryIcon = (categoryName: string) => {
  const iconMap: Record<string, string> = {
    '蔬菜': 'leaf-o',
    '肉类': 'fire-o',
    '水果': 'gift-o',
    '调料': 'coffee-o',
    '其他': 'bag-o'
  }
  return iconMap[categoryName] || 'bag-o'
}

const generateReport = async () => {
  isGeneratingReport.value = true
  
  try {
    // 调用生成报告API
    await new Promise(resolve => setTimeout(resolve, 2000))
    showSuccessToast('报告生成完成')
    router.push('/analytics/reports/inventory-latest')
  } catch (error) {
    showToast('报告生成失败')
  } finally {
    isGeneratingReport.value = false
  }
}

const exportData = () => {
  // 导出库存数据
  const data = {
    overview: overviewStats.value,
    categories: categoryData.value,
    trends: expirationTrends.value,
    exportTime: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-analysis-${Date.now()}.json`
  a.click()
  
  showSuccessToast('数据导出完成')
}
</script>

<style scoped>
.inventory-analysis-page {
  padding-bottom: 20px;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.nav-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.time-range-selector {
  margin: 16px 0;
}

.inventory-overview {
  margin: 16px 0;
}

.overview-item {
  padding: 8px;
}

.stat-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.stat-value.positive {
  color: #07c160;
}

.stat-value.negative {
  color: #ee0a24;
}

.stat-value.warning {
  color: #ff976a;
}

.stat-unit {
  font-size: 12px;
  color: #666;
}

.stat-change {
  font-size: 10px;
  color: #999;
}

.status-distribution,
.category-analysis,
.expiration-trend,
.usage-frequency,
.smart-recommendations {
  margin: 16px 0;
}

.chart-container {
  padding: 16px;
  display: flex;
  justify-content: center;
}

.chart-canvas {
  width: 300px;
  height: 200px;
  background: white;
  border-radius: 8px;
}

.legend-grid {
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-text {
  flex: 1;
}

.legend-label {
  font-size: 12px;
  color: #666;
}

.legend-value {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.category-list {
  background: transparent;
}

.category-item {
  margin: 8px 0;
  background: white;
  border-radius: 8px;
}

.category-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.category-value {
  font-weight: 600;
  color: #333;
}

.trend-summary {
  margin-top: 16px;
}

.trend-item {
  padding: 8px;
}

.trend-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  font-weight: bold;
}

.trend-value.up {
  color: #ee0a24;
}

.trend-value.down {
  color: #07c160;
}

.trend-value.warning {
  color: #ff976a;
}

.usage-tabs {
  --van-tabs-bottom-bar-color: #1989fa;
}

.usage-list {
  padding: 0 16px;
}

.usage-item {
  margin: 8px 0;
  background: white;
  border-radius: 8px;
}

.usage-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.frequency-bar {
  width: 60px;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.frequency-fill {
  height: 100%;
  background: linear-gradient(90deg, #07c160, #1989fa);
  transition: width 0.3s ease;
}

.frequency-text {
  font-size: 12px;
  color: #666;
  min-width: 60px;
}

.recommendation-notice {
  margin: 8px 0;
}

.action-buttons {
  margin: 16px 0;
}

.action-button {
  margin: 8px 16px;
}

.loading-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}
</style>