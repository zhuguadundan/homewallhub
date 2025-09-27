<template>
  <div class="menu-detail">
    <!-- 页面头部 -->
    <van-nav-bar
      :title="menuData.name || '菜单详情'"
      left-arrow
      @click-left="$router.go(-1)"
    >
      <template #right v-if="menuData.status === 'draft'">
        <van-icon name="edit" @click="editMenu" />
      </template>
    </van-nav-bar>

    <div v-if="loading" class="loading-container">
      <van-loading size="24px">加载中...</van-loading>
    </div>

    <div v-else class="menu-content">
      <!-- 菜单信息 -->
      <div class="menu-info-card">
        <h2 class="menu-title">{{ menuData.name }}</h2>
        <p class="menu-desc">{{ menuData.description }}</p>
        <div class="menu-meta">
          <div class="meta-item">
            <span class="label">目标日期:</span>
            <span class="value">{{ formatDate(menuData.target_date) }}</span>
          </div>
          <div class="meta-item">
            <span class="label">状态:</span>
            <span class="status" :class="menuData.status">{{ getStatusText(menuData.status) }}</span>
          </div>
          <div class="meta-item" v-if="menuData.voting_deadline">
            <span class="label">投票截止:</span>
            <span class="value">{{ formatDateTime(menuData.voting_deadline) }}</span>
          </div>
        </div>
      </div>

      <!-- 投票统计 -->
      <div v-if="menuData.status === 'voting' || menuData.status === 'finalized'" class="vote-stats-card">
        <h3>投票统计</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-number">{{ statistics.total_participants || 0 }}</span>
            <span class="stat-label">参与人数</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ statistics.total_votes || 0 }}</span>
            <span class="stat-label">总投票数</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ dishes.length || 0 }}</span>
            <span class="stat-label">菜品数量</span>
          </div>
        </div>
      </div>

      <!-- 菜品列表 -->
      <div class="dishes-section">
        <div class="section-header">
          <h3>菜品列表</h3>
          <van-button 
            v-if="menuData.status === 'draft'"
            size="small" 
            type="primary"
            @click="showAddDish = true"
          >
            添加菜品
          </van-button>
        </div>

        <div v-if="dishes.length === 0" class="empty-state">
          <van-empty description="暂无菜品" />
        </div>

        <div v-else class="dishes-list">
          <div 
            v-for="dish in dishes" 
            :key="dish.id" 
            class="dish-item"
            :class="{ voted: dish.user_vote }"
          >
            <div class="dish-info">
              <div class="dish-header">
                <h4 class="dish-name">{{ dish.name }}</h4>
                <span class="dish-category">{{ dish.category }}</span>
              </div>
              <p class="dish-desc">{{ dish.description }}</p>
              <div class="dish-meta">
                <span v-if="dish.estimated_price" class="price">
                  ¥{{ dish.estimated_price }}
                </span>
                <span v-if="dish.preparation_time" class="time">
                  {{ dish.preparation_time }}分钟
                </span>
                <span class="difficulty">{{ getDifficultyText(dish.difficulty_level) }}</span>
              </div>
            </div>

            <!-- 投票区域 -->
            <div v-if="menuData.status === 'voting'" class="vote-section">
              <div class="vote-buttons">
                <van-button
                  :type="dish.user_vote?.vote_type === 'like' ? 'primary' : 'default'"
                  size="small"
                  round
                  @click="voteForDish(dish.id, 'like')"
                >
                  <van-icon name="good-job" />
                  {{ dish.like_count || 0 }}
                </van-button>
                <van-button
                  :type="dish.user_vote?.vote_type === 'neutral' ? 'warning' : 'default'"
                  size="small"
                  round
                  @click="voteForDish(dish.id, 'neutral')"
                >
                  <van-icon name="minus" />
                  {{ dish.neutral_count || 0 }}
                </van-button>
                <van-button
                  :type="dish.user_vote?.vote_type === 'dislike' ? 'danger' : 'default'"
                  size="small"
                  round
                  @click="voteForDish(dish.id, 'dislike')"
                >
                  <van-icon name="delete" />
                  {{ dish.dislike_count || 0 }}
                </van-button>
              </div>
              <div v-if="dish.user_vote" class="vote-note">
                <van-field
                  v-model="dish.user_vote.notes"
                  placeholder="添加备注..."
                  type="textarea"
                  rows="2"
                  @blur="updateVoteNote(dish.id, dish.user_vote.notes)"
                />
              </div>
            </div>

            <!-- 投票结果展示 -->
            <div v-if="menuData.status === 'finalized'" class="vote-result">
              <div class="result-bar">
                <div class="like-bar" :style="{ width: getVotePercentage(dish, 'like') + '%' }"></div>
                <div class="neutral-bar" :style="{ width: getVotePercentage(dish, 'neutral') + '%' }"></div>
                <div class="dislike-bar" :style="{ width: getVotePercentage(dish, 'dislike') + '%' }"></div>
              </div>
              <div class="result-text">
                <span class="like">👍 {{ dish.like_count || 0 }}</span>
                <span class="neutral">😐 {{ dish.neutral_count || 0 }}</span>
                <span class="dislike">👎 {{ dish.dislike_count || 0 }}</span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div v-if="menuData.status === 'draft'" class="dish-actions">
              <van-button size="mini" @click="editDish(dish)">编辑</van-button>
              <van-button size="mini" type="danger" @click="deleteDish(dish.id)">删除</van-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="menuData.status === 'draft'">
        <van-button type="primary" block @click="startVoting">开始投票</van-button>
      </div>
      
      <div class="action-buttons" v-if="menuData.status === 'voting'">
        <van-button type="success" block @click="finalizeMenu">完成投票</van-button>
      </div>

      <div class="action-buttons" v-if="menuData.status === 'finalized'">
        <van-button type="primary" block @click="viewResult">查看结果统计</van-button>
      </div>
    </div>

    <!-- 添加菜品弹窗 -->
    <van-popup
      v-model:show="showAddDish"
      position="bottom"
      :style="{ height: '80%' }"
      round
    >
      <div class="add-dish-form">
        <h3>添加菜品</h3>
        <van-form @submit="addDish">
          <van-field
            v-model="dishForm.name"
            name="name"
            label="菜品名称"
            placeholder="请输入菜品名称"
            :rules="[{ required: true, message: '请输入菜品名称' }]"
          />
          <van-field
            v-model="dishForm.description"
            name="description"
            label="菜品描述"
            placeholder="请输入菜品描述"
            type="textarea"
            rows="3"
          />
          <van-field
            v-model="dishForm.category"
            name="category"
            label="菜品类别"
            placeholder="选择菜品类别"
            readonly
            @click="showCategoryPicker = true"
          />
          <van-field
            v-model="dishForm.estimated_price"
            name="price"
            label="预估价格"
            placeholder="请输入预估价格"
            type="number"
          />
          <van-field
            v-model="dishForm.preparation_time"
            name="time"
            label="制作时间"
            placeholder="请输入制作时间(分钟)"
            type="number"
          />
          <van-field
            v-model="dishForm.difficulty_level"
            name="difficulty"
            label="难易程度"
            placeholder="选择难易程度"
            readonly
            @click="showDifficultyPicker = true"
          />
          <div class="form-actions">
            <van-button round block type="primary" native-type="submit">
              添加菜品
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 分类选择器 -->
    <van-popup v-model:show="showCategoryPicker" position="bottom">
      <van-picker
        :columns="categoryOptions"
        @confirm="onCategoryConfirm"
        @cancel="showCategoryPicker = false"
      />
    </van-popup>

    <!-- 难度选择器 -->
    <van-popup v-model:show="showDifficultyPicker" position="bottom">
      <van-picker
        :columns="difficultyOptions"
        @confirm="onDifficultyConfirm"
        @cancel="showDifficultyPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { menuApi } from '@/api/menu'

