/**
 * 身份认证服务
 */

const https = require('https')

// ====== 微信配置 ======
const WECHAT_APPID = process.env.WECHAT_APPID || 'wx1b4bce250ac41b0f'
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

/** 微信 code2Session：用临时 code 换取 OpenID */
function wechatCode2Session(code) {
  return new Promise((resolve, reject) => {
    if (!WECHAT_SECRET) return reject(new Error('WECHAT_SECRET 未配置'))
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.errcode) reject(new Error(json.errmsg || '微信登录失败'))
          else resolve(json)
        } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

/** 生成 6 位恢复密钥 */
function generateRecoveryKey() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

module.exports = { wechatCode2Session, generateRecoveryKey }
