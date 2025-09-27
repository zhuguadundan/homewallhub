<template>
  <div class="inventory-page">
    <!-- 顶部统计卡片 -->
    <div class="stats-section">
      <van-row gutter="12">
        <van-col span="6">
          <div class="stat-card">
            <div class="stat-number">{{ statistics.total_items }}</div>
            <div class="stat-label">总物品</div>
          </div>
        </van-col>
        <van-col span="6">
          <div class="stat-card warning">
            <div class="stat-number">{{ statistics.low_stock_items }}</div>
            <div class="stat-label">库存不足</div>
          </div>
        </van-col>
        <van-col span="6">
          <div class="stat-card danger">
            <div class="stat-number">{{ statistics.expired_items }}</div>
            <div class="stat-label">已过期</div>
          </div>
        </van-col>
        <van-col span="6">
          <div class="stat-card info">
            <div class="stat-number">{{ statistics.expiring_soon_items }}</div>
            <div class="stat-label">即将过期</div>
          </div>
        </van-col>
      </van-row>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-section">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索物品名称、品牌"
        @search="handleSearch"
        @clear="handleSearch"
      />
      
      <div class="filter-tabs">
        <van-tabs v-model="activeTab" @change="handleTabChange">
          <van-tab title="全部" name="all" />
          <van-tab title="库存不足" name="low_stock" />
          <van-tab title="即将过期" name="expiring_soon" />
          <van-tab title="已过期" name="expired" />
        </van-tabs>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="category-filter" v-if="categories.length > 0">
      <van-row gutter="8">
        <van-col span="4" v-for="category in categories" :key="category.id">
          <div 
            class="category-chip"
            :class="{ active: selectedCategoryId === category.id }"
            @click="handleCategorySelect(category.id)"
          >
            <span class="category-icon">{{ category.icon || '📦' }}</span>
            <span class="category-name">{{ category.name }}</span>
          </div>
        </van-col>
      </van-row>
    </div>    <!-- 库存物品列表 -->
    <div class="inventory-list">
      <van-pull-refresh v-model="refreshing" @refresh="handleRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadItems"
        >
          <div v-for="item in items" :key="item.id" class="inventory-item">
            <van-card
              :title="item.name"
              :desc="`${item.brand || ''} | ${item.location || '未设置位置'}`"
              :tag="getCategoryName(item.category_id)"
              @click="handleItemClick(item)"
            >
              <template #thumb>
                <div class="item-thumb">
                  <span class="category-icon">{{ getCategoryIcon(item.category_id) }}</span>
                </div>
              </template>
              
              <template #bottom>
                <div class="item-stock">
                  <div class="stock-info">
                    <span class="stock-amount" :class="getStockStatus(item)">
                      {{ item.current_stock }} {{ item.unit }}
                    </span>
                    <span class="stock-threshold" v-if="item.min_stock_threshold > 0">
                      / 最低 {{ item.min_stock_threshold }}
                    </span>
                  </div>
                  
                  <div class="item-actions">
                    <van-button 
                      type="primary" 
                      size="mini"
                      @click.stop="handleStockIn(item)"
                    >
                      入库
                    </van-button>
                    <van-button 
                      type="default" 
                      size="mini"
                      @click.stop="handleStockOut(item)"
                    >
                      出库
                    </van-button>
                  </div>
                </div>
              </template>
            </van-card>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 浮动添加按钮 -->
    <van-floating-bubble
      axis="xy"
      icon="plus"
      @click="handleAddItem"
    />

    <!-- 入库弹窗 -->
    <van-popup 
      v-model:show="showStockInModal" 
      position="bottom" 
      round 
      :style="{ height: '60%' }"
    >
      <div class="modal-header">
        <h3>{{ currentItem?.name }} - 入库</h3>
      </div>
      <div class="modal-content">
        <van-form @submit="handleStockInSubmit">
          <van-field
            v-model="stockInForm.quantity"
            type="number"
            label="入库数量"
            placeholder="请输入入库数量"
            required
          />
          <van-field
            v-model="stockInForm.purchase_date"
            type="date"
            label="采购日期"
            placeholder="请选择采购日期"
            required
          />
          <van-field
            v-model="stockInForm.expiry_date"
            type="date"
            label="过期日期"
            placeholder="请选择过期日期（可选）"
          />
          <van-field
            v-model="stockInForm.unit_price"
            type="number"
            label="单价"
            placeholder="请输入单价（可选）"
          />
          <van-field
            v-model="stockInForm.supplier"
            label="供应商"
            placeholder="请输入供应商（可选）"
          />
          <van-field
            v-model="stockInForm.notes"
            type="textarea"
            label="备注"
            placeholder="请输入备注（可选）"
            rows="3"
          />
          
          <div class="modal-actions">
            <van-button @click="showStockInModal = false">取消</van-button>
            <van-button type="primary" native-type="submit" :loading="submitting">
              确认入库
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>    <!-- 出库弹窗 -->
    <van-popup 
      v-model:show="showStockOutModal" 
      position="bottom" 
      round 
      :style="{ height: '40%' }"
    >
      <div class="modal-header">
        <h3>{{ currentItem?.name }} - 出库</h3>
        <p>当前库存：{{ currentItem?.current_stock }} {{ currentItem?.unit }}</p>
      </div>
      <div class="modal-content">
        <van-form @submit="handleStockOutSubmit">
          <van-field
            v-model="stockOutForm.quantity"
            type="number"
            label="出库数量"
            placeholder="请输入出库数量"
            required
            :rules="[{ 
              validator: (val) => val <= (currentItem?.current_stock || 0), 
              message: '出库数量不能超过当前库存' 
            }]"
          />
          <van-field
            v-model="stockOutForm.reason"
            label="出库原因"
            placeholder="请输入出库原因"
          />
          
          <div class="modal-actions">
            <van-button @click="showStockOutModal = false">取消</van-button>
            <van-button type="primary" native-type="submit" :loading="submitting">
              确认出库
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast, showConfirmDialog } from 'vant'

