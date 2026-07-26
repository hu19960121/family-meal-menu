const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const { db, connect } = require('./db')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ====== 图片上传配置 ======
const UPLOAD_DIR = path.join(__dirname, 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, Date.now() + '_' + uuidv4().slice(0, 6) + ext)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.originalname).toLowerCase())
    cb(ok ? null : new Error('仅支持 jpg/png/gif/webp 格式'), ok)
  },
})

// 静态文件服务
app.use('/uploads', express.static(UPLOAD_DIR))

// 单图上传
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' })
    if (!req.file) return res.status(400).json({ error: '未选择文件' })
    const url = `/uploads/${req.file.filename}`
    res.json({ url })
  })
})

// 异步路由错误处理
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

// ==================== Middleware: 验证家庭 ====================
async function requireFamily(req, res, next) {
  const familyId = req.headers['x-family-id']
  if (!familyId) return res.status(401).json({ error: '缺少家庭 ID' })
  const family = await db.families.get(familyId)
  if (!family) return res.status(404).json({ error: '家庭不存在' })
  req.family = family
  req.familyId = familyId
  next()
}

// ==================== 家庭 API ====================

// 创建家庭
app.post('/api/families', asyncHandler(async (req, res) => {
  const { name, creatorName } = req.body
  if (!name || !creatorName) return res.status(400).json({ error: '缺少家庭名称或创建者名称' })

  const familyId = 'fam_' + uuidv4().slice(0, 8)
  const memberId = 'm_' + Date.now()
  const now = new Date().toISOString()
  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase()
  const inviteExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

  const family = { id: familyId, name, inviteCode, inviteExpiry, createdAt: now }
  const creator = { id: memberId, name: creatorName, avatar: '👨', role: 'creator', createdAt: now }

  await db.families.save(family)
  await db.members.add(familyId, creator)

  res.json({ familyId, memberId, name: creatorName, familyName: name, inviteCode })
}))

// 加入家庭
app.post('/api/families/join', asyncHandler(async (req, res) => {
  const { inviteCode, name } = req.body
  if (!inviteCode || !name) return res.status(400).json({ error: '缺少邀请码或名称' })

  const families = await db.families.list()
  const family = families.find(f => f.inviteCode && f.inviteCode === inviteCode.toUpperCase())
  if (!family) return res.status(404).json({ error: '邀请码无效' })
  if (family.inviteExpiry && Date.now() > family.inviteExpiry) {
    return res.status(400).json({ error: '邀请码已过期' })
  }

  const memberId = 'm_' + Date.now()
  const now = new Date().toISOString()
  const avatars = ['👩', '👶', '👴', '👵', '🧑', '👦', '👧', '🐶', '🐱', '🦊', '🐼']
  const avatar = avatars[Math.floor(Math.random() * avatars.length)]

  const member = { id: memberId, name, avatar, role: 'member', createdAt: now }
  await db.members.add(family.id, member)

  // 返回完整成员列表，前端无需再次同步
  const members = await db.members.getAll(family.id)

  res.json({
    familyId: family.id,
    memberId,
    name,
    familyName: family.name,
    members,
  })
}))

// 生成新邀请码
app.post('/api/families/:familyId/invite', requireFamily, asyncHandler(async (req, res) => {
  const code = Math.random().toString(36).slice(2, 10).toUpperCase()
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

// ==================== 成员 API ====================

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

// ==================== 食谱 API ====================

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

// ==================== 购物车 API ====================

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

// ==================== 订单 API ====================

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

// ==================== 错误处理 ====================

app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err)
  res.status(500).json({ error: err.message || '服务器内部错误' })
})

// ==================== 启动 ====================

async function start() {
  try {
    await connect()
    app.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('  🍽️  家庭餐单服务端 (MongoDB)')
      console.log('  ─────────────────────────────')
      console.log(`  本地:    http://localhost:${PORT}`)
      console.log(`  局域网:  http://192.168.10.7:${PORT}`)
      console.log('')
    })
  } catch (err) {
    console.error('❌ 启动失败:', err.message)
    process.exit(1)
  }
}

start()
