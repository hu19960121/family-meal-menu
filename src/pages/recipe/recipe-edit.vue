<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useMealStore, type RecipeInput } from '@/store/meal'
import { RecipeCategoryLabels, RecipeCategoryIcons } from '@/api/types'
import { uploadImage } from '@/api/client'
import type { RecipeCategory, Ingredient } from '@/api/types'

const store = useMealStore()
const editId = ref('')
const isEdit = computed(() => !!editId.value)

const form = reactive({
  name: '',
  category: 'meat' as RecipeCategory,
  coverImage: '',
  cookingTime: 30,
  difficulty: 1 as 1 | 2 | 3,
  servings: 3,
  tags: [] as string[],
})
const ingredients = reactive<Ingredient[]>([{ name: '', amount: '', unit: '', category: 'main' }])
const steps = reactive<{ text: string; image: string }[]>([{ text: '', image: '' }])
const nutritions = reactive({ calories: 0, protein: 0, fat: 0, carbs: 0 })

const categories = Object.entries(RecipeCategoryLabels).map(([k, v]) => ({
  key: k as RecipeCategory,
  label: v,
  icon: RecipeCategoryIcons[k as RecipeCategory],
}))

async function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (r) => {
      uni.showLoading({ title: '上传中...' })
      try {
        form.coverImage = await uploadImage(r.tempFilePaths[0])
      } catch (e: any) {
        uni.showToast({ title: e.message || '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
}
async function chooseStepImg(idx: number) {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (r) => {
      uni.showLoading({ title: '上传中...' })
      try {
        steps[idx].image = await uploadImage(r.tempFilePaths[0])
      } catch (e: any) {
        uni.showToast({ title: e.message || '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function addIng() { ingredients.push({ name: '', amount: '', unit: '', category: 'main' }) }
function delIng(i: number) { if (ingredients.length > 1) ingredients.splice(i, 1) }
function addStep() { steps.push({ text: '', image: '' }) }
function delStep(i: number) { if (steps.length > 1) steps.splice(i, 1) }

const tagInput = ref('')
function addTag() {
  const t = tagInput.value.trim()
  if (t && !form.tags.includes(t)) { form.tags.push(t); tagInput.value = '' }
}
function delTag(i: number) { form.tags.splice(i, 1) }

function validate(): boolean {
  if (!form.name.trim()) { uni.showToast({ title: '请输入名称', icon: 'none' }); return false }
  if (!ingredients.some(i => i.name.trim())) { uni.showToast({ title: '至少一个食材', icon: 'none' }); return false }
  if (!steps.some(s => s.text.trim())) { uni.showToast({ title: '至少一个步骤', icon: 'none' }); return false }
  return true
}

async function save() {
  if (!validate()) return

  const data: RecipeInput = {
    name: form.name.trim(),
    category: form.category,
    coverImage: form.coverImage,
    cookingTime: form.cookingTime,
    difficulty: form.difficulty,
    servings: form.servings,
    tags: form.tags,
    nutritions: { ...nutritions },
    ingredients: ingredients.filter(i => i.name.trim()).map(i => ({
      name: i.name.trim(),
      amount: i.amount.trim() || '适量',
      unit: i.unit.trim(),
      category: i.category,
    })),
    steps: steps.filter(s => s.text.trim()).map(s => ({
      text: s.text.trim(),
      image: s.image || '',
    })),
  }

  uni.showLoading({ title: '保存中...' })
  try {
    if (isEdit.value) {
      await store.updateRecipe(editId.value, data)
      uni.showToast({ title: '已更新', icon: 'success' })
    } else {
      await store.addRecipe(data)
      uni.showToast({ title: '已创建', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 800)
  } catch {
    // 错误已由 store 中处理
  } finally {
    uni.hideLoading()
  }
}

onLoad((opts: any) => {
  if (!store.canEditRecipes) {
    uni.showToast({ title: '仅管理员可编辑', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1000)
    return
  }
  if (opts?.id) {
    editId.value = opts.id
    const r = store.getRecipeById(opts.id)
    if (r) {
      Object.assign(form, {
        name: r.name,
        category: r.category,
        coverImage: r.coverImage,
        cookingTime: r.cookingTime,
        difficulty: r.difficulty,
        servings: r.servings,
        tags: [...r.tags],
      })
      ingredients.length = 0
      ingredients.push(...r.ingredients.map(i => ({ ...i })))
      if (!ingredients.length) ingredients.push({ name: '', amount: '', unit: '', category: 'main' })

      steps.length = 0
      steps.push(...r.steps.map(s => ({ text: s.text, image: s.image || '' })))
      if (!steps.length) steps.push({ text: '', image: '' })

      Object.assign(nutritions, r.nutritions)
    }
  }
})
</script>

<template>
  <view class="page">
    <view class="top-bar">
      <text class="t">{{ isEdit ? '编辑食谱' : '新建食谱' }}</text>
      <text class="save" @click="save">保存</text>
    </view>
    <scroll-view scroll-y class="body">
      <!-- 封面 -->
      <view class="sec">
        <text class="label">封面</text>
        <view class="cover" @click="chooseImage">
          <image v-if="form.coverImage" :src="form.coverImage" class="c-img" mode="aspectFill" />
          <view v-else class="c-empty">
            <text>📷</text>
            <text>点击上传</text>
          </view>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="sec">
        <text class="label">基本信息</text>
        <input v-model="form.name" class="inp" placeholder="食谱名称" />
        <view class="cats">
          <view v-for="c in categories" :key="c.key" class="c-opt" :class="{ on: form.category === c.key }" @click="form.category = c.key">
            {{ c.icon }} {{ c.label }}
          </view>
        </view>
        <view class="row">
          <view class="half">
            <text class="sub">时间</text>
            <view class="stepr">
              <text class="s-btn" @click="form.cookingTime = Math.max(1, form.cookingTime - 5)">−</text>
              <text>{{ form.cookingTime }}分</text>
              <text class="s-btn" @click="form.cookingTime += 5">+</text>
            </view>
          </view>
          <view class="half">
            <text class="sub">难度</text>
            <view class="stars">
              <text v-for="d in [1, 2, 3]" :key="d" class="star" :class="{ on: form.difficulty >= d }" @click="form.difficulty = d as any">⭐</text>
            </view>
          </view>
        </view>
        <view class="row">
          <view class="half">
            <text class="sub">份量</text>
            <view class="stepr">
              <text class="s-btn" @click="form.servings = Math.max(1, form.servings - 1)">−</text>
              <text>{{ form.servings }}人份</text>
              <text class="s-btn" @click="form.servings += 1">+</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 食材 -->
      <view class="sec">
        <view class="sh">
          <text class="label">食材</text>
          <text class="add" @click="addIng">+ 添加</text>
        </view>
        <view v-for="(ing, i) in ingredients" :key="i" class="ing-r">
          <input v-model="ing.name" class="inp-sm" placeholder="名称" />
          <input v-model="ing.amount" class="inp-xs" placeholder="量" />
          <input v-model="ing.unit" class="inp-xs" placeholder="单位" />
          <picker :value="['main', 'sub', 'seasoning'].indexOf(ing.category)" :range="['主料', '辅料', '调料']" @change="(e: any) => { ing.category = (['main', 'sub', 'seasoning'] as const)[e.detail.value] }">
            <text class="c-pick">{{ ing.category === 'main' ? '主' : ing.category === 'sub' ? '辅' : '调' }} ▼</text>
          </picker>
          <text class="del" @click="delIng(i)">🗑</text>
        </view>
      </view>

      <!-- 步骤 -->
      <view class="sec">
        <view class="sh">
          <text class="label">步骤</text>
          <text class="add" @click="addStep">+ 添加</text>
        </view>
        <view v-for="(s, i) in steps" :key="i" class="step-r">
          <view class="sn">{{ i + 1 }}</view>
          <view class="sb">
            <textarea v-model="s.text" class="ta" :placeholder="'第' + (i + 1) + '步...'" />
            <view class="s-img" v-if="s.image">
              <image :src="s.image" class="si" mode="aspectFill" />
              <text class="si-del" @click="s.image = ''">✕</text>
            </view>
            <view v-else class="s-add" @click="chooseStepImg(i)">
              <text>📷 添加图片</text>
            </view>
          </view>
          <text class="del" @click="delStep(i)">✕</text>
        </view>
      </view>

      <!-- 标签 -->
      <view class="sec">
        <text class="label">标签</text>
        <view class="tags">
          <view v-for="(t, i) in form.tags" :key="i" class="t-row">
            <text>{{ t }}</text>
            <text class="t-del" @click="delTag(i)">✕</text>
          </view>
        </view>
        <view class="t-inp">
          <input v-model="tagInput" class="inp" placeholder="输入标签回车" @confirm="addTag" />
          <text class="t-add" @click="addTag">添加</text>
        </view>
        <view class="sug">
          <text class="sug-label">常用：</text>
          <text v-for="t in ['家常', '快手', '下饭', '清淡', '经典', '健康']" :key="t" class="sug-t" @click="!form.tags.includes(t) && form.tags.push(t)">{{ t }}</text>
        </view>
      </view>

      <!-- 营养 -->
      <view class="sec">
        <text class="label">营养（每份）</text>
        <view class="n-grid">
          <view class="n-f"><text>卡路里</text><input v-model.number="nutritions.calories" type="number" class="inp" /></view>
          <view class="n-f"><text>蛋白质(g)</text><input v-model.number="nutritions.protein" type="number" class="inp" /></view>
          <view class="n-f"><text>脂肪(g)</text><input v-model.number="nutritions.fat" type="number" class="inp" /></view>
          <view class="n-f"><text>碳水(g)</text><input v-model.number="nutritions.carbs" type="number" class="inp" /></view>
        </view>
      </view>

      <view style="height: 80rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg); }
.top-bar { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 24rpx; background: #fff; border-bottom: 1rpx solid var(--color-border); .t{font-size:30rpx;font-weight:700} .save{font-size:26rpx;color:#fff;background:var(--color-primary);padding:8rpx 28rpx;border-radius:28rpx;font-weight:600} }
.body { flex: 1; padding: 12rpx 0; }
.sec { margin: 12rpx 16rpx; background: #fff; border-radius: 14rpx; padding: 20rpx; }
.label { font-size: 28rpx; font-weight: 600; display: block; margin-bottom: 14rpx; }
.sh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; .label{margin-bottom:0} }
.add { font-size: 24rpx; color: var(--color-primary); }
.cover { width: 180rpx; height: 180rpx; border-radius: 12rpx; overflow: hidden; }
.c-img { width: 100%; height: 100%; }
.c-empty { width: 100%; height: 100%; background: #F8F8F8; border: 2rpx dashed #DDD; border-radius: 12rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 22rpx; color: #AAA; }
.inp { width: 100%; height: 68rpx; background: #F8F8F8; border-radius: 10rpx; padding: 0 16rpx; font-size: 26rpx; box-sizing: border-box; margin-bottom: 14rpx; }
.inp-sm { width: 140rpx; height: 56rpx; background: #F8F8F8; border-radius: 8rpx; padding: 0 10rpx; font-size: 24rpx; }
.inp-xs { width: 80rpx; height: 56rpx; background: #F8F8F8; border-radius: 8rpx; padding: 0 8rpx; font-size: 24rpx; }
.cats { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 14rpx; }
.c-opt { padding: 10rpx 18rpx; background: #F8F8F8; border-radius: 20rpx; font-size: 24rpx; border: 2rpx solid transparent; }
.c-opt.on { background: #FFF0E8; border-color: var(--color-primary); color: var(--color-primary); }
.row { display: flex; gap: 16rpx; margin-bottom: 14rpx; }
.half { flex: 1; }
.sub { font-size: 22rpx; color: var(--color-text-secondary); margin-bottom: 6rpx; display: block; }
.stepr { display: flex; align-items: center; background: #F8F8F8; border-radius: 10rpx; overflow: hidden; .s-btn{width:50rpx;height:56rpx;display:flex;align-items:center;justify-content:center;font-size:28rpx;color:var(--color-primary)} text{flex:1;text-align:center;font-size:24rpx} }
.stars { display: flex; gap: 6rpx; padding: 10rpx 0; }
.star { font-size: 32rpx; opacity: 0.3; }
.star.on { opacity: 1; }
.ing-r { display: flex; align-items: center; gap: 6rpx; margin-bottom: 10rpx; }
.c-pick { font-size: 20rpx; color: var(--color-primary); white-space: nowrap; padding: 0 4rpx; }
.del { font-size: 26rpx; padding: 6rpx; }
.step-r { display: flex; align-items: flex-start; gap: 10rpx; margin-bottom: 14rpx; }
.sn { width: 38rpx; height: 38rpx; background: var(--color-primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22rpx; font-weight: 600; flex-shrink: 0; }
.sb { flex: 1; }
.ta { width: 100%; min-height: 56rpx; background: #F8F8F8; border-radius: 8rpx; padding: 10rpx 14rpx; font-size: 24rpx; box-sizing: border-box; }
.s-img { position: relative; width: 140rpx; height: 140rpx; margin-top: 8rpx; border-radius: 8rpx; overflow: hidden; display: inline-block; }
.si { width: 100%; height: 100%; }
.si-del { position: absolute; top: 4rpx; right: 4rpx; width: 32rpx; height: 32rpx; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18rpx; }
.s-add { display: inline-flex; align-items: center; gap: 6rpx; padding: 10rpx 18rpx; margin-top: 8rpx; background: #F8F8F8; border: 2rpx dashed #DDD; border-radius: 8rpx; font-size: 22rpx; color: #AAA; }
.tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 12rpx; }
.t-row { display: flex; align-items: center; background: #FFF0E8; padding: 5rpx 14rpx; border-radius: 14rpx; font-size: 24rpx; color: var(--color-primary); .t-del{font-size:18rpx;margin-left:6rpx;color:var(--color-primary-light)} }
.t-inp { display: flex; gap: 10rpx; margin-bottom: 10rpx; .inp{flex:1;margin-bottom:0} .t-add{font-size:24rpx;color:#fff;background:var(--color-primary);padding:0 20rpx;border-radius:10rpx;display:flex;align-items:center} }
.sug { display: flex; flex-wrap: wrap; align-items: center; gap: 6rpx; .sug-label{font-size:20rpx;color:#AAA} .sug-t{font-size:20rpx;background:#F0F0F0;padding:3rpx 12rpx;border-radius:10rpx;color:var(--color-text-secondary)} }
.n-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.n-f { flex: 1; min-width: 45%; text{font-size:20rpx;color:var(--color-text-secondary);margin-bottom:4rpx;display:block} .inp{margin-bottom:0} }
</style>
