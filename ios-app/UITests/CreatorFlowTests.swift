import XCTest

final class CreatorFlowTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // 故意使用不可连接的地址：创作和草稿必须能离线使用。
        app.launchEnvironment["YIZHANG_UI_TEST_SERVER"] = "http://127.0.0.1:1"
        app.launch()
    }
    private func openEditor() {
        let cover = app.buttons["creator.open"]
        XCTAssertTrue(cover.waitForExistence(timeout: 10))
        XCTAssertTrue(cover.isHittable)
        cover.tap()
        XCTAssertTrue(app.buttons["creator.back"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["保存草稿"].exists)
    }
    private func reveal(_ element: XCUIElement) {
        for _ in 0..<5 {
            if element.exists && element.isHittable { return }
            app.swipeUp()
        }
        XCTAssertTrue(element.exists && element.isHittable)
    }
    func testOfflineCoverCanOpenAndReturn() {
        openEditor()
        app.buttons["creator.back"].tap()
        XCTAssertTrue(app.buttons["creator.open"].waitForExistence(timeout: 3))
        openEditor()
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "创作入口已打开"; shot.lifetime = .keepAlways; add(shot)
    }
    func testEditorToolsAndDraftPersistence() {
        openEditor()
        let words = app.buttons["文字"]
        reveal(words); words.tap()
        let message = app.textViews["creator.message"]
        reveal(message); message.tap(); message.typeText("今天的晚霞，想和你一起看。")
        app.swipeDown()
        let save = app.buttons["保存草稿"]
        for _ in 0..<5 { if save.isHittable { break }; app.swipeDown() }
        save.tap()
        app.terminate(); app.launch(); openEditor()
        reveal(app.buttons["文字"]); app.buttons["文字"].tap()
        reveal(message)
        XCTAssertTrue((message.value as? String ?? "").contains("今天的晚霞"))
        for name in ["手写", "声音", "邮戳", "风格"] {
            let tool = app.buttons[name]; reveal(tool); tool.tap()
        }
        XCTAssertTrue(app.buttons["生成我的明信片"].exists || app.buttons["按所选画风重新生成"].exists)
    }
    func testGalleryAndProfileNavigation() {
        app.tabBars.buttons["展览馆"].tap()
        XCTAssertTrue(app.navigationBars["展览馆"].waitForExistence(timeout: 5))
        app.tabBars.buttons["我的"].tap()
        reveal(app.buttons["连接设置"])
        app.buttons["连接设置"].tap()
        XCTAssertTrue(app.buttons["保存并连接"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
        for _ in 0..<4 { if app.buttons["我的草稿"].isHittable { break }; app.swipeDown() }
        app.buttons["我的草稿"].tap()
        XCTAssertTrue(app.navigationBars["我的草稿"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["新建明信片"].exists)
    }
}
