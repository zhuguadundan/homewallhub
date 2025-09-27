<template>
  <div class="task-suggestion-page">
    <!-- 页面标题 -->
    <van-nav-bar 
      title="智能任务建议" 
      left-arrow 
      @click-left="$router.back()"
      class="nav-header"
    />

    <!-- 参数设置区域 -->
    <van-cell-group inset class="suggestion-form">
      <van-cell-group title="任务分析参数">
        <van-field
          v-model="suggestionParams.timeRange"
          label="时间范围"
          placeholder="例如：今天、本周、本月"
          :border="false"
        />
        
        <van-field
          v-model="suggestionParams.priority"
          label="优先级偏好"
          placeholder="高优先级、平衡、轻松模式"
          :border="false"
        />

        <van-field
          v-model="suggestionParams.workload"
          label="工作量偏好"
          placeholder="轻量、适中、密集"
          :border="false"
        />

        <van-field
          v-model="suggestionParams.categories"
          label="任务类别"
          placeholder="家务、学习、工作、生活"
          :border="false"
        />
      </van-cell-group>

      <!-- 当前任务统计 -->
      <van-cell-group title="当前任务状况" v-if="taskStats">
        <van-cell title="待完成任务" :value="taskStats.pending" />
        <van-cell title="进行中任务" :value="taskStats.inProgress" />
        <van-cell title="本周完成" :value="taskStats.completed" />
        <van-cell title="平均完成时间" :value="taskStats.avgCompletionTime" />
      </van-cell-group>

      <van-button 
        type="primary" 
        block 
        @click="getSuggestions"
        :loading="loading"
        class="suggestion-button"
      >
        获取智能建议
      </van-button>
    </van-cell-group>

    <!-- 建议结果展示 -->
    <van-cell-group inset v-if="suggestions.length > 0" class="suggestions-result">
      <van-cell-group title="智能任务建议">
        <div v-for="(suggestion, index) in suggestions" :key="index" class="suggestion-item">
          <van-card
            :title="suggestion.title"
            :desc="suggestion.description"
            :tag="suggestion.priority"
            class="suggestion-card"
          >
            <template #tags>
              <van-tag 
                :type="getPriorityColor(suggestion.priority)" 
                size="small"
              >
                {{ suggestion.priority }}
              </van-tag>
              <van-tag 
                type="default" 
                size="small" 
                style="margin-left: 8px;"
              >
                {{ suggestion.category }}
              </van-tag>
            </template>
            
            <template #footer>
              <div class="suggestion-meta">
                <span class="estimated-time">预估时间: {{ suggestion.estimatedTime }}</span>
                <span class="suggested-time">建议时间: {{ suggestion.suggestedTime }}</span>
              </div>
              
              <div class="suggestion-actions">
                <van-button 
                  size="small" 
                  type="primary" 
                  @click="createTask(suggestion)"
                >
                  创建任务
                </van-button>
                <van-button 
                  size="small" 
                  plain 
                  @click="viewDetails(suggestion)"
                >
                  查看详情
                </van-button>
              </div>
            </template>
          </van-card>
        </div>
      </van-cell-group>
    </van-cell-group>

    <!-- AI分析报告 -->
    <van-cell-group inset v-if="analysisReport" class="analysis-report">
      <van-cell-group title="工作量分析报告">
        <van-cell>
          <div class="report-content">
            <p><strong>当前状况:</strong> {{ analysisReport.currentStatus }}</p>
            <p><strong>建议策略:</strong> {{ analysisReport.strategy }}</p>
            <p><strong>时间安排建议:</strong> {{ analysisReport.timeAdvice }}</p>
            <p><strong>优化建议:</strong> {{ analysisReport.optimization }}</p>
          </div>
        </van-cell>
      </van-cell-group>
    </van-cell-group>

    <!-- 任务详情弹窗 -->
    <van-popup v-model:show="showDetails" position="bottom" class="details-popup">
      <div class="task-details" v-if="selectedSuggestion">
        <h3>{{ selectedSuggestion.title }}</h3>
        <div class="detail-section">
          <h4>详细步骤</h4>
          <ol>
            <li v-for="step in selectedSuggestion.steps" :key="step">{{ step }}</li>
          </ol>
        </div>
        
        <div class="detail-section">
          <h4>所需资源</h4>
          <van-tag 
            v-for="resource in selectedSuggestion.resources" 
            :key="resource" 
            type="default" 
            size="small"
            style="margin: 4px;"
          >
            {{ resource }}
          </van-tag>
        </div>

        <div class="detail-section">
          <h4>预期收益</h4>
          <p>{{ selectedSuggestion.benefits }}</p>
        </div>

        <div class="detail-actions">
          <van-button type="primary" block @click="createTask(selectedSuggestion)">
            创建任务
          </van-button>
          <van-button plain block @click="showDetails = false" style="margin-top: 12px;">
            关闭
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 加载状态 -->
    <van-loading v-if="loading" class="loading-overlay" vertical>
      正在分析任务情况...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import type { TaskSuggestion, TaskSuggestionRequest, TaskSuggestionResponse } from '@/types/ai'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const suggestions = ref<TaskSuggestion[]>([])
