<template>
  <MobileOptimized>
    <div class="tab-layout">
      <!-- 离线状态指示器 -->
      <OfflineIndicator />
      
      <!-- 主内容区域 -->
      <div class="content-wrapper">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component
            :is="Component"
            v-if="$route.meta?.keepAlive"
          />
        </keep-alive>
        <component
          :is="Component"
          v-if="!$route.meta?.keepAlive"
        />
      </router-view>
    </div>
    
    <!-- 底部导航栏 -->
    <van-tabbar
      v-model="activeTab"
      route
      fixed
      placeholder
      safe-area-inset-bottom
    >
      <van-tabbar-item
        to="/home"
        icon="home-o"
        name="home"
      >
        首页
      </van-tabbar-item>
      
      <van-tabbar-item
        to="/family"
        icon="friends-o"
        name="family"
        :badge="familyBadge"
      >
        家庭
      </van-tabbar-item>
      
      <van-tabbar-item
        to="/tasks"
        icon="todo-list-o"
        name="tasks"
        :badge="taskBadge"
      >
        任务
      </van-tabbar-item>      
      <van-tabbar-item
        to="/inventory"
        icon="bag-o"
        name="inventory"
      >
        物品
      </van-tabbar-item>
      
      <van-tabbar-item
        to="/calendar"
        icon="calendar-o"
        name="calendar"
        :badge="calendarBadge"
      >
        日历
      </van-tabbar-item>
      
      <van-tabbar-item
        to="/analytics"
        icon="chart-trending-o"
        name="analytics"
      >
        分析
      </van-tabbar-item>
    </van-tabbar>
    </div>
  </MobileOptimized>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { useCalendarStore } from '@/stores/calendar'
import { useFamilyStore } from '@/stores/family'
import OfflineIndicator from '@/components/OfflineIndicator.vue'
import MobileOptimized from '@/components/MobileOptimized.vue'

const route = useRoute()
const userStore = useUserStore()
const taskStore = useTaskStore()
const calendarStore = useCalendarStore()
const familyStore = useFamilyStore()

const activeTab = ref('home')

// 徽章数量计算
const familyBadge = computed(() => {
  return familyStore.pendingInvitations > 0 ? familyStore.pendingInvitations : ''
});

const taskBadge = computed(() => {
  return taskStore.urgentTaskCount > 0 ? taskStore.urgentTaskCount : ''
})

const calendarBadge = computed(() => {
  return calendarStore.todayEventCount > 0 ? calendarStore.todayEventCount : ''
})

// 更新活跃标签
const updateActiveTab = () => {
  const routeName = route.name as string
  if (['Home'].includes(routeName)) {
    activeTab.value = 'home'
  } else if (['Family', 'CreateFamily', 'JoinFamily', 'FamilySettings'].includes(routeName)) {
    activeTab.value = 'family'
  } else if (['Tasks', 'CreateTask', 'TaskDetail'].includes(routeName)) {
    activeTab.value = 'tasks'
  } else if (['Inventory'].includes(routeName)) {
    activeTab.value = 'inventory'
  } else if (['Calendar'].includes(routeName)) {
    activeTab.value = 'calendar'
  } else if (['Analytics', 'InventoryAnalysis'].includes(routeName)) {
    activeTab.value = 'analytics'
  }
}

onMounted(() => {
  updateActiveTab()
  // 初始化数据
  if (userStore.isAuthenticated) {
    taskStore.loadUrgentTasks()
    calendarStore.loadTodayEvents()
    familyStore.loadPendingInvitations()
  }
})

// 监听路由变化
const unwatchRoute = route.path
  ? () => updateActiveTab()
  : updateActiveTab

onUnmounted(() => {
  if (typeof unwatchRoute === 'function') {
    unwatchRoute()
  }
})
</script><style scoped>
.tab-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  overflow: hidden;
  padding-bottom: 50px; /* 为底部导航栏留出空间 */
}

/* 底部导航栏样式调整 */
:deep(.van-tabbar) {
  border-top: 1px solid var(--van-border-color);
  background-color: var(--van-background-2);
}

:deep(.van-tabbar-item--active) {
  color: var(--van-primary-color);
}

/* 响应式调整 */
@media (max-width: 375px) {
  :deep(.van-tabbar-item) {
    font-size: 10px;
  }
}
</style>