"""Run against the local site: python tests/browser_smoke.py [screenshot-directory]."""

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
        page.close()


if __name__ == "__main__":
    screenshots = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        study(browser.new_context(viewport={"width": 1440, "height": 960}), screenshots)
        device_layout(browser, screenshots)
        browser.close()
    print("Verified study, independent directions, retest, backup, offline reload and four touch viewport sizes.")
