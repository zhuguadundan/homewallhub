<template>
  <div class="menu-page">
    <!-- 页面头部 -->
    <van-nav-bar
      title="家庭点菜"
      left-arrow
      @click-left="$router.go(-1)"
    >
      <template #right>
        <van-icon name="plus" @click="showCreateMenu = true" />
      </template>
    </van-nav-bar>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-number">{{ stats.total_menus || 0 }}</div>
        <div class="stat-label">总菜单</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.voting_menus || 0 }}</div>
        <div class="stat-label">投票中</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.completed_menus || 0 }}</div>
        <div class="stat-label">已完成</div>
      </div>
    </div>

    <!-- 菜单列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="refreshData">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadMenus"
      >
        <div v-for="menu in menuList" :key="menu.id" class="menu-item">
          <div class="menu-header" @click="goToMenuDetail(menu.id)">
            <div class="menu-info">
              <h3 class="menu-title">{{ menu.name }}</h3>
              <p class="menu-desc">{{ menu.description }}</p>
              <div class="menu-meta">
                <span class="menu-date">{{ formatDate(menu.target_date) }}</span>
                <span class="menu-status" :class="menu.status">{{ getStatusText(menu.status) }}</span>
              </div>
            </div>
            <van-icon name="arrow" class="arrow-icon" />
          </div>
          
          <div class="menu-actions" v-if="menu.status === 'draft'">
            <van-button size="small" type="primary" @click="startVoting(menu.id)">
              开始投票
            </van-button>
            <van-button size="small" @click="editMenu(menu)">
              编辑
            </van-button>
            <van-button size="small" type="danger" @click="deleteMenu(menu.id)">
              删除
            </van-button>
          </div>
          
          <div class="menu-progress" v-if="menu.status === 'voting'">
            <div class="progress-info">
              <span>投票进度: {{ menu.vote_count || 0 }}/{{ menu.member_count || 0 }}</span>
              <span class="deadline">截止: {{ formatDate(menu.voting_deadline) }}</span>
            </div>
            <van-progress :percentage="getVoteProgress(menu)" />
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 创建菜单弹窗 -->
    <van-popup
      v-model:show="showCreateMenu"
      position="bottom"
      :style="{ height: '70%' }"
      round
    >
      <div class="create-menu-form">
        <h3>创建新菜单</h3>
        <van-form @submit="createMenu">
          <van-field
            v-model="menuForm.name"
            name="name"
            label="菜单名称"
            placeholder="请输入菜单名称"
            :rules="[{ required: true, message: '请输入菜单名称' }]"
          />
          <van-field
            v-model="menuForm.description"
            name="description"
            label="菜单描述"
            placeholder="请输入菜单描述"
            type="textarea"
            rows="3"
          />
          <van-field
            v-model="menuForm.target_date"
            name="target_date"
            label="目标日期"
            placeholder="选择用餐日期"
            readonly
            @click="showDatePicker = true"
          />
          <van-field
            v-model="menuForm.voting_deadline"
            name="voting_deadline"
            label="投票截止"
            placeholder="选择投票截止时间"
            readonly
            @click="showTimePicker = true"
          />
          <div class="form-actions">
            <van-button round block type="primary" native-type="submit">
              创建菜单
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 日期选择器 -->
    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-date-picker
        v-model="selectedDate"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>

    <!-- 时间选择器 -->
    <van-popup v-model:show="showTimePicker" position="bottom">
      <van-datetime-picker
        v-model="selectedTime"
        type="datetime"
        @confirm="onTimeConfirm"
        @cancel="showTimePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { menuApi } from '@/api/menu'

const router = useRouter()

// 响应式数据
const menuList = ref([])
const stats = ref({})
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const showCreateMenu = ref(false)
const showDatePicker = ref(false)
const showTimePicker = ref(false)
const selectedDate = ref(new Date())
const selectedTime = ref(new Date())

const menuForm = reactive({
  name: '',
  description: '',
  target_date: '',
  voting_deadline: ''
})

// 分页数据
const pageData = reactive({
  current: 1,
  size: 20
})

