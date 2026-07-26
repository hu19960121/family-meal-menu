/**
 * Mock database — 内存存储替代 MongoDB
 * vitest 自动发现：vi.mock('../db') 时使用此文件
 */

// —— 内存存储 ——————————————————————————————
const store = {
  families: [],
  members: [],
  recipes: [],
  cart: [],
  orders: [],
}

function uid() {
  return 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

// —— DB API ————————————————————————————————
const db = {
  families: {
    list: async () => store.families.map(d => ({ ...d })),
    get: async (id) => store.families.find(d => d.id === id || d._id === id) || null,
    save: async (data) => {
      const id = data.id || data._id
      const ix = store.families.findIndex(d => d._id === id || d.id === id)
      if (ix >= 0) Object.assign(store.families[ix], data)
      else store.families.push({ ...data, _id: id, id })
    },
    remove: async (id) => {
      store.families = store.families.filter(d => d._id !== id && d.id !== id)
      store.members = store.members.filter(d => d.familyId !== id)
      store.recipes = store.recipes.filter(d => d.familyId !== id)
      store.cart = store.cart.filter(d => d.familyId !== id)
      store.orders = store.orders.filter(d => d.familyId !== id)
      return true
    },
  },
  members: {
    getAll: async (fid) => store.members.filter(d => d.familyId === fid).map(d => ({ ...d, id: d._id })),
    getById: async (fid, id) => {
      const d = store.members.find(m => m.familyId === fid && (m._id === id || m.id === id))
      return d ? { ...d, id: d._id } : null
    },
    add: async (fid, member) => {
      const doc = { ...member, _id: member.id || member._id || uid(), familyId: fid }
      doc.id = doc._id
      store.members.push(doc)
      return { ...doc }
    },
    update: async (fid, id, upd) => {
      const d = store.members.find(m => m.familyId === fid && (m._id === id || m.id === id))
      if (d) Object.assign(d, upd)
      return d ? { ...d, id: d._id } : null
    },
    remove: async (fid, id) => {
      const i = store.members.findIndex(m => m.familyId === fid && (m._id === id || m.id === id))
      if (i >= 0) { store.members.splice(i, 1); return true }
      return false
    },
  },
  recipes: {
    getAll: async () => [], add: async () => ({}), getById: async () => null,
    update: async () => ({}), remove: async () => true, clear: async () => {},
  },
  cart: {
    getAll: async () => [], add: async () => ({}), remove: async () => true, clear: async () => {},
  },
  orders: {
    getAll: async () => [], add: async () => ({}),
  },
}

async function connect() { /* no-op */ }

// 暴露内存 store 供测试断言使用
db._store = store

module.exports = { db, connect }
