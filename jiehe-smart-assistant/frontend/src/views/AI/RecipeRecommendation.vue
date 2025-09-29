<template>
  <div class="recipe-recommendation">
    <van-nav-bar title="智能菜谱推荐" left-arrow @click-left="$router.go(-1)">
      <template #right>
        <van-icon name="question-o" @click="showHelp = true" />
      </template>
    </van-nav-bar>

    <!-- 推荐参数设置 -->
    <div class="params-section">
      <van-cell-group>
        <van-field
          v-model="searchForm.ingredients"
          label="现有食材"
          placeholder="请输入您现有的食材，用逗号分隔"
          type="textarea"
          autosize
          :rules="[{ required: true, message: '请输入至少一种食材' }]"
        />
        
        <van-cell title="餐次类型" is-link @click="showMealTypePicker = true">
          <template #value>
            <span :class="{ placeholder: !searchForm.mealType }">
              {{ mealTypeText || '选择餐次类型（可选）' }}
            </span>
          </template>
        </van-cell>
        
        <van-cell title="烹饪难度" is-link @click="showDifficultyPicker = true">
          <template #value>
            <span :class="{ placeholder: !searchForm.difficulty }">
              {{ difficultyText || '选择难度等级（可选）' }}
            </span>
          </template>
        </van-cell>

        <van-field
          v-model.number="searchForm.cookingTime"
          label="烹饪时间"
          placeholder="最长烹饪时间（分钟）"
          type="number"
        />

        <van-field
          v-model.number="searchForm.servings"
          label="用餐人数"
          placeholder="几人用餐"
          type="number"
        />

        <van-field
          v-model="searchForm.preferences"
          label="口味偏好"
          placeholder="如：清淡、麻辣、甜味等，用逗号分隔"
          type="textarea"
          autosize
        />

        <van-field
          v-model="searchForm.restrictions"
          label="饮食限制"
          placeholder="如：不吃辣、素食、无海鲜等，用逗号分隔"
          type="textarea"
          autosize
        />
      </van-cell-group>

      <div class="action-buttons">
        <van-button 
          type="primary" 
          block 
          @click="getRecommendations"
          :loading="loading"
          :disabled="!searchForm.ingredients.trim()"
        >
          获取推荐
        </van-button>
      </div>
    </div>

    <!-- 库存提示 -->
    <div class="inventory-hint" v-if="inventoryItems.length > 0">
      <div class="hint-title">💡 您的库存食材</div>
      <div class="inventory-tags">
        <van-tag 
          v-for="item in inventoryItems" 
          :key="item.id"
          size="mini"
          @click="addToIngredients(item.name)"
        >
          {{ item.name }}
        </van-tag>
      </div>
    </div>

    <!-- 推荐结果 -->
    <div class="recommendations-section" v-if="recommendations.length > 0">
      <div class="section-header">
        <h3>推荐菜谱 ({{ recommendations.length }}个)</h3>
        <van-button 
          size="mini" 
          plain 
          @click="refreshRecommendations"
          :loading="loading"
        >
          重新推荐
        </van-button>
      </div>

      <div 
        v-for="recipe in recommendations" 
        :key="recipe.name"
        class="recipe-card"
      >
        <div class="recipe-header">
          <h4 class="recipe-title">{{ recipe.name }}</h4>
          <div class="recipe-meta">
            <van-tag type="primary" size="mini">{{ recipe.difficulty }}</van-tag>
            <van-tag type="success" size="mini">{{ recipe.cookingTime }}分钟</van-tag>
            <van-tag type="warning" size="mini">{{ recipe.servings }}人份</van-tag>
          </div>
        </div>

        <div class="recipe-description">
          {{ recipe.description }}
        </div>

        <van-collapse v-model="expandedRecipes">
          <van-collapse-item :title="`食材清单 (${recipe.ingredients.length}种)`" :name="recipe.name + '_ingredients'">
            <div class="ingredients-list">
              <div 
                v-for="ingredient in recipe.ingredients" 
                :key="ingredient.name"
                class="ingredient-item"
                :class="{ optional: ingredient.optional }"
              >
                <span class="ingredient-name">{{ ingredient.name }}</span>
                <span class="ingredient-amount">{{ ingredient.amount }} {{ ingredient.unit }}</span>
                <van-tag v-if="ingredient.optional" type="default" size="mini">可选</van-tag>
              </div>
            </div>
          </van-collapse-item>

          <van-collapse-item :title="`制作步骤 (${recipe.instructions.length}步)`" :name="recipe.name + '_instructions'">
            <div class="instructions-list">
              <div 
                v-for="(step, index) in recipe.instructions" 
                :key="index"
                class="instruction-step"
              >
                <div class="step-number">{{ index + 1 }}</div>
                <div class="step-content">{{ step }}</div>
              </div>
            </div>
          </van-collapse-item>

          <van-collapse-item 
            v-if="recipe.nutritionInfo" 
            title="营养信息" 
            :name="recipe.name + '_nutrition'"
          >
            <div class="nutrition-info">
              <van-grid :column-num="3" :border="false">
                <van-grid-item>
                  <div class="nutrition-item">
                    <div class="nutrition-value">{{ recipe.nutritionInfo.calories }}</div>
                    <div class="nutrition-label">卡路里</div>
                  </div>
                </van-grid-item>
                <van-grid-item>
                  <div class="nutrition-item">
                    <div class="nutrition-value">{{ recipe.nutritionInfo.protein }}g</div>
                    <div class="nutrition-label">蛋白质</div>
                  </div>
                </van-grid-item>
                <van-grid-item>
                  <div class="nutrition-item">
                    <div class="nutrition-value">{{ recipe.nutritionInfo.carbs }}g</div>
                    <div class="nutrition-label">碳水</div>
                  </div>
                </van-grid-item>
              </van-grid>
            </div>
          </van-collapse-item>
        </van-collapse>

        <div class="recipe-actions">
          <van-button size="small" @click="saveRecipe(recipe)">
            收藏菜谱
          </van-button>
          <van-button size="small" plain @click="addToMenu(recipe)">
            加入菜单
          </van-button>
          <van-button size="small" plain @click="shareRecipe(recipe)">
            分享菜谱
          </van-button>
        </div>
      </div>

      <!-- 推荐理由 -->
      <div class="recommendation-reasoning" v-if="reasoning">
        <van-cell-group>
          <van-cell title="推荐理由" :label="reasoning" />
        </van-cell-group>
      </div>

      <!-- 缺失食材提示 -->
      <div class="missing-ingredients" v-if="missingIngredients.length > 0">
        <van-cell-group>
          <van-cell title="需要购买的食材">
            <template #label>
              <div class="missing-tags">
                <van-tag 
                  v-for="ingredient in missingIngredients" 
                  :key="ingredient"
                  type="warning"
                  size="mini"
                >
                  {{ ingredient }}
                </van-tag>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </div>

    <!-- 空状态 -->
    <van-empty 
      v-if="!loading && recommendations.length === 0 && hasSearched"
      image="search"
      description="暂无推荐结果，请调整搜索条件后重试"
    />

    <!-- 选择器弹窗 -->
    <van-popup v-model:show="showMealTypePicker" position="bottom">
      <van-picker
        :columns="mealTypeColumns"
        @confirm="onMealTypeConfirm"
        @cancel="showMealTypePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showDifficultyPicker" position="bottom">
      <van-picker
        :columns="difficultyColumns"
        @confirm="onDifficultyConfirm"
        @cancel="showDifficultyPicker = false"
      />
    </van-popup>

    <!-- 帮助弹窗 -->
    <van-popup v-model:show="showHelp" position="center" style="width: 80%">
      <div class="help-content">
        <h3>智能菜谱推荐帮助</h3>
        <div class="help-section">
          <h4>功能说明</h4>
          <p>根据您现有的食材和偏好，AI会推荐适合的菜谱，包含详细的制作步骤和营养信息。</p>
        </div>
        <div class="help-section">
          <h4>使用技巧</h4>
          <ul>
            <li>输入您现有的主要食材，用逗号分隔</li>
            <li>设置合适的烹饪时间和难度要求</li>
            <li>明确说明饮食限制和口味偏好</li>
            <li>可以点击库存食材快速添加</li>
          </ul>
        </div>
        <van-button type="primary" block @click="showHelp = false">
          知道了
        </van-button>
      </div>
    </van-popup>

    <!-- 加载状态 -->
    <van-loading v-if="loading" type="spinner" vertical>
      AI正在分析推荐中...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { aiApi } from '@/api/ai'