// 页面初始化
onMounted(() => {
  loadStats()
  loadMenus()
})

// 加载统计数据
const loadStats = async () => {
  try {
    const response = await menuApi.getStats()
    stats.value = response.data
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 加载菜单列表
const loadMenus = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const response = await menuApi.getMenuList({
      page: pageData.current,
      limit: pageData.size
    })
    
    if (pageData.current === 1) {
      menuList.value = response.data.menus
    } else {
      menuList.value.push(...response.data.menus)
    }
    
    finished.value = response.data.pagination.current_page >= response.data.pagination.total_pages
    pageData.current++
  } catch (error) {
    showToast('加载菜单列表失败')
    console.error('加载菜单列表失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 刷新数据
const refreshData = () => {
  pageData.current = 1
  finished.value = false
  loadStats()
  loadMenus()
}

// 创建菜单
const createMenu = async () => {
  try {
    await menuApi.createMenu(menuForm)
    showToast('菜单创建成功')
    showCreateMenu.value = false
    resetForm()
    refreshData()
  } catch (error) {
    showToast('菜单创建失败')
    console.error('菜单创建失败:', error)
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(menuForm, {
    name: '',
    description: '',
    target_date: '',
    voting_deadline: ''
  })
}

// 开始投票
const startVoting = async (menuId: string) => {
  try {
    await showConfirmDialog({
      title: '确认操作',
      message: '确定要开始投票吗？开始后将无法修改菜单。'
    })
    
    await menuApi.startVoting(menuId)
    showToast('投票已开始')
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      showToast('操作失败')
      console.error('开始投票失败:', error)
    }
  }
}

// 删除菜单
const deleteMenu = async (menuId: string) => {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '确定要删除这个菜单吗？此操作无法撤销。'
    })
    
    await menuApi.deleteMenu(menuId)
    showToast('菜单已删除')
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      showToast('删除失败')
      console.error('删除菜单失败:', error)
    }
  }
}

// 日期确认
const onDateConfirm = (value: Date) => {
  menuForm.target_date = formatDate(value)
  showDatePicker.value = false
}

// 时间确认
const onTimeConfirm = (value: Date) => {
  menuForm.voting_deadline = formatDateTime(value)
  showTimePicker.value = false
}

// 跳转到菜单详情
const goToMenuDetail = (menuId: string) => {
  router.push(`/menu/${menuId}`)
}

// 编辑菜单
const editMenu = (menu: any) => {
  // 实现编辑逻辑
  console.log('编辑菜单:', menu)
}

// 工具函数
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const formatDateTime = (date: Date) => {
  return date.toISOString()
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

const getVoteProgress = (menu: any) => {
  if (!menu.member_count) return 0
  return Math.round((menu.vote_count || 0) / menu.member_count * 100)
}
</script>

<style scoped>
.menu-page {
  background-color: #f7f8fa;
  min-height: 100vh;
}

.stats-cards {
  display: flex;
  padding: 16px;
  gap: 12px;
}

.stat-card {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #1890ff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.menu-item {
  margin: 0 16px 12px;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.menu-header {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
}

.menu-info {
  flex: 1;
}

.menu-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #323233;
}

.menu-desc {
  font-size: 14px;
  color: #646566;
  margin: 0 0 8px 0;
}

.menu-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-date {
  font-size: 12px;
  color: #969799;
}

.menu-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #646566;
}

.menu-status.voting {
  background: #fff7e6;
  color: #fa8c16;
}

.menu-status.finalized {
  background: #f6ffed;
  color: #52c41a;
}

.arrow-icon {
  color: #c8c9cc;
  font-size: 16px;
}

.menu-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f2f3f5;
}

.menu-progress {
  padding: 12px 16px;
  border-top: 1px solid #f2f3f5;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #646566;
}

.deadline {
  color: #fa8c16;
}

.create-menu-form {
  padding: 24px;
}

.create-menu-form h3 {
  text-align: center;
  margin-bottom: 24px;
  color: #323233;
}

.form-actions {
  margin-top: 24px;
}
</style>