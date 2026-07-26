/**
 * MongoDB 数据库层
 *
 * 替代原来的 JSON 文件存储，数据持久化不丢失。
 * 保持与 server/index.js 完全兼容的 API 接口。
 *
 * 环境变量 MONGO_URI 用于配置连接地址（Render 上设置）。
 * 默认连接本地 MongoDB（开发用）。
 */

const mongoose = require('mongoose')

// ====== 连接 ======

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/family-meal-menu'

async function connect() {
  await mongoose.connect(MONGO_URI)
  console.log(`  📦 MongoDB 已连接`)

  // 清理旧数据
  const [orphanMembers, orphanRecipes, orphanCart, orphanOrders, cleanCodes] = await Promise.all([
    Member.deleteMany({ familyId: { $exists: false } }),
    Recipe.deleteMany({ familyId: { $exists: false } }),
    CartItem.deleteMany({ familyId: { $exists: false } }),
    Order.deleteMany({ familyId: { $exists: false } }),
    // 清除所有只有1人的家庭的邀请码（测试残留,防冲突）
    Family.updateMany(
      {},
      { $set: { inviteCode: null, inviteExpiry: null } }
    ),
  ])
  const total = orphanMembers.deletedCount + orphanRecipes.deletedCount + orphanCart.deletedCount + orphanOrders.deletedCount
  if (total > 0) {
    console.log(`  🧹 已清理 ${total} 条缺少 familyId 的旧数据`)
  }
}

// ====== Schema 定义 ======

const familySchema = new mongoose.Schema({
  _id: String,
  name: String,
  inviteCode: { type: String, default: null },
  inviteExpiry: { type: Number, default: null },
  createdAt: String,
})

const memberSchema = new mongoose.Schema({
  _id: String,
  familyId: { type: String, index: true },
  name: String,
  avatar: String,
  role: { type: String, enum: ['creator', 'admin', 'member'], default: 'member' },
  createdAt: String,
})

const recipeSchema = new mongoose.Schema({
  _id: String,
  familyId: { type: String, index: true },
  name: String,
  category: String,
  coverImage: String,
  cookingTime: Number,
  difficulty: Number,
  servings: Number,
  tags: [String],
  nutritions: mongoose.Schema.Types.Mixed,
  ingredients: [mongoose.Schema.Types.Mixed],
  steps: [mongoose.Schema.Types.Mixed],
  orderCount: { type: Number, default: 0 },
  createdAt: String,
  updatedAt: String,
})

const cartItemSchema = new mongoose.Schema({
  _id: String,
  familyId: { type: String, index: true },
  recipeId: String,
  recipeName: String,
  recipeCategory: String,
  cookName: String,
  quantity: { type: Number, default: 1 },
})

const orderSchema = new mongoose.Schema({
  _id: String,
  familyId: { type: String, index: true },
  items: [mongoose.Schema.Types.Mixed],
  memberId: String,
  memberName: String,
  createdAt: String,
})

const Family = mongoose.model('Family', familySchema)
const Member = mongoose.model('Member', memberSchema)
const Recipe = mongoose.model('Recipe', recipeSchema)
const CartItem = mongoose.model('CartItem', cartItemSchema)
const Order = mongoose.model('Order', orderSchema)

// ====== 辅助函数 ======

/** 将 MongoDB 文档转为带 id 字段的普通对象 */
function toPlain(doc) {
  if (!doc) return null
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc
  return { ...obj, id: String(obj._id) }
}

function toPlainMany(docs) {
  return docs.map(d => toPlain(d))
}

/** 去除文档中的 _id/id 字段，避免 $set 覆写 _id */
function stripId(obj) {
  if (!obj) return obj
  const { _id, id, ...rest } = obj
  return rest
}

// ====== 数据库 API（与原 db.js 完全一致） ======

