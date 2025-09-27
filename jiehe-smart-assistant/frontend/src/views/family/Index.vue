<template>
  <div class="page">
    <van-nav-bar title="家庭管理" />
    <FamilyList />
  </div>
</template>

<script setup lang="ts">
import FamilyList from '@/views/family/FamilyList.vue'
</script>

<style scoped>
.page { min-height: 100vh; background: #f7f8fa; }
</style>

