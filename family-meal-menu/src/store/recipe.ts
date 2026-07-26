import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, save } from '@/utils/storage'
import { isOnline, recipeApi } from '@/api/client'
import type { Recipe, RecipeCategory, Ingredient, Nutrition, StepItem } from '@/api/types'

// ==================== 类型 ====================

export interface RecipeInput {
  name: string
  category: RecipeCategory
  coverImage: string
  cookingTime: number
  difficulty: 1 | 2 | 3
  servings: number
  tags: string[]
  nutritions: Nutrition
  ingredients: Ingredient[]
  steps: StepItem[]
}

// ==================== Store ====================

const STORAGE_KEY = 'family_recipes'

export const useRecipeStore = defineStore('recipe', () => {
  // ==================== 状态 ====================
  const items = ref<Recipe[]>(load(STORAGE_KEY, [] as Recipe[]))

  // ==================== 持久化 ====================
  function persist() {
    save(STORAGE_KEY, items.value)
  }

  // ==================== 操作 ====================

  /** 创建食谱，返回服务端 ID */
  async function add(input: RecipeInput): Promise<string> {
    const now = new Date().toISOString()

    if (isOnline()) {
      try {
        const result = await recipeApi.create(input)
        const recipe: Recipe = {
          ...input,
          id: result.id,
          orderCount: 0,
          createdAt: now,
          updatedAt: now,
        }
        items.value.unshift(recipe)
        persist()
        return result.id
      } catch {
        uni.showToast({ title: '创建食谱失败，请检查网络', icon: 'none' })
        throw new Error('创建食谱失败')
      }
    }

    // 离线模式兜底
    const recipe: Recipe = {
      ...input,
      id: 'r_' + Date.now(),
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    items.value.unshift(recipe)
    persist()
    return recipe.id
  }

  /** 更新食谱 */
  async function update(id: string, data: Partial<RecipeInput>): Promise<boolean> {
    if (isOnline()) {
      try {
        await recipeApi.update(id, data)
      } catch {
        uni.showToast({ title: '更新食谱失败', icon: 'none' })
        return false
      }
    }
    const i = items.value.findIndex(r => r.id === id)
    if (i === -1) return false
    items.value[i] = { ...items.value[i], ...data, id, updatedAt: new Date().toISOString() }
    persist()
    return true
  }

  /** 删除食谱 */
  async function remove(id: string): Promise<void> {
    if (isOnline()) {
      try {
        await recipeApi.delete(id)
      } catch {
        uni.showToast({ title: '删除食谱失败', icon: 'none' })
        return
      }
    }
    items.value = items.value.filter(r => r.id !== id)
    persist()
  }

  /** 按 ID 查找 */
  function getById(id: string): Recipe | undefined {
    return items.value.find(r => r.id === id)
  }

  /** 增加点单次数（跨域：由 placeOrder 调用） */
  function incrementOrderCount(recipeId: string): void {
    const recipe = items.value.find(r => r.id === recipeId)
    if (recipe) {
      recipe.orderCount = (recipe.orderCount || 0) + 1
      persist()
    }
  }

  /** 从服务端数据加载（syncFromCloud 调用） */
  function loadFromServer(data: any[]): void {
    items.value = data as Recipe[]
    persist()
  }

  /** 仅清空本地（退出/解散家庭时用，不同步） */
  function reset(): void {
    items.value = []
    persist()
  }

  return {
    items,
    add,
    update,
    remove,
    getById,
    incrementOrderCount,
    loadFromServer,
    reset,
  }
})
