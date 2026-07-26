<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useMealStore } from '@/store/meal'
import { RecipeCategoryLabels, RecipeCategoryIcons } from '@/api/types'
import type { Recipe } from '@/api/types'

const store = useMealStore()
const recipe = ref<Recipe | null>(null)
const recipeId = ref('')

onLoad((opts: any) => { recipeId.value = opts?.id || ''; recipe.value = store.getRecipeById(recipeId.value) || null })

const diffLabel = computed(() => recipe.value ? ['简单','中等','困难'][recipe.value.difficulty - 1] : '')

function goEdit() { uni.navigateTo({ url: `/pages/recipe/recipe-edit?id=${recipeId.value}` }) }
async function del() {
  uni.showModal({
    title: '确认删除',
    content: `确定删除「${recipe.value?.name}」？`,
    success: async (r) => {
      if (!r.confirm) return
      uni.showLoading({ title: '删除中...' })
      await store.deleteRecipe(recipeId.value)
      uni.hideLoading()
      uni.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 800)
    },
  })
}
</script>

<template>
  <view class="page" v-if="recipe">
    <view class="header">
      <!-- 封面图占位 -->
      <view class="h-cover">
        <image v-if="recipe.coverImage" :src="recipe.coverImage" class="h-cover-img" mode="aspectFill" />
        <text v-else class="h-cover-emoji">{{ RecipeCategoryIcons[recipe.category] }}</text>
      </view>
      <text class="h-name">{{ recipe.name }}</text>
      <view class="h-meta">
        <text>{{ RecipeCategoryLabels[recipe.category] }} | ⏱{{ recipe.cookingTime }}分钟 | {{ diffLabel }} | {{ recipe.servings }}人份 | 🔥{{ recipe.orderCount || 0 }}次</text>
      </view>
      <view class="h-tags"><text v-for="t in recipe.tags" :key="t" class="tag">{{ t }}</text></view>
      <view class="h-actions">
        <text class="act" @click="goEdit">✏️ 编辑</text>
        <text class="act act-del" @click="del">🗑 删除</text>
      </view>
    </view>
    <view class="section">
      <text class="s-title">📊 营养（每份）</text>
      <view class="nutri"><view class="n-item"><text class="n-val">{{ recipe.nutritions.calories }}</text><text class="n-label">卡路里</text></view><view class="n-item"><text class="n-val">{{ recipe.nutritions.protein }}g</text><text class="n-label">蛋白质</text></view><view class="n-item"><text class="n-val">{{ recipe.nutritions.fat }}g</text><text class="n-label">脂肪</text></view><view class="n-item"><text class="n-val">{{ recipe.nutritions.carbs }}g</text><text class="n-label">碳水</text></view></view>
    </view>
    <view class="section">
      <text class="s-title">🥬 食材</text>
      <view v-for="ing in recipe.ingredients" :key="ing.name" class="ing">
        <view class="ing-cat" :class="'ing-'+ing.category">{{ ['main','sub','seasoning'].indexOf(ing.category)===0?'主':ing.category==='sub'?'辅':'调' }}</view>
        <text class="ing-name">{{ ing.name }}</text><text class="ing-amt">{{ ing.amount }}{{ ing.unit }}</text>
      </view>
    </view>
    <view class="section">
      <text class="s-title">👨‍🍳 步骤</text>
      <view v-for="(s,idx) in recipe.steps" :key="idx" class="step">
        <view class="step-num">{{ idx+1 }}</view>
        <view class="step-body">
          <text class="step-text">{{ s.text }}</text>
          <image v-if="s.image" :src="s.image" class="step-img" mode="widthFix" @click="uni.previewImage({urls:[s.image]})" />
        </view>
      </view>
    </view>
    <view style="height:60rpx" />
  </view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; }
.header { background: linear-gradient(135deg,#FF9A76,#FF7A5C); padding: 30rpx 30rpx; color: #fff; text-align: center; }
.h-cover { width: 160rpx; height: 160rpx; border-radius: 20rpx; margin: 0 auto 14rpx; overflow: hidden; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }
.h-cover-img { width: 100%; height: 100%; }
.h-cover-emoji { font-size: 60rpx; }
.h-name { font-size: 38rpx; font-weight: 700; }
.h-meta { margin-top: 12rpx; font-size: 24rpx; opacity: 0.9; }
.h-tags { display: flex; justify-content: center; gap: 10rpx; margin-top: 14rpx; }
.tag { font-size: 22rpx; background: rgba(255,255,255,0.3); padding: 4rpx 14rpx; border-radius: 14rpx; }
.h-actions { display: flex; justify-content: center; gap: 24rpx; margin-top: 18rpx; padding-top: 14rpx; border-top: 1rpx solid rgba(255,255,255,0.25); }
.act { font-size: 24rpx; background: rgba(255,255,255,0.2); padding: 8rpx 22rpx; border-radius: 18rpx; }
.act-del { background: rgba(255,80,80,0.35); }
.section { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 22rpx; }
.s-title { font-size: 28rpx; font-weight: 700; margin-bottom: 16rpx; display: block; }
.nutri { display: flex; justify-content: space-around; }
.n-item { display: flex; flex-direction: column; align-items: center; .n-val{font-size:32rpx;font-weight:700;color:var(--color-primary)} .n-label{font-size:20rpx;color:var(--color-text-secondary);margin-top:2rpx} }
.ing { display: flex; align-items: center; padding: 12rpx 0; border-bottom: 1rpx solid #F5F0EB; &:last-child{border-bottom:none} }
.ing-cat { width: 36rpx; height: 36rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18rpx; color: #fff; margin-right: 14rpx; flex-shrink: 0; }
.ing-main { background: var(--color-primary); } .ing-sub { background: var(--color-primary-light); } .ing-seasoning { background: #F0C040; }
.ing-name { flex: 1; font-size: 26rpx; } .ing-amt { font-size: 24rpx; color: var(--color-text-secondary); }
.step { display: flex; align-items: flex-start; margin-bottom: 18rpx; }
.step-num { width: 40rpx; height: 40rpx; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22rpx; font-weight: 600; margin-right: 14rpx; flex-shrink: 0; }
.step-body { flex: 1; }
.step-text { font-size: 26rpx; line-height: 1.7; }
.step-img { display: block; width: 100%; border-radius: 10rpx; margin-top: 12rpx; }
</style>
