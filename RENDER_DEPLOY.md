# 🚀 Render + MongoDB Atlas 部署指南

将后端部署到 Render，数据存储在 MongoDB Atlas（免费 512MB），数据永不丢失。

---

## 目录

- [第一步：注册 MongoDB Atlas（免费）](#第一步注册-mongodb-atlas免费)
- [第二步：获取连接字符串](#第二步获取连接字符串)
- [第三步：推送代码到 GitHub](#第三步推送代码到-github)
- [第四步：在 Render 创建 Web Service](#第四步在-render-创建-web-service)
- [第五步：配置微信小程序白名单](#第五步配置微信小程序白名单)
- [排错指南](#排错指南)

---

## 第一步：注册 MongoDB Atlas（免费）

1. 打开 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. 用邮箱注册（也可以用 Google / GitHub 账号登录）
3. 选择 **M0 Free** 免费集群，**Cloud Provider & Region** 选 **AWS / Singapore**
4. 点击 **Create Cluster**
5. 等待 1-3 分钟集群创建完成

---

## 第二步：获取连接字符串

### 2.1 创建数据库用户

1. 在 Atlas 左侧菜单点击 **Database Access**
2. 点击 **Add New Database User**
3. 用户名填 `family_menu_user`，密码点击 **Autogenerate Secure Password**
4. **把生成的密码复制下来**（关闭弹窗后就找不回来了）
5. 角色保持默认 **Atlas Admin**
6. 点击 **Add User**

### 2.2 配置 IP 白名单

1. 在 Atlas 左侧菜单点击 **Network Access**
2. 点击 **Add IP Address**
3. 选择 **Allow Access from Anywhere**（`0.0.0.0/0`），这样 Render 和你的本地都能连
4. 点击 **Confirm**

### 2.3 获取连接字符串

1. 在 Atlas 左侧菜单点击 **Database** → 你的集群 → **Connect**
2. 选择 **Drivers**
3. 复制连接字符串，格式如下：
   ```
   mongodb+srv://family_menu_user:<password>@cluster0.xxxxx.mongodb.net/family-meal-menu?retryWrites=true&w=majority
   ```
4. **把 `<password>` 替换成刚才生成的密码**

### 2.4 本地测试连接（可选）

在 `server/` 目录运行：

```bash
set MONGO_URI="mongodb+srv://family_menu_user:你的密码@cluster0.xxxxx.mongodb.net/family-meal-menu?retryWrites=true&w=majority"
node index.js
```

看到 `📦 MongoDB 已连接` 说明成功。

---

## 第三步：推送代码到 GitHub

如果还没上传：

```bash
cd /c/Users/12579/Desktop/小程序/family-meal-menu
git init
git add -A
git commit -m "初始化家庭餐单（MongoDB 版）"

# 在 GitHub 新建一个仓库后，关联并推送
git remote add origin https://github.com/你的用户名/family-meal-menu.git
git branch -M main
git push -u origin main
```

---

## 第四步：在 Render 创建 Web Service

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击右上角 **「New +」→「Web Service」**
3. 连接 GitHub，选择 `family-meal-menu` 仓库
4. 填写服务信息：

   | 字段 | 值 |
   |------|----|
   | **Name** | `family-meal-menu-api` |
   | **Region** | **Singapore (Southeast Asia)** |
   | **Branch** | `main` |
   | **Root Directory** | `server` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node index.js` |
   | **Plan** | **Free** |

   > ⚠️ **Root Directory 必须填 `server`**

5. **关键步骤 — 配置环境变量**

   在创建页面下方，展开 **「Advanced」**，点击 **「Add Environment Variable」**：

   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | `mongodb+srv://family_menu_user:你的密码@cluster0.xxxxx.mongodb.net/family-meal-menu?retryWrites=true&w=majority` |

6. 点击 **「Create Web Service」**
7. 等待 2-3 分钟部署完成
8. 部署成功后得到一个 URL，如：
   ```
   https://family-meal-menu-api.onrender.com
   ```

9. **验证部署**：浏览器访问该 URL + 一个 API 路径，如：
   ```
   https://family-meal-menu-api.onrender.com/api/families
   ```
   返回 `{"error":"缺少家庭名称或创建者名称"}` 说明服务正常 ✅

---

## 第五步：配置微信小程序白名单

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **「开发 → 开发设置 → 服务器域名」**
3. 点击 **「修改」**（需管理员扫码）
4. 在 **「request 合法域名」** 添加：
   ```
   https://family-meal-menu-api.onrender.com
   ```
5. 保存

> 开发工具中 `urlCheck: false` 可绕过限制，**真机预览和线上版本必须配置**。

---

## 🎉 做完以上步骤

1. ✅ 小程序代码已构建（`dist/build/mp-weixin`）
2. ✅ AppID 已配置（`wx1b4bce250ac41b0f`）
3. ✅ 默认服务器地址已设为 Render URL
4. ✅ 后端使用 MongoDB，**数据永不丢失**
5. ⏳ 等你部署 Render + 配置域名白名单 → 在开发者工具预览

最后在开发者工具中点击 **「上传」** → 去微信公众平台 **提交审核** → 审核通过后 **发布** 即可。

---

## 排错指南

### 部署后服务启动失败

检查 Render Dashboard → 顶部 **「Events」** 或 **「Logs」** 看报错。常见原因：
- `MONGO_URI` 环境变量没填或格式不对
- 密码中包含特殊字符（如 `@`、`$`、`#`）需要 URL 编码：`@` → `%40`、`$` → `%24`、`#` → `%23`

### 小程序请求失败

- 检查微信公众平台是否已添加域名白名单
- 检查 Render URL 是否以 `https://` 开头
- 开发者工具中打开调试 → Network 面板查看具体错误

### 数据丢失

不会丢失。MongoDB Atlas 是持久化云数据库，重启、重部署都不影响数据。
