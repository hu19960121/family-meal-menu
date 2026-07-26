import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// —— 系统边界 mock ——————

const { mockIsOnline, mockMemberApi } = vi.hoisted(() => ({
  mockIsOnline: vi.fn(() => false),
  mockMemberApi: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setRole: vi.fn(),
  },
}))

vi.mock('@/utils/storage', () => ({
  load: vi.fn((_key: string, fallback: any) => fallback),
  save: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  isOnline: () => mockIsOnline(),
  memberApi: mockMemberApi,
  familyApi: {
    generateInvite: vi.fn(),
    get: vi.fn(),
  },
}))

import { useFamilyStore } from '../family'

// —— 辅助 ——————————————————

function setupStore() {
  const store = useFamilyStore()
  // 确保 store 从空状态开始
  store.reset()
  vi.clearAllMocks()
  return store
}

const VALID_AVATARS = ['👨', '👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']

// —— 测试 ——————————————————

describe('familyStore.addMember', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockIsOnline.mockReturnValue(false)
  })

  // ================================================================
  // Test 1: 基本创建
  // ================================================================
  it('creates a member with correct name, role, avatar and id', async () => {
    const store = setupStore()

    const member = await store.addMember('小明', 'member')

    expect(member.name).toBe('小明')
    expect(member.role).toBe('member')
    expect(VALID_AVATARS).toContain(member.avatar)
    expect(member.id).toMatch(/^m_\d+/)
  })

  it('defaults role to member when omitted', async () => {
    const store = setupStore()

    const member = await store.addMember('小红')

    expect(member.role).toBe('member')
  })

  it('appends member to the members list', async () => {
    const store = setupStore()

    expect(store.members).toHaveLength(0)
    await store.addMember('小明', 'member')
    expect(store.members).toHaveLength(1)
    expect(store.members[0].name).toBe('小明')
  })

  it('persists members to localStorage after adding', async () => {
    const store = setupStore()
    const { save } = await import('@/utils/storage')

    await store.addMember('小明', 'member')

    expect(save).toHaveBeenCalledWith('family_members', expect.any(Array))
    const saved = (save as any).mock.calls.find((c: any) => c[0] === 'family_members')
    expect(saved[1]).toHaveLength(1)
    expect(saved[1][0].name).toBe('小明')
  })

  // ================================================================
  // Test 2: 在线模式使用服务端 ID
  // ================================================================
  it('uses server ID when online and API succeeds', async () => {
    mockIsOnline.mockReturnValue(true)
    mockMemberApi.create.mockResolvedValue({ id: 'm_server_generated' })

    const store = setupStore()
    const member = await store.addMember('小红', 'admin')

    expect(member.id).toBe('m_server_generated')
    expect(mockMemberApi.create).toHaveBeenCalledWith({
      name: '小红',
      avatar: expect.any(String),
      role: 'admin',
    })
  })

  it('does not call memberApi.update (the old broken behavior)', async () => {
    mockIsOnline.mockReturnValue(true)
    mockMemberApi.create.mockResolvedValue({ id: 'm_server' })

    const store = setupStore()
    await store.addMember('测试', 'member')

    expect(mockMemberApi.update).not.toHaveBeenCalled()
  })

  // ================================================================
  // Test 3: 离线模式使用本地 ID
  // ================================================================
  it('uses local ID when offline', async () => {
    mockIsOnline.mockReturnValue(false)

    const store = setupStore()
    const member = await store.addMember('小刚', 'member')

    expect(member.id).toMatch(/^m_\d+/)
    expect(mockMemberApi.create).not.toHaveBeenCalled()
  })

  it('does not call any API when offline', async () => {
    mockIsOnline.mockReturnValue(false)

    const store = setupStore()
    await store.addMember('小刚', 'member')

    expect(mockMemberApi.create).not.toHaveBeenCalled()
    expect(mockMemberApi.update).not.toHaveBeenCalled()
  })

  // ================================================================
  // Test 4: API 失败降级
  // ================================================================
  it('falls back to local ID when API call fails', async () => {
    mockIsOnline.mockReturnValue(true)
    mockMemberApi.create.mockRejectedValue(new Error('Network error'))

    const store = setupStore()
    const member = await store.addMember('小丽', 'member')

    expect(member).toBeDefined()
    expect(member.name).toBe('小丽')
    expect(member.id).toMatch(/^m_\d+/)
  })

  it('still creates member locally even when server is down', async () => {
    mockIsOnline.mockReturnValue(true)
    mockMemberApi.create.mockRejectedValue(new Error('500 Internal Server Error'))

    const store = setupStore()
    const member = await store.addMember('测试', 'admin')

    expect(store.members).toHaveLength(1)
    expect(store.members[0]).toEqual(member)
  })
})
