# 六级词本

[打开六级词本](https://linxi9384-glitch.github.io/cet6-vocabulary/)

在仓库根目录运行 `python -m http.server 8765 --bind 127.0.0.1 --directory site`，打开 `http://127.0.0.1:8765/`。

推送到 `main` 后，GitHub Actions 会将 `site/` 发布到 GitHub Pages。iPad 上可从 Safari 将网站添加到主屏幕。首次联网打开后，在设置中查看离线缓存状态。系统发音依赖设备提供的英语语音。

进度存放在当前浏览器和站点地址的本地存储中。更换浏览器、域名或端口前，可在设置中导出 JSON，再在新地址导入。

真题模块内置《集训刷题卷（历年真题）》的六套试题。打开任意一套可直接作答，客观题交卷后按原卷答案核对。听力可加载另备的原卷音频。「试卷原页」可导入原始 PDF，文件保存在当前设备。作答、进度和写作、翻译草稿包含在学习记录备份中。试卷预览使用 Apache-2.0 许可的 PDF.js 6.5.438（legacy build），资源位于 `site/vendor/pdfjs`。

运行 `node --test tests/study.test.mjs` 验证词库结构、判题、错题和备份。重新生成词库时运行 `python scripts/export_bank.py <原始CSV> <原词本work目录>`。原词本的序号、分组、释义和附注沿用到网页。修改应用资源后，同步更新 `site/sw.js` 的缓存版本。

词条发音使用豆包语音合成 3.0 的美音 Jamie。运行 `python scripts/generate_audio.py --id 1` 生成单条音频，脚本会在终端隐藏密钥输入。`--all` 补齐缺失词条。网站播放 `site/audio/` 中已有的 MP3，离线时可使用设备自带的美式英语语音。
