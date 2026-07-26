import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { load, save } from '@/utils/storage'
import {
  isOnline, getCloudConfig, saveCloudConfig, clearCloudConfig,
  familyApi, memberApi, recipeApi, cartApi, orderApi,
} from '@/api/client'
import type { Recipe, FamilyMember, Order, CartItem, MemberRole, Ingredient } from '@/api/types'

export interface FamilyInfo {
  name: string
  createdAt: string
}

export interface RecipeInput {
  name: string
  category: Recipe['category']
  coverImage: string
  cookingTime: number
  difficulty: Recipe['difficulty']
  servings: number
  tags: string[]
  nutritions: Recipe['nutritions']
  ingredients: Ingredient[]
  steps: Recipe['steps']
}

export const useMealStore = defineStore('meal', () => {
  const AVATARS = ['👨', '👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']

  // ==================== 云端模式状态 ====================
  const cloudMode = ref(isOnline())
  const syncing = ref(false)

  // ==================== 家庭信息 ====================
  const familyInfo = ref<FamilyInfo>(load('family_info', { name: '', createdAt: '' }))
  const isInitialized = computed(() => {
    // 1) 云端模式必定已初始化
    if (cloudMode.value) return true
    // 2) 内存中有家庭信息
    if (familyInfo.value.name) return true
    // 3) 安全兜底：直接检查 localStorage（防止 cloudMode 或内存状态异常）
    const cached = load('family_info', { name: '', createdAt: '' } as FamilyInfo)
    return !!cached.name
  })

  // ==================== 成员 ====================
  const members = ref<FamilyMember[]>(load('family_members', [] as FamilyMember[]))
  const currentUserId = ref<string>(load('current_user', ''))

  if (!currentUserId.value && members.value.length > 0) {
    currentUserId.value = members.value[0].id
    save('current_user', currentUserId.value)
  }

  const currentUser = computed(() => members.value.find(m => m.id === currentUserId.value) || members.value[0])
  const isCreator = computed(() => currentUser.value?.role === 'creator')
  const isAdmin = computed(() => currentUser.value?.role === 'creator' || currentUser.value?.role === 'admin')
  const canEditRecipes = computed(() => isAdmin.value)
  const canOrder = computed(() => true)
  const canManageMembers = computed(() => isCreator.value)

  // ==================== 重置/退出 ====================
  /** 清理所有数据，回到设置页 */
  function resetFamily() {
    cloudMode.value = false
    familyInfo.value = { name: '', createdAt: '' }
    members.value = []
    currentUserId.value = ''
    recipes.value = []
    cart.value = []
    orders.value = []
    clearCloudConfig()
    save('family_info', familyInfo.value)
    save('family_members', [])
    save('current_user', '')
    save('family_recipes', [])
    save('family_cart', [])
    save('family_orders', [])
  }

  // ==================== 云端同步 ====================
  async function syncFromCloud() {
    if (!isOnline() || syncing.value) return
    syncing.value = true
    try {
      const config = getCloudConfig()!
      const fam = await familyApi.get(config.familyId)
      familyInfo.value = { name: fam.name, createdAt: fam.createdAt }
      members.value = fam.members as FamilyMember[]

      // 检测当前用户是否已被管理员删除
      const myId = config.memberId
      if (!members.value.find(m => m.id === myId)) {
        uni.showToast({ title: '你已被移出家庭', icon: 'none' })
        resetFamily()
        uni.reLaunch({ url: '/pages/family/setup' })
        return
      }
      currentUserId.value = myId
      save('family_info', familyInfo.value)
      save('family_members', members.value)
      save('current_user', currentUserId.value)

      // 获取食谱
      const recipesData = await recipeApi.list()
      recipes.value = recipesData as Recipe[]
      save('family_recipes', recipes.value)

      // 获取购物车
      const cartData = await cartApi.get()
      cart.value = (cartData || []).map((c: any) => ({
        recipeId: c.recipeId,
        recipeName: c.recipeName,
        recipeCategory: c.recipeCategory,
        cookName: c.cookName,
        quantity: c.quantity || 1,
      })) as CartItem[]
      save('family_cart', cart.value)

      // 获取订单
      const ordersData = await orderApi.list()
      orders.value = ordersData as Order[]
      save('family_orders', orders.value)

    } catch (e: any) {
      console.warn('云端同步失败，使用本地缓存:', e?.message)
      // 如果服务器返回 404（家庭被删了），重置
      if (e?.message?.includes('404') || e?.message?.includes('家庭不存在')) {
        resetFamily()
      }
    } finally {
      syncing.value = false
    }
  }

  // ==================== 家庭管理 ====================

  /** 解散家庭（仅创建者） */
  async function dissolveFamily(): Promise<boolean> {
    if (currentUser.value?.role !== 'creator') {
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
    const result = await familyApi.create(familyName, creatorName)
    saveCloudConfig({
      serverUrl: getCloudConfig()?.serverUrl || 'https://family-meal-menu.onrender.com',
      familyId: result.familyId,
      familyName: result.familyName,
      memberName: result.name,
      memberId: result.memberId,
    })
    cloudMode.value = true
    familyInfo.value = { name: result.familyName, createdAt: new Date().toISOString() }
    members.value = [{ id: result.memberId, name: result.name, avatar: '👨', role: 'creator' }]
    currentUserId.value = result.memberId
    save('family_info', familyInfo.value)
    save('family_members', members.value)
    save('current_user', currentUserId.value)
    return { inviteCode: result.inviteCode }
  }

  async function joinFamily(inviteCode: string, name: string): Promise<boolean> {
    const result = await familyApi.join(inviteCode, name)

    // 第二步：保存配置
    saveCloudConfig({
      serverUrl: getCloudConfig()?.serverUrl || 'https://family-meal-menu.onrender.com',
      familyId: result.familyId,
      familyName: result.familyName,
      memberName: result.name,
      memberId: result.memberId,
    })
    cloudMode.value = true

    // 写入本地缓存
    familyInfo.value = { name: result.familyName, createdAt: new Date().toISOString() }
    currentUserId.value = result.memberId
    save('family_info', familyInfo.value)
    save('current_user', currentUserId.value)

    // 如果服务器返回了成员列表，直接使用（不同步请求）
    if (result.members && result.members.length > 0) {
      members.value = result.members as FamilyMember[]
    } else {
      // 兜底：只添加当前成员
      members.value = [{ id: result.memberId, name: result.name, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], role: 'member' }]
    }
    save('family_members', members.value)

    // 尝试从云端拉食谱等数据（静默失败）
    try {
      await syncFromCloud()
    } catch { /* 静默 */ }
    return true
  }

  async function generateInviteCode(): Promise<string> {
    if (cloudMode.value) {
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

  // ==================== 本地成员管理 ====================

  function addMemberLocal(name: string, role: MemberRole = 'member'): FamilyMember {
    const m: FamilyMember = {
      id: 'm_' + Date.now(),
      name,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      role,
    }
    members.value.push(m)
    save('family_members', members.value)
    return m
  }

  function addMember(name: string, role: MemberRole = 'member'): FamilyMember {
    const m = addMemberLocal(name, role)
    if (cloudMode.value) {
      memberApi.update(m.id, { name }).catch(() => {})
    }
    return m
  }

  function switchUser(id: string) {
    currentUserId.value = id
    save('current_user', id)
  }

  function setMemberRole(id: string, role: MemberRole) {
    const m = members.value.find(x => x.id === id)
    if (!m) return
    m.role = role
    save('family_members', members.value)
    if (cloudMode.value) {
      memberApi.setRole(id, role).catch(() => {})
    }
  }

  function updateMember(id: string, data: { name?: string; avatar?: string }) {
    const m = members.value.find(x => x.id === id)
    if (!m) return
    if (data.name) m.name = data.name
    if (data.avatar) m.avatar = data.avatar
    save('family_members', members.value)
    if (cloudMode.value) {
      memberApi.update(id, data).catch(() => {})
    }
  }

  function deleteMember(id: string) {
    members.value = members.value.filter(m => m.id !== id)
    save('family_members', members.value)
    if (id === currentUserId.value && members.value.length > 0) {
      currentUserId.value = members.value[0].id
      save('current_user', currentUserId.value)
    }
    if (cloudMode.value) {
      memberApi.remove(id).catch(() => {})
    }
  }

  function leaveFamily(): boolean {
    if (currentUser.value?.role === 'creator') return false
    deleteMember(currentUserId.value)
    if (cloudMode.value) {
      clearCloudConfig()
      cloudMode.value = false
    }
    resetFamily()
    return true
  }

  // ==================== 邀请码 ====================

  const inviteCode = ref<string>(load('invite_code', ''))
  const inviteExpiry = ref<number>(load('invite_expiry', 0))

  // ==================== 食谱 ====================

  const recipes = ref<Recipe[]>(isInitialized.value ? load('family_recipes', []) : [])

  async function addRecipe(input: RecipeInput): Promise<string> {
    const now = new Date().toISOString()
    const localId = 'r_' + Date.now()

    if (cloudMode.value) {
      // 先同步到服务器，获得真实ID
      try {
        const result = await recipeApi.create(input)
        const recipe: Recipe = {
          ...input,
          id: result.id,
          orderCount: 0,
          createdAt: now,
          updatedAt: now,
        }
        recipes.value.unshift(recipe)
        save('family_recipes', recipes.value)
        return result.id
      } catch {
        uni.showToast({ title: '创建食谱失败，请检查网络', icon: 'none' })
        throw new Error('创建食谱失败')
      }
    }

    // 离线模式（理论上不会执行到，保留兜底）
    const recipe: Recipe = {
      ...input,
      id: localId,
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    recipes.value.unshift(recipe)
    save('family_recipes', recipes.value)
    return localId
  }

  async function updateRecipe(id: string, data: Partial<RecipeInput>): Promise<boolean> {
    if (cloudMode.value) {
      try {
        await recipeApi.update(id, data)
      } catch {
        uni.showToast({ title: '更新食谱失败', icon: 'none' })
        return false
      }
    }
    const i = recipes.value.findIndex(r => r.id === id)
    if (i === -1) return false
    recipes.value[i] = { ...recipes.value[i], ...data, id, updatedAt: new Date().toISOString() }
    save('family_recipes', recipes.value)
    return true
  }

  async function deleteRecipe(id: string) {
    if (cloudMode.value) {
      try {
        await recipeApi.delete(id)
      } catch {
        uni.showToast({ title: '删除食谱失败', icon: 'none' })
        return
      }
    }
    recipes.value = recipes.value.filter(r => r.id !== id)
    save('family_recipes', recipes.value)
  }

  function getRecipeById(id: string): Recipe | undefined {
    return recipes.value.find(r => r.id === id)
  }

  // ==================== 购物车（支持数量） ====================

  const cart = ref<CartItem[]>(load('family_cart', [] as CartItem[]))
  const cartCount = computed(() => cart.value.reduce((sum, c) => sum + (c.quantity || 1), 0))

  /** 添加 / +1 */
  function addToCart(recipe: Recipe): boolean {
    const exist = cart.value.find(c => c.recipeId === recipe.id)
    if (exist) {
      exist.quantity = (exist.quantity || 1) + 1
      save('family_cart', cart.value)
      if (cloudMode.value) {
        cartApi.add(recipe.id, recipe.name, recipe.category, exist.cookName, exist.quantity).catch(() => {})
      }
      return true
    }
    cart.value.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeCategory: recipe.category,
      cookName: currentUser.value?.name || '未知',
      quantity: 1,
    })
    save('family_cart', cart.value)
    if (cloudMode.value) {
      cartApi.add(recipe.id, recipe.name, recipe.category, currentUser.value?.name || '未知').catch(() => {})
    }
    return true
  }

  /** -1 或移除 */
  function removeFromCart(idxOrRecipeId: number | string) {
    if (typeof idxOrRecipeId === 'number') {
      // 按索引移除（购物车页用）
      cart.value.splice(idxOrRecipeId, 1)
    } else {
      // 按 recipeId 减一（点餐页用）
      const exist = cart.value.find(c => c.recipeId === idxOrRecipeId)
      if (!exist) return
      if ((exist.quantity || 1) > 1) {
        exist.quantity -= 1
      } else {
        cart.value = cart.value.filter(c => c.recipeId !== idxOrRecipeId)
      }
    }
    save('family_cart', cart.value)
  }

  /** 获取某食谱的购物车数量 */
  function getCartQuantity(recipeId: string): number {
    const item = cart.value.find(c => c.recipeId === recipeId)
    return item ? (item.quantity || 1) : 0
  }

  function generateCart() {
    cart.value = []
    const all = [...recipes.value].sort(() => Math.random() - 0.5)
    const count = Math.min(4, all.length)
    for (let i = 0; i < count; i++) {
      cart.value.push({
        recipeId: all[i].id,
        recipeName: all[i].name,
        recipeCategory: all[i].category,
        cookName: currentUser.value?.name || '未知',
        quantity: 1,
      })
    }
    save('family_cart', cart.value)
    if (cloudMode.value) {
      cartApi.generate().catch(() => {})
    }
  }

  function clearCart() {
    cart.value = []
    save('family_cart', cart.value)
    if (cloudMode.value) {
      cartApi.clear().catch(() => {})
    }
  }

  // ==================== 订单 ====================

  const orders = ref<Order[]>(load('family_orders', [] as Order[]))

  function placeOrder(items: Array<{ recipeId: string; recipeName: string; recipeCategory: string }>) {
    const user = currentUser.value
    const order: Order = {
      id: 'ord_' + Date.now(),
      items: [...items],
      memberId: user?.id || '',
      memberName: user?.name || '未知',
      createdAt: new Date().toISOString(),
    }
    orders.value.unshift(order)
    items.forEach(item => {
      const recipe = recipes.value.find(r => r.id === item.recipeId)
      if (recipe) recipe.orderCount = (recipe.orderCount || 0) + 1
    })
    save('family_orders', orders.value)
    save('family_recipes', recipes.value)
    if (cloudMode.value) {
      orderApi.place(items, user?.id || '', user?.name || '').catch(() => {})
    }
    return order
  }

  return {
    cloudMode, syncing, isInitialized,
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
