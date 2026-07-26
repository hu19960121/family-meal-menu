/**
 * 身份认证路由
 * POST /api/auth/wechat-login  — 微信登录
 * POST /api/auth/recover       — 恢复密钥找回身份
 */

module.exports = function registerAuthRoutes(app, { db, asyncHandler, wechatCode2Session }) {
  // 微信登录：用 code 换 OpenID，查找已有身份
  app.post('/api/auth/wechat-login', asyncHandler(async (req, res) => {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: '缺少登录 code' })

    let openid
    try {
      const session = await wechatCode2Session(code)
      openid = session.openid
    } catch {
      // 微信 API 不可用时降级为 code 本身（开发环境兼容）
      openid = 'dev_' + code.slice(-16)
    }

    // 在所有家庭中查找该 openid 对应的成员
    const families = await db.families.list()
    for (const fam of families) {
      const members = await db.members.getAll(fam.id)
      const found = members.find(m => m.openid === openid)
      if (found) {
        return res.json({
          found: true,
          openid,
          familyId: fam.id,
          familyName: fam.name,
          memberId: found.id,
          memberName: found.name,
          role: found.role,
          avatar: found.avatar,
        })
      }
    }

    res.json({ found: false, openid })
  }))

  // 恢复密钥找回身份
  app.post('/api/auth/recover', asyncHandler(async (req, res) => {
    const { recoveryKey } = req.body
    if (!recoveryKey) return res.status(400).json({ error: '缺少恢复密钥' })

    const families = await db.families.list()
    for (const fam of families) {
      const members = await db.members.getAll(fam.id)
      const found = members.find(m => m.recoveryKey === recoveryKey.toUpperCase())
      if (found) {
        return res.json({
          found: true,
          familyId: fam.id,
          familyName: fam.name,
          memberId: found.id,
          memberName: found.name,
          role: found.role,
          avatar: found.avatar,
        })
      }
    }

    res.status(404).json({ error: '恢复密钥无效' })
  }))
}