// 响应式数据
const userStore = useUserStore()
const router = useRouter()

// 统计数据
const statistics = reactive({
  total_items: 0,
  total_categories: 0,
  low_stock_items: 0,
  expired_items: 0,
  expiring_soon_items: 0,
  recent_transactions: 0
})

// 筛选状态
const searchKeyword = ref('')
const activeTab = ref('all')
const selectedCategoryId = ref('')

// 列表状态
const items = ref([])
const categories = ref([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = ref(20)

// 弹窗状态
const showStockInModal = ref(false)
const showStockOutModal = ref(false)
const currentItem = ref(null)
const submitting = ref(false)

// 表单数据
const stockInForm = reactive({
  quantity: '',
  purchase_date: '',
  expiry_date: '',
  unit_price: '',
  supplier: '',
  notes: ''
})

const stockOutForm = reactive({
  quantity: '',
  reason: ''
});

// 计算属性
const familyId = computed(() => userStore.currentFamily?.id)

// 生命周期
onMounted(() => {
  if (familyId.value) {
    loadStatistics()
    loadCategories()
    loadItems()
  }
})

// 方法
const loadStatistics = async () => {
  try {
    // 调用API获取统计数据
    showToast('获取统计数据成功')
  } catch (error) {
    showToast('获取统计数据失败')
  }
}

const loadCategories = async () => {
  try {
    // 调用API获取分类数据
    categories.value = [
      { id: '1', name: '蔬菜类', icon: '🥬' },
      { id: '2', name: '水果类', icon: '🍎' },
      { id: '3', name: '肉类', icon: '🥩' },
      { id: '4', name: '调料', icon: '🧂' }
    ]
  } catch (error) {
    showToast('获取分类数据失败')
  }
}

const loadItems = async () => {
  if (loading.value || finished.value) return
  
  loading.value = true
  try {
    // 模拟API调用
    const mockItems = [
      {
        id: '1',
        name: '西红柿',
        brand: '新鲜果蔬',
        category_id: '1',
        unit: '斤',
        current_stock: 5,
        min_stock_threshold: 2,
        location: '冰箱'
      },
      {
        id: '2',
        name: '苹果',
        brand: '红富士',
        category_id: '2',
        unit: '个',
        current_stock: 1,
        min_stock_threshold: 5,
        location: '水果篮'
      }
    ]
    
    if (page.value === 1) {
      items.value = mockItems
    } else {
      items.value.push(...mockItems)
    }
    
    page.value++
    loading.value = false
    
    // 模拟数据加载完毕
    if (page.value > 2) {
      finished.value = true
    }
  } catch (error) {
    loading.value = false
    showToast('获取库存数据失败')
  }
}

const handleRefresh = async () => {
  page.value = 1
  finished.value = false
  await loadItems()
  await loadStatistics()
  refreshing.value = false
}

const handleSearch = () => {
  page.value = 1
  finished.value = false
  items.value = []
  loadItems()
}

const handleTabChange = (name) => {
  activeTab.value = name
  page.value = 1
  finished.value = false
  items.value = []
  loadItems()
};

const handleCategorySelect = (categoryId) => {
  if (selectedCategoryId.value === categoryId) {
    selectedCategoryId.value = ''
  } else {
    selectedCategoryId.value = categoryId
  }
  page.value = 1
  finished.value = false
  items.value = []
  loadItems()
}

const handleItemClick = (item) => {
  router.push(`/inventory/${item.id}`)
}

const handleAddItem = () => {
  router.push('/inventory/create')
}

const handleStockIn = (item) => {
  currentItem.value = item
  // 重置表单
  Object.assign(stockInForm, {
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    unit_price: '',
    supplier: '',
    notes: ''
  })
  showStockInModal.value = true
}

const handleStockOut = (item) => {
  currentItem.value = item
  // 重置表单
  Object.assign(stockOutForm, {
    quantity: '',
    reason: ''
  })
  showStockOutModal.value = true
}

const handleStockInSubmit = async () => {
  if (!currentItem.value) return
  
  submitting.value = true
  try {
    // 调用入库API
    showToast('入库成功')
    showStockInModal.value = false
    handleRefresh()
  } catch (error) {
    showToast('入库失败')
  } finally {
    submitting.value = false
  }
}

const handleStockOutSubmit = async () => {
  if (!currentItem.value) return
  
  submitting.value = true
  try {
    // 调用出库API
    showToast('出库成功')
    showStockOutModal.value = false
    handleRefresh()
  } catch (error) {
    showToast('出库失败')
  } finally {
    submitting.value = false
  }
}

// 工具函数
const getCategoryName = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '未分类'
}

const getCategoryIcon = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.icon || '📦'
}

