/**
 * API 客户端
 *
 * 连接后端服务器，兼容 H5 和微信小程序。
 * 支持在线/离线双模式。
 */

const STORAGE_KEY = 'cloud_config'
const BACKUP_KEY = 'family_cloud_info'

export interface CloudConfig {
  serverUrl: string
  familyId: string
  familyName: string
  memberName: string
  memberId: string
}

export function getCloudConfig(): CloudConfig | null {
  try {
    // 尝试主 key
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && raw.serverUrl) return raw
    // 尝试备用 key
    const backup = uni.getStorageSync(BACKUP_KEY)
    if (backup && backup.serverUrl) {
      // 恢复主 key
      uni.setStorageSync(STORAGE_KEY, backup)
      return backup
    }
  } catch { /* ignore */ }
  return null
}

export function saveCloudConfig(config: CloudConfig): void {
  try {
    const data = JSON.parse(JSON.stringify(config))
    uni.setStorageSync(STORAGE_KEY, data)
    // 双写备份
    uni.setStorageSync(BACKUP_KEY, data)
  } catch (e) {
    console.warn('保存云端配置失败:', e)
  }
}

export function clearCloudConfig(): void {
  try { uni.removeStorageSync(STORAGE_KEY) } catch { /* ignore */ }
  try { uni.removeStorageSync(BACKUP_KEY) } catch { /* ignore */ }
}

export function isOnline(): boolean {
  return !!getCloudConfig()
}

// ========== 通用请求（兼容 H5 + 小程序） ==========

function request<T>(method: string, path: string, body?: any, requireFamily = true, extraHeaders?: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const config = getCloudConfig()
    if (!config) { reject(new Error('未连接服务器')); return }

    const url = `${config.serverUrl.replace(/\/+$/, '')}${path}`
    const header: Record<string, string> = { 'Content-Type': 'application/json' }

    // 需要家庭 ID 的接口才加该头
    if (requireFamily && config.familyId) {
      header['x-family-id'] = config.familyId
    }
    if (extraHeaders) {
      Object.assign(header, extraHeaders)
    }

    uni.request({
      url,
      method: method as any,
      header,
      data: body,
      timeout: 10000,
      success: (res) => {
        const data = res.data as any
        if (res.statusCode >= 400) {
          reject(new Error(data?.error || `请求失败 (${res.statusCode})`))
        } else {
          resolve(data as T)
        }
      },
      fail: (err) => {
        reject(new Error(err?.errMsg || '网络请求失败'))
      },
    })
  })
}

function get<T>(path: string): Promise<T> { return request<T>('GET', path) }
function post<T>(path: string, body?: any, requireFamily = true): Promise<T> { return request<T>('POST', path, body, requireFamily) }
function put<T>(path: string, body?: any): Promise<T> { return request<T>('PUT', path, body) }
function del<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> { return request<T>('DELETE', path, undefined, true, extraHeaders) }

// ========== 图片上传（兼容 H5 + 小程序） ==========

export function uploadImage(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const config = getCloudConfig()
    if (!config) { reject(new Error('未连接服务器')); return }

    const url = `${config.serverUrl.replace(/\/+$/, '')}/api/upload`

    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data as string)
          if (res.statusCode >= 400) reject(new Error(data.error || '上传失败'))
          else resolve(config.serverUrl.replace(/\/+$/, '') + data.url)
        } catch {
          reject(new Error('上传返回格式错误'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

// ========== 家庭 API（无需 familyId） ==========

export const familyApi = {
  /** 创建家庭（无需 familyId） */
  create: (name: string, creatorName: string) =>
    post<{ familyId: string; memberId: string; name: string; familyName: string; inviteCode: string }>(
      '/api/families', { name, creatorName }, false
    ),

  /** 加入家庭（无需 familyId） */
  join: (inviteCode: string, name: string) =>
    post<{ familyId: string; memberId: string; name: string; familyName: string; members?: any[] }>(
      '/api/families/join', { inviteCode, name }, false
    ),

  /** 获取家庭信息 */
  get: () =>
    get<{ id: string; name: string; createdAt: string; memberCount: number; members: any[] }>(
      '/api/families/' + getCloudConfig()?.familyId
    ),

  /** 生成新邀请码 */
  generateInvite: () =>
    post<{ inviteCode: string; expiry: number }>(
      '/api/families/' + getCloudConfig()?.familyId + '/invite'
    ),

  /** 解散家庭（仅创建者） */
  dissolve: () =>
    del<{ success: boolean }>(
      '/api/families/' + getCloudConfig()?.familyId,
      { 'x-member-id': getCloudConfig()?.memberId || '' }
    ),
}

// ========== 成员 API ==========

export const memberApi = {
  update: (memberId: string, data: { name?: string; avatar?: string; role?: string }) =>
    put(`/api/families/${getCloudConfig()?.familyId}/members/${memberId}`, data),

  remove: (memberId: string) =>
    del(`/api/families/${getCloudConfig()?.familyId}/members/${memberId}`),

  setRole: (memberId: string, role: string) =>
    put(`/api/families/${getCloudConfig()?.familyId}/members/${memberId}/role`, { role }),
}

// ========== 食谱 API ==========

export const recipeApi = {
  list: () =>
    get<any[]>(`/api/families/${getCloudConfig()?.familyId}/recipes`),

  create: (data: any) =>
    post<{ id: string }>(`/api/families/${getCloudConfig()?.familyId}/recipes`, data),

  update: (recipeId: string, data: any) =>
    put(`/api/families/${getCloudConfig()?.familyId}/recipes/${recipeId}`, data),

  delete: (recipeId: string) =>
    del(`/api/families/${getCloudConfig()?.familyId}/recipes/${recipeId}`),
}

// ========== 购物车 API ==========

export const cartApi = {
  get: () =>
    get<any[]>(`/api/families/${getCloudConfig()?.familyId}/cart`),

  add: (recipeId: string, recipeName: string, recipeCategory: string, cookName: string, quantity?: number) =>
    post(`/api/families/${getCloudConfig()?.familyId}/cart`, { recipeId, recipeName, recipeCategory, cookName, quantity: quantity || 1 }),

  remove: (itemId: number | string) =>
    del(`/api/families/${getCloudConfig()?.familyId}/cart/${itemId}`),

  clear: () =>
    del(`/api/families/${getCloudConfig()?.familyId}/cart`),

  generate: () =>
    post<any[]>(`/api/families/${getCloudConfig()?.familyId}/cart/generate`),
}

// ========== 订单 API ==========

export const orderApi = {
  list: () =>
    get<any[]>(`/api/families/${getCloudConfig()?.familyId}/orders`),

  place: (items: any[], memberId: string, memberName: string) =>
    post<{ id: string; createdAt: string }>(`/api/families/${getCloudConfig()?.familyId}/orders`, { items, memberId, memberName }),
}
