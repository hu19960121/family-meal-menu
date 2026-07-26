<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useMealStore } from '@/store/meal'
import { isOnline } from '@/api/client'

onLaunch(async () => {
  const store = useMealStore()

  if (isOnline()) {
    // 云端模式：同步数据，同步后如果已被删除会自动跳转设置页
    await store.syncFromCloud()
  }

  // 仍未初始化 → 跳转设置页
  if (!store.isInitialized) {
    uni.reLaunch({ url: '/pages/family/setup' })
  }
})
</script>
<style lang="scss">
page {
  --color-primary: #E8784A; --color-primary-light: #F5A07A; --color-bg: #FFF9F0;
  --color-bg-card: #FFFFFF; --color-text: #333; --color-text-secondary: #888;
  --color-border: #F0E8DE; --color-success: #6BBF6B; --color-danger: #E05555;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx; color: var(--color-text); background: var(--color-bg);
}
</style>