import { inventoryApi } from '@/api/inventory'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 数据状态
const loading = ref(false)
const hasSearched = ref(false)
const recommendations = ref<any[]>([])
const reasoning = ref('')
const missingIngredients = ref<string[]>([])
const inventoryItems = ref<any[]>([])
const expandedRecipes = ref<string[]>([])

// 表单数据
const searchForm = reactive({
  ingredients: '',
  mealType: '',
  difficulty: '',
  cookingTime: null as number | null,
  servings: null as number | null,
  preferences: '',
  restrictions: ''
})

// 界面状态
const showMealTypePicker = ref(false)
const showDifficultyPicker = ref(false)
const showHelp = ref(false)

// 选择器数据
const mealTypeColumns = [
  { text: '早餐', value: 'breakfast' },
  { text: '午餐', value: 'lunch' },
  { text: '晚餐', value: 'dinner' },
  { text: '小食', value: 'snack' }
]

const difficultyColumns = [
  { text: '简单', value: 'easy' },
  { text: '中等', value: 'medium' },
  { text: '困难', value: 'hard' }
]

// 计算属性
const mealTypeText = computed(() => {
  const found = mealTypeColumns.find(item => item.value === searchForm.mealType)
  return found?.text || ''
})

const difficultyText = computed(() => {
  const found = difficultyColumns.find(item => item.value === searchForm.difficulty)
  return found?.text || ''
})

// 方法
const loadInventoryItems = async () => {
  try {
    const familyId = userStore.currentFamily?.id
    if (!familyId) {
      console.warn('当前用户没有选择家庭，跳过库存加载')
      return
    }

    const response = await inventoryApi.getItems(familyId, {
      page: 1,
      limit: 20,
      hasStock: true
    })
    inventoryItems.value = response.data.items || []
  } catch (error) {
    console.error('加载库存失败:', error)
  }
}

