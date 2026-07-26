/**
 * 服务端身份认证 API 测试
 *
 * 覆盖改动：
 *   1. POST /api/auth/wechat-login  — 微信登录 / OpenID 身份查找
 *   2. POST /api/auth/recover       — 恢复密钥找回身份
 *   3. POST /api/families           — 创建家庭（含 openid + recoveryKey）
 *   4. POST /api/families/join      — 加入家庭（含 openid + 自动恢复）
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

// 使用 __mocks__/db.js 自动 mock
vi.mock('../db')

const supertestP = import('supertest').then(m => m.default || m)

let app: any
let gk: () => string
let rq: any
let S: any  // mock 的内存 store

beforeAll(async () => {
  // 动态加载 server（mock 已生效）
  const serverMod = await import('../index.js')
  app = serverMod.app
  gk = serverMod.generateRecoveryKey

  // 拿到 mock db 的内存 store 用于断言
  const { db } = await import('../db.js')
  S = db._store

  rq = await supertestP
})

// 每个 describe 前清空数据
function resetStore() {
  Object.keys(S).forEach((k: string) => { S[k] = [] })
}

// ====================================================================
describe('generateRecoveryKey', () => {
  it('生成 6 位大写字母数字混合密钥', () => {
    expect(gk()).toMatch(/^[A-Z0-9]{6}$/)
  })
  it('每次生成不同密钥', () => {
    const keys = new Set(Array.from({ length: 20 }, () => gk()))
    expect(keys.size).toBeGreaterThan(15)
  })
})

// ====================================================================
describe('POST /api/auth/wechat-login', () => {
  beforeAll(resetStore)

  it('缺 code → 400', async () => {
    const r = await rq(app).post('/api/auth/wechat-login').send({})
    expect(r.status).toBe(400)
  })

  it('无 WECHAT_SECRET 降级 dev_ openid', async () => {
    const r = await rq(app).post('/api/auth/wechat-login').send({ code: 'abc123' })
    expect(r.status).toBe(200)
    expect(r.body.openid).toMatch(/^dev_/)
    expect(r.body.found).toBe(false)
  })

  it('找到匹配 openid 返回身份信息', async () => {
    S.families = [{ _id: 'f1', id: 'f1', name: '测试家庭', createdAt: new Date().toISOString() }]
    S.members = [{
      _id: 'm1', id: 'm1', familyId: 'f1', name: '爸爸', avatar: '👨',
      role: 'creator', openid: 'dev_test_user', recoveryKey: 'K1',
      createdAt: new Date().toISOString(),
    }]

    const r = await rq(app).post('/api/auth/wechat-login').send({ code: 'test_user' })
    expect(r.status).toBe(200)
    expect(r.body.found).toBe(true)
    expect(r.body.memberId).toBe('m1')
    expect(r.body.familyId).toBe('f1')
    expect(r.body.role).toBe('creator')
  })

  it('无匹配 openid 返回 found:false', async () => {
    S.families = [{ _id: 'f2', id: 'f2', name: '其他家庭', createdAt: new Date().toISOString() }]
    S.members = [{ _id: 'm2', id: 'm2', familyId: 'f2', name: '别人', avatar: '👶', role: 'member', openid: 'other', createdAt: new Date().toISOString() }]

    const r = await rq(app).post('/api/auth/wechat-login').send({ code: 'unknown' })
    expect(r.status).toBe(200)
    expect(r.body.found).toBe(false)
  })
})

// ====================================================================
describe('POST /api/auth/recover', () => {
  beforeAll(resetStore)

  it('缺 key → 400', async () => {
    const r = await rq(app).post('/api/auth/recover').send({})
    expect(r.status).toBe(400)
  })

  it('恢复密钥匹配返回身份', async () => {
    S.families = [{ _id: 'f3', id: 'f3', name: '恢复家庭', createdAt: new Date().toISOString() }]
    S.members = [{ _id: 'm3', id: 'm3', familyId: 'f3', name: '小明', avatar: '🧑', role: 'member', recoveryKey: 'SAVE99', createdAt: new Date().toISOString() }]

    const r = await rq(app).post('/api/auth/recover').send({ recoveryKey: 'save99' })
    expect(r.status).toBe(200)
    expect(r.body.found).toBe(true)
    expect(r.body.memberId).toBe('m3')
    expect(r.body.familyName).toBe('恢复家庭')
  })

  it('恢复密钥无效 → 404', async () => {
    S.families = [{ _id: 'f4', id: 'f4', name: 'X', createdAt: new Date().toISOString() }]
    S.members = [{ _id: 'm4', id: 'm4', familyId: 'f4', name: '某人', avatar: '👤', role: 'member', recoveryKey: 'X99', createdAt: new Date().toISOString() }]

    const r = await rq(app).post('/api/auth/recover').send({ recoveryKey: 'WRONG' })
    expect(r.status).toBe(404)
  })
})

// ====================================================================
describe('POST /api/families', () => {
  beforeAll(resetStore)

  it('创建家庭返回 recoveryKey + inviteCode', async () => {
    const r = await rq(app).post('/api/families').send({ name: '新家庭', creatorName: '创建者' })
    expect(r.status).toBe(200)
    expect(r.body.familyId).toMatch(/^fam_/)
    expect(r.body.memberId).toMatch(/^m_/)
    expect(r.body.inviteCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(r.body.recoveryKey).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('openid 写入成员记录', async () => {
    const r = await rq(app).post('/api/families').send({ name: 'OpenID家', creatorName: '测试', openid: 'dev_user123' })
    expect(r.status).toBe(200)
    const m = S.members.find((d: any) => d.familyId === r.body.familyId)
    expect(m).toBeDefined()
    expect(m.openid).toBe('dev_user123')
    expect(m.recoveryKey).toBe(r.body.recoveryKey)
    expect(m.role).toBe('creator')
  })

  it('缺名 → 400', async () => {
    const r = await rq(app).post('/api/families').send({ creatorName: '无名' })
    expect(r.status).toBe(400)
  })
})

// ====================================================================
describe('POST /api/families/join', () => {
  const tid = 'fam_join_test'

  beforeAll(() => {
    resetStore()
    S.families = [{ _id: tid, id: tid, name: '加入测试家庭', inviteCode: 'JOINME', inviteExpiry: Date.now() + 86400000, createdAt: new Date().toISOString() }]
  })

  it('加入家庭返回 recoveryKey', async () => {
    const r = await rq(app).post('/api/families/join').send({ inviteCode: 'joinme', name: '新成员' })
    expect(r.status).toBe(200)
    expect(r.body.familyId).toBe(tid)
    expect(r.body.recoveryKey).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('已有 openid 自动恢复身份', async () => {
    S.members.push({ _id: 'm_old', id: 'm_old', familyId: tid, name: '老用户', avatar: '👩', role: 'member', openid: 'dev_old', recoveryKey: 'OLDKEY', createdAt: new Date().toISOString() })

    const r = await rq(app).post('/api/families/join').send({ inviteCode: 'joinme', name: '随便', openid: 'dev_old' })
    expect(r.status).toBe(200)
    expect(r.body.recovered).toBe(true)
    expect(r.body.memberId).toBe('m_old')
    expect(r.body.recoveryKey).toBe('OLDKEY')
  })

  it('邀请码无效 → 404', async () => {
    const r = await rq(app).post('/api/families/join').send({ inviteCode: 'WRONG', name: 'x' })
    expect(r.status).toBe(404)
  })

  it('邀请码过期 → 400', async () => {
    S.families.push({ _id: 'fam_exp', id: 'fam_exp', name: '过期', inviteCode: 'EXPCD', inviteExpiry: Date.now() - 1, createdAt: new Date().toISOString() })
    const r = await rq(app).post('/api/families/join').send({ inviteCode: 'expcd', name: 'x' })
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('过期')
  })
})