const route = useRoute()
const router = useRouter()

// 响应式数据
const loading = ref(true)
const menuData = ref({})
const dishes = ref([])
const statistics = ref({})
const showAddDish = ref(false)
const showCategoryPicker = ref(false)
const showDifficultyPicker = ref(false)

const dishForm = reactive({
  name: '',
  description: '',
  category: '',
  estimated_price: '',
  preparation_time: '',
  difficulty_level: ''
})

const categoryOptions = [
  { text: '主食', value: '主食' },
  { text: '荤菜', value: '荤菜' },
  { text: '素菜', value: '素菜' },
  { text: '汤品', value: '汤品' },
  { text: '甜点', value: '甜点' },
  { text: '其他', value: '其他' }
]

const difficultyOptions = [
  { text: '简单', value: 'easy' },
  { text: '中等', value: 'medium' },
  { text: '困难', value: 'hard' }
]

// 页面初始化
onMounted(() => {
  loadMenuDetail()
})

// 加载菜单详情
const loadMenuDetail = async () => {
  const menuId = route.params.id as string
  
  try {
    loading.value = true
    const response = await menuApi.getMenuDetail(menuId)
    menuData.value = response.data
    dishes.value = response.data.dishes || []
    statistics.value = response.data.statistics || {}
  } catch (error) {
    showToast('加载菜单详情失败')
    console.error('加载菜单详情失败:', error)
  } finally {
    loading.value = false
  }
}

// 投票
const voteForDish = async (dishId: string, voteType: string) => {
  try {
    await menuApi.voteForDish(dishId, {
      vote_type: voteType,
      priority: 1
    })
    showToast('投票成功')
    loadMenuDetail() // 重新加载数据
  } catch (error) {
    showToast('投票失败')
    console.error('投票失败:', error)
  }
}

