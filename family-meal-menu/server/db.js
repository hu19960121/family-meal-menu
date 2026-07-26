/**
 * 基于 JSON 文件的轻量数据库
 *
 * 整个数据库就是 data/ 目录下的一堆 JSON 文件，
 * 每个家庭一个文件夹。适合低并发场景（3-5 人家庭）。
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ====== 文件路径 ======

function familyDir(familyId) {
  return path.join(DATA_DIR, familyId)
}

function filePath(familyId, name) {
  return path.join(familyDir(familyId), name + '.json')
}

function readJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ====== 家庭 ======

function listFamilies() {
  ensureDir(DATA_DIR)
  const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  return dirs.map(id => readJSON(filePath(id, 'info'))).filter(Boolean)
}

function getFamily(id) {
  return readJSON(filePath(id, 'info'))
}

function saveFamily(family) {
  writeJSON(filePath(family.id, 'info'), family)
}

// ====== 通用 CRUD ======

function getAll(familyId, collection) {
  const file = filePath(familyId, collection)
  return readJSON(file) || []
}

function saveAll(familyId, collection, data) {
  writeJSON(filePath(familyId, collection), data)
}

function getById(familyId, collection, id) {
  const items = getAll(familyId, collection)
  return items.find(i => i.id === id) || null
}

function addItem(familyId, collection, item) {
  const items = getAll(familyId, collection)
  items.push(item)
  saveAll(familyId, collection, items)
  return item
}

function updateItem(familyId, collection, id, updates) {
  const items = getAll(familyId, collection)
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...updates }
  saveAll(familyId, collection, items)
  return items[idx]
}

function removeItem(familyId, collection, id) {
  const items = getAll(familyId, collection)
  const filtered = items.filter(i => i.id !== id)
  if (filtered.length === items.length) return false
  saveAll(familyId, collection, filtered)
  return true
}

function clearCollection(familyId, collection) {
  saveAll(familyId, collection, [])
}

// ====== 导出的数据库接口（兼容之前的路由代码） ======

const db = {
  // 家庭
  families: {
    list: listFamilies,
    get: getFamily,
    save: saveFamily,
    remove: (familyId) => {
      const dir = familyDir(familyId)
      if (!fs.existsSync(dir)) return false
      try {
        // 逐个删除文件再删目录（比 fs.rmSync 更可靠的跨平台方案）
        const entries = fs.readdirSync(dir)
        for (const entry of entries) {
          fs.unlinkSync(path.join(dir, entry))
        }
        fs.rmdirSync(dir)
        return true
      } catch {
        return false
      }
    },
  },
  // 成员
  members: {
    getAll: (familyId) => getAll(familyId, 'members'),
    getById: (familyId, id) => getById(familyId, 'members', id),
    add: (familyId, member) => addItem(familyId, 'members', member),
    update: (familyId, id, updates) => updateItem(familyId, 'members', id, updates),
    remove: (familyId, id) => removeItem(familyId, 'members', id),
  },
  // 食谱
  recipes: {
    getAll: (familyId) => getAll(familyId, 'recipes'),
    getById: (familyId, id) => getById(familyId, 'recipes', id),
    add: (familyId, recipe) => addItem(familyId, 'recipes', recipe),
    update: (familyId, id, updates) => updateItem(familyId, 'recipes', id, updates),
    remove: (familyId, id) => removeItem(familyId, 'recipes', id),
    clear: (familyId) => clearCollection(familyId, 'recipes'),
  },
  // 购物车
  cart: {
    getAll: (familyId) => getAll(familyId, 'cart'),
    add: (familyId, item) => addItem(familyId, 'cart', item),
    remove: (familyId, id) => removeItem(familyId, 'cart', id),
    clear: (familyId) => clearCollection(familyId, 'cart'),
  },
  // 订单
  orders: {
    getAll: (familyId) => getAll(familyId, 'orders'),
    add: (familyId, order) => addItem(familyId, 'orders', order),
  },
}

module.exports = { db, ensureDir }
