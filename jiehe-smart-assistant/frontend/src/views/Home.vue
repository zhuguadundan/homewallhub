<template>
  <div class="home">
    <van-nav-bar title="家和智能助手" />
    <div class="cards">
      <van-grid :column-num="5">
        <van-grid-item icon="home-o" text="首页" to="/home" />
        <van-grid-item icon="fire-o" text="点菜" to="/ai/recipe-recommendation" />
        <van-grid-item icon="balance-o" text="库存" to="/inventory" />
        <van-grid-item icon="calendar-o" text="日历" to="/calendar" />
        <van-grid-item icon="chat-o" text="留言" to="/messages" />
      </van-grid>
    </div>
  </div>
</template>

<script setup lang="ts">
// 简洁首页占位
</script>

<style scoped>
.home { min-height: 100vh; background: #f7f8fa; }
.cards { padding: 12px; }
</style>

