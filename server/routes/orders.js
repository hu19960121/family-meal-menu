/**
 * 订单路由
 * GET  /api/families/:familyId/orders — 获取订单列表
 * POST /api/families/:familyId/orders — 下单
 */

module.exports = function registerOrderRoutes(app, { db, asyncHandler, requireFamily }) {
  app.get('/api/families/:familyId/orders', requireFamily, asyncHandler(async (req, res) => {
    const orders = await db.orders.getAll(req.familyId)
    res.json(orders)
  }))

  app.post('/api/families/:familyId/orders', requireFamily, asyncHandler(async (req, res) => {
    const { items, memberId, memberName } = req.body
    if (!items || !items.length) return res.status(400).json({ error: '没有菜品' })

    const order = {
      id: 'ord_' + Date.now(),
      memberId: memberId || '',
      memberName: memberName || '未知',
      items,
      createdAt: new Date().toISOString(),
    }

    await db.orders.add(req.familyId, order)

    // 更新菜品点单次数
    for (const item of items) {
      const recipe = await db.recipes.getById(req.familyId, item.recipeId)
      if (recipe) {
        await db.recipes.update(req.familyId, recipe.id, { orderCount: (recipe.orderCount || 0) + 1 })
      }
    }

    // 清空购物车
    await db.cart.clear(req.familyId)

    res.json({ id: order.id, createdAt: order.createdAt })
  }))
}