const db = {
  // ---------- 家庭 ----------
  families: {
    list: async () => {
      const docs = await Family.find().lean()
      return docs.map(d => ({ ...d, id: String(d._id) }))
    },

    get: async (id) => {
      const doc = await Family.findById(String(id)).lean()
      if (!doc) return null
      return { ...doc, id: String(doc._id) }
    },

    save: async (data) => {
      await Family.findByIdAndUpdate(
        String(data.id || data._id),
        { $set: stripId(data) },
        { upsert: true }
      )
    },

    remove: async (familyId) => {
      await Family.findByIdAndDelete(String(familyId))
      await Member.deleteMany({ familyId: String(familyId) })
      await Recipe.deleteMany({ familyId: String(familyId) })
      await CartItem.deleteMany({ familyId: String(familyId) })
      await Order.deleteMany({ familyId: String(familyId) })
      return true
    },
  },

  // ---------- 成员 ----------
  members: {
    getAll: async (familyId) => {
      const docs = await Member.find({ familyId: String(familyId) }).lean()
      return docs.map(d => ({ ...d, id: String(d._id) }))
    },

    getById: async (familyId, id) => {
      const doc = await Member.findOne({ _id: String(id), familyId: String(familyId) }).lean()
      if (!doc) return null
      return { ...doc, id: String(doc._id) }
    },

    add: async (familyId, member) => {
      const doc = await Member.create({ ...member, _id: String(member.id || member._id), familyId: String(familyId) })
      return toPlain(doc)
    },

    update: async (familyId, id, updates) => {
      const doc = await Member.findOneAndUpdate(
        { _id: String(id), familyId: String(familyId) },
        { $set: stripId(updates) },
        { new: true }
      )
      return toPlain(doc)
    },

    remove: async (familyId, id) => {
      const r = await Member.deleteOne({ _id: String(id), familyId: String(familyId) })
      return r.deletedCount > 0
    },
  },

  // ---------- 食谱 ----------
  recipes: {
    getAll: async (familyId) => {
      const docs = await Recipe.find({ familyId: String(familyId) }).lean()
      return docs.map(d => ({ ...d, id: String(d._id) }))
    },

    getById: async (familyId, id) => {
      const doc = await Recipe.findOne({ _id: String(id), familyId: String(familyId) }).lean()
      if (!doc) return null
      return { ...doc, id: String(doc._id) }
    },

    add: async (familyId, recipe) => {
      const doc = await Recipe.create({ ...recipe, _id: String(recipe.id || recipe._id), familyId: String(familyId) })
      return toPlain(doc)
    },

    update: async (familyId, id, updates) => {
      const doc = await Recipe.findOneAndUpdate(
        { _id: String(id), familyId: String(familyId) },
        { $set: stripId(updates) },
        { new: true }
      )
      return toPlain(doc)
    },

    remove: async (familyId, id) => {
      const r = await Recipe.deleteOne({ _id: String(id), familyId: String(familyId) })
      return r.deletedCount > 0
    },

    clear: async (familyId) => {
      await Recipe.deleteMany({ familyId: String(familyId) })
    },
  },

  // ---------- 购物车 ----------
  cart: {
    getAll: async (familyId) => {
      const docs = await CartItem.find({ familyId: String(familyId) }).lean()
      return docs.map(d => ({ ...d, id: String(d._id) }))
    },

    add: async (familyId, item) => {
      const doc = await CartItem.create({ ...item, _id: String(item.id || item._id), familyId: String(familyId) })
      return toPlain(doc)
    },

    remove: async (familyId, id) => {
      const r = await CartItem.deleteOne({ _id: String(id), familyId: String(familyId) })
      return r.deletedCount > 0
    },

    clear: async (familyId) => {
      await CartItem.deleteMany({ familyId: String(familyId) })
    },
  },

  // ---------- 订单 ----------
  orders: {
    getAll: async (familyId) => {
      const docs = await Order.find({ familyId: String(familyId) })
        .sort({ createdAt: -1 })
        .lean()
      return docs.map(d => ({ ...d, id: String(d._id) }))
    },

    add: async (familyId, order) => {
      const doc = await Order.create({ ...order, _id: String(order.id || order._id), familyId: String(familyId) })
      return toPlain(doc)
    },

    clearAll: async () => {
      await Order.deleteMany({})
    },
  },

  // ---------- 全局重置 ----------
  /** 清空数据库中所有表的数据（仅当提供匹配的 resetToken 时执行） */
  resetAll: async (token) => {
    const EXPECTED = process.env.RESET_TOKEN || 'reset-all-data-2024'
    if (token !== EXPECTED) return { success: false, error: 'resetToken 不正确' }
    const results = await Promise.all([
      Family.deleteMany({}),
      Member.deleteMany({}),
      Recipe.deleteMany({}),
      CartItem.deleteMany({}),
      Order.deleteMany({}),
    ])
    return { success: true, deleted: results.map(r => r.deletedCount).reduce((a, b) => a + b, 0) }
  },
}

module.exports = { db, connect, mongoose, MONGO_URI }
