<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMealStore } from '@/store/meal'
import { RecipeCategoryLabels, RecipeCategoryIcons } from '@/api/types'
import type { RecipeCategory } from '@/api/types'

const store = useMealStore()

const activeCategory = ref<RecipeCategory | 'all'>('all')
const searchKeyword = ref('')

const categories = [
  { key: 'all' as const, label: '全部', icon: '📋' },
  ...Object.entries(RecipeCategoryLabels).map(([key, label]) => ({
    key: key as RecipeCategory, label,
    icon: RecipeCategoryIcons[key as RecipeCategory],
  })),
]

const filteredRecipes = computed(() => {
  let list = activeCategory.value === 'all'
    ? [...store.recipes]
    : store.recipes.filter(r => r.category === activeCategory.value)

  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(r => r.name.includes(kw) || r.tags.some(t => t.includes(kw)))
  }

  list.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
  return list
})

// 固定渐变色
const COVER_COLORS = [
  'linear-gradient(135deg,#FF9A76,#E8784A)',
  'linear-gradient(135deg,#5B9BD5,#3B7DC4)',
  'linear-gradient(135deg,#6BBF6B,#4CAF50)',
  'linear-gradient(135deg,#F5A07A,#E8784A)',
  'linear-gradient(135deg,#B895E8,#9060D0)',
  'linear-gradient(135deg,#F0C040,#E8A020)',
]
function coverColor(id: string) {
  return COVER_COLORS[Math.abs(hashCode(id)) % COVER_COLORS.length]
}
function hashCode(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i)
  return h
}

// 购物车操作
function handleAdd(e: any, recipe: any) {
  e.stopPropagation()
  store.addToCart(recipe)
  uni.showToast({ title: `+1 ${recipe.name}`, icon: 'success', duration: 800 })
}

function handleRemove(e: any, recipe: any) {
  e.stopPropagation()
  store.removeFromCart(recipe.id)
}

// 查看详情
function goDetail(recipe: any) {
  uni.navigateTo({ url: `/pages/recipe/recipe-detail?id=${recipe.id}` })
}

// 新建食谱
function goCreate() {
  uni.navigateTo({ url: '/pages/recipe/recipe-edit' })
}

// 购物车
function goCart() {
  uni.navigateTo({ url: '/pages/cart/cart' })
}
</script>

<template>
  <view class="page">
    <!-- 左右布局 -->
    <view class="main-row">
      <!-- 左列：分类 -->
      <scroll-view class="cat-col" scroll-y :show-scrollbar="false">
        <view v-for="cat in categories" :key="cat.key"
          class="cat-tab" :class="{ 'cat-active': activeCategory === cat.key }"
          @click="activeCategory = cat.key">
          <text class="cat-icon">{{ cat.icon }}</text>
          <text class="cat-label">{{ cat.label }}</text>
        </view>
      </scroll-view>

      <!-- 右列：食谱卡片 -->
      <scroll-view class="recipe-col" scroll-y :show-scrollbar="false" @touchmove.stop>
        <!-- 搜索 -->
        <view class="search-box">
          <input v-model="searchKeyword" class="search-input" placeholder="搜食谱..." />
          <text class="search-icon">🔍</text>
        </view>

        <view v-for="r in filteredRecipes" :key="r.id" class="card" @click="goDetail(r)">
          <!-- 封面 -->
          <view class="card-cover" :style="{ background: coverColor(r.id) }">
            <image v-if="r.coverImage" :src="r.coverImage" class="cover-img" mode="aspectFill" />
            <text v-else class="cover-emoji">{{ RecipeCategoryIcons[r.category] }}</text>
          </view>

          <!-- 信息 -->
          <view class="card-body">
            <text class="card-name">{{ r.name }}</text>
            <text class="card-meta">⏱{{ r.cookingTime }}分 · 🔥{{ r.orderCount || 0 }}</text>
            <view class="card-tags">
              <text v-for="t in r.tags.slice(0, 2)" :key="t" class="tag">{{ t }}</text>
            </view>
          </view>

          <!-- 加减按钮 -->
          <view class="qty-wrap">
            <view v-if="store.getCartQuantity(r.id) > 0" class="qty-control">
              <text class="qty-btn qty-minus" @click="handleRemove($event, r)">−</text>
              <text class="qty-num">{{ store.getCartQuantity(r.id) }}</text>
            </view>
            <text class="qty-btn qty-plus" :class="{ 'in-cart': store.getCartQuantity(r.id) > 0 }"
              @click="handleAdd($event, r)">+</text>
          </view>
        </view>

        <view v-if="filteredRecipes.length === 0" class="empty">
          <text class="empty-icon">📭</text>
          <text>{{ searchKeyword ? '没有匹配的食谱' : '暂无食谱，点击右下角 ＋ 创建' }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 新建食谱（管理员可见） -->
    <view class="fab-add" v-if="store.canEditRecipes" @click="goCreate">
      <text class="fab-icon">+</text>
    </view>

    <!-- 购物车入口 -->
    <view class="fab-cart" @click="goCart">
      <text class="fab-icon">🛒</text>
      <view class="fab-badge" v-if="store.cartCount">{{ store.cartCount }}</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg); }

