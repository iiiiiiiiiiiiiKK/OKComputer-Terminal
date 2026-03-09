# Vercel 部署步骤

## 1. 代码推送到 GitHub
```bash
cd OKComputer-Terminal
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/OKComputer-Terminal.git
git push -u origin main
```

## 2. Vercel 导入
1. 打开 https://vercel.com
2. 用 GitHub 登录
3. 点击 "New Project"
4. 选择刚才推送的仓库
5. 配置：
   - Framework: Vite
   - Build Command: npm run build
   - Output Directory: dist
6. 点击 Deploy

## 3. 注意事项
⚠️ 当前版本后端是 Python，需要另外托管
   - 方案 A：把 Python API 部署到 Render/Railway/VPS
   - 方案 B：纯前端，直接从浏览器请求 Yahoo/TradingView（当前已支持）

如果选方案 B，部署后数据源会直接从客户端请求，不依赖 Python 后端。

## 4. 域名（可选）
Vercel 分配免费域名：xxx.vercel.app  
也可以绑定自己的域名
