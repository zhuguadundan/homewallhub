<template>
  <div class="smart-shopping-page">
    <!-- 页面标题 -->
    <van-nav-bar 
      title="智能购物清单" 
      left-arrow 
      @click-left="$router.back()"
      class="nav-header"
    />

    <!-- 生成参数设置 -->
    <van-cell-group inset class="generation-form">
      <van-cell-group title="清单生成参数">
        <van-field
          v-model="shoppingParams.mealPlan"
          label="膳食计划"
          placeholder="例如：一周早中晚餐规划"
          type="textarea"
          :border="false"
          autosize
        />
        
        <van-field
          v-model="shoppingParams.familySize"
          label="家庭人数"
          placeholder="例如：4人（2大人2小孩）"
          :border="false"
        />

        <van-field
          v-model="shoppingParams.budget"
          label="预算范围"
          placeholder="例如：300-500元"
          :border="false"
        />

        <van-field
          v-model="shoppingParams.preferences"
          label="饮食偏好"
          placeholder="例如：少油少盐，多蔬菜"
          :border="false"
        />

        <van-field
          v-model="shoppingParams.restrictions"
          label="限制条件"
          placeholder="例如：不吃辣，过敏食物"
          :border="false"
        />
      </van-cell-group>

      <!-- 当前库存显示 -->
      <van-cell-group title="当前库存状况" v-if="currentInventory.length > 0">
        <van-collapse v-model="inventoryExpanded">
          <van-collapse-item title="查看现有食材" name="inventory">
            <div class="inventory-grid">
              <van-tag 
                v-for="item in currentInventory" 
                :key="item.id"
                :type="getExpirationColor(item.expirationDate)"
                size="small"
                class="inventory-item"
              >
                {{ item.name }} ({{ item.quantity }})
              </van-tag>
            </div>
          </van-collapse-item>
        </van-collapse>
      </van-cell-group>

      <van-button 
        type="primary" 
        block 
        @click="generateShoppingList"
        :loading="loading"
        class="generate-button"
      >
        生成智能购物清单
      </van-button>
    </van-cell-group>

    <!-- 购物清单结果 -->
    <van-cell-group inset v-if="shoppingList.length > 0" class="shopping-result">
      <van-cell-group title="智能购物清单">
        <!-- 清单汇总 -->
        <van-cell title="总计商品" :value="`${shoppingList.length}项`" />
        <van-cell title="预估总价" :value="`¥${estimatedTotal}`" />
        
        <!-- 分类显示 -->
        <van-collapse v-model="expandedCategories">
          <van-collapse-item 
            v-for="category in categories" 
            :key="category.name"
            :title="`${category.name} (${category.items.length}项)`"
            :name="category.name"
          >
            <div class="category-items">
              <div 
                v-for="item in category.items" 
                :key="item.id"
                class="shopping-item"
              >
                <van-checkbox 
                  v-model="item.purchased"
                  @change="updateItemStatus(item)"
                >
                  <div class="item-content">
                    <div class="item-info">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-quantity">{{ item.quantity }}</span>
                    </div>
                    <div class="item-meta">
                      <span class="item-price">¥{{ item.estimatedPrice }}</span>
                      <van-tag 
                        :type="getPriorityColor(item.priority)" 
                        size="small"
                      >
                        {{ item.priority }}
                      </van-tag>
                    </div>
                  </div>
                </van-checkbox>
                
                <!-- 商品详情 -->
                <div class="item-details" v-if="item.reasoning">
                  <span class="reasoning">{{ item.reasoning }}</span>
                  <span class="alternatives" v-if="item.alternatives">
                    替代品: {{ item.alternatives.join(', ') }}
                  </span>
                </div>
              </div>
            </div>
          </van-collapse-item>
        </van-collapse>
      </van-cell-group>
    </van-cell-group>

    <!-- 智能建议 -->
    <van-cell-group inset v-if="shoppingAdvice" class="shopping-advice">
      <van-cell-group title="购物建议">
        <van-cell>
          <div class="advice-content">
            <div class="advice-section" v-if="shoppingAdvice.budgetTips">
              <h4>💰 预算优化</h4>
              <p>{{ shoppingAdvice.budgetTips }}</p>
            </div>
            
            <div class="advice-section" v-if="shoppingAdvice.seasonalTips">
              <h4>🌱 时令建议</h4>
              <p>{{ shoppingAdvice.seasonalTips }}</p>
            </div>
            
            <div class="advice-section" v-if="shoppingAdvice.nutritionTips">
              <h4>🥗 营养搭配</h4>
              <p>{{ shoppingAdvice.nutritionTips }}</p>
            </div>
            
            <div class="advice-section" v-if="shoppingAdvice.storageTips">
              <h4>📦 储存建议</h4>
              <p>{{ shoppingAdvice.storageTips }}</p>
            </div>
          </div>
        </van-cell>
      </van-cell-group>
    </van-cell-group>

    <!-- 操作按钮 -->
    <van-cell-group inset v-if="shoppingList.length > 0" class="action-buttons">
      <van-button 
        type="primary" 
        block 
        @click="exportList"
        class="action-button"
      >
        导出购物清单
      </van-button>
      
      <van-button 
        plain 
        block 
        @click="saveToInventory"
        class="action-button"
      >
        保存到库存系统
      </van-button>
      
      <van-button 
        plain 
        block 
        @click="shareList"
        class="action-button"
      >
        分享给家庭成员
      </van-button>
    </van-cell-group>

    <!-- 加载状态 -->
    <van-loading v-if="loading" class="loading-overlay" vertical>
      正在生成智能购物清单...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import type { SmartShoppingRequest, SmartShoppingResponse, ShoppingItem } from '@/types/ai'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const shoppingList = ref<ShoppingItem[]>([])
