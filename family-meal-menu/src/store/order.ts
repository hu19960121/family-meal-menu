import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, save } from '@/utils/storage'
import { hasCloudConfig, orderApi } from '@/api/client'
import type { Order } from '@/api/types'

const STORAGE_KEY = 'family_orders'

export const useOrderStore = defineStore('order', () => {
  // ==================== 状态 ====================
  const items = ref<Order[]>(load(STORAGE_KEY, [] as Order[]))

  // ==================== 持久化 ====================
  function persist() {
    save(STORAGE_KEY, items.value)
  }

  // ==================== 操作 ====================

  /** 下单 */
  function place(
    orderItems: Array<{ recipeId: string; recipeName: string; recipeCategory: string; recipeImage?: string }>,
    memberId: string,
    memberName: string,
  ): Order {
    const order: Order = {
      id: 'ord_' + Date.now(),
      items: [...orderItems],
      memberId: memberId || '',
      memberName: memberName || '未知',
      createdAt: new Date().toISOString(),
    }
    items.value.unshift(order)
    persist()
    if (hasCloudConfig()) {
      orderApi.place(orderItems, memberId || '', memberName || '').catch(() => {
        uni.showToast({ title: '同步失败', icon: 'none', duration: 1500 })
      })
    }
    return order
  }

  /** 从服务端数据加载（syncFromCloud 调用） */
  function loadFromServer(data: any[]): void {
    items.value = data as Order[]
    persist()
  }

  /** 仅清空本地（退出/解散家庭时用，不同步） */
  function reset(): void {
    items.value = []
    persist()
  }

  return { items, place, loadFromServer, reset }
})
