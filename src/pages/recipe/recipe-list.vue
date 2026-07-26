<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMealStore } from '@/store/meal'
import { RecipeCategoryLabels, RecipeCategoryIcons } from '@/api/types'
import type { RecipeCategory } from '@/api/types'

const store = useMealStore()
const activeCategory = ref('all')
const searchKeyword = ref('')

const categories = [
  { key: 'all', label: '全部', icon: '📋' },
  ...Object.entries(RecipeCategoryLabels).map(([k, v]) => ({ key: k, label: v, icon: RecipeCategoryIcons[k as keyof typeof RecipeCategoryIcons] })),
]

const filtered = computed(() => {
  let list = store.recipes
  if (activeCategory.value !== 'all') list = list.filter(r => r.category === activeCategory.value)
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(r => r.name.includes(kw) || r.tags.some(t => t.includes(kw)))
  }
  return list
})

// 给每个食谱一个固定的渐变色（用 id 取模）
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

function goDetail(id: string) { uni.navigateTo({ url: `/pages/recipe/recipe-detail?id=${id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/recipe/recipe-edit' }) }
</script>

<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input v-model="searchKeyword" class="search-input" placeholder="搜食谱..." />
      <text class="search-icon">🔍</text>
    </view>

    <!-- 分类 -->
    <view class="cat-grid">
      <view v-for="c in categories" :key="c.key" class="cat-card" :class="{ 'cat-on': activeCategory === c.key }" @click="activeCategory = c.key">
        <text class="cat-icon">{{ c.icon }}</text>
        <text class="cat-label">{{ c.label }}</text>
      </view>
    </view>

    <!-- 食谱列表 -->
    <view class="list">
      <view v-for="r in filtered" :key="r.id" class="card" @click="goDetail(r.id)">
        <!-- 封面区：有图显示图，无图显示渐变+emoji占位 -->
        <view class="card-cover" :style="{ background: coverColor(r.id) }">
          <image v-if="r.coverImage" :src="r.coverImage" class="cover-img" mode="aspectFill" />
          <text v-else class="cover-placeholder">{{ RecipeCategoryIcons[r.category] }}</text>
        </view>
        <view class="card-body">
          <text class="card-name">{{ r.name }}</text>
          <text class="card-desc">⏱{{ r.cookingTime }}分 · {{ '⭐'.repeat(r.difficulty) }} · 🔥{{ r.orderCount || 0 }}</text>
          <view class="card-tags">
            <text v-for="t in r.tags.slice(0, 3)" :key="t" class="tag">{{ t }}</text>
          </view>
        </view>
        <text class="card-arrow">›</text>
      </view>

      <view v-if="filtered.length === 0" class="empty">
        <text class="empty-icon">📭</text>
        <text>{{ searchKeyword ? '没有匹配的食谱' : '暂无食谱' }}</text>
      </view>
    </view>

    <!-- 新建按钮 -->
    <view class="fab" v-if="store.canEditRecipes" @click="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--color-bg); padding-bottom: 40rpx; }

.search-bar { margin: 20rpx; position: relative; }
.search-input { width: 100%; height: 72rpx; background: #fff; border-radius: 36rpx; padding: 0 56rpx 0 28rpx; font-size: 26rpx; box-sizing: border-box; }
.search-icon { position: absolute; right: 22rpx; top: 50%; transform: translateY(-50%); font-size: 28rpx; }

.cat-grid { display: flex; flex-wrap: wrap; gap: 14rpx; padding: 0 20rpx 16rpx; }
.cat-card { display: flex; flex-direction: column; align-items: center; padding: 16rpx 18rpx; background: #fff; border-radius: 14rpx; min-width: 120rpx; flex: 1; .cat-icon{font-size:30rpx;margin-bottom:4rpx} .cat-label{font-size:22rpx;color:var(--color-text-secondary)} }
.cat-on { background: var(--color-primary); .cat-label{color:#fff} }

.list { padding: 0 20rpx; }
.card { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 14rpx 18rpx; margin-bottom: 14rpx; box-shadow: 0 1rpx 8rpx rgba(0,0,0,0.03); overflow: hidden; }
.card-cover { width: 100rpx; height: 100rpx; border-radius: 12rpx; flex-shrink: 0; margin-right: 16rpx; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.cover-img { width: 100%; height: 100%; }
.cover-placeholder { font-size: 44rpx; }
.card-body { flex: 1; min-width: 0; .card-name{font-size:28rpx;font-weight:600;margin-bottom:4rpx;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .card-desc{font-size:22rpx;color:var(--color-text-secondary);margin-bottom:6rpx} .card-tags{display:flex;gap:6rpx;overflow:hidden} .tag{font-size:20rpx;background:#FFF0E8;color:var(--color-primary);padding:2rpx 10rpx;border-radius:8rpx;flex-shrink:0} }
.card-arrow { font-size: 32rpx; color: #CCC; margin-left: 8rpx; flex-shrink: 0; }

.empty { text-align: center; padding: 80rpx 0; .empty-icon{font-size:64rpx;display:block;margin-bottom:12rpx} font-size:26rpx;color:#CCC }

.fab { position: fixed; bottom: 140rpx; right: 40rpx; width: 96rpx; height: 96rpx; background: linear-gradient(135deg,#FF9A76,var(--color-primary)); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(232,120,74,0.35); z-index: 100; .fab-icon{font-size:48rpx;color:#fff;font-weight:300} }
</style>
