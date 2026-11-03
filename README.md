# 勤政殿 · 网页版

科研学习专注小殿（浏览器版）。纯静态站点，无后端。

## 进殿口令

打开后需要输入**进殿口令**（默认 `1123`）——网页版公开托管，防别人随手打开。
- 口令校验为 `sha256('qzd.v1:' + 口令)`，哈希存于 `js/gate-config.js`；
- 改口令：换掉该文件里的 `HASH` 即可（生成命令见文件注释）；
- 正确后「记住 30 天」，期间免输；
- 桌面版（Electron）不校验口令。

## 结构

```
index.html      主页面
float.html      专注悬浮窗（Document Picture-in-Picture）
css/            样式（含 ≤860px 的移动端底部导航适配）
js/             游戏逻辑（systems 系统层 / ui 界面层）
assets/images/  立绘与图片素材
```

## 数据说明

- 存档保存在**各自浏览器 localStorage**，各设备互不同步（可用「设置 → 导出/导入存档」手动迁移）；
- 本仓库不含任何个人数据（学习记录、周报、备份文件均不在此）。

## 发布

```bash
node D:/game/勤政殿/scripts/sync_web.js D:/game/qzd-deploy   # 同步最新文件并提交
# 然后推送：git push -u origin main
```
GitHub Pages 需在仓库 Settings → Pages 选择「Deploy from a branch / main / (root)」。