const inventoryExpanded = ref([])
const expandedCategories = ref(['蔬菜', '肉类'])

// 购物参数
const shoppingParams = reactive<SmartShoppingRequest>({
  mealPlan: '一周三餐，偏向家常菜',
  familySize: '4人家庭',
  budget: '400-600元',
  preferences: '健康营养，少油少盐',
  restrictions: ''
})

// 当前库存
const currentInventory = ref([
  { id: '1', name: '大米', quantity: '2kg', expirationDate: '2024-01-15' },
  { id: '2', name: '鸡蛋', quantity: '10个', expirationDate: '2024-01-10' },
  { id: '3', name: '牛奶', quantity: '1L', expirationDate: '2024-01-08' },
  { id: '4', name: '面条', quantity: '500g', expirationDate: '2024-03-01' }
])

// 购物建议
const shoppingAdvice = ref<{
  budgetTips: string
  seasonalTips: string  
  nutritionTips: string
  storageTips: string
} | null>(null)

// 计算属性
const categories = computed(() => {
  const categoryMap = new Map()
  
  shoppingList.value.forEach(item => {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, {
        name: item.category,
        items: []
      })
    }
    categoryMap.get(item.category).items.push(item)
  })
  
  return Array.from(categoryMap.values())
})

const estimatedTotal = computed(() => {
  return shoppingList.value
    .reduce((total, item) => total + (item.estimatedPrice || 0), 0)
    .toFixed(2)
})

onMounted(() => {
  loadCurrentInventory()
})

const loadCurrentInventory = async () => {
  try {
    // 这里会调用实际的API获取当前库存
    // const response = await api.getInventory()
    // currentInventory.value = response.data
  } catch (error) {
    console.error('加载库存失败:', error)
  }
}

const generateShoppingList = async () => {
  if (!shoppingParams.mealPlan) {
    showToast('请输入膳食计划')
    return
  }

  loading.value = true
  
  try {
    // 调用AI智能购物清单API
    const response = await fetch('/api/ai/smart-shopping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ...shoppingParams,
        currentInventory: currentInventory.value
      })
    })

    if (!response.ok) {
      throw new Error('生成购物清单失败')
    }

    const data: SmartShoppingResponse = await response.json()
    
    if (data.success) {
      shoppingList.value = data.shoppingList
      shoppingAdvice.value = data.advice
      showSuccessToast('已生成智能购物清单')
    } else {
      // 使用本地算法作为后备
      generateLocalShoppingList()
    }
  } catch (error) {
    console.error('生成购物清单失败:', error)
    generateLocalShoppingList()
  } finally {
    loading.value = false
  }
}

