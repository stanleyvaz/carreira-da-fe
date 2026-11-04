import XCTest

final class FlowTests: XCTestCase {
    func testFullFlow() throws {
        continueAfterFailure = false
        addUIInterruptionMonitor(withDescription: "Salvar senha") { alert in
            for t in ["Agora Não", "Não Salvar", "Not Now"] where alert.buttons[t].exists { alert.buttons[t].tap(); return true }
            return false
        }
        let app = XCUIApplication(); app.launchEnvironment["JORNADA_RESET"] = "1"; app.launch()
        let wait: (XCUIElement, TimeInterval) -> Void = { el, t in
            if !el.waitForExistence(timeout: t) {
                try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/jornada-uitest-fail.png"))
            }
            XCTAssertTrue(el.exists, "não apareceu: \(el)")
        }

        // Cadastro
        wait(app.buttons["Ainda não tenho conta"], 10); app.buttons["Ainda não tenho conta"].tap()
        let email = app.textFields["E-mail"]; wait(email, 5); email.tap(); email.typeText("ui\(Int(Date().timeIntervalSince1970))@teste.org")
        let pw = app.secureTextFields.firstMatch; wait(pw, 5); pw.tap(); sleep(1); for ch in "senha-segura-123" { pw.typeText(String(ch)) }
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Li e aceito'")).firstMatch.tap()
        app.buttons["Criar conta"].tap()

        // Primeiro passo: escolher o companheiro (leão)
        let confirm = app.buttons["companion.confirm"]; wait(confirm, 15)
        for _ in 0..<3 { // o aviso "Salvar Senha?" pode consumir o 1º toque
            for t in ["Agora Não", "Not Now"] where app.buttons[t].waitForExistence(timeout: 1) { app.buttons[t].tap() }
            app.buttons["companion.lion"].tap()
            if app.buttons["Caminhar com o leão"].waitForExistence(timeout: 3) { break }
        }
        if !app.buttons["Caminhar com o leão"].exists { try? app.debugDescription.write(toFile: "/tmp/jornada-uitest-tree.txt", atomically: true, encoding: .utf8) }
        XCTAssertTrue(app.buttons["Caminhar com o leão"].exists, "botão com o nome do leão")
        for _ in 0..<3 { // o aviso nativo "Salvar Senha?" pode consumir o 1º toque
            confirm.tap()
            if app.buttons["Começar"].waitForExistence(timeout: 6) { break }
        }

        // Onboarding
        wait(app.buttons["Começar"], 15)
        XCTAssertTrue(app.staticTexts["Leão"].exists, "companheiro escolhido aparece no onboarding")
        app.buttons["Perdão"].tap()
        for _ in 0..<3 { // o aviso nativo "Salvar Senha?" pode consumir o 1º toque
            if app.buttons["Começar"].exists { app.buttons["Começar"].tap() }
            if app.buttons["Concluir reflexão"].waitForExistence(timeout: 6) { break }
        }

        let tab: (String) -> Void = { name in
            app.swipeDown(); app.swipeDown()
            // Barra de abas minimizada (iOS 26+): um toque no botão recolhido a expande
            if !app.tabBars.buttons[name].exists, app.tabBars.buttons.firstMatch.exists { app.tabBars.buttons.firstMatch.tap(); sleep(1) }
            let t = app.tabBars.buttons[name].exists ? app.tabBars.buttons[name] : app.buttons[name]
            if !t.waitForExistence(timeout: 5) {
                try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/jornada-uitest-fail.png"))
                try? app.debugDescription.write(toFile: "/tmp/jornada-uitest-tree.txt", atomically: true, encoding: .utf8)
            }
            XCTAssertTrue(t.exists, "aba \(name)"); t.tap()
        }
        // Hoje: o leão está no cenário
        wait(app.buttons["Fazer carinho no leão"], 15)
        // Hoje: concluir reflexão
        let concluir = app.buttons["Concluir reflexão"]; wait(concluir, 15)
        app.swipeUp(); sleep(2); concluir.tap()
        let feito = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Reflexão concluída'")).firstMatch
        if !feito.waitForExistence(timeout: 4) { concluir.tap() } // o 1º toque pode ser consumido pelo aviso "Salvar Senha?"
        wait(feito, 10)

        // Aprender → jornada → etapa
        tab("Aprender")
        let card = app.buttons.containing(NSPredicate(format: "label CONTAINS 'Perdão: soltar'")).firstMatch; wait(card, 10); card.tap()
        let comecar = app.buttons["Começar"]; wait(comecar, 10); comecar.tap()
        let opt = app.buttons.matching(NSPredicate(format: "label CONTAINS 'setenta vezes sete'")).firstMatch
        app.swipeUp(); wait(opt, 10); opt.tap()
        let fim = app.buttons["Concluir etapa"]; wait(fim, 5); fim.tap()
        wait(app.staticTexts["Etapa concluída. Não há nota — apenas aprendizado."], 10)

        // Exercitar e Minha jornada
        tab("Exercitar")
        wait(app.buttons["Marcar como feito"].firstMatch, 10); app.buttons["Marcar como feito"].firstMatch.tap()
        tab("Minha jornada")
        wait(app.staticTexts["Marcos"], 10)
    }
}