// ========== 左右布局 ==========
.main-row { flex: 1; display: flex; overflow: hidden; }

// 左列：分类
.cat-col {
  width: 150rpx; flex-shrink: 0; background: #FFFBF7;
  border-right: 1rpx solid var(--color-border); padding: 6rpx 0;
}
.cat-tab {
  display: flex; flex-direction: column; align-items: center;
  padding: 18rpx 8rpx; color: var(--color-text-secondary);
  .cat-icon { font-size: 30rpx; margin-bottom: 4rpx; }
  .cat-label { font-size: 20rpx; }
}
.cat-active {
  color: var(--color-primary); background: #FFF0E8;
  border-right: 4rpx solid var(--color-primary);
}

// 右列：卡片
.recipe-col { flex: 1; padding: 0 0 20rpx; }

// 搜索
.search-box {
  position: relative; margin: 14rpx 14rpx 10rpx;
}
.search-input {
  width: 100%; height: 64rpx; background: #fff; border-radius: 32rpx;
  padding: 0 48rpx 0 22rpx; font-size: 24rpx; box-sizing: border-box;
}
.search-icon { position: absolute; right: 18rpx; top: 50%; transform: translateY(-50%); font-size: 24rpx; }

// 食谱卡片
.card {
  display: flex; align-items: center; background: #fff; border-radius: 14rpx;
  margin: 6rpx 14rpx; padding: 12rpx; box-shadow: 0 1rpx 6rpx rgba(0,0,0,0.03);
  &:active { background: #FFF8F5; }
}

.card-cover {
  width: 80rpx; height: 80rpx; border-radius: 12rpx; flex-shrink: 0;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  margin-right: 12rpx;
}
.cover-img { width: 100%; height: 100%; }
.cover-emoji { font-size: 34rpx; }

.card-body { flex: 1; min-width: 0; }
.card-name { font-size: 26rpx; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-meta { font-size: 20rpx; color: var(--color-text-secondary); margin: 2rpx 0; display: block; }
.card-tags { display: flex; gap: 4rpx; overflow: hidden; }
.tag { font-size: 18rpx; background: #FFF0E8; color: var(--color-primary); padding: 1rpx 8rpx; border-radius: 6rpx; }

// 加减按钮
.qty-wrap { display: flex; align-items: center; margin-left: 8rpx; flex-shrink: 0; }
.qty-control { display: flex; align-items: center; gap: 4rpx; margin-right: 4rpx; }
.qty-btn {
  width: 40rpx; height: 40rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 26rpx; font-weight: 700;
}
.qty-plus { background: var(--color-primary); color: #fff; }
.qty-minus { background: #F5F5F5; color: var(--color-text); font-size: 28rpx; }
.qty-num { font-size: 24rpx; font-weight: 700; color: var(--color-primary); min-width: 24rpx; text-align: center; }
.in-cart { background: var(--color-success); }

// ========== 悬浮按钮 ==========
.fab-add, .fab-cart {
  position: fixed; width: 92rpx; height: 92rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba(232,120,74,0.35); z-index: 100;
  .fab-icon { font-size: 40rpx; }
}
.fab-add {
  bottom: 240rpx; right: 28rpx;
  background: linear-gradient(135deg, #5B9BD5, #3B7DC4);
}
.fab-cart {
  bottom: 130rpx; right: 28rpx;
  background: linear-gradient(135deg, #FF9A76, var(--color-primary));
}
.fab-badge {
  position: absolute; top: -2rpx; right: -2rpx;
  min-width: 32rpx; height: 32rpx; border-radius: 16rpx;
  background: var(--color-danger); color: #fff;
  font-size: 20rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 6rpx; border: 2rpx solid #fff;
}

// ========== 空状态 ==========
.empty { text-align: center; padding: 80rpx 0; font-size: 24rpx; color: #CCC; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.empty-icon { font-size: 56rpx; }
</style>
