import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Family } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const families = ref<Family[]>([])
  const currentFamily = ref<Family | null>(null)

  const auth = useAuthStore()
  const familyStore = useFamilyStore()

  const isAuthenticated = computed(() => auth.isAuthenticated)
  const userId = computed(() => user.value?.id || '')
  const token = computed(() => auth.accessToken)

  const setUser = async (u: User) => {
    user.value = u
    families.value = u.families || []
    currentFamily.value = u.currentFamily || families.value[0] || null
  }

  const clearUser = () => {
    user.value = null
    families.value = []
    currentFamily.value = null
  }

  const initializeAuth = async () => {
    return await auth.initializeAuth()
  }

  const logout = async () => {
    await auth.logout()
  }

  const getFamilyMembers = async () => {
    if (!currentFamily.value) return []
    return await familyStore.getFamilyMembers(currentFamily.value.id)
  }

  const getFamilyMemberName = (uid: string) => {
    const members = familyStore.currentMembers
    const found = members.find(m => m.user_id === uid)
    return found?.user?.nickname || found?.user?.username || ''
  }

  return {
    // state
    user,
    families,
    currentFamily,
    // getters
    isAuthenticated,
    userId,
    token,
    // actions
    setUser,
    clearUser,
    initializeAuth,
    logout,
    getFamilyMembers,
    getFamilyMemberName,
  }
})

// 兼容旧代码的导出（部分视图中以 userStore 命名导入）
export const userStore = {
  async getFamilyMembers() {
    const s = useUserStore()
    return s.getFamilyMembers()
  },
  getFamilyMemberName(userId: string) {
    const s = useUserStore()
    return s.getFamilyMemberName(userId)
  },
  get userId() {
    const s = useUserStore()
    return s.userId
  }
}

