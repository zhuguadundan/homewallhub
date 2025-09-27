import { http } from '@/utils/request'
import type { IFamily, IFamilyMember, CreateFamilyData, UpdateFamilyData } from '@/types/family'
import type { ApiResponse } from '@/types/api'

export const familyApi = {
  // 获取用户的家庭列表
  getFamilies(): Promise<ApiResponse<IFamily[]>> {
    return http.get('/families/my')
  },

  // 创建家庭
  createFamily(data: CreateFamilyData): Promise<ApiResponse<IFamily>> {
    return http.post('/families', data)
  },

  // 通过邀请码加入家庭
  joinFamily(inviteCode: string): Promise<ApiResponse<IFamily>> {
    return http.post(`/families/join`, { inviteCode })
  },

  // 获取家庭详情
  getFamilyDetail(familyId: string): Promise<ApiResponse<IFamily>> {
    return http.get(`/families/${familyId}`)
  },

  // 更新家庭信息
  updateFamily(familyId: string, data: UpdateFamilyData): Promise<ApiResponse<IFamily>> {
    return http.put(`/families/${familyId}`, data)
  },

  // 获取家庭成员列表
  getFamilyMembers(familyId: string): Promise<ApiResponse<IFamilyMember[]>> {
    return http.get(`/families/${familyId}/members`)
  },

  // 更新成员角色
  updateMemberRole(familyId: string, memberId: string, role: string): Promise<ApiResponse<void>> {
    return http.put(`/families/${familyId}/members/${memberId}/role`, { role })
  },

  // 移除家庭成员
  removeMember(familyId: string, memberId: string): Promise<ApiResponse<void>> {
    return http.delete(`/families/${familyId}/members/${memberId}`)
  },

  // 退出家庭
  leaveFamily(familyId: string): Promise<ApiResponse<void>> {
    return http.post(`/families/${familyId}/leave`)
  },

  // 解散家庭（仅管理员）
  dissolveFamily(familyId: string): Promise<ApiResponse<void>> {
    return http.delete(`/families/${familyId}`)
  },

  // 重新生成邀请码
  regenerateInviteCode(familyId: string): Promise<ApiResponse<{ inviteCode: string }>> {
    return http.post(`/families/${familyId}/regenerate-invite-code`)
  }
}
