/**
 * 成员路由
 * PUT    /api/families/:familyId/members/:memberId      — 更新成员
 * DELETE /api/families/:familyId/members/:memberId      — 删除成员
 * PUT    /api/families/:familyId/members/:memberId/role — 修改角色
 */

module.exports = function registerMemberRoutes(app, { db, asyncHandler, requireFamily }) {
  app.put('/api/families/:familyId/members/:memberId', requireFamily, asyncHandler(async (req, res) => {
    const { name, avatar, role } = req.body
    const member = await db.members.getById(req.familyId, req.params.memberId)
    if (!member) return res.status(404).json({ error: '成员不存在' })

    const updates = {}
    if (name) updates.name = name
    if (avatar) updates.avatar = avatar
    if (role && role !== 'creator') updates.role = role

    await db.members.update(req.familyId, member.id, updates)
    res.json({ success: true })
  }))

  app.delete('/api/families/:familyId/members/:memberId', requireFamily, asyncHandler(async (req, res) => {
    const member = await db.members.getById(req.familyId, req.params.memberId)
    if (!member) return res.status(404).json({ error: '成员不存在' })
    if (member.role === 'creator') return res.status(400).json({ error: '不能删除创建者' })

    await db.members.remove(req.familyId, member.id)
    res.json({ success: true })
  }))

  app.put('/api/families/:familyId/members/:memberId/role', requireFamily, asyncHandler(async (req, res) => {
    const { role } = req.body
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: '无效角色' })

    const member = await db.members.getById(req.familyId, req.params.memberId)
    if (!member) return res.status(404).json({ error: '成员不存在' })
    if (member.role === 'creator') return res.status(400).json({ error: '不能修改创建者角色' })

    await db.members.update(req.familyId, member.id, { role })
    res.json({ success: true })
  }))
}
