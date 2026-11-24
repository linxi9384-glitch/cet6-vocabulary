# 六级词本

[打开六级词本](https://linxi9384-glitch.github.io/cet6-vocabulary/)

在仓库根目录运行 `python -m http.server 8765 --bind 127.0.0.1 --directory site`，打开 `http://127.0.0.1:8765/`。

推送到 `main` 后，GitHub Actions 会将 `site/` 发布到 GitHub Pages。iPad 上可从 Safari 将网站添加到主屏幕。首次联网打开后，在设置中查看离线缓存状态。系统发音依赖设备提供的英语语音。

进度存放在当前浏览器和站点地址的本地存储中。更换浏览器、域名或端口前，可在设置中导出 JSON，再在新地址导入。

运行 `node --test tests/study.test.mjs` 验证词库结构、判题、错题和备份。重新生成词库时运行 `python scripts/export_bank.py <原始CSV> <原词本work目录>`。原词本的序号、分组、释义和附注沿用到网页。修改应用资源后，同步更新 `site/sw.js` 的缓存版本。
