<script setup lang="ts">
import { useMealStore } from '@/store/meal'
import { RecipeCategoryIcons } from '@/api/types'

const store = useMealStore()

function removeItem(idx: number) {
  store.removeFromCart(idx)
}

function generate() {
  store.generateCart()
  uni.showToast({ title: `已生成${store.cart.length}道菜`, icon: 'success' })
}

function placeOrder() {
  if (store.cart.length === 0) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  // 展开数量：每个 item 按 quantity 展开为多个 entry
  const expanded: Array<{ recipeId: string; recipeName: string; recipeCategory: string; recipeImage?: string }> = []
  for (const c of store.cart) {
    const qty = c.quantity || 1
    const recipe = store.getRecipeById(c.recipeId)
    const recipeImage = recipe?.coverImage || ''
    for (let i = 0; i < qty; i++) {
      expanded.push({ recipeId: c.recipeId, recipeName: c.recipeName, recipeCategory: c.recipeCategory, recipeImage })
    }
  }

  uni.showModal({
    title: '确认下单',
    content: `确定提交购物车中${store.cartCount}道菜吗？`,
    success: (res) => {
      if (!res.confirm) return
      const order = store.placeOrder(expanded)
      store.clearCart()
      const t = new Date(order.createdAt)
      uni.showToast({ title: `下单成功！${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`, icon: 'success', duration: 2000 })
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="section">
      <view class="sec-head">
        <text class="sec-title">🛒 购物车</text>
        <text class="sec-badge" v-if="store.cart.length">{{ store.cartCount }}道</text>
      </view>

      <view v-if="store.cart.length === 0" class="cart-empty">
        <text class="empty-icon">🛒</text>
        <text>购物车为空，返回点餐页添加</text>
      </view>

      <view v-for="(item, idx) in store.cart" :key="item.recipeId" class="cart-item">
        <text class="ci-emoji">{{ RecipeCategoryIcons[item.recipeCategory] }}</text>
        <view class="ci-info">
          <text class="ci-name">{{ item.recipeName }}</text>
          <text class="ci-cook">👨‍🍳{{ item.cookName }} · {{ '✕' + (item.quantity || 1) }}</text>
        </view>
        <text class="ci-del" @click="removeItem(idx)">✕</text>
      </view>
    </view>

    <view class="actions">
      <view class="act-btn btn-gen" @click="generate">
        <text class="act-icon">🎲</text><text>随机生成</text>
      </view>
      <view class="act-btn btn-order" @click="placeOrder">
        <text class="act-icon">📋</text><text>下单 ({{ store.cartCount }})</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--color-bg); padding-bottom: 40rpx; }
.section { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 20rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.03); }
.sec-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.sec-title { font-size: 30rpx; font-weight: 700; }
.sec-badge { font-size: 22rpx; background: var(--color-primary); color: #fff; padding: 2rpx 14rpx; border-radius: 14rpx; }
.cart-empty { text-align: center; padding: 60rpx 0; font-size: 26rpx; color: #CCC; .empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; } }
.cart-item { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #F5F0EB; &:last-child { border-bottom: none; } }
.ci-emoji { font-size: 38rpx; margin-right: 16rpx; flex-shrink: 0; }
.ci-info { flex: 1; .ci-name { font-size: 28rpx; font-weight: 600; display: block; } .ci-cook { font-size: 22rpx; color: var(--color-primary-light); margin-top: 4rpx; } }
.ci-del { width: 44rpx; height: 44rpx; background: #FEE; color: var(--color-danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22rpx; flex-shrink: 0; }
.actions { display: flex; gap: 16rpx; margin: 0 20rpx; }
.act-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 22rpx 0; border-radius: 16rpx; font-size: 28rpx; font-weight: 700; color: #fff; }
.btn-gen { background: linear-gradient(135deg, #FF9A76, var(--color-primary)); }
.btn-order { background: linear-gradient(135deg, #5B9BD5, #3B7DC4); }
.act-icon { font-size: 32rpx; }
</style>
