import SwiftUI

// MARK: - Estatísticas de uso (opt-in, anônimas)
/// Mede o tempo em cada área do app e envia em lote. Só funciona se a pessoa autorizou em "Conta e privacidade".
/// O servidor guarda apenas somas por dia e área, sem identificar quem enviou.
@MainActor final class Usage: ObservableObject {
    static let shared = Usage()
    @Published private(set) var consent: Bool = UserDefaults.standard.bool(forKey: "usageConsent")
    private var area: String?
    /// Área da aba atual (para onde voltar ao fechar uma folha como o Perfil).
    var tabArea = "hoje"
    private var since = Date()
    private var buffer: [Item] = []
    private weak var api: API?
    struct Item: Encodable { let area: String; let seconds: Double }

    func refreshConsent(_ api: API) async {
        self.api = api
        struct C: Decodable { let aggregateAnalytics: Bool }
        if let c: C = try? await api.get("/api/me/consents") { setLocal(c.aggregateAnalytics) }
    }
    func setConsent(_ on: Bool, api: API) async throws {
        struct B: Encodable { let aggregateAnalytics: Bool }
        try await api.send("PUT", "/api/me/consents", B(aggregateAnalytics: on), as: Empty.self)
        setLocal(on)
        if !on { buffer.removeAll() }
    }
    private func setLocal(_ on: Bool) { consent = on; UserDefaults.standard.set(on, forKey: "usageConsent") }

    /// Entra numa área (fecha a anterior).
    func enter(_ new: String?) {
        close()
        area = new; since = Date()
    }
    /// Fecha a área atual (ex.: app foi para segundo plano) e envia o que estiver acumulado.
    func pause() { close(); area = nil; flush() }
    func resume(_ a: String) { if area == nil { area = a; since = Date() } }

    private func close() {
        guard let a = area else { return }
        let s = Date().timeIntervalSince(since)
        if consent, s >= 1 { buffer.append(Item(area: a, seconds: min(s, 3600))) }
        if buffer.count >= 10 { flush() }
    }
    func flush() {
        guard consent, !buffer.isEmpty, let api else { buffer.removeAll(); return }
        let items = buffer; buffer.removeAll()
        struct B: Encodable { let items: [Item] }
        Task { _ = try? await api.raw("POST", "/api/me/usage", body: B(items: items)) }
    }
}

extension View {
    /// Marca a tela como uma área do app para as estatísticas (volta para `parent` ao sair).
    func usageArea(_ area: String, parent: String? = nil) -> some View {
        self.onAppear { Usage.shared.enter(area) }.onDisappear { if let parent { Usage.shared.enter(parent == "tab" ? Usage.shared.tabArea : parent) } }
    }
}

// MARK: - Frases da ovelhinha (editáveis no CMS)
@MainActor final class Phrases {
    static let shared = Phrases()
    private var byCategory: [String: [String]] = (UserDefaults.standard.data(forKey: "companionPhrases"))
        .flatMap { try? JSONDecoder().decode([String: [String]].self, from: $0) } ?? [:]

    func refresh(_ api: API) async {
        guard let d: [String: [String]] = try? await api.get("/api/companion/phrases") else { return }
        byCategory = d
        if let data = try? JSONEncoder().encode(d) { UserDefaults.standard.set(data, forKey: "companionPhrases") }
    }
    /// Frase sorteada da categoria; se o CMS não tiver nenhuma habilitada, usa as padrão do app.
    func pick(_ category: String, name: String?, fallback: [String]) -> String {
        let list = byCategory[category].flatMap { $0.isEmpty ? nil : $0 } ?? fallback
        return fill(list.randomElement() ?? fallback.first ?? "Béé!", name: name)
    }
    private func fill(_ s: String, name: String?) -> String {
        let n = name?.trimmingCharacters(in: .whitespaces) ?? ""
        if n.isEmpty { return s.replacingOccurrences(of: ", {nome}", with: "").replacingOccurrences(of: " {nome}", with: "").replacingOccurrences(of: "{nome}", with: "") }
        return s.replacingOccurrences(of: "{nome}", with: n)
    }
}

// MARK: - Troca obrigatória da senha temporária (conta criada ou redefinida pelo suporte)
struct ForcedPasswordView: View {
    @EnvironmentObject var api: API
    @State private var current = ""; @State private var next = ""; @State private var again = ""
    @State private var error: String?; @State private var busy = false
    private var ok: Bool { !current.isEmpty && next.count >= 10 && next == again }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Você entrou com uma senha temporária. Escolha uma senha só sua para continuar.").font(.callout)
                }
                Section("Senhas") {
                    SecureField("Senha temporária", text: $current).textContentType(.password)
                    SecureField("Nova senha (mín. 10 caracteres)", text: $next).textContentType(.newPassword)
                    SecureField("Repita a nova senha", text: $again).textContentType(.newPassword)
                    if !again.isEmpty && next != again { Text("As senhas não conferem.").font(.footnote).foregroundStyle(.red) }
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
                Section {
                    Button { Task { await save() } } label: { HStack { Spacer(); if busy { ProgressView() } else { Text("Salvar e continuar").bold() }; Spacer() } }.disabled(!ok || busy)
                    Button("Sair", role: .destructive) { Task { await api.signOut() } }
                }
            }
            .navigationTitle("Crie sua senha")
        }
    }
    private func save() async {
        busy = true; error = nil
        struct B: Encodable { let currentPassword: String; let newPassword: String }
        do { try await api.send("POST", "/api/me/password", B(currentPassword: current, newPassword: next), as: Empty.self); await api.refreshProfile() }
        catch { self.error = error.localizedDescription }
        busy = false
    }
}
