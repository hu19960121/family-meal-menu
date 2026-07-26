<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useMealStore } from '@/store/meal'

const store = useMealStore()

// 30 秒轮询，自动保持最新
let timer: ReturnType<typeof setInterval> | null = null
onShow(() => {
  store.syncFromCloud()
  if (!timer) timer = setInterval(() => store.syncFromCloud(), 30000)
})
onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null }
})

// 下拉刷新
onPullDownRefresh(async () => {
  try {
    await Promise.race([
      store.syncFromCloud(),
      new Promise(resolve => setTimeout(resolve, 20000)),
    ])
    uni.showToast({ title: '已刷新', icon: 'success', duration: 800 })
  } finally {
    uni.stopPullDownRefresh()
  }
})

// ===== 个人资料编辑 =====
const editId = ref('')
const editName = ref('')
const showAvatarPicker = ref('')

function startEdit(m: any) { editId.value = m.id; editName.value = m.name }
function confirmEdit() {
  store.updateMember(editId.value, { name: editName.value.trim() })
  editId.value = ''
  uni.showToast({ title: '已修改', icon: 'success' })
}
function pickAvatar(id: string) { showAvatarPicker.value = id }
function setAvatar(id: string, avatar: string) { store.updateMember(id, { avatar }); showAvatarPicker.value = '' }
function uploadAvatar(id: string) {
  uni.chooseImage({
    count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
    success: (r) => { store.updateMember(id, { avatar: r.tempFilePaths[0] }); uni.showToast({ title: '头像已更新', icon: 'success' }) },
  })
}
function isImageUrl(s: string) { return s && (s.startsWith('http') || s.startsWith('data:') || s.startsWith('/') || s.startsWith('blob:')) }

// ===== 成员管理 =====
const showInvite = ref(false)

async function doInvite() {
  await store.generateInviteCode()
  showInvite.value = true
}

