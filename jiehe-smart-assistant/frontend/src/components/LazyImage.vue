<template>
  <div 
    class="lazy-image-container"
    :class="{ 'loaded': isLoaded, 'loading': isLoading }"
    :style="{ width, height }"
  >
    <!-- 占位符 -->
    <div 
      v-if="!isLoaded" 
      class="placeholder"
      :style="{ backgroundColor: placeholderColor }"
    >
      <van-loading v-if="isLoading" size="20px" />
      <van-icon v-else name="photo-o" size="24px" />
    </div>
    
    <!-- 实际图片 -->
    <img
      v-show="isLoaded"
      ref="imageRef"
      :src="actualSrc"
      :alt="alt"
      :class="imageClass"
      @load="handleLoad"
      @error="handleError"
    />
    
    <!-- 错误状态 -->
    <div v-if="hasError" class="error-state">
      <van-icon name="warning-o" size="24px" />
      <span class="error-text">加载失败</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  src: string
  alt?: string
  width?: string
  height?: string
  placeholderColor?: string
  imageClass?: string
  lazy?: boolean
  threshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  width: '100%',
  height: 'auto',
  placeholderColor: '#f5f5f5',
  imageClass: '',
  lazy: true,
  threshold: 0.1
})

const imageRef = ref<HTMLImageElement>()
const isLoaded = ref(false)
const isLoading = ref(false)
const hasError = ref(false)
const actualSrc = ref('')
const observer = ref<IntersectionObserver>()

const handleLoad = () => {
  isLoading.value = false
  isLoaded.value = true
  hasError.value = false
}

const handleError = () => {
  isLoading.value = false
  hasError.value = true
}

const loadImage = () => {
  if (actualSrc.value) return
  
  isLoading.value = true
  actualSrc.value = props.src
}

const setupIntersectionObserver = () => {
  if (!props.lazy) {
    loadImage()
    return
  }

  observer.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImage()
          observer.value?.unobserve(entry.target)
        }
      })
    },
    {
      threshold: props.threshold,
      rootMargin: '50px'
    }
  )

  if (imageRef.value?.parentElement) {
    observer.value.observe(imageRef.value.parentElement)
  }
}

watch(() => props.src, () => {
  // 重置状态
  isLoaded.value = false
  isLoading.value = false
  hasError.value = false
  actualSrc.value = ''
  
  // 重新设置观察器
  setupIntersectionObserver()
})

onMounted(() => {
  setupIntersectionObserver()
})

onUnmounted(() => {
  observer.value?.disconnect()
})
</script>

<style scoped>
.lazy-image-container {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #999;
  transition: opacity 0.3s ease;
}

.lazy-image-container.loaded .placeholder {
  opacity: 0;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: #ee0a24;
  background-color: #ffeee8;
}

.error-text {
  font-size: 12px;
}

.loading {
  background-color: #f5f5f5;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>