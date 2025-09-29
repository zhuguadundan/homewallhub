<template>
  <div class="message-detail">
    <van-nav-bar :title="message?.title || '留言详情'" left-arrow @click-left="$router.go(-1)">
      <template #right>
        <van-icon name="ellipsis" @click="showActions = true" />
      </template>
    </van-nav-bar>

    <!-- 留言内容 -->
    <div v-if="message" class="message-content">
      <!-- 留言头部 -->
      <div class="message-header">
        <van-cell>
          <template #icon>
            <van-image
              :src="message.user_avatar"
              width="40"
              height="40"
              round
              fit="cover"
              :alt="message.user_name"
            />
          </template>
          <template #title>
            <div class="user-info">
              <span class="user-name">{{ message.user_name }}</span>
              <van-tag
                v-if="message.is_pinned"
                color="#ff6b35"
                style="margin-left: 8px"
              >
                置顶
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="meta-info">
              <span>{{ formatTime(message.created_at) }}</span>
              <span class="category">{{ getCategoryName(message.category) }}</span>
            </div>
          </template>
        </van-cell>
      </div>

      <!-- 留言正文 -->
      <div class="message-body">
        <h3 v-if="message.title" class="message-title">{{ message.title }}</h3>
        <div class="message-text" v-html="formatContent(message.content)"></div>
        
        <!-- 附件 -->
        <div v-if="message.attachments && message.attachments.length" class="attachments">
          <div
            v-for="attachment in message.attachments"
            :key="attachment.id"
            class="attachment-item"
            @click="previewAttachment(attachment)"
          >
            <van-icon name="paperclip" />
            <span>{{ attachment.name }}</span>
          </div>
        </div>

        <!-- @提醒用户 -->
        <div v-if="message.mentioned_users && message.mentioned_users.length" class="mentions">
          <van-tag
            v-for="userId in message.mentioned_users"
            :key="userId"
            color="#1989fa"
            style="margin-right: 4px"
          >
            @{{ getUserName(userId) }}
          </van-tag>
        </div>
      </div>

      <!-- 反应统计 -->
      <div class="reactions-section">
        <div class="reactions-bar">
          <div
            v-for="(count, emoji) in reactionCounts"
            :key="emoji"
            class="reaction-item"
            :class="{ active: userReactions.includes(emoji) }"
            @click="toggleReaction(emoji)"
          >
            <span class="emoji">{{ emoji }}</span>
            <span class="count">{{ count }}</span>
          </div>
          <van-icon name="smile-o" @click="showReactionPicker = true" />
        </div>
      </div>

      <!-- 已读状态 -->
      <div class="read-status">
        <van-collapse v-model="activeNames">
          <van-collapse-item title="查看已读状态" name="read">
            <div class="read-list">
              <div
                v-for="status in readStatuses"
                :key="status.user_id"
                class="read-item"
              >
                <van-image
                  :src="status.user_avatar"
                  width="24"
                  height="24"
                  round
                  fit="cover"
                />
                <span class="user-name">{{ status.user_name }}</span>
                <span class="read-time">{{ formatTime(status.read_at) }}</span>
              </div>
            </div>
          </van-collapse-item>
        </van-collapse>
      </div>
    </div>

    <!-- 评论区 -->
    <div class="comments-section">
      <div class="comments-header">
        <h4>评论 ({{ comments.length }})</h4>
      </div>
      
      <div class="comments-list">
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="comment-item"
        >
          <van-image
            :src="comment.user_avatar"
            width="32"
            height="32"
            round
            fit="cover"
            class="comment-avatar"
          />
          <div class="comment-content">
            <div class="comment-header">
              <span class="comment-user">{{ comment.user_name }}</span>
              <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
            </div>
            <div class="comment-text" v-html="formatContent(comment.content)"></div>
          </div>
        </div>
      </div>

      <!-- 评论输入 -->
      <div class="comment-input">
        <van-field
          v-model="newComment"
          type="textarea"
          placeholder="写下你的评论..."
          autosize
          maxlength="500"
          show-word-limit
        />
        <van-button
          type="primary"
          size="small"
          :disabled="!newComment.trim()"
          @click="submitComment"
          :loading="submittingComment"
        >
          发送
        </van-button>
      </div>
    </div>

    <!-- 操作面板 -->
    <van-action-sheet
      v-model:show="showActions"
      :actions="actionItems"
      @select="handleAction"
    />

    <!-- 反应选择器 -->
    <van-popup v-model:show="showReactionPicker" position="bottom">
      <div class="reaction-picker">
        <div class="picker-header">选择反应</div>
        <div class="emoji-grid">
          <div
            v-for="emoji in availableEmojis"
            :key="emoji"
            class="emoji-item"
            @click="addReaction(emoji)"
          >
            {{ emoji }}
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 加载状态 -->
    <van-loading v-if="loading" type="spinner" vertical>
      加载中...
    </van-loading>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { messageApi } from '@/api/message'