const addToIngredients = (itemName: string) => {
  const ingredients = searchForm.ingredients.split(',').map(s => s.trim()).filter(s => s)
  if (!ingredients.includes(itemName)) {
    ingredients.push(itemName)
    searchForm.ingredients = ingredients.join(', ')
  }
}

const getRecommendations = async () => {
  if (!searchForm.ingredients.trim()) {
    uni.showToast({
      title: '请输入食材',
      icon: 'none'
    })
    return
  }

  try {
    loading.value = true
    hasSearched.value = true

    const requestData = {
      availableIngredients: searchForm.ingredients.split(',').map(s => s.trim()).filter(s => s),
      mealType: searchForm.mealType || undefined,
      difficulty: searchForm.difficulty || undefined,
      cookingTime: searchForm.cookingTime || undefined,
      servings: searchForm.servings || undefined,
      preferences: searchForm.preferences.split(',').map(s => s.trim()).filter(s => s),
      restrictions: searchForm.restrictions.split(',').map(s => s.trim()).filter(s => s)
    }

    const response = await aiApi.getRecipeRecommendation(requestData)
    
    recommendations.value = response.data.recipes || []
    reasoning.value = response.data.reasoning || ''
    missingIngredients.value = response.data.missingIngredients || []

    if (recommendations.value.length === 0) {
      uni.showToast({
        title: '未找到合适的菜谱',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('获取菜谱推荐失败:', error)
    uni.showToast({
      title: '推荐失败，请重试',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const refreshRecommendations = () => {
  getRecommendations()
}

const saveRecipe = (recipe: any) => {
  // 收藏菜谱到用户的菜谱库
  uni.showToast({
    title: '菜谱已收藏',
    icon: 'success'
  })
  
  // 这里可以调用API保存菜谱
}

const addToMenu = (recipe: any) => {
  // 添加到家庭菜单
  router.push({
    path: '/menu/create',
    query: {
      recipe: JSON.stringify(recipe)
    }
  })
}

const shareRecipe = (recipe: any) => {
  // 分享菜谱
  uni.share({
    provider: 'weixin',
    scene: 'WXSceneSession',
    type: 0,
    title: `推荐菜谱：${recipe.name}`,
    summary: recipe.description,
    success: () => {
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      })
    }
  })
}

const onMealTypeConfirm = ({ selectedOptions }: any) => {
  searchForm.mealType = selectedOptions[0]?.value || ''
  showMealTypePicker.value = false
}

const onDifficultyConfirm = ({ selectedOptions }: any) => {
  searchForm.difficulty = selectedOptions[0]?.value || ''
  showDifficultyPicker.value = false
}

onMounted(() => {
  loadInventoryItems()
})
</script>

<style scoped>
.recipe-recommendation {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.params-section {
  background: white;
  margin-bottom: 12px;
}

.action-buttons {
  padding: 16px;
}

.placeholder {
  color: #c8c9cc;
}

.inventory-hint {
  background: white;
  margin-bottom: 12px;
  padding: 16px;
}

.hint-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #646566;
}

.inventory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inventory-tags .van-tag {
  cursor: pointer;
}

.recommendations-section {
  background: white;
  padding: 16px;
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
  font-weight: 600;
}

.recipe-card {
  border: 1px solid #ebedf0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: white;
}

.recipe-header {
  margin-bottom: 12px;
}

.recipe-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #323233;
}

.recipe-meta {
  display: flex;
  gap: 8px;
}

.recipe-description {
  color: #646566;
  line-height: 1.5;
  margin-bottom: 16px;
}

.ingredients-list {
  padding: 12px 0;
}

.ingredient-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f7f8fa;
}

.ingredient-item.optional {
  opacity: 0.7;
}

.ingredient-name {
  font-weight: 500;
}

.ingredient-amount {
  color: #646566;
  margin-right: 8px;
}

.instructions-list {
  padding: 12px 0;
}

.instruction-step {
  display: flex;
  margin-bottom: 12px;
}

.step-number {
  width: 24px;
  height: 24px;
  background: #1989fa;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-right: 12px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  line-height: 1.5;
}

.nutrition-info {
  padding: 12px 0;
}

.nutrition-item {
  text-align: center;
}

.nutrition-value {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.nutrition-label {
  font-size: 12px;
  color: #969799;
  margin-top: 4px;
}

.recipe-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebedf0;
}

.recommendation-reasoning {
  margin-top: 16px;
}

.missing-ingredients {
  margin-top: 12px;
}

.missing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.help-content {
  padding: 20px;
}

.help-content h3 {
  margin: 0 0 16px 0;
  text-align: center;
}

.help-section {
  margin-bottom: 16px;
}

.help-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #646566;
}

.help-section p,
.help-section ul {
  font-size: 14px;
  line-height: 1.5;
  color: #323233;
  margin: 0;
}

.help-section ul {
  padding-left: 16px;
}

.help-section li {
  margin-bottom: 4px;
}
</style>