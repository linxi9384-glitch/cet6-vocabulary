# 六级词本

[打开六级词本](https://linxi9384-glitch.github.io/cet6-vocabulary/)

在仓库根目录运行 `python -m http.server 8765 --bind 127.0.0.1 --directory site`，打开 `http://127.0.0.1:8765/`。

推送到 `main` 后，GitHub Actions 会将 `site/` 发布到 GitHub Pages。iPad 上可从 Safari 将网站添加到主屏幕。首次联网打开后，在设置中查看离线缓存状态。系统发音依赖设备提供的英语语音。

进度存放在当前浏览器和站点地址的本地存储中。更换浏览器、域名或端口前，可在设置中导出 JSON，再在新地址导入。

真题模块收录 18 套试卷，包含《集训刷题卷（历年真题）》以及 2024、2025 年 6 月和 12 月的试题。整套真题和专题练习各自保存作答进度。题头的「解析」可查看配套讲解或原卷答案，详细讲解可放大和翻页。「试卷原页」可导入对应 PDF，文件保存在当前设备。作答、进度和写作、翻译草稿包含在学习记录备份中。试卷预览使用 Apache-2.0 许可的 PDF.js 6.5.438（legacy build），资源位于 `site/vendor/pdfjs`。

14 套含听力题的试卷可在线播放，也可选择本地音频。`site/exam-audio-data.mjs` 保存每套录音的来源、原始地址、字节数和 SHA-256。主来源为 `Aron0525/English-past-papers`，2022 年 9 月录音由 `1e5e11/CET46-Resources` 补齐。2024 年 6 月按实际听力题匹配，本站第 1、2 套分别对应主来源的 `02`、`01`。

运行 `node --test tests/study.test.mjs` 验证词库结构、判题、错题和备份。重新生成词库时运行 `python scripts/export_bank.py <原始CSV> <原词本work目录>`。原词本的序号、分组、释义和附注沿用到网页。修改应用资源后，同步更新 `site/sw.js` 的缓存版本。

词条发音使用豆包语音合成 3.0 的美音 Jamie。运行 `python scripts/generate_audio.py --id 1` 生成单条音频，脚本会在终端隐藏密钥输入。`--all` 补齐缺失词条。网站播放 `site/audio/` 中已有的 MP3，离线时可使用设备自带的美式英语语音。