// 更新投票备注
const updateVoteNote = async (dishId: string, notes: string) => {
  try {
    await menuApi.voteForDish(dishId, {
      vote_type: 'like', // 保持原投票类型
      priority: 1,
      notes
    })
  } catch (error) {
    console.error('更新备注失败:', error)
  }
}

// 添加菜品
const addDish = async () => {
  try {
    await menuApi.addDish(menuData.value.id, dishForm)
    showToast('菜品添加成功')
    showAddDish.value = false
    resetDishForm()
    loadMenuDetail()
  } catch (error) {
    showToast('菜品添加失败')
    console.error('菜品添加失败:', error)
  }
}

// 重置菜品表单
const resetDishForm = () => {
  Object.assign(dishForm, {
    name: '',
    description: '',
    category: '',
    estimated_price: '',
    preparation_time: '',
    difficulty_level: ''
  })
}

// 开始投票
const startVoting = async () => {
  try {
    await showConfirmDialog({
      title: '确认操作',
      message: '确定要开始投票吗？开始后将无法修改菜品。'
    })
    
    await menuApi.startVoting(menuData.value.id)
    showToast('投票已开始')
    loadMenuDetail()
  } catch (error) {
    if (error !== 'cancel') {
      showToast('操作失败')
      console.error('开始投票失败:', error)
    }
  }
}

// 完成投票
const finalizeMenu = async () => {
  try {
    await showConfirmDialog({
      title: '确认操作',
      message: '确定要完成投票吗？完成后将无法继续投票。'
    })
    
    await menuApi.finalizeMenu(menuData.value.id)
    showToast('投票已完成')
    loadMenuDetail()
  } catch (error) {
    if (error !== 'cancel') {
      showToast('操作失败')
      console.error('完成投票失败:', error)
    }
  }
}

// 查看结果统计
const viewResult = () => {
  router.push(`/menu/${menuData.value.id}/result`)
}

// 选择器确认事件
const onCategoryConfirm = ({ selectedValues }) => {
  dishForm.category = selectedValues[0]
  showCategoryPicker.value = false
}

const onDifficultyConfirm = ({ selectedValues }) => {
  dishForm.difficulty_level = selectedValues[0]
  showDifficultyPicker.value = false
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

const getStatusText = (status: string) => {
  const statusMap = {
    draft: '草稿',
    voting: '投票中',
    finalized: '已确定',
    completed: '已完成'
  }
  return statusMap[status] || status
}

const getDifficultyText = (level: string) => {
  const difficultyMap = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  }
  return difficultyMap[level] || level
}

const getVotePercentage = (dish: any, type: string) => {
  const total = (dish.like_count || 0) + (dish.neutral_count || 0) + (dish.dislike_count || 0)
  if (total === 0) return 0
  const count = dish[type + '_count'] || 0
  return Math.round((count / total) * 100)
}

// 占位函数
const editMenu = () => console.log('编辑菜单')
const editDish = (dish: any) => console.log('编辑菜品:', dish)
const deleteDish = (dishId: string) => console.log('删除菜品:', dishId)
</script>

<style scoped>
.menu-detail {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.menu-content {
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
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.menu-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 14px;
  color: #969799;
  min-width: 80px;
}

.value {
  font-size: 14px;
  color: #323233;
}

.status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #646566;
}

.status.voting {
  background: #fff7e6;
  color: #fa8c16;
}

.status.finalized {
  background: #f6ffed;
  color: #52c41a;
}

.vote-stats-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.vote-stats-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #323233;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.dishes-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #323233;
}

.dishes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dish-item {
  border: 1px solid #ebedf0;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
}

.dish-item.voted {
  border-color: #1890ff;
  background: #f0f9ff;
}

.dish-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dish-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #323233;
}

.dish-category {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #646566;
}

.dish-desc {
  font-size: 14px;
  color: #646566;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.dish-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.price {
  color: #f56565;
  font-weight: 600;
}

.vote-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebedf0;
}

.vote-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.vote-note {
  margin-top: 8px;
}

.vote-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebedf0;
}

.result-bar {
  height: 6px;
  border-radius: 3px;
  background: #f2f3f5;
  overflow: hidden;
  margin-bottom: 8px;
  display: flex;
}

.like-bar {
  background: #52c41a;
}

.neutral-bar {
  background: #fa8c16;
}

.dislike-bar {
  background: #f56565;
}

.result-text {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.dish-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebedf0;
  display: flex;
  gap: 8px;
}

.action-buttons {
  margin-top: 16px;
}

.add-dish-form {
  padding: 24px;
}

.add-dish-form h3 {
  text-align: center;
  margin-bottom: 24px;
  color: #323233;
}

.form-actions {
  margin-top: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}
</style>