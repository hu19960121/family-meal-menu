/**
 * 本地存储工具函数
 * 兼容 uni-app (H5 / 微信小程序) 环境
 */

export function load<T>(key: string, fallback: T): T {
  try {
    const s = uni.getStorageSync(key)
    if (s !== '' && s !== null && s !== undefined) {
      if (Array.isArray(s)) return s.length > 0 ? s : fallback
      if (typeof s === 'object') return Object.keys(s).length > 0 ? s : fallback
      return s as T
    }
  } catch {
    // 存储读取失败时静默降级
  }
  return JSON.parse(JSON.stringify(fallback))
}

export function save<T>(key: string, val: T): void {
  try {
    uni.setStorageSync(key, JSON.parse(JSON.stringify(val)))
  } catch {
    uni.showToast({ title: '存储失败', icon: 'none' })
  }
}