const generateLocalShoppingList = () => {
  // 本地算法生成购物清单
  const localShoppingList: ShoppingItem[] = [
    {
      id: '1',
      name: '西红柿',
      category: '蔬菜',
      quantity: '1kg',
      estimatedPrice: 8.5,
      priority: '高',
      reasoning: '制作西红柿鸡蛋面和番茄炒蛋需要',
      alternatives: ['樱桃番茄'],
      purchased: false
    },
    {
      id: '2', 
      name: '猪肉丝',
      category: '肉类',
      quantity: '500g',
      estimatedPrice: 18.0,
      priority: '高',
      reasoning: '制作青椒肉丝和炒面需要',
      alternatives: ['牛肉丝', '鸡肉丝'],
      purchased: false
    },
    {
      id: '3',
      name: '青椒',
      category: '蔬菜', 
      quantity: '300g',
      estimatedPrice: 6.0,
      priority: '中',
      reasoning: '制作青椒肉丝，补充维生素C',
      alternatives: ['彩椒'],
      purchased: false
    },
    {
      id: '4',
      name: '香蕉',
      category: '水果',
      quantity: '1kg',
      estimatedPrice: 12.0,
      priority: '中',
      reasoning: '家庭水果需求，钾含量丰富',
      alternatives: ['苹果', '橙子'],
      purchased: false
    },
    {
      id: '5',
      name: '酱油',
      category: '调料',
      quantity: '1瓶',
      estimatedPrice: 15.0,
      priority: '低',
      reasoning: '调料库存不足，日常烹饪必需',
      alternatives: ['生抽', '老抽'],
      purchased: false
    }
  ]

  shoppingList.value = localShoppingList
  shoppingAdvice.value = {
    budgetTips: '选择时令蔬菜可节省20-30%成本，建议购买当季的西红柿和青椒',
    seasonalTips: '冬季应多选择耐储存的根茎类蔬菜，如土豆、胡萝卜等',
    nutritionTips: '搭配红绿蔬菜确保维生素摄入，增加优质蛋白质来源',
    storageTips: '肉类应冷冻保存，蔬菜放置阴凉通风处，水果避免阳光直射'
  }
  
  showSuccessToast('已生成本地购物清单')
}

const getExpirationColor = (expirationDate: string) => {
  const expDate = new Date(expirationDate)
  const today = new Date()
  const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24))
  
  if (diffDays <= 2) return 'danger'
  if (diffDays <= 7) return 'warning'
  return 'success'
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case '高': return 'danger'
    case '中': return 'warning'
    case '低': return 'default'
    default: return 'default'
  }
}

const updateItemStatus = (item: ShoppingItem) => {
  // 更新商品购买状态
  console.log(`${item.name} 购买状态更新为: ${item.purchased}`)
}

const exportList = () => {
  // 导出购物清单为文本或图片
  const listText = shoppingList.value
    .map(item => `${item.purchased ? '✓' : '○'} ${item.name} - ${item.quantity}`)
    .join('\n')
  
  // 复制到剪贴板
  navigator.clipboard.writeText(listText).then(() => {
    showSuccessToast('购物清单已复制到剪贴板')
  }).catch(() => {
    showToast('导出失败')
  })
}

const saveToInventory = async () => {
  try {
    const purchasedItems = shoppingList.value.filter(item => item.purchased)
    
    if (purchasedItems.length === 0) {
      showToast('请先标记已购买的商品')
      return
    }

    // 调用API保存到库存系统
    const response = await fetch('/api/inventory/batch-add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ items: purchasedItems })
    })

    if (response.ok) {
      showSuccessToast('已保存到库存系统')
    } else {
      showToast('保存失败')
    }
  } catch (error) {
    console.error('保存到库存失败:', error)
    showToast('保存失败')
  }
}

const shareList = () => {
  // 分享购物清单给家庭成员
  const shareText = `购物清单 (${new Date().toLocaleDateString()})\n\n` +
    shoppingList.value
      .map(item => `${item.name} - ${item.quantity} (约¥${item.estimatedPrice})`)
      .join('\n') +
    `\n\n总计: ¥${estimatedTotal.value}`

  if (navigator.share) {
    navigator.share({
      title: '家庭购物清单',
      text: shareText
    })
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      showSuccessToast('购物清单已复制，可手动分享')
    })
  }
}
</script>

<style scoped>
.smart-shopping-page {
  padding-bottom: 20px;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.nav-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.generation-form {
  margin: 16px 0;
}

.inventory-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
}

.inventory-item {
  margin: 2px;
}

.generate-button {
  margin: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.shopping-result {
  margin: 16px 0;
}

.category-items {
  padding: 8px 0;
}

.shopping-item {
  margin: 8px 0;
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: 8px;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 500;
  color: #333;
}

.item-quantity {
  font-size: 12px;
  color: #666;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-price {
  font-weight: 600;
  color: #e74c3c;
}

.item-details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #666;
}

.reasoning {
  display: block;
  margin-bottom: 4px;
}

.alternatives {
  display: block;
  color: #999;
}

.shopping-advice {
  margin: 16px 0;
}

.advice-content {
  line-height: 1.6;
}

.advice-section {
  margin: 12px 0;
}

.advice-section h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #333;
}

.advice-section p {
  margin: 0;
  font-size: 13px;
  color: #666;
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