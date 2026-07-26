/**
 * 家庭路由
 * POST   /api/families                — 创建家庭
 * POST   /api/families/join           — 加入家庭
 * GET    /api/families/:familyId      — 获取家庭信息
 * POST   /api/families/:familyId/invite — 生成邀请码
 * DELETE /api/families/:familyId      — 解散家庭
 */

module.exports = function registerFamilyRoutes(app, { db, asyncHandler, requireFamily, generateRecoveryKey }) {
  // 创建家庭
  app.post('/api/families', asyncHandler(async (req, res) => {
    const { name, creatorName, openid } = req.body
    if (!name || !creatorName) return res.status(400).json({ error: '缺少家庭名称或创建者名称' })

    const familyId = 'fam_' + require('uuid').v4().slice(0, 8)
    const memberId = 'm_' + Date.now()
    const now = new Date().toISOString()
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const inviteExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000
    const recoveryKey = generateRecoveryKey()

    const family = { id: familyId, name, inviteCode, inviteExpiry, createdAt: now }
    const creator = { id: memberId, name: creatorName, avatar: '👨', role: 'creator', openid: openid || null, recoveryKey, createdAt: now }

    await db.families.save(family)
    await db.members.add(familyId, creator)

    res.json({ familyId, memberId, name: creatorName, familyName: name, inviteCode, recoveryKey })
  }))

  // 加入家庭
  app.post('/api/families/join', asyncHandler(async (req, res) => {
    const { inviteCode, name, openid } = req.body
    if (!inviteCode || !name) return res.status(400).json({ error: '缺少邀请码或名称' })

    const families = await db.families.list()
    const family = families.find(f => f.inviteCode && f.inviteCode === inviteCode.toUpperCase())
    if (!family) return res.status(404).json({ error: '邀请码无效' })
    if (family.inviteExpiry && Date.now() > family.inviteExpiry) {
      return res.status(400).json({ error: '邀请码已过期' })
    }

    // 检查是否已有相同 openid 的成员（恢复身份）
    if (openid) {
      const existingMembers = await db.members.getAll(family.id)
      const existing = existingMembers.find(m => m.openid === openid)
      if (existing) {
        return res.json({
          familyId: family.id,
          memberId: existing.id,
          name: existing.name,
          familyName: family.name,
          members: existingMembers,
          recoveryKey: existing.recoveryKey,
          recovered: true,
        })
      }
    }

    const memberId = 'm_' + Date.now()
    const now = new Date().toISOString()
    const avatars = ['👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']
    const avatar = avatars[Math.floor(Math.random() * avatars.length)]
    const recoveryKey = generateRecoveryKey()

    const member = { id: memberId, name, avatar, role: 'member', openid: openid || null, recoveryKey, createdAt: now }
    await db.members.add(family.id, member)

    const members = await db.members.getAll(family.id)

    res.json({
      familyId: family.id,
      memberId,
      name,
      familyName: family.name,
      members,
      recoveryKey,
    })
  }))

  // 生成新邀请码
  app.post('/api/families/:familyId/invite', requireFamily, asyncHandler(async (req, res) => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000

    req.family.inviteCode = code
    req.family.inviteExpiry = expiry
    await db.families.save(req.family)

    res.json({ inviteCode: code, expiry })
  }))

  // 获取家庭信息
  app.get('/api/families/:familyId', requireFamily, asyncHandler(async (req, res) => {
    const members = await db.members.getAll(req.familyId)

    res.json({
      id: req.family.id,
      name: req.family.name,
      createdAt: req.family.createdAt,
      memberCount: members.length,
      members,
    })
  }))

  // 解散家庭（仅创建者可操作）
  app.delete('/api/families/:familyId', requireFamily, asyncHandler(async (req, res) => {
    const memberId = req.headers['x-member-id']
    if (!memberId) return res.status(401).json({ error: '缺少成员 ID' })

    const member = await db.members.getById(req.familyId, memberId)
    if (!member) return res.status(404).json({ error: '成员不存在' })
    if (member.role !== 'creator') return res.status(403).json({ error: '仅创建者可解散家庭' })

    await db.families.remove(req.familyId)
    res.json({ success: true })
  }))
}
