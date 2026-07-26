/**
 * 家庭餐单服务端
 *
 * 组装 Express 应用：中间件 → 路由 → 错误处理 → 启动。
 * 路由按领域拆分到 routes/ 目录，中间件在 middleware.js，服务在 services/。
 */

const express = require('express')
const cors = require('cors')
const path = require('path')

const { db, connect } = require('./db')
const { asyncHandler, createRequireFamily, uploadMiddleware, UPLOAD_DIR } = require('./middleware')
const { wechatCode2Session, generateRecoveryKey } = require('./services/auth')

// ====== 路由模块 ======
const registerAuthRoutes = require('./routes/auth')
const registerFamilyRoutes = require('./routes/families')
const registerMemberRoutes = require('./routes/members')
const registerRecipeRoutes = require('./routes/recipes')
const registerCartRoutes = require('./routes/cart')
const registerOrderRoutes = require('./routes/orders')
const registerUploadRoutes = require('./routes/upload')

const app = express()
const PORT = process.env.PORT || 3001

// ====== 全局中间件 ======
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ====== 注册路由 ======
const requireFamily = createRequireFamily(db)
const routeDeps = { db, asyncHandler, requireFamily, generateRecoveryKey }
const uploadDeps = { uploadMiddleware, UPLOAD_DIR }

registerUploadRoutes(app, uploadDeps)
registerAuthRoutes(app, { db, asyncHandler, wechatCode2Session })
registerFamilyRoutes(app, routeDeps)
registerMemberRoutes(app, routeDeps)
registerRecipeRoutes(app, routeDeps)
registerCartRoutes(app, routeDeps)
registerOrderRoutes(app, routeDeps)

// ====== 错误处理 ======
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err)
  res.status(500).json({ error: err.message || '服务器内部错误' })
})

// ====== 启动 ======
async function start() {
  try {
    await connect()
    app.listen(PORT, '0.0.0.0', () => {
      console.log('')
      console.log('  🍽️  家庭餐单服务端 (MongoDB)')
      console.log('  ─────────────────────────────')
      console.log(`  本地:    http://localhost:${PORT}`)
      console.log('')
    })
  } catch (err) {
    console.error('❌ 启动失败:', err.message)
    process.exit(1)
  }
}

// 仅在直接运行时启动，被 require 时不启动（方便测试）
if (require.main === module) {
  start()
}

module.exports = { app, start, generateRecoveryKey, wechatCode2Session }