const showDetails = ref(false)
const selectedSuggestion = ref<TaskSuggestion | null>(null)

// 建议参数
const suggestionParams = reactive<TaskSuggestionRequest>({
  timeRange: '本周',
  priority: '平衡',
  workload: '适中',
  categories: '家务,生活'
})

// 任务统计
const taskStats = ref({
  pending: '12个',
  inProgress: '3个', 
  completed: '8个',
  avgCompletionTime: '2.5天'
})

// 分析报告
const analysisReport = ref<{
  currentStatus: string
  strategy: string
  timeAdvice: string
  optimization: string
} | null>(null)

onMounted(() => {
  loadTaskStats()
})

const loadTaskStats = async () => {
  try {
    // 这里会调用实际的API获取任务统计
    // const response = await api.getTaskStats()
    // taskStats.value = response.data
  } catch (error) {
    console.error('加载任务统计失败:', error)
  }
}

const getSuggestions = async () => {
  if (!suggestionParams.timeRange) {
    showToast('请输入时间范围')
    return
  }

  loading.value = true
  
  try {
    // 调用AI任务建议API
    const response = await fetch('/api/ai/task-suggestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(suggestionParams)
    })

    if (!response.ok) {
      throw new Error('获取建议失败')
    }

    const data: TaskSuggestionResponse = await response.json()
    
    if (data.success) {
      suggestions.value = data.suggestions
      analysisReport.value = data.analysis
      showSuccessToast('已生成智能建议')
    } else {
      // 使用本地算法作为后备
      generateLocalSuggestions()
    }
  } catch (error) {
    console.error('获取任务建议失败:', error)
    generateLocalSuggestions()
  } finally {
    loading.value = false
  }
}

const generateLocalSuggestions = () => {
  // 本地算法生成建议
  const localSuggestions: TaskSuggestion[] = [
    {
      id: '1',
      title: '整理客厅和厨房',
      description: '清理杂物，整理物品摆放，保持空间整洁',
      priority: '中等',
      category: '家务',
      estimatedTime: '1-2小时',
      suggestedTime: '周末上午',
      reasoning: '基于家庭成员活动模式，周末上午是最佳整理时间',
      steps: [
        '收集散落的物品',
        '分类整理物品',
        '清洁表面和地面',
        '重新摆放物品'
      ],
      resources: ['清洁用品', '收纳盒'],
      benefits: '改善居住环境，提升生活品质'
    },
    {
      id: '2', 
      title: '制定下周膳食计划',
      description: '规划一周的餐食安排，准备购物清单',
      priority: '高',
      category: '生活',
      estimatedTime: '30-45分钟',
      suggestedTime: '周日晚上',
      reasoning: '提前规划可以节省时间和成本，确保营养均衡',
      steps: [
        '查看冰箱现有食材',
        '考虑家庭成员喜好',
        '安排营养搭配',
        '制定购物清单'
      ],
      resources: ['食谱参考', '营养指南'],
      benefits: '节省时间和金钱，保证营养摄入'
    }
  ]

  suggestions.value = localSuggestions
  analysisReport.value = {
    currentStatus: '当前有15个待完成任务，工作量适中',
    strategy: '建议优先处理高优先级任务，合理分配时间',
    timeAdvice: '工作日晚上处理轻量任务，周末处理复杂任务',
    optimization: '可以将相似任务归类处理，提高效率'
  }
  
  showSuccessToast('已生成本地建议')
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case '高': return 'danger'
    case '中等': return 'warning' 
    case '低': return 'default'
    default: return 'default'
  }
}

const createTask = async (suggestion: TaskSuggestion) => {
  try {
    const taskData = {
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      category: suggestion.category,
      estimatedTime: suggestion.estimatedTime,
      suggestedDeadline: suggestion.suggestedTime
    }

    // 调用创建任务API
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(taskData)
    })

    if (response.ok) {
      showSuccessToast('任务创建成功')
      showDetails.value = false
    } else {
      showToast('创建任务失败')
    }
  } catch (error) {
    console.error('创建任务失败:', error)
    showToast('创建任务失败')
  }
}

const viewDetails = (suggestion: TaskSuggestion) => {
  selectedSuggestion.value = suggestion
  showDetails.value = true
}
</script>

<style scoped>
.task-suggestion-page {
  padding-bottom: 20px;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.nav-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.suggestion-form {
  margin: 16px 0;
}

.suggestion-button {
  margin: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.suggestions-result {
  margin: 16px 0;
}

.suggestion-item {
  margin-bottom: 12px;
}

.suggestion-card {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
}

.suggestion-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.suggestion-actions {
  display: flex;
  gap: 8px;
}

.analysis-report {
  margin: 16px 0;
}

.report-content {
  line-height: 1.6;
}

.report-content p {
  margin: 8px 0;
}

.details-popup {
  height: 80vh;
  border-radius: 16px 16px 0 0;
}

.task-details {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.task-details h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.detail-section {
  margin: 16px 0;
}

.detail-section h4 {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.detail-section ol {
  padding-left: 20px;
  line-height: 1.6;
}

.detail-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.loading-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
}
</style>