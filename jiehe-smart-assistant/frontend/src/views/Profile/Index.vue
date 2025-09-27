<template>
  <div class="page">
    <van-nav-bar title="个人中心" />
    <van-cell-group inset>
      <van-cell title="用户名" :value="user?.username || '-'" />
      <van-cell title="邮箱" :value="user?.email || '-'" />
      <van-cell title="当前家庭" :value="user?.currentFamily?.name || '-'" />
    </van-cell-group>
    <div style="margin:16px">
      <van-button block type="danger" @click="logout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const userStore = useUserStore()
const router = useRouter()

const user = computed(() => userStore.user)

const logout = async () => {
  await auth.logout()
  router.replace('/login')
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

