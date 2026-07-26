const express = require('express')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const { db } = require('./db')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ==================== Middleware: 验证家庭 ====================
function requireFamily(req, res, next) {
  const familyId = req.headers['x-family-id']
  if (!familyId) return res.status(401).json({ error: '缺少家庭 ID' })
  const family = db.families.get(familyId)
  if (!family) return res.status(404).json({ error: '家庭不存在' })
  req.family = family
  req.familyId = familyId
  next()
}

// ==================== 家庭 API ====================

// 创建家庭
app.post('/api/families', (req, res) => {
  const { name, creatorName } = req.body
  if (!name || !creatorName) return res.status(400).json({ error: '缺少家庭名称或创建者名称' })

  const familyId = 'fam_' + uuidv4().slice(0, 8)
  const memberId = 'm_' + Date.now()
  const now = new Date().toISOString()
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  const inviteExpiry = Date.now() + 30 * 60 * 1000

  const family = {
    id: familyId,
    name,
    inviteCode,
    inviteExpiry,
    createdAt: now,
  }

  const creator = {
    id: memberId,
    familyId,
    name: creatorName,
    avatar: '👨',
    role: 'creator',
    createdAt: now,
  }

  db.families.save(family)
  db.members.add(familyId, creator)

  res.json({ familyId, memberId, name: creatorName, familyName: name, inviteCode })
})

// 加入家庭
app.post('/api/families/join', (req, res) => {
  const { inviteCode, name } = req.body
  if (!inviteCode || !name) return res.status(400).json({ error: '缺少邀请码或名称' })

  // 在所有家庭中查找匹配的邀请码
  const families = db.families.list()
  const family = families.find(f => f.inviteCode && f.inviteCode === inviteCode.toUpperCase())
  if (!family) return res.status(404).json({ error: '邀请码无效' })
  if (family.inviteExpiry && Date.now() > family.inviteExpiry) {
    return res.status(400).json({ error: '邀请码已过期' })
  }

  const memberId = 'm_' + Date.now()
  const now = new Date().toISOString()
  const avatars = ['👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']
  const avatar = avatars[Math.floor(Math.random() * avatars.length)]

  const member = { id: memberId, familyId: family.id, name, avatar, role: 'member', createdAt: now }
  db.members.add(family.id, member)

  // 邀请码一次性使用
  family.inviteCode = null
  family.inviteExpiry = null
  db.families.save(family)

  res.json({ familyId: family.id, memberId, name, familyName: family.name })
})

// 生成新邀请码
app.post('/api/families/:familyId/invite', requireFamily, (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  const expiry = Date.now() + 30 * 60 * 1000

  req.family.inviteCode = code
  req.family.inviteExpiry = expiry
  db.families.save(req.family)

  res.json({ inviteCode: code, expiry })
})

// 获取家庭信息
app.get('/api/families/:familyId', requireFamily, (req, res) => {
  const members = db.members.getAll(req.familyId)

  res.json({
    id: req.family.id,
    name: req.family.name,
    createdAt: req.family.createdAt,
    memberCount: members.length,
    members,
  })
})

// 解散家庭（仅创建者可操作）
app.delete('/api/families/:familyId', requireFamily, (req, res) => {
  const memberId = req.headers['x-member-id']
  if (!memberId) return res.status(401).json({ error: '缺少成员 ID' })

  // 验证操作者是创建者
  const member = db.members.getById(req.familyId, memberId)
  if (!member) return res.status(404).json({ error: '成员不存在' })
  if (member.role !== 'creator') return res.status(403).json({ error: '仅创建者可解散家庭' })

  // 删除家庭所有数据
  db.families.remove(req.familyId)
  res.json({ success: true })
})

// ==================== 成员 API ====================

app.put('/api/families/:familyId/members/:memberId', requireFamily, (req, res) => {
  const { name, avatar, role } = req.body
  const member = db.members.getById(req.familyId, req.params.memberId)
  if (!member) return res.status(404).json({ error: '成员不存在' })

  const updates = {}
  if (name) updates.name = name
  if (avatar) updates.avatar = avatar
  if (role && role !== 'creator') updates.role = role

  db.members.update(req.familyId, member.id, updates)
  res.json({ success: true })
})

app.delete('/api/families/:familyId/members/:memberId', requireFamily, (req, res) => {
  const member = db.members.getById(req.familyId, req.params.memberId)
  if (!member) return res.status(404).json({ error: '成员不存在' })
  if (member.role === 'creator') return res.status(400).json({ error: '不能删除创建者' })

  db.members.remove(req.familyId, member.id)
  res.json({ success: true })
})

app.put('/api/families/:familyId/members/:memberId/role', requireFamily, (req, res) => {
  const { role } = req.body
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: '无效角色' })

  const member = db.members.getById(req.familyId, req.params.memberId)
  if (!member) return res.status(404).json({ error: '成员不存在' })
  if (member.role === 'creator') return res.status(400).json({ error: '不能修改创建者角色' })

  db.members.update(req.familyId, member.id, { role })
  res.json({ success: true })
})

