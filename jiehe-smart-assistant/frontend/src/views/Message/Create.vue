<template>
  <div class="message-create">
    <van-nav-bar title="发布留言" left-arrow @click-left="handleBack">
      <template #right>
        <van-button
          type="primary"
          size="small"
          :disabled="!isValid"
          :loading="submitting"
          @click="submitMessage"
        >
          发布
        </van-button>
      </template>
    </van-nav-bar>

    <div class="form-container">
      <!-- 标题输入 -->
      <van-field
        v-model="form.title"
        label="标题"
        placeholder="请输入留言标题"
        maxlength="50"
        show-word-limit
        required
        :error-message="errors.title"
      />

      <!-- 分类选择 -->
      <van-field
        v-model="categoryText"
        label="分类"
        placeholder="选择留言分类"
        readonly
        is-link
        @click="showCategoryPicker = true"
        required
        :error-message="errors.category"
      />

      <!-- 内容输入 -->
      <van-field
        v-model="form.content"
        label="内容"
        type="textarea"
        placeholder="写下你想说的话..."
        autosize
        maxlength="1000"
        show-word-limit
        required
        :error-message="errors.content"
      />

      <!-- @提醒用户 -->
      <van-field
        label="@提醒"
        placeholder="选择要提醒的家庭成员"
        readonly
        is-link
        @click="showMemberPicker = true"
      >
        <template #input>
          <div v-if="selectedMembers.length" class="selected-members">
            <van-tag
              v-for="member in selectedMembers"
              :key="member.id"
              closeable
              @close="removeMember(member.id)"
              style="margin-right: 8px; margin-bottom: 4px"
            >
              @{{ member.name }}
            </van-tag>
          </div>
          <span v-else class="placeholder">点击选择要@的成员</span>
        </template>
      </van-field>

      <!-- 附件上传 -->
      <div class="attachment-section">
        <div class="section-title">
          <span>附件</span>
          <van-button
            type="primary"
            size="mini"
            plain
            @click="chooseFile"
          >
            添加附件
          </van-button>
        </div>
        
        <div v-if="attachments.length" class="attachments">
          <div
            v-for="(file, index) in attachments"
            :key="index"
            class="attachment-item"
          >
            <van-image
              v-if="file.type.startsWith('image/')"
              :src="file.preview"
              width="60"
              height="60"
              fit="cover"
              round
            />
            <van-icon v-else name="description" size="24" />
            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-size">{{ formatFileSize(file.size) }}</div>
            </div>
            <van-icon
              name="cross"
              @click="removeAttachment(index)"
              class="remove-btn"
            />
          </div>
        </div>
      </div>

      <!-- 高级选项 -->
      <van-collapse v-model="activeNames">
        <van-collapse-item title="高级选项" name="advanced">
          <van-field label="置顶">
            <template #input>
              <van-switch v-model="form.is_pinned" />
            </template>
          </van-field>
          
          <van-field
            v-model="reminderTimeText"
            label="定时提醒"
            placeholder="设置提醒时间（可选）"
            readonly
            is-link
            @click="showTimePicker = true"
          />
        </van-collapse-item>
      </van-collapse>
    </div>

    <!-- 分类选择器 -->
    <van-popup v-model:show="showCategoryPicker" position="bottom">
      <van-picker
        :columns="categoryOptions"
        @confirm="onCategoryConfirm"
        @cancel="showCategoryPicker = false"
      />
    </van-popup>

    <!-- 成员选择器 -->
    <van-popup v-model:show="showMemberPicker" position="bottom">
      <div class="member-picker">
        <div class="picker-header">
          <span>选择要@的成员</span>
          <van-button
            type="primary"
            size="small"
            @click="confirmMemberSelection"
          >
            确定
          </van-button>
        </div>
        <div class="member-list">
          <van-checkbox-group v-model="tempSelectedMemberIds">
            <van-checkbox
              v-for="member in familyMembers"
              :key="member.id"
              :name="member.id"
              class="member-item"
            >
              <div class="member-info">
                <van-image
                  :src="member.avatar"
                  width="40"
                  height="40"
                  round
                  fit="cover"
                />
                <span>{{ member.name }}</span>
              </div>
            </van-checkbox>
          </van-checkbox-group>
        </div>
      </div>
    </van-popup>

    <!-- 时间选择器 -->
    <van-popup v-model:show="showTimePicker" position="bottom">
      <van-date-picker
        v-model="reminderTime"
        title="选择提醒时间"
        :min-date="new Date()"
        @confirm="onTimeConfirm"
        @cancel="showTimePicker = false"
      />
    </van-popup>

    <!-- 文件选择器 -->
    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/*,.pdf,.doc,.docx,.txt"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { messageApi } from '@/api/message'
import { userStore } from '@/stores/user'
import { uploadApi } from '@/api/upload'
import type { IMessage } from '@/types/message'

const router = useRouter()

// 表单数据
const form = reactive({
  title: '',
  content: '',
  category: 'general' as IMessage['category'],
  is_pinned: false,
  mentioned_users: [] as string[],
  reminder_time: null as Date | null
})

// 界面状态
const submitting = ref(false)
const showCategoryPicker = ref(false)
const showMemberPicker = ref(false)
const showTimePicker = ref(false)
const activeNames = ref<string[]>([])

// 文件相关
const fileInput = ref<HTMLInputElement>()
const attachments = ref<File[]>([])

// 选择相关
const selectedMembers = ref<Array<{ id: string, name: string, avatar: string }>>([])
const tempSelectedMemberIds = ref<string[]>([])
const reminderTime = ref<Date>(new Date())

// 验证错误
const errors = reactive({
  title: '',
  content: '',
  category: ''
})

// 家庭成员列表
const familyMembers = ref<Array<{ id: string, name: string, avatar: string }>>([])

// 分类选项
const categoryOptions = [
  { text: '普通留言', value: 'general' },
  { text: '紧急事项', value: 'urgent' },
  { text: '提醒事项', value: 'reminder' },
  { text: '家庭动态', value: 'family_news' },
  { text: '庆祝事项', value: 'celebration' },
  { text: '其他', value: 'other' }
]

// 计算属性
const categoryText = computed(() => {
  const option = categoryOptions.find(opt => opt.value === form.category)
  return option?.text || ''
})

const reminderTimeText = computed(() => {
  return form.reminder_time 
    ? form.reminder_time.toLocaleString('zh-CN')
    : ''
})

const isValid = computed(() => {
  return form.title.trim() && 
         form.content.trim() && 
         form.category &&
         !Object.values(errors).some(error => error)
})

// 方法
const validateForm = () => {
  errors.title = form.title.trim() ? '' : '请输入标题'
  errors.content = form.content.trim() ? '' : '请输入内容'
  errors.category = form.category ? '' : '请选择分类'
  
  return !Object.values(errors).some(error => error)
}

const submitMessage = async () => {
  if (!validateForm()) return
  
  try {
    submitting.value = true
    
    // 上传附件
    const uploadedAttachments = []
    for (const file of attachments.value) {
      const uploadRes = await uploadApi.uploadFile(file)
      uploadedAttachments.push({
        name: file.name,
        url: uploadRes.data.url,
        type: file.type,
        size: file.size
      })
    }
    
    // 创建留言
    const messageData = {
      ...form,
      mentioned_users: selectedMembers.value.map(m => m.id),
      attachments: uploadedAttachments
    }
    
    await messageApi.create(messageData)
    
    uni.showToast({
      title: '发布成功',
      icon: 'success'
    })
    
    // 返回上一页
    setTimeout(() => {
      router.go(-1)
    }, 1500)
    
  } catch (error) {
    console.error('发布留言失败:', error)
    uni.showToast({
      title: '发布失败',
      icon: 'error'
    })
  } finally {
    submitting.value = false
  }
}

const handleBack = () => {
  if (form.title || form.content) {
    uni.showModal({
      title: '确认退出',
      content: '已输入的内容将丢失，确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          router.go(-1)
        }
      }
    })
  } else {
    router.go(-1)
  }
}

const onCategoryConfirm = ({ selectedOptions }: any) => {
  form.category = selectedOptions[0]?.value || 'general'
  showCategoryPicker.value = false
}

const confirmMemberSelection = () => {
  selectedMembers.value = familyMembers.value.filter(
    member => tempSelectedMemberIds.value.includes(member.id)
  )
  showMemberPicker.value = false
}

const removeMember = (memberId: string) => {
  selectedMembers.value = selectedMembers.value.filter(m => m.id !== memberId)
  tempSelectedMemberIds.value = tempSelectedMemberIds.value.filter(id => id !== memberId)
}

const onTimeConfirm = () => {
  form.reminder_time = reminderTime.value
  showTimePicker.value = false
}

const chooseFile = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  
  files.forEach(file => {
    if (file.size > 10 * 1024 * 1024) { // 10MB限制
      uni.showToast({
        title: '文件大小不能超过10MB',
        icon: 'none'
      })
      return
    }
    
    // 为图片文件生成预览
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        file.preview = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
    
    attachments.value.push(file)
  })
  
  // 清空input
  target.value = ''
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const loadFamilyMembers = async () => {
  try {
    const res = await userStore.getFamilyMembers()
    familyMembers.value = res.filter(member => member.id !== userStore.userId)
  } catch (error) {
    console.error('加载家庭成员失败:', error)
  }
}

onMounted(() => {
  loadFamilyMembers()
})
</script>

<style scoped>
.message-create {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.form-container {
  padding: 0;
}

.form-container .van-field {
  margin-bottom: 1px;
}

.selected-members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.placeholder {
  color: #c8c9cc;
}

.attachment-section {
  padding: 16px;
  background: white;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.attachments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.file-info {
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.file-size {
  font-size: 12px;
  color: #969799;
}

.remove-btn {
  color: #ee0a24;
  cursor: pointer;
}

.member-picker {
  max-height: 60vh;
  overflow-y: auto;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ebedf0;
  font-weight: 600;
}

.member-list {
  padding: 16px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f7f8fa;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
}
</style>