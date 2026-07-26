import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { load, save } from '@/utils/storage'
import { hasCloudConfig, cartApi } from '@/api/client'
import type { CartItem, Recipe } from '@/api/types'

const STORAGE_KEY = 'family_cart'

export const useCartStore = defineStore('cart', () => {
  // ==================== 状态 ====================
  const items = ref<CartItem[]>(load(STORAGE_KEY, [] as CartItem[]))
  const count = computed(() => items.value.reduce((sum, c) => sum + (c.quantity || 1), 0))

  // ==================== 持久化 ====================
  function persist() {
    save(STORAGE_KEY, items.value)
  }

  // ==================== 操作 ====================

  /** 添加 / +1，cookName 由调用方传入。乐观更新：先写本地，异步获取服务端 ID */
  async function add(recipe: Recipe, cookName: string): Promise<boolean> {
    const exist = items.value.find(c => c.recipeId === recipe.id)
    if (exist) {
      exist.quantity = (exist.quantity || 1) + 1
      persist()
      if (hasCloudConfig()) {
        cartApi.add(recipe.id, recipe.name, recipe.category, exist.cookName, exist.quantity).catch(() => {
          uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
        })
      }
      return true
    }

    // 乐观更新：先推入本地，UI 立即响应
    const newItem: CartItem = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeCategory: recipe.category,
      cookName: cookName || '未知',
      quantity: 1,
    }
    items.value.push(newItem)
    persist()

    // 异步获取服务端 ID，不阻塞 UI
    if (hasCloudConfig()) {
      cartApi.add(recipe.id, recipe.name, recipe.category, cookName || '未知')
        .then((result: any) => {
          if (result?.id) newItem.id = result.id
        })
        .catch(() => {
          uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
        })
    }

    return true
  }

  /** 按索引移除（购物车页用） */
  function removeByIndex(idx: number): void {
    const removed = items.value.splice(idx, 1)[0]
    persist()
    // 同步删除到服务器
    if (hasCloudConfig() && removed?.id != null) {
      cartApi.remove(removed.id).catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  /** 按 recipeId 减一（点餐页用） */
  function decreaseQuantity(recipeId: string): void {
    const exist = items.value.find(c => c.recipeId === recipeId)
    if (!exist) return
    if ((exist.quantity || 1) > 1) {
      exist.quantity -= 1
      persist()
      return
    }
    // 数量归零 → 移除
    items.value = items.value.filter(c => c.recipeId !== recipeId)
    persist()
    if (hasCloudConfig() && exist.id != null) {
      cartApi.remove(exist.id).catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  /** 获取某食谱的购物车数量 */
  function getQuantity(recipeId: string): number {
    const item = items.value.find(c => c.recipeId === recipeId)
    return item ? (item.quantity || 1) : 0
  }

  /** 随机生成购物车 */
  function generate(recipes: Recipe[], cookName: string): void {
    items.value = []
    const all = [...recipes].sort(() => Math.random() - 0.5)
    const count = Math.min(4, all.length)
    for (let i = 0; i < count; i++) {
      items.value.push({
        recipeId: all[i].id,
        recipeName: all[i].name,
        recipeCategory: all[i].category,
        cookName: cookName || '未知',
        quantity: 1,
      })
    }
    persist()
    if (hasCloudConfig()) {
      cartApi.generate().catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  /** 清空购物车（正常用户操作，会同步云端） */
  function clear(): void {
    items.value = []
    persist()
    if (hasCloudConfig()) {
      cartApi.clear().catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
  }

  /** 仅清空本地（退出/解散家庭时用，不同步） */
  function reset(): void {
    items.value = []
    persist()
  }

  /** 从服务端数据加载（syncFromCloud 调用） */
  function loadFromServer(data: any[]): void {
    items.value = (data || []).map((c: any) => ({
      id: c.id,
      recipeId: c.recipeId,
      recipeName: c.recipeName,
      recipeCategory: c.recipeCategory,
      cookName: c.cookName,
      quantity: c.quantity || 1,
    })) as CartItem[]
    persist()
  }

  return {
    items,
    count,
    add,
    removeByIndex,
    decreaseQuantity,
    getQuantity,
    generate,
    clear,
    reset,
    loadFromServer,
  }
})
