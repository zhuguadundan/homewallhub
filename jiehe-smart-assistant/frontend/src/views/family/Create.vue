<template>
  <div class="page">
    <van-nav-bar title="创建家庭" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="name" label="家庭名称" placeholder="请输入" required />
        <van-field v-model="description" label="简介" placeholder="可选" />
      </van-cell-group>
      <div style="margin: 16px;">
        <van-button block round type="primary" native-type="submit">创建</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { showToast, showSuccessToast } from 'vant'
import { useFamilyStore } from '@/stores/family'

const familyStore = useFamilyStore()
const name = ref('')
const description = ref('')

const onSubmit = async () => {
  try {
    await familyStore.createFamily({ name: name.value, description: description.value })
    showSuccessToast('创建成功')
  } catch {
    showToast('创建失败')
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

