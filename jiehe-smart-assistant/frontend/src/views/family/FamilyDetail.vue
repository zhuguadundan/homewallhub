<template>
  <div class="family-detail" v-if="family">
    <!-- 头部导航 -->
    <nav-bar 
      :title="family.name" 
      left-arrow 
      @click-left="router.back()"
      right-text="设置"
      @click-right="showSettingsSheet = true"
    />

    <!-- 家庭信息卡片 -->
    <div class="family-info-card">
      <div class="info-header">
        <div class="avatar-group">
          <van-image
            v-for="member in displayMembers"
            :key="member.id"
            class="member-avatar"
            :src="member.avatar || getDefaultAvatar(member.name)"
            round
            fit="cover"
          />
          <div v-if="family.memberCount > 4" class="more-count">
            +{{ family.memberCount - 4 }}
          </div>
        </div>
        <div class="family-stats">
          <div class="stat-item">
            <span class="stat-number">{{ family.memberCount }}</span>
            <span class="stat-label">成员</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ activeTasks }}</span>
            <span class="stat-label">待办</span>
          </div>
        </div>
      </div>
      
      <div class="family-description" v-if="family.description">
        {{ family.description }}
      </div>
      
      <!-- 邀请码（仅管理员可见） -->
      <div v-if="isAdmin" class="invite-section">
        <div class="invite-code-display">
          <span class="label">邀请码</span>
          <span class="code">{{ family.inviteCode }}</span>
          <van-button size="mini" @click="copyInviteCode">复制</van-button>
        </div>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="function-menu">
      <van-grid :column-num="4" :border="false">
        <van-grid-item 
          icon="todo-list-o"
          text="家务任务"
          @click="goToTasks"
        />
        <van-grid-item 
          icon="bag-o"
          text="库存管理"
          @click="goToInventory"
        />
        <van-grid-item 
          icon="clock-o"
          text="共享日历"
          @click="goToCalendar"
        />
        <van-grid-item 
          icon="chat-o"
          text="留言板"
          @click="goToMessages"
        />
      </van-grid>
    </div>

    <!-- 家庭成员列表 -->
    <div class="members-section">
      <div class="section-header">
        <h3>家庭成员</h3>
        <van-button 
          v-if="isAdmin" 
          size="small" 
          type="primary" 
          plain
          @click="showInviteDialog = true"
        >
          邀请成员
        </van-button>
      </div>
      
      <div class="members-list">
        <div 
          v-for="member in members"
          :key="member.id"
          class="member-item"
        >
          <van-image
            class="member-avatar-large"
            :src="member.avatar || getDefaultAvatar(member.name)"
            round
          />
          <div class="member-info">
            <div class="member-name">{{ member.name }}</div>
            <div class="member-role">{{ getRoleText(member.role) }}</div>
            <div class="member-stats">
              完成任务 {{ member.completedTasks || 0 }} 个
            </div>
          </div>
          <div class="member-actions" v-if="isAdmin && member.id !== currentUserId">
            <van-button 
              size="mini" 
              @click="showMemberActions(member)"
            >
              管理
            </van-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近动态 -->
    <div class="recent-activities">
      <h3 class="section-title">最近动态</h3>
      <van-cell-group>
        <van-cell 
          v-for="activity in recentActivities"
          :key="activity.id"
          :title="activity.title"
          :label="formatDate(activity.createdAt)"
          :value="activity.type"
        />
      </van-cell-group>
      <van-empty v-if="recentActivities.length === 0" description="暂无动态" />
    </div>

    <!-- 设置面板 -->
    <van-action-sheet 
      v-model:show="showSettingsSheet"
      :actions="settingsActions"
      @select="onSettingsSelect"
    />

    <!-- 邀请对话框 -->
    <van-dialog
      v-model:show="showInviteDialog"
      title="邀请成员"
      show-cancel-button
      @confirm="sendInvite"
    >
      <div class="invite-content">
        <p>分享邀请码给家人加入</p>
        <div class="invite-code-share">
          <span class="invite-code-large">{{ family.inviteCode }}</span>
          <van-button @click="copyInviteCode">复制邀请码</van-button>
        </div>
      </div>
    </van-dialog>

    <!-- 成员管理弹窗 -->
    <van-action-sheet 
      v-model:show="showMemberSheet"
      :actions="memberActions"
      @select="onMemberAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useFamilyStore } from '@/stores/family'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils/date'
import type { IFamily, IFamilyMember } from '@/types/family'

const router = useRouter()
const route = useRoute()
const familyStore = useFamilyStore()
const userStore = useUserStore()

// 响应式数据
const family = ref<IFamily | null>(null)
const members = ref<IFamilyMember[]>([])
const recentActivities = ref([])
const showSettingsSheet = ref(false)
const showInviteDialog = ref(false)
const showMemberSheet = ref(false)
const selectedMember = ref<IFamilyMember | null>(null)

// 计算属性
const currentUserId = computed(() => userStore.currentUser?.id)
const isAdmin = computed(() => {
  if (!family.value || !currentUserId.value) return false
  const currentMember = members.value.find(m => m.id === currentUserId.value)
  return currentMember?.role === 'admin'
})

const displayMembers = computed(() => members.value.slice(0, 4))
const activeTasks = computed(() => 0) // TODO: 从任务store获取

// 设置菜单
const settingsActions = computed(() => {
  const actions = [
    { name: '家庭设置', value: 'settings' },
    { name: '退出家庭', value: 'leave', color: '#ee0a24' }
  ]
  
  if (isAdmin.value) {
    actions.splice(1, 0, { name: '解散家庭', value: 'dissolve', color: '#ee0a24' })
  }
  
  return actions
})

// 成员管理菜单
const memberActions = [
  { name: '设为管理员', value: 'promote' },
  { name: '移除成员', value: 'remove', color: '#ee0a24' }
]
</script>

<style scoped>
.family-detail {
  min-height: 100vh;
  background-color: #f8f8f8;
}

.family-info-card {
  margin: 16px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.avatar-group {
  display: flex;
  align-items: center;
}

.member-avatar {
  width: 32px;
  height: 32px;
  margin-right: -8px;
  border: 2px solid white;
}

.more-count {
  width: 32px;
  height: 32px;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #666;
  margin-left: 8px;
}

.family-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #1989fa;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.family-description {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.invite-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.invite-code-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.function-menu {
  margin: 16px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.members-section {
  margin: 16px;
  background: white;
  border-radius: 12px;
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
  color: #333;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-avatar-large {
  width: 48px;
  height: 48px;
  margin-right: 12px;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.member-role {
  font-size: 12px;
  color: #1989fa;
  margin: 2px 0;
}

.member-stats {
  font-size: 12px;
  color: #999;
}

.recent-activities {
  margin: 16px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.section-title {
  padding: 16px 16px 0;
  margin: 0;
  font-size: 16px;
  color: #333;
}

.invite-content {
  padding: 20px;
  text-align: center;
}

.invite-code-share {
  margin-top: 20px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
}

.invite-code-large {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #1989fa;
  margin-bottom: 16px;
  letter-spacing: 2px;
}
</style>