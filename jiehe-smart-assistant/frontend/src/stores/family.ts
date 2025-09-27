import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { familyApi } from '@/api/family'
import type { IFamily, IFamilyMember, CreateFamilyData } from '@/types/family'

export const useFamilyStore = defineStore('family', () => {
  // 状态
  const families = ref<IFamily[]>([])
  const currentFamily = ref<IFamily | null>(null)
  const currentMembers = ref<IFamilyMember[]>([])
  const loading = ref(false)

  // 计算属性
  const currentFamilyId = computed(() => currentFamily.value?.id)
  const isCurrentUserAdmin = computed(() => {
    if (!currentFamily.value) return false
    // TODO: 从用户store获取当前用户ID
    return true // 临时返回true
  })

  // 获取家庭列表
  const getFamilies = async (): Promise<IFamily[]> => {
    try {
      loading.value = true
      const response = await familyApi.getFamilies()
      families.value = response.data
      return response.data
    } catch (error) {
      console.error('获取家庭列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 创建家庭
  const createFamily = async (familyData: CreateFamilyData): Promise<IFamily> => {
    try {
      loading.value = true
      const response = await familyApi.createFamily(familyData)
      families.value.unshift(response.data)
      return response.data
    } catch (error) {
      console.error('创建家庭失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 加入家庭
  const joinFamily = async (inviteCode: string): Promise<IFamily> => {
    try {
      loading.value = true
      const response = await familyApi.joinFamily(inviteCode)
      families.value.unshift(response.data)
      return response.data
    } catch (error) {
      console.error('加入家庭失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取家庭详情
  const getFamilyDetail = async (familyId: string): Promise<IFamily> => {
    try {
      loading.value = true
      const response = await familyApi.getFamilyDetail(familyId)
      currentFamily.value = response.data
      return response.data
    } catch (error) {
      console.error('获取家庭详情失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取家庭成员
  const getFamilyMembers = async (familyId: string): Promise<IFamilyMember[]> => {
    try {
      const response = await familyApi.getFamilyMembers(familyId)
      currentMembers.value = response.data
      return response.data
    } catch (error) {
      console.error('获取家庭成员失败:', error)
      throw error
    }
  }

  // 设置当前家庭
  const setCurrentFamily = (family: IFamily) => {
    currentFamily.value = family
  }

  // 更新家庭信息
  const updateFamily = async (familyId: string, updates: Partial<IFamily>): Promise<IFamily> => {
    try {
      const response = await familyApi.updateFamily(familyId, updates)
      if (currentFamily.value?.id === familyId) {
        currentFamily.value = { ...currentFamily.value, ...response.data }
      }
      const index = families.value.findIndex(f => f.id === familyId)
      if (index !== -1) {
        families.value[index] = { ...families.value[index], ...response.data }
      }
      return response.data
    } catch (error) {
      console.error('更新家庭信息失败:', error)
      throw error
    }
  }

  // 移除家庭成员
  const removeFamilyMember = async (familyId: string, memberId: string): Promise<void> => {
    try {
      await familyApi.removeMember(familyId, memberId)
      currentMembers.value = currentMembers.value.filter(m => m.id !== memberId)
    } catch (error) {
      console.error('移除家庭成员失败:', error)
      throw error
    }
  }

  // 退出家庭
  const leaveFamily = async (familyId: string): Promise<void> => {
    try {
      await familyApi.leaveFamily(familyId)
      families.value = families.value.filter(f => f.id !== familyId)
      if (currentFamily.value?.id === familyId) {
        currentFamily.value = null
        currentMembers.value = []
      }
    } catch (error) {
      console.error('退出家庭失败:', error)
      throw error
    }
  }

  // 解散家庭
  const dissolveFamily = async (familyId: string): Promise<void> => {
    try {
      await familyApi.dissolveFamily(familyId)
      families.value = families.value.filter(f => f.id !== familyId)
      if (currentFamily.value?.id === familyId) {
        currentFamily.value = null
        currentMembers.value = []
      }
    } catch (error) {
      console.error('解散家庭失败:', error)
      throw error
    }
  }

  return {
    // 状态
    families,
    currentFamily,
    currentMembers,
    loading,
    
    // 计算属性
    currentFamilyId,
    isCurrentUserAdmin,
    
    // 方法
    getFamilies,
    createFamily,
    joinFamily,
    getFamilyDetail,
    getFamilyMembers,
    setCurrentFamily,
    updateFamily,
    removeFamilyMember,
    leaveFamily,
    dissolveFamily
  }
})