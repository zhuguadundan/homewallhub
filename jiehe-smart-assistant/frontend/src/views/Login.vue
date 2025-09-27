<template>
  <div class="page">
    <van-nav-bar title="登录" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="identifier" label="用户名/邮箱" placeholder="请输入" required />
        <van-field v-model="password" label="密码" type="password" placeholder="请输入" required />
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button block round type="primary" native-type="submit">登录</van-button>
      </div>
      <div style="text-align:center">
        <van-button type="default" text="去注册" @click="goRegister" />
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const identifier = ref('')
const password = ref('')

const onSubmit = async () => {
  try {
    await auth.login({ identifier: identifier.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e: any) {
    showToast(e?.message || '登录失败')
  }
}

const goRegister = () => router.push('/register')
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

