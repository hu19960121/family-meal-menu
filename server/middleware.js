/**
 * Express 中间件
 */

const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

// ====== 通用 ======

/** 异步路由错误处理 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

// ====== 家庭验证 ======

/** 创建 requireFamily 中间件（需注入 db 以便测试 mock） */
function createRequireFamily(db) {
  return async function requireFamily(req, res, next) {
    const familyId = req.headers['x-family-id']
    if (!familyId) return res.status(401).json({ error: '缺少家庭 ID' })
    const family = await db.families.get(familyId)
    if (!family) return res.status(404).json({ error: '家庭不存在' })
    req.family = family
    req.familyId = familyId
    next()
  }
}

// ====== 图片上传 ======

const UPLOAD_DIR = path.join(__dirname, 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, Date.now() + '_' + uuidv4().slice(0, 6) + ext)
  },
})

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.originalname).toLowerCase())
    cb(ok ? null : new Error('仅支持 jpg/png/gif/webp 格式'), ok)
  },
})

module.exports = { asyncHandler, createRequireFamily, uploadMiddleware, UPLOAD_DIR }