import { userStore } from '@/stores/user'
import { formatTime, formatContent } from '@/utils/format'
import type { IMessage, IMessageComment, IMessageReaction, IMessageReadStatus } from '@/types/message'

const route = useRoute()
const messageId = route.params.id as string

// 数据状态
const loading = ref(true)
const message = ref<IMessage | null>(null)
const comments = ref<IMessageComment[]>([])
const reactions = ref<IMessageReaction[]>([])
const readStatuses = ref<IMessageReadStatus[]>([])

// 界面状态
const showActions = ref(false)
const showReactionPicker = ref(false)
const activeNames = ref<string[]>([])
const newComment = ref('')
const submittingComment = ref(false)

// 可用的表情
const availableEmojis = ['👍', '❤️', '😄', '😮', '😢', '😡', '👏', '🎉']

// 计算属性
const reactionCounts = computed(() => {
  const counts: Record<string, number> = {}
  reactions.value.forEach(reaction => {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1
  })
  return counts
})

const userReactions = computed(() => {
  return reactions.value
    .filter(r => r.user_id === userStore.userId)
    .map(r => r.emoji)
})

const actionItems = computed(() => {
  const items = []
  
  if (message.value?.user_id === userStore.userId) {
    items.push(
      { name: '编辑', value: 'edit' },
      { name: '删除', value: 'delete' }
    )
  }
  
  items.push(
    { name: message.value?.is_pinned ? '取消置顶' : '置顶', value: 'pin' },
    { name: '分享', value: 'share' }
  )
  
  return items
})

// 方法
const loadMessageDetail = async () => {
  try {
    loading.value = true
    
    // 并行加载所有数据
    const [messageRes, commentsRes, reactionsRes, readRes] = await Promise.all([
      messageApi.getById(messageId),
      messageApi.getComments(messageId),
      messageApi.getReactions(messageId),
      messageApi.getReadStatus(messageId)
    ])
    
    message.value = messageRes.data
    comments.value = commentsRes.data
    reactions.value = reactionsRes.data
    readStatuses.value = readRes.data
    
    // 标记为已读
    await messageApi.markAsRead(messageId)
  } catch (error) {
    console.error('加载留言详情失败:', error)
    uni.showToast({
      title: '加载失败',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const toggleReaction = async (emoji: string) => {
  try {
    if (userReactions.value.includes(emoji)) {
      await messageApi.removeReaction(messageId, emoji)
    } else {
      await messageApi.addReaction(messageId, emoji)
    }
    
    // 重新加载反应数据
    const reactionsRes = await messageApi.getReactions(messageId)
    reactions.value = reactionsRes.data
  } catch (error) {
    console.error('操作反应失败:', error)
  }
}

const addReaction = (emoji: string) => {
  showReactionPicker.value = false
  toggleReaction(emoji)
}

const submitComment = async () => {
  if (!newComment.value.trim()) return
  
  try {
    submittingComment.value = true
    
    await messageApi.addComment(messageId, {
      content: newComment.value.trim()
    })
    
    newComment.value = ''
    
    // 重新加载评论
    const commentsRes = await messageApi.getComments(messageId)
    comments.value = commentsRes.data
    
    uni.showToast({
      title: '评论成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('提交评论失败:', error)
    uni.showToast({
      title: '评论失败',
      icon: 'error'
    })
  } finally {
    submittingComment.value = false
  }
}

const handleAction = (action: any) => {
  showActions.value = false
  
  switch (action.value) {
    case 'edit':
      // 跳转到编辑页面
      uni.navigateTo({
        url: `/pages/message/edit?id=${messageId}`
      })
      break
    case 'delete':
      confirmDelete()
      break
    case 'pin':
      togglePin()
      break
    case 'share':
      shareMessage()
      break
  }
}

const confirmDelete = () => {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条留言吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await messageApi.delete(messageId)
          uni.showToast({
            title: '删除成功',
            icon: 'success'
          })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } catch (error) {
          console.error('删除失败:', error)
          uni.showToast({
            title: '删除失败',
            icon: 'error'
          })
        }
      }
    }
  })
}

const togglePin = async () => {
  try {
    await messageApi.togglePin(messageId)
    
    if (message.value) {
      message.value.is_pinned = !message.value.is_pinned
    }
    
    uni.showToast({
      title: message.value?.is_pinned ? '置顶成功' : '取消置顶',
      icon: 'success'
    })
  } catch (error) {
    console.error('操作失败:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'error'
    })
  }
}

