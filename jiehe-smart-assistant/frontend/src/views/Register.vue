<template>
  <div class="page">
    <van-nav-bar title="注册" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="username" label="用户名" placeholder="3-30位字母数字" required />
        <van-field v-model="email" label="邮箱" type="email" placeholder="name@example.com" required />
        <van-field v-model="password" label="密码" type="password" placeholder="至少6位" required />
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button block round type="primary" native-type="submit">注册并登录</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')

const onSubmit = async () => {
  try {
    await auth.register({ username: username.value, email: email.value, password: password.value })
    router.replace('/')
  } catch (e: any) {
    showToast(e?.message || '注册失败')
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

