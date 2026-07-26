/**
 * 购物车路由
 * GET    /api/families/:familyId/cart             — 获取购物车
 * POST   /api/families/:familyId/cart             — 添加菜品
 * DELETE /api/families/:familyId/cart/:itemId     — 删除单项
 * DELETE /api/families/:familyId/cart             — 清空购物车
 * POST   /api/families/:familyId/cart/generate    — 随机生成购物车
 */

module.exports = function registerCartRoutes(app, { db, asyncHandler, requireFamily }) {
  app.get('/api/families/:familyId/cart', requireFamily, asyncHandler(async (req, res) => {
    const items = await db.cart.getAll(req.familyId)
    res.json(items)
  }))

  app.post('/api/families/:familyId/cart', requireFamily, asyncHandler(async (req, res) => {
    const { recipeId, recipeName, recipeCategory, cookName, quantity } = req.body

    const items = await db.cart.getAll(req.familyId)
    const exists = items.find(i => i.recipeId === recipeId)
    if (exists) {
      exists.quantity = (exists.quantity || 1) + (quantity || 1)
      await db.cart.remove(req.familyId, exists.id)
      await db.cart.add(req.familyId, exists)
      return res.json({ success: true, id: exists.id })
    }

    const item = {
      id: Date.now(),
      recipeId,
      recipeName,
      recipeCategory,
      cookName: cookName || '未知',
      quantity: quantity || 1,
    }

    await db.cart.add(req.familyId, item)
    res.json({ success: true, id: item.id })
  }))

  app.delete('/api/families/:familyId/cart/:itemId', requireFamily, asyncHandler(async (req, res) => {
    await db.cart.remove(req.familyId, req.params.itemId)
    res.json({ success: true })
  }))

  app.delete('/api/families/:familyId/cart', requireFamily, asyncHandler(async (req, res) => {
    await db.cart.clear(req.familyId)
    res.json({ success: true })
  }))

  // 随机生成购物车
  app.post('/api/families/:familyId/cart/generate', requireFamily, asyncHandler(async (req, res) => {
    const recipes = await db.recipes.getAll(req.familyId)
    const members = await db.members.getAll(req.familyId)

    const shuffled = [...recipes].sort(() => Math.random() - 0.5)
    const count = Math.min(4, shuffled.length)

    const newItems = []
    for (let i = 0; i < count; i++) {
      const cook = members.length > 0 ? members[Math.floor(Math.random() * members.length)].name : '未知'
      newItems.push({
        id: Date.now() + i,
        recipeId: shuffled[i].id,
        recipeName: shuffled[i].name,
        recipeCategory: shuffled[i].category,
        cookName: cook,
        quantity: 1,
      })
    }

    await db.cart.clear(req.familyId)
    for (const item of newItems) {
      await db.cart.add(req.familyId, item)
    }

    res.json(newItems)
  }))
}
