import XCTest
final class LoginTests: XCTestCase {
    func testLogin() throws {
        let shot = "/private/tmp/claude-501/-Users-stanleyvaz-Documents-Claude-jornada/4ac99dad-c12d-4efa-b2ae-88f4d20e09c3/scratchpad/shots/login.png"
        let app = XCUIApplication(); app.launchEnvironment["JORNADA_RESET"] = "1"; app.launch()
        let email = app.textFields["E-mail"]; XCTAssertTrue(email.waitForExistence(timeout: 10))
        email.tap(); email.typeText("stanleyvaz@universal.org")
        let pw = app.secureTextFields.firstMatch; pw.tap(); sleep(1); pw.typeText("javb-q5wp-9wvw")
        print("PWVALUE=\(String(describing: pw.value))")
        try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: shot))
        app.buttons["Entrar"].tap(); sleep(4)
        try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: shot.replacingOccurrences(of: "login", with: "login2")))
        // Conta sem onboarding cai em "Vamos começar"; conta com onboarding cai nas abas.
        XCTAssertTrue(app.buttons["Começar"].waitForExistence(timeout: 8) || app.tabBars.firstMatch.exists || app.buttons["Hoje"].exists, "não logou")
    }
}
