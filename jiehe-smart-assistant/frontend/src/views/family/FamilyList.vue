<template>
  <div class="family-list">
    <!-- 头部 -->
    <nav-bar title="家庭管理" right-text="创建" @click-right="showCreateDialog = true" />
    
    <!-- 家庭列表 -->
    <div class="family-cards" v-if="families.length > 0">
      <div 
        v-for="family in families" 
        :key="family.id"
        class="family-card"
        @click="enterFamily(family)"
      >
        <div class="card-header">
          <div class="family-info">
            <h3>{{ family.name }}</h3>
            <span class="member-count">{{ family.memberCount }}人</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="family-details">
          <p class="created-time">创建于 {{ formatDate(family.createdAt) }}</p>
          <div class="invite-info" v-if="family.role === 'admin'">
            <span class="invite-code">邀请码: {{ family.inviteCode }}</span>
            <van-button size="mini" @click.stop="copyInviteCode(family.inviteCode)">
              复制
            </van-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <van-empty 
      v-else
      description="还没有加入任何家庭"
      image="https://img.yzcdn.cn/vant/empty-image-default.png"
    >
      <van-button type="primary" @click="showCreateDialog = true">
        创建家庭
      </van-button>
    </van-empty>

    <!-- 创建家庭弹窗 -->
    <van-dialog
      v-model:show="showCreateDialog"
      title="创建家庭"
      show-cancel-button
      @confirm="createFamily"
    >
      <van-field
        v-model="newFamilyName"
        placeholder="请输入家庭名称"
        label="家庭名称"
        required
      />
      <van-field
        v-model="newFamilyDescription"
        type="textarea"
        placeholder="请输入家庭描述（可选）"
        label="家庭描述"
      />
    </van-dialog>

    <!-- 加入家庭弹窗 -->
    <van-dialog
      v-model:show="showJoinDialog"
      title="加入家庭"
      show-cancel-button
      @confirm="joinFamily"
    >
      <van-field
        v-model="inviteCode"
        placeholder="请输入邀请码"
        label="邀请码"
        required
      />
    </van-dialog>

    <!-- 底部操作栏 -->
    <van-action-bar>
      <van-action-bar-button
        type="warning"
        text="加入家庭"
        @click="showJoinDialog = true"
      />
      <van-action-bar-button
        type="danger"
        text="创建家庭"
        @click="showCreateDialog = true"
      />
    </van-action-bar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useFamilyStore } from '@/stores/family'
import { formatDate } from '@/utils/date'
import type { IFamily } from '@/types/family'

const router = useRouter()
const familyStore = useFamilyStore()

// 响应式数据
const families = ref<IFamily[]>([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showJoinDialog = ref(false)
const newFamilyName = ref('')
const newFamilyDescription = ref('')
const inviteCode = ref('')

// 获取家庭列表
const loadFamilies = async () => {
  try {
    loading.value = true
    families.value = await familyStore.getFamilies()
  } catch (error) {
    showToast('获取家庭列表失败')
    console.error('获取家庭列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 创建家庭
const createFamily = async () => {
  if (!newFamilyName.value.trim()) {
    showToast('请输入家庭名称')
    return
  }

  try {
    await familyStore.createFamily({
      name: newFamilyName.value,
      description: newFamilyDescription.value
    })
    showSuccessToast('家庭创建成功')
    showCreateDialog.value = false
    newFamilyName.value = ''
    newFamilyDescription.value = ''
    loadFamilies()
  } catch (error) {
    showToast('创建家庭失败')
    console.error('创建家庭失败:', error)
  }
}

// 加入家庭
const joinFamily = async () => {
  if (!inviteCode.value.trim()) {
    showToast('请输入邀请码')
    return
  }

  try {
    await familyStore.joinFamily(inviteCode.value)
    showSuccessToast('成功加入家庭')
    showJoinDialog.value = false
    inviteCode.value = ''
    loadFamilies()
  } catch (error) {
    showToast('加入家庭失败，请检查邀请码是否正确')
    console.error('加入家庭失败:', error)
  }
}

// 进入家庭详情
const enterFamily = (family: IFamily) => {
  familyStore.setCurrentFamily(family)
  router.push({ name: 'FamilyDetail', params: { id: family.id } })
}

// 复制邀请码
const copyInviteCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code)
    showSuccessToast('邀请码已复制')
  } catch (error) {
    showToast('复制失败，请手动复制')
  }
}

onMounted(() => {
  loadFamilies()
})
</script>

<style scoped>
.family-list {
  min-height: 100vh;
  background-color: #f8f8f8;
  padding-bottom: 70px;
}

.family-cards {
  padding: 16px;
}

.family-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.family-card:active {
  transform: scale(0.98);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.family-info h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.member-count {
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
}

.family-details {
  font-size: 13px;
  color: #666;
}

.created-time {
  margin: 4px 0;
}

.invite-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
}

.invite-code {
  color: #1989fa;
  font-weight: 500;
}

.van-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>