const getStockStatus = (item) => {
  if (item.current_stock <= 0) return 'out-of-stock'
  if (item.current_stock <= item.min_stock_threshold) return 'low-stock'
  return 'normal-stock'
}
</script><style scoped>
.inventory-page {
  padding: 16px;
  padding-bottom: 80px;
  background-color: #f5f5f5;
}

/* 统计卡片样式 */
.stats-section {
  margin-bottom: 16px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border-left: 3px solid #1890ff;
}

.stat-card.warning {
  border-left-color: #fa8c16;
}

.stat-card.danger {
  border-left-color: #f5222d;
}

.stat-card.info {
  border-left-color: #722ed1;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #262626;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
}

/* 搜索筛选样式 */
.filter-section {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.filter-tabs {
  margin-top: 12px;
}

/* 分类筛选样式 */
.category-filter {
  margin-bottom: 16px;
}

.category-chip {
  background: white;
  border-radius: 16px;
  padding: 8px 12px;
  text-align: center;
  border: 1px solid #d9d9d9;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 8px;
}

.category-chip.active {
  background: #1890ff;
  border-color: #1890ff;
  color: white;
}

.category-chip:hover {
  border-color: #1890ff;
}

.category-icon {
  font-size: 16px;
  margin-bottom: 4px;
  display: block;
}

.category-name {
  font-size: 12px;
  display: block;
}

/* 库存物品样式 */
.inventory-list {
  margin-bottom: 60px;
}

.inventory-item {
  margin-bottom: 12px;
}

.item-thumb {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
}

.item-stock {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.stock-info {
  flex: 1;
}

.stock-amount {
  font-weight: bold;
  margin-right: 8px;
}

.stock-amount.normal-stock {
  color: #52c41a;
}

.stock-amount.low-stock {
  color: #fa8c16;
}

.stock-amount.out-of-stock {
  color: #f5222d;
}

.stock-threshold {
  font-size: 12px;
  color: #8c8c8c;
}

.item-actions {
  display: flex;
  gap: 8px;
}

/* 弹窗样式 */
.modal-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 500;
}

.modal-header p {
  margin: 0;
  color: #8c8c8c;
  font-size: 14px;
}

.modal-content {
  padding: 16px;
  max-height: calc(60vh - 80px);
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-actions .van-button {
  flex: 1;
}

/* 响应式调整 */
@media (max-width: 375px) {
  .inventory-page {
    padding: 12px;
  }
  
  .stat-card {
    padding: 8px;
  }
  
  .stat-number {
    font-size: 20px;
  }
  
  .category-chip {
    padding: 6px 8px;
  }
  
  .category-name {
    font-size: 10px;
  }
}
</style>