<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- 离线状态指示器 -->
    <OfflineIndicator />

    <!-- 路��视图 -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import OfflineIndicator from '@/components/OfflineIndicator.vue'
import { useAuthStore } from '@/stores/auth'

// 初始化认证状态
const authStore = useAuthStore()

onMounted(() => {
  // 检查本地存储的认证状态
  authStore.checkAuthStatus()
})
</script>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 移动端优化 */
@media (max-width: 768px) {
  body {
    font-size: 16px; /* 防止iOS缩放 */
  }
}

/* 触摸反馈 */
.van-button--active,
.van-cell--clickable:active {
  background-color: rgba(0, 0, 0, 0.1);
}
</style>