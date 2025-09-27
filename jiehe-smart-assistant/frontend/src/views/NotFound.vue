<template>
  <div class="page">
    <van-empty description="页面不存在" />
    <div style="margin:16px">
      <van-button block type="primary" to="/">返回首页</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 404 占位
</script>

<style scoped>
.page { min-height: 100vh; display:flex; flex-direction:column; justify-content:center; }
</style>

