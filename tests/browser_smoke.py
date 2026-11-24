"""Run against the local site: python tests/browser_smoke.py [screenshot-directory]."""

import json
from pathlib import Path
import re
import sys

from playwright.sync_api import expect, sync_playwright


ROOT = "http://127.0.0.1:8765/"


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
    open_page(page, page.get_by_role("link", name="英译中", exact=True), "英译中默写")
    page.get_by_role("textbox", name="输入中文").fill("养分")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 待自评", exact=True)).to_be_visible()
    page.get_by_role("button", name="判为对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name=re.compile("^错题本")), "错题本")
    expect(page.get_by_text("1 道待复测", exact=True)).to_be_visible()
    expect(page.locator(".result-row")).to_have_count(1)
    expect(page.get_by_text("nutriton", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("button", name="中译英复测 (1)", exact=True), "中译英默写")
    page.get_by_role("textbox", name="输入英文").fill("  NUTRITION  ")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 答对", exact=True)).to_be_visible()
    open_page(page, page.get_by_role("link", name="返回错题本", exact=True), "错题本")
    page.get_by_role("checkbox", name="含已掌握").check()
    expect(page.get_by_text("最近复测 答对 (NUTRITION)", exact=False)).to_be_visible()
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
    expect(page.get_by_role("heading", name="英译中乱序练习", exact=True)).to_be_visible()
    expect(page.get_by_text("第 1 / 20 题", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name=re.compile("^朗读 "))).to_be_visible()
    page.get_by_role("textbox", name="输入中文").fill("wrong shuffle answer")
    page.get_by_role("button", name="交卷核对", exact=True).click()
    expect(page.get_by_text("1 待自评", exact=True)).to_be_visible()
    page.get_by_role("button", name="判为对", exact=True).click()
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
    answer.fill(bank["words"][first_id]["en"])
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
        expect(page.get_by_role("textbox", name="输入中文")).to_be_visible()
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


if __name__ == "__main__":
    screenshots = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        study(browser.new_context(viewport={"width": 1440, "height": 960}), screenshots)
        shuffle(browser.new_context(viewport={"width": 820, "height": 1180}))
        dictation(browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True), screenshots)
        device_layout(browser, screenshots)
        browser.close()
    print("Verified study, shuffle, dictation audio, retest, backup, offline reload and four touch viewport sizes.")