// ==================== 食谱 API ====================

app.get('/api/families/:familyId/recipes', requireFamily, (req, res) => {
  const recipes = db.recipes.getAll(req.familyId)
  res.json(recipes)
})

app.post('/api/families/:familyId/recipes', requireFamily, (req, res) => {
  const { name, category, coverImage, cookingTime, difficulty, servings, tags, nutritions, ingredients, steps } = req.body
  if (!name) return res.status(400).json({ error: '缺少食谱名称' })

  const id = 'r_' + Date.now()
  const now = new Date().toISOString()

  const recipe = {
    id,
    familyId: req.familyId,
    name,
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
    createdAt: now,
    updatedAt: now,
  }

  db.recipes.add(req.familyId, recipe)
  res.json({ id })
})

app.put('/api/families/:familyId/recipes/:recipeId', requireFamily, (req, res) => {
  const recipe = db.recipes.getById(req.familyId, req.params.recipeId)
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

  db.recipes.update(req.familyId, recipe.id, updates)
  res.json({ success: true })
})

app.delete('/api/families/:familyId/recipes/:recipeId', requireFamily, (req, res) => {
  db.recipes.remove(req.familyId, req.params.recipeId)
  res.json({ success: true })
})

// ==================== 购物车 API ====================

app.get('/api/families/:familyId/cart', requireFamily, (req, res) => {
  const items = db.cart.getAll(req.familyId)
  res.json(items)
})

app.post('/api/families/:familyId/cart', requireFamily, (req, res) => {
  const { recipeId, recipeName, recipeCategory, cookName, quantity } = req.body

  // 支持追加数量：如已在购物车中，增加数量
  const items = db.cart.getAll(req.familyId)
  const exists = items.find(i => i.recipeId === recipeId)
  if (exists) {
    exists.quantity = (exists.quantity || 1) + (quantity || 1)
    db.cart.remove(req.familyId, exists.id)
    db.cart.add(req.familyId, exists)
    return res.json({ success: true, id: exists.id })
  }

  const item = {
    id: Date.now(),
    familyId: req.familyId,
    recipeId,
    recipeName,
    recipeCategory,
    cookName: cookName || '未知',
    quantity: quantity || 1,
  }

  db.cart.add(req.familyId, item)
  res.json({ success: true, id: item.id })
})

app.delete('/api/families/:familyId/cart/:itemId', requireFamily, (req, res) => {
  db.cart.remove(req.familyId, parseInt(req.params.itemId) || req.params.itemId)
  res.json({ success: true })
})

app.delete('/api/families/:familyId/cart', requireFamily, (req, res) => {
  db.cart.clear(req.familyId)
  res.json({ success: true })
})

// 随机生成购物车
app.post('/api/families/:familyId/cart/generate', requireFamily, (req, res) => {
  const recipes = db.recipes.getAll(req.familyId)
  const members = db.members.getAll(req.familyId)

  // 随机选 1-4 道菜
  const shuffled = [...recipes].sort(() => Math.random() - 0.5)
  const count = Math.min(4, shuffled.length)

  const newItems = []
  for (let i = 0; i < count; i++) {
    const cook = members.length > 0 ? members[Math.floor(Math.random() * members.length)].name : '未知'
    newItems.push({
      id: Date.now() + i,
      familyId: req.familyId,
      recipeId: shuffled[i].id,
      recipeName: shuffled[i].name,
      recipeCategory: shuffled[i].category,
      cookName: cook,
      quantity: 1,
    })
  }

  db.cart.clear(req.familyId)
  for (const item of newItems) {
    db.cart.add(req.familyId, item)
  }

  res.json(newItems)
})

// ==================== 订单 API ====================

app.get('/api/families/:familyId/orders', requireFamily, (req, res) => {
  const orders = db.orders.getAll(req.familyId)
  res.json(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

app.post('/api/families/:familyId/orders', requireFamily, (req, res) => {
  const { items, memberId, memberName } = req.body
  if (!items || !items.length) return res.status(400).json({ error: '没有菜品' })

  const id = 'ord_' + Date.now()
  const now = new Date().toISOString()

  const order = {
    id,
    familyId: req.familyId,
    memberId: memberId || '',
    memberName: memberName || '未知',
    items,
    createdAt: now,
  }

  db.orders.add(req.familyId, order)

  // 更新菜品点单次数
  for (const item of items) {
    const recipe = db.recipes.getById(req.familyId, item.recipeId)
    if (recipe) {
      db.recipes.update(req.familyId, recipe.id, { orderCount: (recipe.orderCount || 0) + 1 })
    }
  }

  // 清空购物车
  db.cart.clear(req.familyId)

  res.json({ id, createdAt: now })
})

// ==================== 启动 ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('  🍽️  家庭餐单服务端')
  console.log('  ─────────────────────')
  console.log(`  本地:    http://localhost:${PORT}`)
  console.log(`  局域网:  http://192.168.10.7:${PORT}`)
  console.log('')
})
