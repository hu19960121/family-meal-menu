import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { load, save } from '@/utils/storage'
import { isOnline, memberApi, familyApi } from '@/api/client'
import type { FamilyMember, MemberRole } from '@/api/types'

// ==================== 类型 ====================

export interface FamilyInfo {
  name: string
  createdAt: string
}

// ==================== Store ====================

export const useFamilyStore = defineStore('family', () => {
  const AVATARS = ['👨', '👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']

  // ==================== 状态 ====================
  const info = ref<FamilyInfo>(load('family_info', { name: '', createdAt: '' }))
  const members = ref<FamilyMember[]>(load('family_members', [] as FamilyMember[]))
  const currentUserId = ref<string>(load('current_user', ''))
  const inviteCode = ref<string>(load('invite_code', ''))
  const inviteExpiry = ref<number>(load('invite_expiry', 0))

  // 兜底：如果有成员但没有选中当前用户，默认选第一个
  if (!currentUserId.value && members.value.length > 0) {
    currentUserId.value = members.value[0].id
    save('current_user', currentUserId.value)
  }

  // ==================== 计算属性 ====================
  const currentUser = computed(() => members.value.find(m => m.id === currentUserId.value) || members.value[0])
  const isCreator = computed(() => currentUser.value?.role === 'creator')
  const isAdmin = computed(() => currentUser.value?.role === 'creator' || currentUser.value?.role === 'admin')
  const isInitialized = computed(() => {
    if (isOnline()) return true
    if (info.value.name) return true
    const cached = load('family_info', { name: '', createdAt: '' } as FamilyInfo)
    return !!cached.name
  })

  // ==================== 成员操作 ====================

  async function addMember(name: string, role: MemberRole = 'member'): Promise<FamilyMember> {
    let memberId = 'm_' + Date.now()
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]

    // 先尝试在服务端创建，获取服务端 ID
    if (isOnline()) {
      try {
        const result = await memberApi.create({ name, avatar, role })
        memberId = result.id
      } catch {
        // 服务端创建失败，降级为本地 ID
      }
    }

    const m: FamilyMember = { id: memberId, name, avatar, role }
    members.value.push(m)
    save('family_members', members.value)
    return m
  }

  function updateMember(id: string, data: { name?: string; avatar?: string }) {
    const m = members.value.find(x => x.id === id)
    if (!m) return
    if (data.name) m.name = data.name
    if (data.avatar) m.avatar = data.avatar
    save('family_members', members.value)
    if (isOnline()) {
      memberApi.update(id, data).catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  function deleteMember(id: string) {
    members.value = members.value.filter(m => m.id !== id)
    save('family_members', members.value)
    if (id === currentUserId.value && members.value.length > 0) {
      currentUserId.value = members.value[0].id
      save('current_user', currentUserId.value)
    }
    if (isOnline()) {
      memberApi.remove(id).catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  function setMemberRole(id: string, role: MemberRole) {
    const m = members.value.find(x => x.id === id)
    if (!m) return
    m.role = role
    save('family_members', members.value)
    if (isOnline()) {
      memberApi.setRole(id, role).catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  function switchUser(id: string) {
    currentUserId.value = id
    save('current_user', id)
  }

  // ==================== 邀请码 ====================

  async function generateInviteCode(): Promise<string> {
    if (isOnline()) {
      try {
        const r = await familyApi.generateInvite()
        inviteCode.value = r.inviteCode
        save('invite_code', r.inviteCode)
        return inviteCode.value
      } catch { /* API 失败则降级为本地生成 */ }
    }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    inviteCode.value = code
    save('invite_code', code)
    return inviteCode.value
  }

  function clearInviteCode() {
    inviteCode.value = ''
    save('invite_code', '')
  }

  // ==================== 服务端同步 ====================

  /** 直接设置状态并持久化（createFamily / joinFamily 初始化用） */
  function setState(data: {
    info?: FamilyInfo
    members?: FamilyMember[]
    currentUserId?: string
  }) {
    if (data.info) { info.value = data.info; save('family_info', info.value) }
    if (data.members) { members.value = data.members; save('family_members', members.value) }
    if (data.currentUserId !== undefined) { currentUserId.value = data.currentUserId; save('current_user', currentUserId.value) }
  }

  /** 从服务端数据加载（syncFromCloud 调用） */
  function loadFromServer(familyData: { name: string; createdAt: string; members: FamilyMember[] }, myId: string) {
    info.value = { name: familyData.name, createdAt: familyData.createdAt }
    members.value = familyData.members
    currentUserId.value = myId
    save('family_info', info.value)
    save('family_members', members.value)
    save('current_user', currentUserId.value)
  }

  /** 仅清空本地（退出/解散家庭时用，不同步） */
  function reset() {
    info.value = { name: '', createdAt: '' }
    members.value = []
    currentUserId.value = ''
    inviteCode.value = ''
    save('family_info', info.value)
    save('family_members', [])
    save('current_user', '')
    save('invite_code', '')
  }

  return {
    info, members, currentUserId, currentUser, isCreator, isAdmin, isInitialized,
    inviteCode, inviteExpiry, AVATARS,
    addMember, updateMember, deleteMember, setMemberRole, switchUser,
    generateInviteCode, clearInviteCode,
    setState, loadFromServer, reset,
  }
})
