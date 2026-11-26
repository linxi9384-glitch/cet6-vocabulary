"""Run against the local site: python tests/browser_smoke.py [screenshot-directory]."""

import json
from pathlib import Path
import os
import re
import sys

from playwright.sync_api import expect, sync_playwright


ROOT = os.environ.get("CET6_SMOKE_ROOT", "http://127.0.0.1:8765/")


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def open_page(page, link, heading):
    link.click()
    expect(page.get_by_role("heading", name=heading, exact=True, level=1)).to_be_visible()


def study(context, screenshots):
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ROOT)
    expect(page.get_by_role("heading", name="单元目录", exact=True)).to_be_visible()
    page.evaluate("navigator.serviceWorker.ready")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    no_overflow(page)
    if screenshots:
        page.screenshot(path=screenshots / "cet6-desktop.png")
    open_page(page, page.get_by_role("link", name="第四章", exact=True), "单元目录")
    expect(page.get_by_role("link", name="第 64 单元", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name="第一章", exact=True), "单元目录")
    open_page(page, page.get_by_role("link", name="第 01 单元", exact=True), "第 01 单元")
    expect(page.locator(".word-row")).to_have_count(14)
    page.get_by_role("button", name="标记已预习", exact=True).click()
    expect(page.get_by_role("button", name="已完成预习", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^中译英默写")), "中译英默写")
    page.get_by_role("textbox", name="输入英文").fill("nutriton")
    page.get_by_role("button", name="下一题", exact=True).click()
    page.reload()
    expect(page.get_by_text("第 2 / 14 题")).to_be_visible()
    page.get_by_role("button", name="上一题", exact=True).click()
    expect(page.get_by_role("textbox", name="输入英文")).to_have_value("nutriton")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    expect(page.get_by_text("13 未作答", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name="英译汉", exact=True), "英译汉选择题")
    expect(page.get_by_role("radio")).to_have_count(4)
    correct = page.get_by_role("radio", name=re.compile("营养摄入"))
    correct.check()
    expect(page.get_by_text("已作答 1 题", exact=True)).to_be_visible()
    page.get_by_role("button", name="下一题", exact=True).click()
    page.get_by_role("button", name="上一题", exact=True).click()
    page.reload()
    expect(correct).to_be_checked()
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^错题本")), "错题本")
    expect(page.get_by_text("1 道待复测", exact=True)).to_be_visible()
    expect(page.locator(".result-row")).to_have_count(1)
    expect(page.get_by_text("nutriton", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("button", name="中译英复测 (1)", exact=True), "中译英默写")
    page.get_by_role("textbox", name="输入英文").fill("  NU TRI\u00a0TION  ")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name="返回错题本", exact=True), "错题本")
    page.get_by_role("checkbox", name="含已掌握").check()
    expect(page.get_by_text("最近复测 答对 (NU TRI TION)", exact=False)).to_be_visible()
    open_page(page, page.get_by_role("link", name="设置与备份", exact=True), "设置与备份")
    expect(page.get_by_text("已缓存，可离线打开。", exact=False)).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role("button", name="导出 JSON").click()
    backup = download.value.path().read_bytes()
    page.evaluate("localStorage.clear()")
    page.reload()
    expect(page.locator("#overall-label")).to_have_text("0 / 896 条双向答对")
    page.locator("#import-file").set_input_files({"name": "backup.json", "mimeType": "application/json", "buffer": backup})
    page.get_by_role("button", name="确认恢复").click()
    expect(page.locator("#overall-label")).to_have_text("1 / 896 条双向答对")
    context.set_offline(True)
    assert page.reload().from_service_worker
    assert page.evaluate("fetch('./offline-probe').then(() => false, () => true)")
    expect(page.locator("#overall-label")).to_have_text("1 / 896 条双向答对")
    page.get_by_role("button", name="搜索词条", exact=True).click()
    page.get_by_role("searchbox", name="搜索词条", exact=True).fill("nutrition")
    page.get_by_role("button", name=re.compile("^nutrition")).click()
    expect(page.locator("#word-1")).to_have_class(re.compile("highlighted"))
    expect(page.get_by_role("button", name="已完成预习", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^中译英默写")), "中译英默写")
    page.get_by_role("button", name="重练本组", exact=True).click()
    page.get_by_role("textbox", name="输入英文").fill("nutrition")
    page.reload()
    expect(page.get_by_role("textbox", name="输入英文")).to_have_value("nutrition")
    assert not errors, errors


def shuffle(context):
    page = context.new_page()
    page.goto(ROOT + "#shuffle/4/zh-en")
    expect(page.get_by_role("heading", name="乱序练习", exact=True)).to_be_visible()
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.get_by_label("出题范围").select_option("4")
    page.get_by_label("题数").select_option("10")
    page.get_by_role("button", name="开始练习", exact=True).click()
    expect(page.get_by_role("heading", name="中译英乱序练习", exact=True)).to_be_visible()
    answer = page.get_by_role("textbox", name="输入英文")
    first_id = answer.get_attribute("data-id")
    answer.fill("wrong shuffle answer")
    page.get_by_role("button", name="下一题", exact=True).click()
    expect(page.get_by_text("第 2 / 10 题", exact=True)).to_be_visible()
    second_id = answer.get_attribute("data-id")
    assert first_id != second_id
    page.reload()
    expect(answer).to_have_attribute("data-id", second_id)
    page.get_by_role("button", name="上一题", exact=True).click()
    expect(answer).to_have_attribute("data-id", first_id)
    expect(answer).to_have_value("wrong shuffle answer")

    open_page(page, page.get_by_role("link", name="返回乱序练习", exact=True), "乱序练习")
    page.get_by_label("出题范围").select_option("4")
    page.get_by_role("button", name="开始练习", exact=True).click()
    expect(page.get_by_role("dialog", name="开始新一轮")).to_be_visible()
    page.get_by_role("button", name="取消", exact=True).click()
    open_page(page, page.get_by_role("link", name="继续答题", exact=True), "中译英乱序练习")
    expect(answer).to_have_value("wrong shuffle answer")
    context.set_offline(True)
    assert page.reload().from_service_worker
    expect(answer).to_have_value("wrong shuffle answer")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    expect(page.get_by_text("9 未作答", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^错题本")), "错题本")
    expect(page.get_by_text("wrong shuffle answer", exact=True)).to_be_visible()
    expect(page.locator(".result-row").get_by_role("link", name=re.compile(r"第 (49|5\d|6[0-4]) 单元"))).to_be_visible()

    open_page(page, page.get_by_role("link", name="乱序练习", exact=True), "乱序练习")
    open_page(page, page.get_by_role("link", name="查看结果", exact=True), "中译英乱序练习")
    page.get_by_role("button", name="重新抽题", exact=True).click()
    expect(page.get_by_text("第 1 / 10 题", exact=True)).to_be_visible()
    expect(answer).to_have_value("")
    open_page(page, page.get_by_role("link", name="返回乱序练习", exact=True), "乱序练习")
    page.get_by_label("答题方向").select_option("en-zh")
    page.get_by_role("button", name="开始练习", exact=True).click()
    expect(page.get_by_role("heading", name="英译汉乱序练习", exact=True)).to_be_visible()
    expect(page.get_by_text("第 1 / 20 题", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name=re.compile("^朗读 "))).to_be_visible()
    choices = page.get_by_role("radio")
    expect(choices).to_have_count(4)
    asked = choices.first.get_attribute("data-id")
    choices.locator("xpath=self::input[@value!='" + asked + "']").first.check()
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^错题本")), "错题本")
    open_page(page, page.get_by_role("button", name="英译汉复测 (1)", exact=True), "英译汉选择题")
    page.locator(f'input[name="word-choice"][value="{asked}"]').check()
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    page.close()


def dictation(context, screenshots=None):
    page = context.new_page()
    page.add_init_script("""
        const BrowserAudio = window.Audio;
        window.playedClips = [];
        window.Audio = class extends BrowserAudio {
            constructor(url) {
                super(url);
                this.addEventListener('playing', () => window.playedClips.push(this.src));
            }
        };
    """)
    bank = json.loads((Path(__file__).resolve().parents[1] / "site/bank.json").read_text(encoding="utf-8"))
    page.goto(ROOT + "#settings")
    expect(page.locator("#voice-source")).to_contain_text("Jamie")
    open_page(page, page.get_by_role("link", name="听写", exact=True), "听写")
    if screenshots:
        page.screenshot(path=screenshots / "cet6-dictation-setup.png")
    page.get_by_label("出题范围").select_option("2")
    page.get_by_label("题数").select_option("10")
    page.get_by_role("button", name="开始听写").click()
    expect(page.get_by_role("heading", name="单词听写", exact=True)).to_be_visible()
    prompt = page.locator(".question")
    expect(prompt).to_have_text("播放发音")
    answer = page.get_by_role("textbox", name="输入英文")
    first_id = answer.get_attribute("data-id")
    second_chapter = {str(id_) for unit in bank["chapters"][1]["units"] for block in unit["blocks"] for id_ in block["ids"]}
    assert first_id in second_chapter
    expect(prompt.get_by_text(bank["words"][first_id]["en"], exact=True)).to_have_count(0)
    play = page.get_by_role("button", name="播放发音", exact=True)
    play.click()
    page.wait_for_function("(id) => window.playedClips[0]?.includes(`/audio/en-US/${id}-`)", arg=first_id)
    play.click()
    page.wait_for_function("window.playedClips.length === 2")
    if screenshots:
        page.screenshot(path=screenshots / "cet6-dictation-answer.png")
    answer.fill("wrong dictation answer")
    page.reload()
    expect(answer).to_have_attribute("data-id", first_id)
    expect(answer).to_have_value("wrong dictation answer")
    page.get_by_role("button", name="下一题", exact=True).click()
    second_id = answer.get_attribute("data-id")
    assert second_id in second_chapter and second_id != first_id
    answer.fill(f"  {bank['words'][second_id]['en'].upper()} ")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    expect(page.get_by_text("8 未作答", exact=True)).to_be_visible()
    expect(page.locator(".result-word").first.get_by_text(bank["words"][first_id]["en"], exact=True)).to_be_visible()

    open_page(page, page.get_by_role("link", name=re.compile("^错题本")), "错题本")
    page.get_by_label("方向").select_option("dictation")
    expect(page.get_by_text("wrong dictation answer", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("button", name="听写复测 (1)", exact=True), "听写复测")
    expect(prompt).to_have_text("播放发音")
    expect(answer).to_have_attribute("data-id", first_id)
    spelling = bank["words"][first_id]["en"]
    answer.fill(spelling[:2] + " " + spelling[2:])
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name="返回错题本", exact=True), "错题本")
    expect(page.get_by_text("0 道待复测", exact=True)).to_be_visible()
    page.close()


def device_layout(browser, screenshots):
    for width, height in [(820, 1180), (1180, 820), (390, 844), (320, 640)]:
        page = browser.new_page(viewport={"width": width, "height": height}, has_touch=True)
        page.goto(ROOT)
        expect(page.get_by_role("heading", name="单元目录", exact=True)).to_be_visible()
        no_overflow(page)
        page.wait_for_function("document.querySelector('.book-front img')?.naturalWidth > 0")
        assert page.locator(".book-front img").evaluate("(img) => img.complete && img.naturalWidth > 0")
        assert page.evaluate("document.fonts.ready.then(() => document.fonts.check('16px lucide'))")
        assert page.locator(".unit-card").first.bounding_box()["y"] < height
        if screenshots and width in (820, 390):
            page.screenshot(path=screenshots / f"cet6-{width}.png")
        page.goto(ROOT + "#unit/64")
        expect(page.locator(".word-row")).to_have_count(14)
        no_overflow(page)
        page.goto(ROOT + "#unit/64/en-zh")
        expect(page.get_by_role("radio")).to_have_count(4)
        no_overflow(page)
        open_page(page, page.get_by_role("link", name="乱序练习", exact=True), "乱序练习")
        no_overflow(page)
        if screenshots and width in (820, 390):
            page.screenshot(path=screenshots / f"cet6-shuffle-{width}.png")
        open_page(page, page.get_by_role("link", name="听写", exact=True), "听写")
        page.get_by_role("button", name="开始听写", exact=True).click()
        expect(page.get_by_role("button", name="播放发音", exact=True)).to_be_visible()
        no_overflow(page)
        page.close()


def reading(context, screenshots=None):
    page = context.new_page()
    page.goto(ROOT + "#reading")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.reload()
    article = page.locator(".reading-article")
    expect(article.locator("h2")).to_be_visible()
    date = article.locator("time").get_attribute("datetime")
    passage = page.request.get(f"{ROOT}readings/{date}.json").json()
    english = article.locator('.reading-body p[lang="en"]')
    translations = article.locator('.reading-body p[lang="en"] + p[lang="zh-CN"]')
    expect(english).to_have_text(passage["paragraphs"])
    expect(translations).to_have_text(passage["translations"])
    expect(article.locator("mark")).to_have_count(0)
    page.get_by_role("checkbox", name="高亮词库词汇").check()
    expect(article.locator("mark").first).to_be_visible()
    expect(translations).to_have_text(passage["translations"])
    page.get_by_text("本篇词汇 · 100 个词条", exact=True).click()
    expect(page.locator(".reading-glossary dt")).to_have_count(100)
    page.get_by_label("往期阅读").select_option(date)
    expect(article.locator("time")).to_have_text(date)
    assert page.url.endswith(f"#reading/{date}")
    no_overflow(page)
    if screenshots:
        page.screenshot(path=screenshots / "cet6-reading.png")
    context.set_offline(True)
    assert page.reload().from_service_worker
    expect(article.locator("time")).to_have_text(date)
    expect(translations).to_have_text(passage["translations"])
    page.close()


def exam_practice(context, screenshots=None, check_offline=True):
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ROOT + "#exams")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.get_by_role("link", name=re.compile("2023 年 6 月第 1 套")).click()
    radios = page.get_by_role("radio")
    expect(radios).to_have_count(4)
    expect(page.get_by_text("It was warm and comfortable.", exact=True)).to_be_visible()

    def jump(number):
        page.locator(".exam-practice-overview summary").click()
        page.get_by_role("button", name=f"第 {number} 题", exact=True).click()
        expect(page.get_by_role("heading", name=f"第 {number} 题", exact=True)).to_be_visible()

    radios.nth(1).tap()
    expect(radios.nth(1)).to_be_checked()
    page.get_by_role("button", name="下一题", exact=True).click()
    radios.nth(0).tap()
    page.get_by_role("button", name="选词填空", exact=True).click()
    expect(radios).to_have_count(15)
    expect(page.get_by_role("button", name="第 26 空", exact=True)).to_be_visible()
    radios.nth(13).tap()
    page.get_by_role("button", name="段落匹配", exact=True).click()
    expect(radios).to_have_count(13)
    page.get_by_role("radio", name="段落 C", exact=True).tap()
    page.get_by_role("button", name="仔细阅读", exact=True).click()
    material = page.locator(".exam-practice-material")
    expect(material).to_contain_text("Technology is never a neutral tool")
    expect(page.get_by_text("It is reshaping humanity.", exact=True)).to_be_visible()
    radios.nth(3).tap()
    no_overflow(page)
    if screenshots:
        page.screenshot(path=screenshots / f"cet6-web-exam-{page.viewport_size['width']}.png")
    jump(51)
    expect(material).to_contain_text("Phonics")
    expect(radios).to_have_count(4)
    page.get_by_role("button", name="写作", exact=True).click()
    writing = page.get_by_role("textbox", name="写作草稿")
    writing.fill("My written practice.")
    page.get_by_role("button", name="翻译", exact=True).click()
    translation = page.get_by_role("textbox", name="翻译草稿")
    translation.fill("My translation practice.")
    page.reload()
    expect(translation).to_have_value("My translation practice.")
    page.get_by_role("link", name="试卷原页", exact=True).click()
    expect(page.get_by_role("combobox", name="第 1 题", exact=True)).to_have_value("B")
    page.get_by_label("题型", exact=True).select_option("2")
    expect(page.get_by_role("combobox", name="第 36 题", exact=True).locator("option")).to_have_count(14)
    expect(page.get_by_role("combobox", name="第 36 题", exact=True)).to_have_value("C")
    page.get_by_label("题型", exact=True).select_option("4")
    expect(page.get_by_label("写作", exact=True)).to_have_value("My written practice.")
    page.get_by_role("link", name="网页答题", exact=True).click()
    expect(translation).to_have_value("My translation practice.")
    expect(page.get_by_text("已作答 5 / 55 题")).to_be_visible()
    page.get_by_role("button", name="交卷核对", exact=True).click()
    page.get_by_role("button", name="确认交卷", exact=True).click()
    expect(page.get_by_text("4 答对", exact=True)).to_be_visible()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    expect(page.get_by_text("50 未作答", exact=True)).to_be_visible()
    jump(2)
    expect(page.get_by_text("正确答案 B", exact=True)).to_be_visible()
    expect(radios.nth(0)).to_be_disabled()
    if check_offline:
        context.set_offline(True)
        assert page.reload().from_service_worker
        expect(page.get_by_text("4 答对", exact=True)).to_be_visible()
        expect(page.get_by_text("正确答案 B", exact=True)).to_be_visible()
    page.get_by_role("button", name="重做本套", exact=True).click()
    page.get_by_role("button", name="确认重做", exact=True).click()
    expect(page.get_by_role("heading", name="第 1 题", exact=True)).to_be_visible()
    expect(page.get_by_text("已作答 0 / 55 题")).to_be_visible()
    assert not errors, errors
    page.close()


def exams(context, pdf_path=None, screenshots=None):
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ROOT + "#exams")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    expect(page.locator(".exam-list-row")).to_have_count(18)
    page.get_by_role("link", name=re.compile("2023 年 6 月第 1 套")).click()
    expect(page.get_by_role("heading", name="2023 年 6 月第 1 套")).to_be_visible()
    page.get_by_role("link", name="试卷原页", exact=True).click()
    expect(page.get_by_role("combobox", name="第 1 题", exact=True).locator("option")).to_have_count(5)
    page.get_by_label("第 1 题", exact=True).select_option("B")
    page.get_by_label("第 2 题", exact=True).select_option("A")
    expect(page.get_by_text("已作答 2 / 55 题")).to_be_visible()
    page.get_by_label("题型", exact=True).select_option("1")
    expect(page.get_by_label("第 26 题", exact=True).locator("option")).to_have_count(16)
    page.get_by_label("第 26 题", exact=True).select_option("N")
    page.get_by_label("题型", exact=True).select_option("4")
    page.get_by_label("写作", exact=True).fill("My written practice.")

    pdf = page.locator("#exam-file")
    pdf.set_input_files({"name": "wrong.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-wrong"})
    expect(page.get_by_text(re.compile("请选择《集训刷题卷"))).to_be_visible()
    canvas = page.locator(".exam-scan canvas")
    if pdf_path:
        pdf.set_input_files(pdf_path)
        expect(page.get_by_text("试卷已保存在本机", exact=True)).to_be_visible(timeout=45000)
        expect(canvas).to_have_attribute("aria-label", "试卷第 1 页", timeout=45000)
        assert canvas.evaluate("""
            c => {
                const {data} = c.getContext('2d').getImageData(0, 0, c.width, c.height);
                for (let i = 0; i < data.length; i += 36) {
                    if (data[i] < 100 && data[i + 3] > 0) return true;
                }
                return false;
            }
        """)
        page.get_by_role("button", name="放大试卷").click()
        page.wait_for_function("document.querySelector('.exam-scan').scrollWidth > document.querySelector('.exam-scan').clientWidth")
        page.get_by_role("button", name="适应宽度").click()
        page.get_by_label("卷内页码").select_option("9")
        expect(canvas).to_have_attribute("aria-label", "试卷第 7 页")
        masked_height = int(canvas.get_attribute("height"))
        if screenshots:
            page.locator(".exam-document").scroll_into_view_if_needed()
            page.screenshot(path=screenshots / f"cet6-exam-{page.viewport_size['width']}.png")
    no_overflow(page)
    page.reload()
    expect(page.get_by_label("第 1 题", exact=True)).to_have_value("B")
    if pdf_path:
        expect(canvas).to_have_attribute("aria-label", "试卷第 7 页", timeout=45000)
    page.get_by_label("题型", exact=True).select_option("4")
    expect(page.get_by_label("写作", exact=True)).to_have_value("My written practice.")
    page.get_by_label("题型", exact=True).select_option("0")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    page.get_by_role("button", name="确认交卷", exact=True).click()
    expect(page.get_by_text("2 答对", exact=True)).to_be_visible()
    expect(page.get_by_text("1 答错", exact=True)).to_be_visible()
    expect(page.get_by_text("52 未作答", exact=True)).to_be_visible()
    page.get_by_role("checkbox", name="错题和漏题").check()
    expect(page.locator(".exam-answer-row")).to_have_count(24)
    if pdf_path:
        page.wait_for_function(f"document.querySelector('.exam-scan canvas').height > {masked_height}")
    context.set_offline(True)
    assert page.reload().from_service_worker
    expect(page.get_by_text("2 答对", exact=True)).to_be_visible()
    if pdf_path:
        expect(canvas).to_have_attribute("aria-label", "试卷第 7 页", timeout=45000)
    page.get_by_role("button", name="重做本套", exact=True).click()
    page.get_by_role("button", name="确认重做", exact=True).click()
    expect(page.get_by_label("第 1 题", exact=True)).to_have_value("")
    assert not errors, errors
    page.close()


def exam_topics(context, screenshots=None, scan_path=None, check_offline=True):
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ROOT + "#topics")
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    rows = page.locator(".exam-list-row")
    expect(rows).to_have_count(14)
    topics = page.get_by_role("navigation", name="专题题型")
    topics.get_by_role("link", name="段落匹配", exact=True).click()
    expect(rows).to_have_count(18)
    no_overflow(page)
    third = "2025 年 12 月第 3 套"
    rows.filter(has_text=third).click()
    expect(page.get_by_role("heading", name="第 36 题", exact=True)).to_be_visible()
    expect(page.get_by_role("radio")).to_have_count(18)
    page.get_by_role("radio", name="段落 Q", exact=True).tap()
    page.reload()
    expect(page.get_by_role("radio", name="段落 Q", exact=True)).to_be_checked()
    page.get_by_role("button", name="核对本题型", exact=True).click()
    page.get_by_role("button", name="确认交卷", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    expect(page.get_by_text("9 未作答", exact=True)).to_be_visible()
    page.get_by_role("link", name="整套试卷", exact=True).click()
    expect(page.get_by_role("heading", name="第 26 题", exact=True)).to_be_visible()
    expect(page.get_by_text("已作答 0 / 30 题")).to_be_visible()
    expect(page.get_by_role("button", name="听力", exact=True)).to_have_count(0)
    page.get_by_role("button", name="仔细阅读", exact=True).click()
    page.get_by_role("button", name="解析", exact=True).click()
    expect(page.get_by_role("dialog", name="仔细阅读 · 第 1 篇解析")).to_be_visible()
    image = page.locator(".exam-explanation-image")
    expect(image).to_have_attribute("src", "./exam-explanations/2025-12/43.webp")
    page.wait_for_function("document.querySelector('.exam-explanation-image').naturalWidth >= 1600")
    page.get_by_role("button", name="放大解析", exact=True).click()
    page.wait_for_function("document.querySelector('.exam-explanation-frame').scrollWidth > document.querySelector('.exam-explanation-frame').clientWidth")
    page.get_by_role("button", name="适应宽度", exact=True).click()
    page.get_by_role("button", name="下一页解析", exact=True).click()
    expect(image).to_have_attribute("src", "./exam-explanations/2025-12/44.webp")
    page.get_by_role("button", name="关闭", exact=True).click()
    page.locator(".exam-practice-overview summary").click()
    page.get_by_role("button", name="第 51 题", exact=True).click()
    page.get_by_role("button", name="解析", exact=True).click()
    expect(page.get_by_role("dialog", name="仔细阅读 · 第 2 篇解析")).to_be_visible()
    expect(image).to_have_attribute("src", "./exam-explanations/2025-12/45.webp")
    expect(image).to_be_visible()
    assert image.evaluate("img => img.naturalWidth >= 1600 && parseFloat(img.style.top) < 0")
    no_overflow(page)
    if screenshots:
        page.screenshot(path=screenshots / f"cet6-explanation-{page.viewport_size['width']}.png")
    page.get_by_role("button", name="关闭", exact=True).click()
    if scan_path:
        page.get_by_role("link", name="试卷原页", exact=True).click()
        page.locator("#exam-file").set_input_files(scan_path)
        expect(page.get_by_text("试卷已保存在本机", exact=True)).to_be_visible(timeout=45000)
        expect(page.locator(".exam-scan canvas")).to_have_attribute("aria-label", "试卷第 1 页", timeout=45000)
        page.get_by_role("link", name="网页答题", exact=True).click()
    if check_offline:
        context.set_offline(True)
        assert page.reload().from_service_worker
        expect(page.get_by_role("heading", name="第 51 题", exact=True)).to_be_visible()
        page.get_by_role("button", name="解析", exact=True).click()
        page.wait_for_function("document.querySelector('.exam-explanation-image').naturalWidth >= 1600")
    assert not errors, errors
    page.close()


def exam_listening(context):
    page = context.new_page()
    page.goto(ROOT + "#exams/2023-06-1")
    player = page.get_by_label("听力音频播放器", exact=True)
    expect(player).to_be_visible()
    expect(player).to_have_attribute("preload", "none")
    expect(player).to_have_attribute("src", re.compile(r"/2023-06/01/listen\.m4a$"))
    expect(page.get_by_role("link", name="音频来源")).to_have_attribute("href", re.compile(r"/2023-06/01/meta\.json$"))
    page.get_by_role("button", name="下一题", exact=True).click()
    expect(player).to_be_visible()
    page.get_by_role("button", name="选词填空", exact=True).click()
    expect(player).to_be_hidden()
    page.get_by_role("link", name="试卷原页", exact=True).click()
    expect(player).to_be_visible()
    expect(player).to_have_attribute("src", re.compile(r"/2023-06/01/listen\.m4a$"))
    page.get_by_role("link", name="专题练习", exact=True).click()
    page.locator('a[href="#topics/listening/2024-06-1"]').click()
    expect(player).to_have_attribute("src", re.compile(r"/2024-06/02/listen\.m4a$"))
    no_overflow(page)
    page.get_by_label("选择本地音频", exact=True).set_input_files(
        {"name": "local.mp3", "mimeType": "audio/mpeg", "buffer": b"ID3"}
    )
    expect(player).to_have_attribute("src", re.compile(r"^blob:"))
    page.get_by_role("button", name="切换到在线音频", exact=True).click()
    expect(player).to_have_attribute("src", re.compile(r"/2024-06/02/listen\.m4a$"))
    page.goto(ROOT + "#exams/2025-12-3/scan")
    expect(player).to_have_count(0)
    page.close()


if __name__ == "__main__":
    screenshots = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    pdf = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    recent_pdf = Path(sys.argv[3]) if len(sys.argv) > 3 else None
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        study(browser.new_context(viewport={"width": 1440, "height": 960}), screenshots)
        shuffle(browser.new_context(viewport={"width": 820, "height": 1180}))
        dictation(browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True), screenshots)
        reading(browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True), screenshots)
        exam_practice(browser.new_context(viewport={"width": 820, "height": 1180}, has_touch=True), screenshots)
        exams(browser.new_context(viewport={"width": 820, "height": 1180}, has_touch=True), pdf, screenshots)
        exam_topics(browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True), screenshots, recent_pdf)
        exam_listening(browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True))
        device_layout(browser, screenshots)
        browser.close()
        webkit = playwright.webkit.launch()
        exam_topics(webkit.new_context(viewport={"width": 820, "height": 1180}, has_touch=True), screenshots, check_offline=False)
        exam_listening(webkit.new_context(viewport={"width": 820, "height": 1180}, has_touch=True))
        webkit.close()
    print("Verified vocabulary choices, handwritten spacing, dictation, exams, daily reading, backup and offline use.")
