<template>
  <div class="page">
    <van-nav-bar title="加入家庭" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="invite" label="邀请码" placeholder="请输入8位邀请码" required />
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button block round type="primary" native-type="submit">加入</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showToast, showSuccessToast } from 'vant'
import { useFamilyStore } from '@/stores/family'

const familyStore = useFamilyStore()
const invite = ref('')

const onSubmit = async () => {
  try {
    await familyStore.joinFamily(invite.value)
    showSuccessToast('加入成功')
  } catch {
    showToast('加入失败')
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

