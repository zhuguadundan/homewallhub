<template>
  <div class="menu-result">
    <!-- 页面头部 -->
    <van-nav-bar
      title="点菜结果"
      left-arrow
      @click-left="$router.go(-1)"
    >
      <template #right>
        <van-icon name="share" @click="shareResult" />
      </template>
    </van-nav-bar>

    <div v-if="loading" class="loading-container">
      <van-loading size="24px">加载中...</van-loading>
    </div>

    <div v-else class="result-content">
      <!-- 菜单信息 -->
      <div class="menu-info-card">
        <h2 class="menu-title">{{ resultData.menu?.name }}</h2>
        <p class="menu-desc">{{ resultData.menu?.description }}</p>
        <div class="menu-meta">
          <span class="target-date">目标日期: {{ formatDate(resultData.menu?.target_date) }}</span>
          <span class="generate-time">统计时间: {{ formatDateTime(resultData.generated_at) }}</span>
        </div>
      </div>

      <!-- 投票概览 -->
      <div class="overview-card">
        <h3>投票概览</h3>
        <div class="overview-grid">
          <div class="overview-item">
            <span class="number">{{ resultData.overview?.total_voters || 0 }}</span>
            <span class="label">参与人数</span>
          </div>
          <div class="overview-item">
            <span class="number">{{ resultData.overview?.total_votes || 0 }}</span>
            <span class="label">总投票数</span>
          </div>
          <div class="overview-item">
            <span class="number">{{ resultData.dishes?.length || 0 }}</span>
            <span class="label">菜品数量</span>
          </div>
        </div>
      </div>

      <!-- 菜品排行榜 -->
      <div class="ranking-card">
        <h3>菜品排行榜</h3>
        <div class="dish-rankings">
          <div 
            v-for="(dish, index) in sortedDishes" 
            :key="dish.id"
            class="ranking-item"
            :class="getRankingClass(index)"
          >
            <div class="ranking-badge">
              <span class="rank-number">{{ index + 1 }}</span>
              <van-icon 
                v-if="index < 3" 
                :name="getRankIcon(index)" 
                :color="getRankColor(index)"
              />
            </div>
            
            <div class="dish-info">
              <h4 class="dish-name">{{ dish.name }}</h4>
              <p class="dish-category">{{ dish.category }}</p>
              <div class="dish-stats">
                <span class="vote-count">{{ dish.vote_count }} 票</span>
                <span class="avg-score">平均分: {{ dish.average_score.toFixed(1) }}</span>
                <span class="recommendation">推荐度: {{ dish.recommendation_score.toFixed(1) }}</span>
              </div>
            </div>

            <div class="vote-breakdown">
              <div class="vote-bar">
                <div 
                  class="like-segment" 
                  :style="{ width: getVotePercentage(dish, 'like') + '%' }"
                ></div>
                <div 
                  class="neutral-segment" 
                  :style="{ width: getVotePercentage(dish, 'neutral') + '%' }"
                ></div>
                <div 
                  class="dislike-segment" 
                  :style="{ width: getVotePercentage(dish, 'dislike') + '%' }"
                ></div>
              </div>
              <div class="vote-numbers">
                <span class="like">👍 {{ dish.like_count || 0 }}</span>
                <span class="neutral">😐 {{ dish.neutral_count || 0 }}</span>
                <span class="dislike">👎 {{ dish.dislike_count || 0 }}</span>
              </div>
            </div>

            <!-- 备注信息 -->
            <div v-if="dish.top_notes && dish.top_notes.length > 0" class="notes-section">
              <h5>热门备注:</h5>
              <div class="notes-list">
                <span 
                  v-for="note in dish.top_notes.slice(0, 3)" 
                  :key="note"
                  class="note-tag"
                >
                  {{ note }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分析图表 -->
      <div class="charts-card">
        <h3>数据分析</h3>
        
        <!-- 类别偏好图表 -->
        <div class="chart-section">
          <h4>类别偏好分布</h4>
          <div class="category-chart">
            <div 
              v-for="category in categoryStats" 
              :key="category.name"
              class="category-bar"
            >
              <span class="category-name">{{ category.name }}</span>
              <div class="bar-container">
                <div 
                  class="bar-fill" 
                  :style="{ width: category.percentage + '%' }"
                ></div>
                <span class="percentage">{{ category.percentage }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 价格分析 -->
        <div class="chart-section">
          <h4>价格分析</h4>
          <div class="price-stats">
            <div class="price-item">
              <span class="price-label">平均价格</span>
              <span class="price-value">¥{{ avgPrice.toFixed(1) }}</span>
            </div>
            <div class="price-item">
              <span class="price-label">价格范围</span>
              <span class="price-value">¥{{ minPrice }} - ¥{{ maxPrice }}</span>
            </div>
            <div class="price-item">
              <span class="price-label">预算总计</span>
              <span class="price-value">¥{{ totalPrice.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 推荐菜单 -->
      <div class="recommendation-card">
        <h3>推荐菜单 (Top {{ Math.min(5, recommendedDishes.length) }})</h3>
        <div class="recommended-list">
          <div 
            v-for="dish in recommendedDishes.slice(0, 5)" 
            :key="dish.id"
            class="recommended-item"
          >
            <div class="dish-basic">
              <span class="dish-name">{{ dish.name }}</span>
              <span class="dish-category">{{ dish.category }}</span>
            </div>
            <div class="dish-score">
              <van-rate 
                v-model="dish.rating" 
                :size="14" 
                readonly 
                allow-half
              />
              <span class="score-text">{{ dish.recommendation_score.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <van-button type="primary" block @click="exportResult">
          导出结果
        </van-button>
        <van-button block @click="startNewMenu">
          创建新菜单
        </van-button>
      </div>
    </div>

    <!-- 导出选择弹窗 -->
    <van-action-sheet
      v-model:show="showExportSheet"
      :actions="exportActions"
      @select="onExportSelect"
      cancel-text="取消"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { menuApi } from '@/api/menu'

const route = useRoute()
const router = useRouter()

// 响应式数据
const loading = ref(true)
const resultData = ref<any>({})
const showExportSheet = ref(false)

const exportActions = [
  { name: 'JSON格式', value: 'json' },
  { name: 'CSV格式', value: 'csv' }
]

// 计算属性
const sortedDishes = computed(() => {
  if (!resultData.value.dishes) return []
  return [...resultData.value.dishes].sort((a, b) => 
    b.recommendation_score - a.recommendation_score
  )
})

const recommendedDishes = computed(() => {
  return sortedDishes.value.map(dish => ({
    ...dish,
    rating: Math.min(5, dish.recommendation_score)
  }))
})

const categoryStats = computed(() => {
  if (!resultData.value.dishes) return []
  
  const categories = {}
  const total = resultData.value.dishes.length
  
  resultData.value.dishes.forEach(dish => {
    categories[dish.category] = (categories[dish.category] || 0) + 1
  })
  
  return Object.entries(categories).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100)
  })).sort((a, b) => b.count - a.count)
})

const avgPrice = computed(() => {
  if (!resultData.value.dishes || resultData.value.dishes.length === 0) return 0
  const prices = resultData.value.dishes
    .filter(dish => dish.estimated_price > 0)
    .map(dish => dish.estimated_price)
  return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
})

const minPrice = computed(() => {
  if (!resultData.value.dishes) return 0
  const prices = resultData.value.dishes
    .filter(dish => dish.estimated_price > 0)
    .map(dish => dish.estimated_price)
  return prices.length > 0 ? Math.min(...prices) : 0
})

const maxPrice = computed(() => {
  if (!resultData.value.dishes) return 0
  const prices = resultData.value.dishes
    .filter(dish => dish.estimated_price > 0)
    .map(dish => dish.estimated_price)
  return prices.length > 0 ? Math.max(...prices) : 0
})

const totalPrice = computed(() => {
  if (!resultData.value.dishes) return 0
  return resultData.value.dishes
    .filter(dish => dish.recommendation_score > 3) // 只计算推荐度高的菜品
    .reduce((total, dish) => total + (dish.estimated_price || 0), 0)
})

// 页面初始化
onMounted(() => {
  loadResult()
})

// 加载结果数据
const loadResult = async () => {
  const menuId = route.params.id as string
  
  try {
    loading.value = true
    const response = await menuApi.getFinalResult(menuId)
    resultData.value = response.data
  } catch (error) {
    showToast('加载结果失败')
    console.error('加载结果失败:', error)
  } finally {
    loading.value = false
  }
}

// 导出结果
const exportResult = () => {
  showExportSheet.value = true
}

// 导出选择
const onExportSelect = async (action: any) => {
  const menuId = route.params.id as string
  
  try {
    const response = await menuApi.exportResult(menuId, action.value)
    
    if (action.value === 'csv') {
      // 处理CSV下载
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `menu-${menuId}-result.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } else {
      // 处理JSON下载
      const dataStr = JSON.stringify(response.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `menu-${menuId}-result.json`
      link.click()
      window.URL.revokeObjectURL(url)
    }
    
    showToast('导出成功')
  } catch (error) {
    showToast('导出失败')
    console.error('导出失败:', error)
  }
}

// 分享结果
const shareResult = () => {
  // 实现分享功能
  console.log('分享结果')
}

// 创建新菜单
const startNewMenu = () => {
  router.push('/menu')
}

// 工具函数
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const getRankingClass = (index: number) => {
  if (index === 0) return 'first-place'
  if (index === 1) return 'second-place'
  if (index === 2) return 'third-place'
  return ''
}

const getRankIcon = (index: number) => {
  const icons = ['medal', 'medal', 'medal']
  return icons[index]
}

const getRankColor = (index: number) => {
  const colors = ['#ffd700', '#c0c0c0', '#cd7f32']
  return colors[index]
}

const getVotePercentage = (dish: any, type: string) => {
  const total = (dish.like_count || 0) + (dish.neutral_count || 0) + (dish.dislike_count || 0)
  if (total === 0) return 0
  const count = dish[type + '_count'] || 0
  return Math.round((count / total) * 100)
}
</script>

<style scoped>
.menu-result {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.result-content {
  padding: 16px;
}

.menu-info-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.menu-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #323233;
}

.menu-desc {
  font-size: 14px;
  color: #646566;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.menu-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #969799;
}

.overview-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.overview-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.overview-item {
  text-align: center;
}

.overview-item .number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.overview-item .label {
  font-size: 12px;
  color: #666;
}

.ranking-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ranking-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.ranking-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  margin-bottom: 12px;
  position: relative;
}

.ranking-item.first-place {
  border-color: #ffd700;
  background: #fffdf0;
}

.ranking-item.second-place {
  border-color: #c0c0c0;
  background: #f8f8f8;
}

.ranking-item.third-place {
  border-color: #cd7f32;
  background: #fdf8f0;
}

.ranking-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  top: -8px;
  right: 12px;
  background: white;
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid #ebedf0;
}

.rank-number {
  font-size: 14px;
  font-weight: bold;
  color: #1890ff;
}

.dish-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #323233;
}

.dish-category {
  font-size: 12px;
  color: #969799;
  margin-bottom: 8px;
}

.dish-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #646566;
}

.vote-breakdown {
  margin-top: 8px;
}

.vote-bar {
  height: 6px;
  border-radius: 3px;
  background: #f2f3f5;
  overflow: hidden;
  margin-bottom: 8px;
  display: flex;
}

.like-segment {
  background: #52c41a;
}

.neutral-segment {
  background: #fa8c16;
}

.dislike-segment {
  background: #f56565;
}

.vote-numbers {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.notes-section {
  margin-top: 8px;
}

.notes-section h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #646566;
}

.notes-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.note-tag {
  font-size: 11px;
  padding: 2px 6px;
  background: #f2f3f5;
  color: #646566;
  border-radius: 4px;
}

.charts-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.charts-card h3,
.charts-card h4 {
  margin: 0 0 16px 0;
  color: #323233;
}

.charts-card h3 {
  font-size: 16px;
}

.charts-card h4 {
  font-size: 14px;
}

.chart-section {
  margin-bottom: 24px;
}

.category-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
  min-width: 60px;
  font-size: 12px;
  color: #646566;
}

.bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-fill {
  height: 6px;
  background: #1890ff;
  border-radius: 3px;
  transition: width 0.3s;
}

.percentage {
  font-size: 12px;
  color: #969799;
  min-width: 30px;
}

.price-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.price-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-label {
  font-size: 14px;
  color: #646566;
}

.price-value {
  font-size: 14px;
  color: #323233;
  font-weight: 600;
}

.recommendation-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recommendation-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.recommended-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommended-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ebedf0;
  border-radius: 6px;
}

.dish-basic {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dish-basic .dish-name {
  font-size: 14px;
  color: #323233;
  font-weight: 500;
}

.dish-basic .dish-category {
  font-size: 12px;
  color: #969799;
}

.dish-score {
  display: flex;
  align-items: center;
  gap: 8px;
}

.score-text {
  font-size: 12px;
  color: #646566;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
</style>