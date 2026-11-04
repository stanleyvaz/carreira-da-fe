import XCTest

/// Quem já usava o app (onboarding feito, sem personagem) escolhe uma vez; depois troca pelo Perfil.
/// Requer a API de desenvolvimento em API_BASE_URL (padrão http://localhost:3000; rode com TEST_RUNNER_API_BASE_URL=... para outra porta).
final class CompanionTests: XCTestCase {
    private func api(_ method: String, _ path: String, _ body: [String: Any], token: String? = nil) throws -> [String: Any] {
        let base = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:3000"
        var r = URLRequest(url: URL(string: base + path)!); r.httpMethod = method
        r.setValue("application/json", forHTTPHeaderField: "content-type")
        if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "authorization") }
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let done = expectation(description: path); var out: [String: Any] = [:]
        URLSession.shared.dataTask(with: r) { d, _, _ in out = (d.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }) ?? [:]; done.fulfill() }.resume()
        wait(for: [done], timeout: 15)
        return out
    }

    func testChooseOnceThenChangeInProfile() throws {
        continueAfterFailure = false
        let email = "pet\(Int(Date().timeIntervalSince1970))@teste.org", pw = "senha-segura-123"
        let reg = try api("POST", "/api/auth/register", ["email": email, "password": pw, "displayName": "Pet", "acceptTerms": true])
        let token = try XCTUnwrap(reg["token"] as? String)
        _ = try api("PUT", "/api/me/preferences", ["topicSlugs": [], "mode": "read", "dailyMinutes": 3], token: token) // onboarding sem personagem

        let app = XCUIApplication()
        app.launchEnvironment["JORNADA_RESET"] = "1"
        app.launchEnvironment["JORNADA_DEBUG_LOGIN"] = "\(email):\(pw)"
        app.launch()

        // Escolhe a águia uma vez
        let confirm = app.buttons["companion.confirm"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 15), "tela de escolha para quem nunca escolheu")
        app.buttons["companion.eagle"].tap()
        XCTAssertTrue(app.buttons["Caminhar com a águia"].waitForExistence(timeout: 3))
        confirm.tap()
        XCTAssertTrue(app.buttons["Fazer carinho na águia"].waitForExistence(timeout: 15), "águia no cenário")

        // Troca pelo Perfil
        app.buttons["Menu do usuário"].tap()
        app.buttons["Perfil, foto e senha"].tap()
        let row = app.buttons["Companheiro: Águia. Trocar"]
        XCTAssertTrue(row.waitForExistence(timeout: 5)); row.tap()
        XCTAssertTrue(app.buttons["companion.donkey"].waitForExistence(timeout: 5)); app.buttons["companion.donkey"].tap()
        let choose = app.buttons["Escolher o jumentinho"]
        XCTAssertTrue(choose.waitForExistence(timeout: 3)); choose.tap()
        XCTAssertTrue(app.buttons["Companheiro: Jumentinho. Trocar"].waitForExistence(timeout: 10), "volta ao Perfil com o novo companheiro")
        app.buttons["Fechar"].tap()
        XCTAssertTrue(app.buttons["Fazer carinho no jumentinho"].waitForExistence(timeout: 10), "jumentinho no cenário")
    }
}