const shareMessage = () => {
  // 实现分享功能
  uni.share({
    provider: 'weixin',
    scene: 'WXSceneSession',
    type: 0,
    href: `${window.location.origin}/message/${messageId}`,
    title: message.value?.title || '家庭留言',
    summary: message.value?.content?.substring(0, 100) || '',
    success: () => {
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      })
    }
  })
}

const getCategoryName = (category: string) => {
  const categoryMap: Record<string, string> = {
    general: '普通',
    urgent: '紧急',
    reminder: '提醒',
    family_news: '家庭动态',
    celebration: '庆祝',
    other: '其他'
  }
  return categoryMap[category] || category
}

const getUserName = (userId: string) => {
  // 从用户缓存中获取用户名
  return userStore.getFamilyMemberName(userId) || '未知用户'
}

const previewAttachment = (attachment: any) => {
  // 实现附件预览
  if (attachment.type.startsWith('image/')) {
    uni.previewImage({
      urls: [attachment.url],
      current: attachment.url
    })
  } else {
    // 下载其他类型文件
    uni.downloadFile({
      url: attachment.url,
      success: (res) => {
        uni.openDocument({
          filePath: res.tempFilePath
        })
      }
    })
  }
}

onMounted(() => {
  loadMessageDetail()
})
</script>

<style scoped>
.message-detail {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.message-content {
  background: white;
  margin-bottom: 12px;
}

.message-header .user-info {
  display: flex;
  align-items: center;
}

.user-name {
  font-weight: 600;
  color: #323233;
}

.meta-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.category {
  background: #f2f3f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.message-body {
  padding: 16px;
}

.message-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #323233;
}

.message-text {
  line-height: 1.6;
  color: #646566;
  margin-bottom: 16px;
}

.attachments {
  margin-bottom: 16px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f7f8fa;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.attachment-item:hover {
  background: #ebedf0;
}

.mentions {
  margin-top: 12px;
}

.reactions-section {
  padding: 16px;
  border-top: 1px solid #ebedf0;
}

.reactions-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #ebedf0;
  border-radius: 16px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.reaction-item:hover {
  background: #f7f8fa;
}

.reaction-item.active {
  background: #1989fa;
  color: white;
  border-color: #1989fa;
}

.emoji {
  font-size: 16px;
}

.count {
  font-size: 12px;
  min-width: 16px;
  text-align: center;
}

.read-status {
  border-top: 1px solid #ebedf0;
}

.read-list {
  padding: 12px 16px;
}

.read-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.read-time {
  margin-left: auto;
  font-size: 12px;
  color: #969799;
}

.comments-section {
  background: white;
  padding: 16px;
}

.comments-header h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.comment-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.comment-avatar {
  flex-shrink: 0;
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-user {
  font-weight: 600;
  font-size: 14px;
}

.comment-time {
  font-size: 12px;
  color: #969799;
}

.comment-text {
  line-height: 1.5;
  color: #646566;
}

.comment-input {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebedf0;
}

.comment-input .van-field {
  flex: 1;
}

.reaction-picker {
  padding: 20px;
}

.picker-header {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  font-size: 24px;
  background: #f7f8fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.emoji-item:hover {
  background: #ebedf0;
  transform: scale(1.1);
}
</style>