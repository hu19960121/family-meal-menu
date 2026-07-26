<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMealStore } from '@/store/meal'
import { getCloudConfig, saveCloudConfig, clearCloudConfig } from '@/api/client'

const store = useMealStore()

// 如果已经初始化（有家庭数据），直接跳到主页面
onMounted(() => {
  if (store.isInitialized) {
    uni.switchTab({ url: '/pages/index/index' })
  }
})

const tab = ref<'create' | 'join'>('create')

// 服务端地址（从之前保存的配置中恢复）
const savedConfig = getCloudConfig()
const serverUrl = ref(savedConfig?.serverUrl || 'https://family-meal-menu.onrender.com')

// 创建家庭
const familyName = ref('')
const creatorName = ref('')
const creating = ref(false)

async function createFamily() {
  const fn = familyName.value.trim()
  const cn = creatorName.value.trim()
  if (!fn) { uni.showToast({ title: '请输入家庭名称', icon: 'none' }); return }
  if (!cn) { uni.showToast({ title: '请输入你的名字', icon: 'none' }); return }

  // 先保存服务端地址
  saveCloudConfig({
    serverUrl: serverUrl.value.replace(/\/+$/, ''),
    familyId: '',
    familyName: fn,
    memberName: cn,
    memberId: '',
  })

  creating.value = true
  try {
    const result = await store.createFamily(fn, cn)
    uni.showToast({ title: '家庭创建成功！', icon: 'success' })
    if (result.inviteCode) {
      uni.showModal({
        title: '邀请码',
        content: `邀请码：${result.inviteCode}\n（将此码发给家人加入）`,
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          uni.switchTab({ url: '/pages/index/index' })
        },
      })
    } else {
      uni.switchTab({ url: '/pages/index/index' })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '创建失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}

// 加入家庭
const joinName = ref('')
const joinCode = ref('')
const joining = ref(false)

async function joinFamily() {
  const nm = joinName.value.trim()
  const cd = joinCode.value.trim().toUpperCase()
  if (!nm) { uni.showToast({ title: '请输入你的名字', icon: 'none' }); return }
  if (!cd) { uni.showToast({ title: '请输入邀请码', icon: 'none' }); return }

  saveCloudConfig({
    serverUrl: serverUrl.value.replace(/\/+$/, ''),
    familyId: '',
    familyName: '',
    memberName: nm,
    memberId: '',
  })

  joining.value = true
  try {
    const ok = await store.joinFamily(cd, nm)
    if (ok) {
      uni.showToast({ title: `加入成功！`, icon: 'success' })
      uni.switchTab({ url: '/pages/index/index' })
    } else {
      uni.showToast({ title: '邀请码无效，请联系创建者', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '加入失败', icon: 'none' })
  } finally {
    joining.value = false
  }
}

// 离线模式
function offlineMode() {
  clearCloudConfig()
  const cfg = getCloudConfig()
  store.createFamily('本地家庭', '我')
  uni.showToast({ title: '进入离线模式', icon: 'success' })
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-icon">🍽️</text>
      <text class="hero-title">家庭餐单</text>
      <text class="hero-sub">和家人一起，轻松安排每餐</text>
    </view>

    <!-- 服务端地址 -->
    <view class="server-bar">
      <text class="s-label">📡 服务端地址</text>
      <input v-model="serverUrl" class="s-input" placeholder="https://你的服务器地址.com" />
    </view>

    <view class="card">
      <view class="tab-bar">
        <text class="tab" :class="{ active: tab === 'create' }" @click="tab = 'create'">🏠 创建家庭</text>
        <text class="tab" :class="{ active: tab === 'join' }" @click="tab = 'join'">📨 加入家庭</text>
      </view>

      <!-- 创建家庭 -->
      <view v-if="tab === 'create'" class="form">
        <view class="field">
          <text class="label">家庭名称</text>
          <input v-model="familyName" class="inp" placeholder="例如：幸福之家" maxlength="20" />
        </view>
        <view class="field">
          <text class="label">你的名字</text>
          <input v-model="creatorName" class="inp" placeholder="例如：爸爸" maxlength="10" />
        </view>
        <view class="hint">创建后你将获得管理员权限，可以邀请家人加入</view>
        <text class="btn" @click="createFamily" v-if="!creating">✨ 创建家庭</text>
        <text class="btn disabled" v-else>⏳ 创建中...</text>
      </view>

      <!-- 加入家庭 -->
      <view v-else class="form">
        <view class="field">
          <text class="label">你的名字</text>
          <input v-model="joinName" class="inp" placeholder="输入你的称呼" maxlength="10" />
        </view>
        <view class="field">
          <text class="label">邀请码</text>
          <input v-model="joinCode" class="inp invite-inp" placeholder="输入创建者分享的邀请码" maxlength="6" />
        </view>
        <view class="hint">向家庭创建者或管理员索要邀请码</view>
        <text class="btn btn-join" @click="joinFamily" v-if="!joining">📨 加入家庭</text>
        <text class="btn btn-join disabled" v-else>⏳ 加入中...</text>
      </view>
    </view>

    <text class="offline-link" @click="offlineMode">💡 先跳过，使用离线模式（数据仅存本机）</text>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #FFF9F0 0%, #FFF0E8 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx 40rpx;
  box-sizing: border-box;
}

.hero {
  text-align: center;
  margin-bottom: 24rpx;
  .hero-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
  .hero-title { font-size: 44rpx; font-weight: 800; color: var(--color-text); display: block; }
  .hero-sub { font-size: 26rpx; color: var(--color-text-secondary); margin-top: 8rpx; display: block; }
}

// 服务端地址栏
.server-bar {
  width: 100%;
  max-width: 600rpx;
  background: #F0F7FF;
  border: 2rpx solid #D8E8F5;
  border-radius: 14rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.s-label { font-size: 22rpx; color: #3B7DC4; flex-shrink: 0; }
.s-input {
  flex: 1;
  font-size: 24rpx;
  color: #3B7DC4;
  height: 48rpx;
  background: transparent;
}

.card {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 8rpx 40rpx rgba(232, 120, 74, 0.1);
}

.tab-bar {
  display: flex;
  background: #F8F8F8;
  border-radius: 14rpx;
  padding: 4rpx;
  margin-bottom: 32rpx;
  .tab {
    flex: 1;
    text-align: center;
    padding: 18rpx 0;
    font-size: 26rpx;
    font-weight: 600;
    border-radius: 12rpx;
    color: var(--color-text-secondary);
    transition: all 0.2s;
  }
  .active {
    background: #fff;
    color: var(--color-primary);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
  }
}

.form {
  .field { margin-bottom: 24rpx; }
  .label {
    font-size: 24rpx;
    font-weight: 600;
    color: var(--color-text-secondary);
    display: block;
    margin-bottom: 10rpx;
  }
  .inp {
    width: 100%;
    height: 72rpx;
    background: #F8F8F8;
    border-radius: 14rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    box-sizing: border-box;
    border: 2rpx solid transparent;
    transition: border-color 0.2s;
    &:focus { border-color: var(--color-primary); background: #fff; }
  }
  .invite-inp {
    letter-spacing: 4rpx;
    font-size: 32rpx;
    font-weight: 700;
    text-align: center;
  }
  .hint {
    font-size: 22rpx;
    color: #CCC;
    margin-bottom: 24rpx;
    text-align: center;
  }
  .btn {
    display: block;
    text-align: center;
    padding: 22rpx 0;
    background: linear-gradient(135deg, #FF9A76, var(--color-primary));
    color: #fff;
    font-size: 28rpx;
    font-weight: 700;
    border-radius: 16rpx;
  }
  .btn-join { background: linear-gradient(135deg, #5B9BD5, #3B7DC4); }
  .disabled { opacity: 0.6; }
}

.offline-link {
  margin-top: 32rpx;
  font-size: 24rpx;
  color: #AAA;
  text-decoration: underline;
}
</style>
