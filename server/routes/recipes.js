/**
 * 食谱路由
 * GET    /api/families/:familyId/recipes             — 获取食谱列表
 * POST   /api/families/:familyId/recipes             — 创建食谱
 * PUT    /api/families/:familyId/recipes/:recipeId   — 更新食谱
 * DELETE /api/families/:familyId/recipes/:recipeId   — 删除食谱
 */

module.exports = function registerRecipeRoutes(app, { db, asyncHandler, requireFamily }) {
  app.get('/api/families/:familyId/recipes', requireFamily, asyncHandler(async (req, res) => {
    const recipes = await db.recipes.getAll(req.familyId)
    res.json(recipes)
  }))

  app.post('/api/families/:familyId/recipes', requireFamily, asyncHandler(async (req, res) => {
    const { name, category, coverImage, cookingTime, difficulty, servings, tags, nutritions, ingredients, steps } = req.body
    if (!name) return res.status(400).json({ error: '缺少食谱名称' })

    const recipe = {
      id: 'r_' + Date.now(),
      name: name,
      category: category || 'meat',
      coverImage: coverImage || '',
      cookingTime: cookingTime || 0,
      difficulty: difficulty || 1,
      servings: servings || 3,
      tags: tags || [],
      nutritions: nutritions || {},
      ingredients: ingredients || [],
      steps: steps || [],
      orderCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.recipes.add(req.familyId, recipe)
    res.json({ id: recipe.id })
  }))

  app.put('/api/families/:familyId/recipes/:recipeId', requireFamily, asyncHandler(async (req, res) => {
    const recipe = await db.recipes.getById(req.familyId, req.params.recipeId)
    if (!recipe) return res.status(404).json({ error: '食谱不存在' })

    const { name, category, coverImage, cookingTime, difficulty, servings, tags, nutritions, ingredients, steps } = req.body
    const updates = { updatedAt: new Date().toISOString() }

    if (name !== undefined) updates.name = name
    if (category !== undefined) updates.category = category
    if (coverImage !== undefined) updates.coverImage = coverImage
    if (cookingTime !== undefined) updates.cookingTime = cookingTime
    if (difficulty !== undefined) updates.difficulty = difficulty
    if (servings !== undefined) updates.servings = servings
    if (tags !== undefined) updates.tags = tags
    if (nutritions !== undefined) updates.nutritions = nutritions
    if (ingredients !== undefined) updates.ingredients = ingredients
    if (steps !== undefined) updates.steps = steps

    await db.recipes.update(req.familyId, recipe.id, updates)
    res.json({ success: true })
  }))

  app.delete('/api/families/:familyId/recipes/:recipeId', requireFamily, asyncHandler(async (req, res) => {
    await db.recipes.remove(req.familyId, req.params.recipeId)
    res.json({ success: true })
  }))
}
