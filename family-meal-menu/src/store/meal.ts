import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { load, save } from '@/utils/storage'
import {
  hasCloudConfig, getCloudConfig, saveCloudConfig, clearCloudConfig,
  familyApi, recipeApi, cartApi, orderApi, authApi, DEFAULT_SERVER_URL,
} from '@/api/client'
import type { Recipe, MemberRole } from '@/api/types'
import { useCartStore } from './cart'
import { useOrderStore } from './order'
import { useRecipeStore } from './recipe'
import { useFamilyStore } from './family'
export type { RecipeInput } from './recipe'
export type { FamilyInfo } from './family'

export const useMealStore = defineStore('meal', () => {
  const familyStore = useFamilyStore()
  const cartStore = useCartStore()
  const orderStore = useOrderStore()
  const recipeStore = useRecipeStore()

  // ==================== 云端模式状态 ====================
  const cloudMode = ref(hasCloudConfig())
  const syncing = ref(false)

  // ==================== 身份固化（OpenID / 恢复密钥） ====================
  const openid = ref<string>(load('user_openid', ''))
  const recoveryKey = ref<string>(load('user_recovery_key', ''))

  /** 初始化身份：尝试微信登录获取 OpenID */
  async function initIdentity(): Promise<{
    recovered: boolean
    familyId?: string
    memberId?: string
    memberName?: string
    role?: string
  }> {
    if (openid.value) return { recovered: false }

    try {
      const loginRes = await new Promise<{ code: string }>((resolve, reject) => {
        uni.login({ success: resolve as any, fail: reject })
      })
      const result = await authApi.wechatLogin(loginRes.code)
      if (result.openid) {
        openid.value = result.openid
        save('user_openid', result.openid)
      }
      if (result.found && result.familyId && result.memberId) {
        return {
          recovered: true,
          familyId: result.familyId,
          memberId: result.memberId,
          memberName: result.memberName,
          role: result.role,
        }
      }
    } catch {
      // 微信登录失败（如开发环境），静默忽略
    }
    return { recovered: false }
  }

  /** 尝试通过恢复密钥找回身份 */
  async function recoverByIdentityKey(key: string): Promise<{
    recovered: boolean
    familyId?: string
    memberId?: string
    memberName?: string
    role?: string
  }> {
    try {
      const result = await authApi.recover(key)
      if (result.found && result.familyId && result.memberId) {
        recoveryKey.value = key.toUpperCase()
        save('user_recovery_key', recoveryKey.value)
        return {
          recovered: true,
          familyId: result.familyId,
          memberId: result.memberId,
          memberName: result.memberName,
          role: result.role,
        }
      }
    } catch {
      // 恢复失败
    }
    return { recovered: false }
  }

  // ==================== 重置/退出 ====================
  /** 清理所有数据，回到设置页（协调所有 domain store） */
  function resetFamily() {
    cloudMode.value = false
    familyStore.reset()
    cartStore.reset()
    orderStore.reset()
    recipeStore.reset()
    clearCloudConfig()
  }

  // ==================== 云端同步 ====================
  /** 从服务器同步所有数据（协调所有 domain store） */
  async function syncFromCloud() {
    try {
      if (!hasCloudConfig()) return
    } catch { return }

    await new Promise(r => setTimeout(r, 0))
    syncing.value = true

    try {
      const config = getCloudConfig()!
      const fam = await familyApi.get(config.familyId)

      // 检测当前用户是否已被管理员删除
      const myId = config.memberId
      if (!fam.members?.find((m: any) => m.id === myId)) {
        uni.showToast({ title: '你已被移出家庭', icon: 'none' })
        resetFamily()
        uni.reLaunch({ url: '/pages/family/setup' })
        return
      }

      familyStore.loadFromServer(
        { name: fam.name, createdAt: fam.createdAt, members: fam.members as any[] },
        myId,
      )

      // 获取食谱
      const recipesData = await recipeApi.list()
      recipeStore.loadFromServer(recipesData || [])

      // 获取购物车
      const cartData = await cartApi.get()
      cartStore.loadFromServer(cartData || [])

      // 获取订单
      const ordersData = await orderApi.list()
      orderStore.loadFromServer(ordersData || [])

    } catch (e: any) {
      console.warn('云端同步失败，使用本地缓存:', e?.message)
      if (e?.message?.includes('404') || e?.message?.includes('家庭不存在')) {
        resetFamily()
      }
    } finally {
      await new Promise(r => setTimeout(r, 0))
      syncing.value = false
    }
  }

  // ==================== 家庭管理（跨域协调，不放入 familyStore） ====================

  /** 解散家庭（仅创建者） */
  async function dissolveFamily(): Promise<boolean> {
    if (!familyStore.isCreator) {
      uni.showToast({ title: '仅创建者可解散家庭', icon: 'none' })
      return false
    }
    try {
      if (cloudMode.value) {
        await familyApi.dissolve()
      }
      resetFamily()
      uni.showToast({ title: '家庭已解散', icon: 'success' })
      return true
    } catch (e: any) {
      uni.showToast({ title: e.message || '解散失败', icon: 'none' })
      return false
    }
  }

  async function createFamily(familyName: string, creatorName: string) {
    const result = await familyApi.create(familyName, creatorName, openid.value || undefined)
    saveCloudConfig({
      serverUrl: getCloudConfig()?.serverUrl || DEFAULT_SERVER_URL,
      familyId: result.familyId,
      familyName: result.familyName,
      memberName: result.name,
      memberId: result.memberId,
    })
    cloudMode.value = true
    familyStore.setState({
      info: { name: result.familyName, createdAt: new Date().toISOString() },
      members: [{ id: result.memberId, name: result.name, avatar: '👨', role: 'creator' }],
      currentUserId: result.memberId,
    })
    if (result.recoveryKey) {
      recoveryKey.value = result.recoveryKey
      save('user_recovery_key', result.recoveryKey)
    }
    return { inviteCode: result.inviteCode, recoveryKey: result.recoveryKey }
  }

  async function joinFamily(inviteCode: string, name: string): Promise<boolean> {
    const result = await familyApi.join(inviteCode, name, openid.value || undefined)

    saveCloudConfig({
      serverUrl: getCloudConfig()?.serverUrl || DEFAULT_SERVER_URL,
      familyId: result.familyId,
      familyName: result.familyName,
      memberName: result.name,
      memberId: result.memberId,
    })
    cloudMode.value = true

    familyStore.setState({
      info: { name: result.familyName, createdAt: new Date().toISOString() },
      members: result.members?.length
        ? result.members
        : [{ id: result.memberId, name: result.name, avatar: '👩', role: 'member' }],
      currentUserId: result.memberId,
    })

    if (result.recoveryKey) {
      recoveryKey.value = result.recoveryKey
      save('user_recovery_key', result.recoveryKey)
    }

    // 尝试从云端拉食谱等数据（静默失败）
    try {
      await syncFromCloud()
    } catch { /* 静默 */ }
    return true
  }

  // ==================== 成员 & 邀请码（委托 familyStore） ====================

  // 向后兼容：页面通过 mealStore.xxx 访问
  const familyInfo = computed(() => familyStore.info)
  const members = computed(() => familyStore.members)
  const currentUser = computed(() => familyStore.currentUser)
  const currentUserId = computed(() => familyStore.currentUserId)
  const isCreator = computed(() => familyStore.isCreator)
  const isAdmin = computed(() => familyStore.isAdmin)
  const isInitialized = computed(() => familyStore.isInitialized)
  const canEditRecipes = computed(() => familyStore.isAdmin)
  const canOrder = computed(() => true)
  const canManageMembers = computed(() => familyStore.isCreator)
  const inviteCode = computed(() => familyStore.inviteCode)
  const inviteExpiry = computed(() => familyStore.inviteExpiry)
  const AVATARS = familyStore.AVATARS

  async function addMember(name: string, role: MemberRole = 'member'): Promise<any> {
    return familyStore.addMember(name, role)
  }

  function switchUser(id: string) {
    familyStore.switchUser(id)
  }

  function setMemberRole(id: string, role: MemberRole) {
    familyStore.setMemberRole(id, role)
  }

  function updateMember(id: string, data: { name?: string; avatar?: string }) {
    familyStore.updateMember(id, data)
  }

  function deleteMember(id: string) {
    familyStore.deleteMember(id)
  }

  function leaveFamily(): boolean {
    if (familyStore.isCreator) return false
    familyStore.deleteMember(familyStore.currentUserId)
    if (cloudMode.value) {
      clearCloudConfig()
      cloudMode.value = false
    }
    resetFamily()
    return true
  }

  async function generateInviteCode(): Promise<string> {
    return familyStore.generateInviteCode()
  }

  function clearInviteCode() {
    familyStore.clearInviteCode()
  }

  // ==================== 食谱（委托 recipeStore） ====================

  // 向后兼容：页面通过 mealStore.recipes / mealStore.addRecipe 等访问
  const recipes = computed(() => recipeStore.items)

  async function addRecipe(input: RecipeInput): Promise<string> {
    return recipeStore.add(input)
  }

  async function updateRecipe(id: string, data: Partial<RecipeInput>): Promise<boolean> {
    return recipeStore.update(id, data)
  }

  async function deleteRecipe(id: string) {
    return recipeStore.remove(id)
  }

  function getRecipeById(id: string): Recipe | undefined {
    return recipeStore.getById(id)
  }

  // ==================== 购物车（委托 cartStore） ====================

  // 向后兼容：页面通过 mealStore.cart / mealStore.addToCart 等访问
  const cart = computed(() => cartStore.items)
  const cartCount = computed(() => cartStore.count)

  function addToCart(recipe: Recipe): boolean {
    return cartStore.add(recipe, currentUser.value?.name || '未知')
  }

  function removeFromCart(idxOrRecipeId: number | string) {
    if (typeof idxOrRecipeId === 'number') {
      cartStore.removeByIndex(idxOrRecipeId)
    } else {
      cartStore.decreaseQuantity(idxOrRecipeId)
    }
  }

  function getCartQuantity(recipeId: string): number {
    return cartStore.getQuantity(recipeId)
  }

  function generateCart() {
    cartStore.generate(recipes.value, currentUser.value?.name || '未知')
  }

  function clearCart() {
    cartStore.clear()
  }

  // ==================== 订单（委托 orderStore） ====================

  // 向后兼容：页面通过 mealStore.orders / mealStore.placeOrder 访问
  const orders = computed(() => orderStore.items)

  function placeOrder(items: Array<{ recipeId: string; recipeName: string; recipeCategory: string }>) {
    const user = currentUser.value
    const order = orderStore.place(items, user?.id || '', user?.name || '未知')
    // 跨域操作：更新食谱点单次数
    items.forEach(item => {
      recipeStore.incrementOrderCount(item.recipeId)
    })
    return order
  }

  return {
    cloudMode, syncing, isInitialized,
    openid, recoveryKey, initIdentity, recoverByIdentityKey,
    familyInfo, createFamily, joinFamily, dissolveFamily,
    members, currentUser, currentUserId,
    isCreator, isAdmin, canEditRecipes, canOrder, canManageMembers,
    switchUser, addMember, updateMember, deleteMember, setMemberRole,
    leaveFamily, resetFamily,
    inviteCode, generateInviteCode, clearInviteCode,
    recipes, addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    cart, cartCount, addToCart, removeFromCart, getCartQuantity, generateCart, clearCart,
    orders, placeOrder,
    syncFromCloud,
    AVATARS,
  }
})
