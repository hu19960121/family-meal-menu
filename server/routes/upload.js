/**
 * 文件上传路由
 * POST /api/upload — 单图上传
 */

module.exports = function registerUploadRoutes(app, { uploadMiddleware, UPLOAD_DIR }) {
  // 静态文件服务
  app.use('/uploads', require('express').static(UPLOAD_DIR))

  // 单图上传
  app.post('/api/upload', (req, res) => {
    uploadMiddleware.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || '上传失败' })
      if (!req.file) return res.status(400).json({ error: '未选择文件' })
      const url = `/uploads/${req.file.filename}`
      res.json({ url })
    })
  })
}
