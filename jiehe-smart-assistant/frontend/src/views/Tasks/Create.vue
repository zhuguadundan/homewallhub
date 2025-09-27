<template>
  <div class="page">
    <van-nav-bar title="创建任务" left-arrow @click-left="$router.back()" />
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field v-model="title" label="标题" placeholder="请输入标题" required />
        <van-field v-model="description" type="textarea" label="描述" placeholder="可选" />
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
import { useTaskStore } from '@/stores/task'

const taskStore = useTaskStore()
const title = ref('')
const description = ref('')

const onSubmit = async () => {
  if (!title.value.trim()) {
    showToast('请输入标题')
    return
  }
  try {
    await taskStore.createTask({ title: title.value, description: description.value })
    showSuccessToast('创建成功')
    history.back()
  } catch {
    showToast('创建失败')
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