function copyInviteCode() {
  uni.setClipboardData({
    data: store.inviteCode,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}

function delMember(id: string, name: string) {
  uni.showModal({
    title: '删除成员',
    content: `确定将「${name}」移出家庭？`,
    success: r => {
      if (r.confirm) {
        store.deleteMember(id)
        uni.showToast({ title: '已移出', icon: 'success' })
      }
    },
  })
}

function canEdit(m: any) { return store.isAdmin || m.id === store.currentUserId.value }
function canDelete(m: any) { return store.canManageMembers && m.role !== 'creator' }

function changeRole(m: any, e: any) {
  const role = (['admin', 'member'] as const)[e.detail.value]
  store.setMemberRole(m.id, role)
}

const ROLE_LABELS: Record<string, string> = { creator: '创建者', admin: '管理员', member: '成员' }
function getRoleLabel(r: string) { return ROLE_LABELS[r] || r }

// ===== 退出家庭 =====
function leaveFamily() {
  uni.showModal({
    title: '退出家庭',
    content: '确定退出当前家庭？退出后需要邀请码才能重新加入。',
    success: r => {
      if (!r.confirm) return
      const ok = store.leaveFamily()
      if (ok) {
        uni.showToast({ title: '已退出家庭', icon: 'success' })
        uni.reLaunch({ url: '/pages/family/setup' })
      } else {
        uni.showToast({ title: '创建者不能退出，可解散家庭', icon: 'none' })
      }
    },
  })
}

// ===== 解散家庭（创建者专属） =====
function dissolveFamily() {
  uni.showModal({
    title: '⚠️ 解散家庭',
    content: `确定要解散「${store.familyInfo.name}」？\n\n此操作不可恢复，所有成员将被移出，数据将全部删除！`,
    confirmColor: '#E05555',
    confirmText: '确认解散',
    success: async (r) => {
      if (!r.confirm) return
      const ok = await store.dissolveFamily()
      if (ok) uni.reLaunch({ url: '/pages/family/setup' })
    },
  })
}

// ===== 订单 =====
const today = new Date().toISOString().split('T')[0]
const allOrders = computed(() => store.orders)
const todayOrders = computed(() => allOrders.value.filter(o => o.createdAt.startsWith(today)))

const historyDate = ref('')
const pickerDate = ref(today)

function onDateChange(e: any) {
  historyDate.value = e.detail.value
}
const historyOrders = computed(() => historyDate.value ? allOrders.value.filter(o => o.createdAt.startsWith(historyDate.value)) : [])

function fmt(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <view class="page">
    <!-- ===== 家庭信息 ===== -->
    <view class="sec family-header">
      <view class="fh-top">
        <text class="fh-icon">🏠</text>
        <view class="fh-info">
          <text class="fh-name">{{ store.familyInfo.name }}</text>
          <text class="fh-meta">{{ store.members.length }} 位成员 · {{ store.currentUser?.name }}</text>
        </view>
        <text class="role-badge" :class="'r-'+store.currentUser?.role">{{ getRoleLabel(store.currentUser?.role || '') }}</text>
      </view>
    </view>

    <!-- ===== 我的信息 ===== -->
    <view class="sec">
      <view class="sh">
        <text class="title">👤 我的资料</text>
      </view>
      <view class="cu-row" v-if="store.currentUser">
        <view class="cu-av-wrap" @click="pickAvatar(store.currentUser.id)">
          <image v-if="isImageUrl(store.currentUser.avatar)" :src="store.currentUser.avatar" class="cu-av-img" mode="aspectFill" />
          <text v-else class="cu-av">{{ store.currentUser.avatar }}</text>
          <text class="cu-hint">换头像</text>
        </view>
        <view class="cu-info">
          <text v-if="editId !== store.currentUser.id" class="cu-name" @click="startEdit(store.currentUser)">{{ store.currentUser.name }} ✏️</text>
          <input v-else v-model="editName" class="e-inp" @confirm="confirmEdit" />
          <view class="cu-act" v-if="editId === store.currentUser.id">
            <text class="ab as" @click="confirmEdit">✓</text>
            <text class="ab" @click="editId = ''">✕</text>
          </view>
        </view>
      </view>
      <view v-if="showAvatarPicker === store.currentUser?.id" class="av-picker">
        <text class="av-opt av-upload" @click="uploadAvatar(store.currentUser.id)">📷 拍照/相册</text>
        <text v-for="a in store.AVATARS" :key="a" class="av-opt" @click="setAvatar(store.currentUser.id, a)">{{ a }}</text>
        <text class="av-cancel" @click="showAvatarPicker = ''">取消</text>
      </view>
    </view>

    <!-- ===== 成员管理（创建者/管理员可见） ===== -->
    <view class="sec" v-if="store.isAdmin">
      <view class="sh">
        <text class="title">👥 成员管理</text>
        <text class="act" @click="doInvite">📨 邀请</text>
      </view>

      <!-- 邀请码 -->
      <view v-if="showInvite" class="invite-box">
        <text class="invite-title">📨 邀请码</text>
        <text class="invite-code">{{ store.inviteCode }}</text>
        <text class="invite-hint">分享此邀请码给家人，7天内有效</text>
        <view class="invite-acts">
          <text class="btn" @click="copyInviteCode">📋 复制</text>
          <text class="btn-c" @click="showInvite = false; store.clearInviteCode()">关闭</text>
        </view>
      </view>

      <!-- 成员列表 -->
      <view v-for="m in store.members" :key="m.id" class="m-row">
        <view class="m-av-wrap" @click="canEdit(m) && pickAvatar(m.id)">
          <image v-if="isImageUrl(m.avatar)" :src="m.avatar" class="m-av-img" mode="aspectFill" />
          <text v-else class="m-av">{{ m.avatar }}</text>
        </view>
        <view v-if="showAvatarPicker === m.id" class="av-picker-inline">
          <text class="av-opt av-upload" @click="uploadAvatar(m.id)">📷</text>
          <text v-for="a in store.AVATARS" :key="a" class="av-opt" @click="setAvatar(m.id, a)">{{ a }}</text>
          <text class="av-cancel" @click="showAvatarPicker = ''">取消</text>
        </view>
        <view class="m-info">
          <text v-if="editId !== m.id" class="m-name">{{ m.name }}</text>
          <input v-else v-model="editName" class="e-inp" @confirm="confirmEdit" />
          <text class="m-role" :class="'rl-'+m.role">{{ getRoleLabel(m.role) }}</text>
        </view>
        <view class="m-act" v-if="editId !== m.id">
          <text v-if="canEdit(m)" class="ab" @click="startEdit(m)">✏️</text>
          <picker v-if="store.canManageMembers && m.role !== 'creator'" mode="selector" :range="['管理员', '成员']" @change="(e: any) => changeRole(m, e)">
            <text class="ab">🔑</text>
          </picker>
          <text v-if="canDelete(m)" class="ab ad" @click="delMember(m.id, m.name)">🗑</text>
        </view>
        <view class="m-act" v-else>
          <text class="ab as" @click="confirmEdit">✓</text>
          <text class="ab" @click="editId = ''">✕</text>
        </view>
      </view>
    </view>

    <!-- ===== 解散家庭（仅创建者） ===== -->
    <view class="sec" v-if="store.isCreator">
      <view class="sh">
        <text class="title">⚠️ 危险操作</text>
      </view>
      <text class="leave-hint">解散后所有成员将被移出，数据全部删除，不可恢复</text>
      <text class="btn btn-dissolve" @click="dissolveFamily">🗑 解散家庭</text>
    </view>

    <!-- ===== 退出家庭（创建者不可退出） ===== -->
    <view class="sec" v-if="!store.isCreator">
      <view class="sh">
        <text class="title">🚪 退出家庭</text>
      </view>
      <text class="leave-hint">退出后需要邀请码才能重新加入</text>
      <text class="btn btn-leave" @click="leaveFamily">退出当前家庭</text>
    </view>

    <!-- ===== 今日订单 ===== -->
    <view class="sec">
      <text class="title">📋 今日订单</text>
      <view v-if="todayOrders.length === 0" class="empty">暂无今日订单，去点餐页下单吧</view>
      <view v-for="o in todayOrders" :key="o.id" class="o-card">
        <view class="o-head">
          <text class="o-av">{{ store.members.find(m => m.id === o.memberId)?.avatar || '👤' }}</text>
          <text class="o-user">{{ o.memberName }}</text>
          <text class="o-time">🕐 {{ fmt(o.createdAt) }}</text>
          <text class="o-qty">{{ o.items.length }}道</text>
        </view>
        <text class="o-items">{{ o.items.map(i => i.recipeName).join('、') }}</text>
      </view>
    </view>

    <!-- ===== 历史记录 ===== -->
    <view class="sec">
      <view class="sh">
        <text class="title">📅 历史记录</text>
        <picker mode="date" :value="pickerDate" :end="today" @change="onDateChange">
          <text class="act">选择日期 ›</text>
        </picker>
      </view>
      <view v-if="!historyDate" class="empty">点击「选择日期」查看历史订单</view>
      <view v-else-if="historyOrders.length === 0" class="empty">该日无订单</view>
      <view v-for="o in historyOrders" :key="o.id" class="o-card">
        <view class="o-head">
          <text class="o-av">{{ store.members.find(m => m.id === o.memberId)?.avatar || '👤' }}</text>
          <text class="o-user">{{ o.memberName }}</text>
          <text class="o-time">🕐 {{ fmt(o.createdAt) }}</text>
          <text class="o-qty">{{ o.items.length }}道</text>
        </view>
        <text class="o-items">{{ o.items.map(i => i.recipeName).join('、') }}</text>
      </view>
    </view>

    <view class="ver">家庭餐单 v1.0</view>
  </view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; background: var(--color-bg); padding-bottom: 40rpx; }

// ---------- 通用 ----------
.sec { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 22rpx; box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03); }
.sh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.title { font-size: 30rpx; font-weight: 700; }
.act { font-size: 26rpx; color: var(--color-primary); font-weight: 600; }
.empty { text-align: center; padding: 30rpx 0; font-size: 24rpx; color: #CCC; }
.ver { text-align: center; padding: 30rpx; font-size: 22rpx; color: #CCC; }

// ---------- 家庭信息 ----------
.family-header { background: linear-gradient(135deg, #FFF0E8, #FFE8DC); border: 2rpx solid #FFDCC8; }
.fh-top { display: flex; align-items: center; gap: 16rpx; }
.fh-icon { font-size: 48rpx; }
.fh-info { flex: 1; min-width: 0; }
.fh-name { font-size: 34rpx; font-weight: 800; display: block; }
.fh-meta { font-size: 22rpx; color: var(--color-text-secondary); margin-top: 3rpx; }

// ---------- 角色徽章 ----------
.role-badge { font-size: 22rpx; padding: 5rpx 16rpx; border-radius: 12rpx; flex-shrink: 0; }
.r-creator { background: #E8784A; color: #fff; }
.r-admin { background: var(--color-primary); color: #fff; }
.r-member { background: #E8F0FF; color: #5B9BD5; }

// ---------- 我的资料 ----------
.cu-row { display: flex; align-items: center; }
.cu-av-wrap { position: relative; margin-right: 20rpx; text-align: center; }
.cu-av { font-size: 64rpx; display: block; }
.cu-av-img { width: 100rpx; height: 100rpx; border-radius: 50%; display: block; }
.cu-hint { font-size: 18rpx; color: var(--color-primary); display: block; text-align: center; margin-top: 2rpx; }
.cu-info { flex: 1; }
.cu-name { font-size: 32rpx; font-weight: 700; }
.cu-act { display: flex; gap: 8rpx; margin-top: 4rpx; }

// ---------- 邀请码 ----------
.invite-box {
  background: linear-gradient(135deg, #F0F7FF, #E8F4FF);
  border-radius: 14rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  text-align: center;
  border: 2rpx dashed #B8D8F0;
}
.invite-title { font-size: 26rpx; font-weight: 600; color: #3B7DC4; display: block; margin-bottom: 12rpx; }
.invite-code {
  font-size: 52rpx; font-weight: 800; color: #3B7DC4;
  letter-spacing: 8rpx; display: block; margin-bottom: 10rpx;
  font-family: 'Courier New', monospace;
}
.invite-hint { font-size: 22rpx; color: #8BB8D8; display: block; margin-bottom: 20rpx; }
.invite-acts { display: flex; justify-content: center; gap: 16rpx; }

// ---------- 成员管理 ----------
.m-row { display: flex; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid #F5F0EB; &:last-child { border-bottom: none; } }
.m-av-wrap { margin-right: 14rpx; position: relative; }
.m-av { font-size: 44rpx; }
.m-av-img { width: 60rpx; height: 60rpx; border-radius: 50%; }
.m-info { flex: 1; display: flex; align-items: center; gap: 10rpx; }
.m-name { font-size: 28rpx; font-weight: 500; }
.m-role { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 6rpx; }
.rl-creator { background: #FFF0E8; color: #E8784A; }
.rl-admin { background: #FFF0E8; color: var(--color-primary); }
.rl-member { background: #E8F0FF; color: #5B9BD5; }
.m-act { display: flex; gap: 6rpx; margin-left: 8rpx; flex-shrink: 0; }
.ab { font-size: 22rpx; padding: 6rpx 10rpx; background: #F5F5F5; border-radius: 6rpx; }
.ad { color: var(--color-danger); }
.as { color: var(--color-success); }

// ---------- 加入/退出 ----------
.add-form { display: flex; align-items: center; gap: 10rpx; padding: 10rpx; background: #F8F8F8; border-radius: 10rpx; }
.inp { flex: 1; height: 56rpx; background: #fff; border-radius: 8rpx; padding: 0 14rpx; font-size: 26rpx; }
.btn { display: inline-block; font-size: 24rpx; color: #fff; background: var(--color-primary); padding: 12rpx 22rpx; border-radius: 10rpx; text-align: center; }
.btn-c { font-size: 24rpx; color: var(--color-text-secondary); padding: 10rpx 12rpx; }
.leave-hint { font-size: 22rpx; color: #CCC; display: block; margin-bottom: 14rpx; }
.btn-leave { background: var(--color-danger); display: block; }
.btn-dissolve { background: #8B0000; display: block; }

// ---------- 头像选择器 ----------
.av-picker { display: flex; flex-wrap: wrap; gap: 8rpx; padding: 8rpx 0; }
.av-picker-inline { display: flex; flex-wrap: wrap; gap: 6rpx; padding: 4rpx 0; width: 100%; }
.av-opt { font-size: 36rpx; padding: 6rpx; border-radius: 8rpx; border: 2rpx solid transparent; &:active { border-color: var(--color-primary); background: #FFF0E8; } }
.av-upload { font-size: 22rpx; padding: 8rpx 14rpx; border: 2rpx dashed #DDD; display: flex; align-items: center; }
.av-cancel { font-size: 22rpx; color: var(--color-text-secondary); padding: 8rpx; }

// ---------- 其他 ----------
.e-inp { flex: 1; height: 48rpx; border: 1rpx solid var(--color-primary); border-radius: 6rpx; padding: 0 10rpx; font-size: 26rpx; }

// ---------- 订单卡片 ----------
.o-card { padding: 14rpx; background: #FFFBF7; border-radius: 10rpx; margin-bottom: 10rpx; border: 1rpx solid var(--color-border); }
.o-head { display: flex; align-items: center; gap: 8rpx; margin-bottom: 4rpx; }
.o-av { font-size: 28rpx; flex-shrink: 0; }
.o-user { font-size: 22rpx; color: var(--color-primary); font-weight: 500; }
.o-time { font-size: 22rpx; color: var(--color-text-secondary); }
.o-qty { font-size: 20rpx; background: #FFF0E8; color: var(--color-primary); padding: 1rpx 10rpx; border-radius: 8rpx; margin-left: auto; }
.o-items { font-size: 24rpx; line-height: 1.5; display: block; }

</style>
