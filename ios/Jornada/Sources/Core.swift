import SwiftUI
import Security

// MARK: - Tema (HIG: cores semânticas do sistema; acento próprio adaptado a claro/escuro)
enum Theme {
    static let accent = Color(UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.86, green: 0.65, blue: 0.43, alpha: 1) : UIColor(red: 0.54, green: 0.35, blue: 0.17, alpha: 1) })
    static let reflections = Color(red: 0.96, green: 0.65, blue: 0.36)
    static let steps = Color(red: 0.31, green: 0.76, blue: 0.71)
    static let activities = Color(red: 0.73, green: 0.61, blue: 0.97)

    private static let palette: [String: (UInt32, UInt32)] = [
        "fe": (0xF2994A, 0xC0562B), "oracao": (0x6D7BD6, 0x3B3F8F), "perdao": (0x4FB3A9, 0x237A74), "familia": (0xE87AA0, 0xA7456F),
        "casamento": (0xD98AA8, 0x8F4A72), "relacionamentos": (0x58A6D8, 0x2C6896), "trabalho": (0x8FA86A, 0x52703A), "sabedoria": (0xC9A24A, 0x8A6A1F),
        "dominio-proprio": (0x7F8FA6, 0x46546A), "honestidade": (0x5FB28A, 0x2F7A57), "generosidade": (0xE8935A, 0xB0572B),
        "perseveranca": (0xA07AD6, 0x5F3F9A), "ensinamentos-de-jesus": (0xD4A059, 0x8F5E22), "personagens-biblicos": (0xB5875A, 0x6E4A2A),
    ]
    static func gradient(_ slug: String?) -> LinearGradient {
        let p = palette[slug ?? ""] ?? (0xC99A63, 0x7A5230)
        return LinearGradient(colors: [Color(hex: p.0), Color(hex: p.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}
extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}

// MARK: - Keychain
enum Keychain {
    private static let svc = "org.universal.jornada.session"
    static func get() -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: svc, kSecReturnData as String: true]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    static func set(_ token: String?) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: svc]
        SecItemDelete(base as CFDictionary)
        guard let token else { return }
        var add = base; add[kSecValueData as String] = Data(token.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}

// MARK: - API
struct APIError: LocalizedError { let message: String; var errorDescription: String? { message } }

@MainActor final class API: ObservableObject {
    @Published var token: String? = Keychain.get()
    @Published var user: User?
    @Published var prefs: Prefs?
    @Published var avatarVersion = 0
    private let base = URL(string: (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String) ?? "http://localhost:3000")!

    var isAuthed: Bool { token != nil }

    func raw(_ method: String, _ path: String, body: Encodable? = nil) async throws -> Data {
        var r = URLRequest(url: base.appendingPathComponent(path), timeoutInterval: 20)
        if path.contains("?") { r.url = URL(string: base.absoluteString + path) }
        r.httpMethod = method
        if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { r.setValue("application/json", forHTTPHeaderField: "Content-Type"); r.httpBody = try JSONEncoder().encode(AnyEncodable(body)) }
        let (data, resp): (Data, URLResponse)
        do { (data, resp) = try await URLSession.shared.data(for: r) }
        catch { throw APIError(message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.") }
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 && path != "/api/auth/login" { signOutLocally() }
        guard (200..<300).contains(code) else {
            struct E: Decodable { let error: String?; let code: String? }
            let e = try? JSONDecoder().decode(E.self, from: data)
            if code == 403, e?.code == "password_change_required" { user?.mustChangePassword = true }
            let msg = e?.error
            throw APIError(message: msg ?? "Algo deu errado. Tente novamente.")
        }
        return data
    }
    func get<T: Decodable>(_ path: String) async throws -> T { try JSONDecoder().decode(T.self, from: try await raw("GET", path)) }
    @discardableResult func send<T: Decodable>(_ method: String, _ path: String, _ body: Encodable? = nil, as: T.Type) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await raw(method, path, body: body))
    }
    /// Envia bytes (ex.: foto de perfil) e imagens autenticadas.
    func upload(_ method: String, _ path: String, data: Data, contentType: String) async throws {
        var r = URLRequest(url: URL(string: base.absoluteString + path)!, timeoutInterval: 30)
        r.httpMethod = method; r.httpBody = data; r.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (d, resp) = try await URLSession.shared.data(for: r)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else { struct E: Decodable { let error: String? }; throw APIError(message: (try? JSONDecoder().decode(E.self, from: d))?.error ?? "Não foi possível enviar.") }
    }
    func post(_ path: String, _ body: Encodable? = nil) async throws { _ = try await raw("POST", path, body: body) }

    func authenticate(register: Bool, email: String, password: String, name: String) async throws {
        struct Login: Encodable { let email, password: String }
        struct Reg: Encodable { let email, password: String; let displayName: String?; let acceptTerms = true }
        struct Tok: Decodable { let token: String }
        let t: Tok = register
            ? try await send("POST", "/api/auth/register", Reg(email: email, password: password, displayName: name.isEmpty ? nil : name), as: Tok.self)
            : try await send("POST", "/api/auth/login", Login(email: email, password: password), as: Tok.self)
        Keychain.set(t.token); token = t.token
        await refreshProfile()
    }
    func refreshProfile() async {
        user = try? await get("/api/me")
        if user?.mustChangePassword == true { return } // demais rotas ficam bloqueadas até trocar a senha temporária
        prefs = try? await get("/api/me/preferences"); avatarVersion += 1
        await Phrases.shared.refresh(self); await Usage.shared.refreshConsent(self)
    }
    func signOut() async { try? await post("/api/auth/logout"); signOutLocally() }
    func signOutLocally() { SharedStore.clear(); Keychain.set(nil); token = nil; user = nil; prefs = nil }
}
struct Empty: Decodable {}
struct AnyEncodable: Encodable { let v: Encodable; init(_ v: Encodable) { self.v = v }; func encode(to e: Encoder) throws { try v.encode(to: e) } }

// MARK: - Modelos
struct User: Decodable { let id: String; let email: String; let displayName: String?; let role: String; let hasAvatar: Bool?; var mustChangePassword: Bool? }
struct Prefs: Codable { var anchor: String?; var goal: String?; var topicSlugs: [String]; var mode: String; var dailyMinutes: Int; var reminderTime: String?; var onboarded: Bool }
struct Topic: Decodable, Identifiable, Hashable { let id: String; let slug: String; let name: String }
struct Passage: Decodable, Hashable { let id: String; let reference: String; let text: String?; let translation: String?; let bookmarked: Bool? }
struct Today: Decodable {
    let empty: Bool?; let id: String?; let title: String?; let body: String?; let application: String?; let question: String?
    let topicSlug: String?; let passage: Passage?; let done: Bool?
}
struct LockInfo: Decodable, Hashable { let locked: Bool; let reason: String?; let days: Int? }
struct JourneyItem: Decodable, Identifiable, Hashable {
    let id: String; let title: String; let summary: String?; let days: Int; let topicSlug: String; let topicName: String; let totalSteps: Int; let doneSteps: Int
    var kind: String? = nil
    var lock: LockInfo? = nil
    var isChallenge: Bool { kind == "challenge" }
}
/// Item promovido pelo editorial (no máximo um). `id == nil` quando não há destaque.
struct Featured: Decodable {
    let id: String?; let title: String?; let summary: String?; let days: Int?; let kind: String?; let topicSlug: String?; let topicName: String?
    let headline: String?; let totalSteps: Int?; let doneSteps: Int?; let lock: LockInfo?
}
/// Indicação externa publicada pelo editorial: só título/descrição e link para a fonte original.
struct Resource: Decodable, Identifiable {
    let id: String; let kind: String; let source: String; let title: String; let url: String; let blurb: String?; let audiences: [String]; let hasContent: Bool?; let imageId: String?
    var verb: String { switch kind { case "podcast_episode", "podcast_program": "Ouvir"; case "video": "Assistir"; case "site": "Visitar"; default: "Ler" } }
    var icon: String { switch kind { case "podcast_episode", "podcast_program": "headphones"; case "video": "play.rectangle"; default: "doc.text" } }
    /// Só abre links https do domínio universal.org (defesa contra dado inesperado).
    var safeURL: URL? { guard let u = URL(string: url), u.scheme == "https", let h = u.host, h == "universal.org" || h.hasSuffix(".universal.org") else { return nil }; return u }
}
let audienceOptions: [(slug: String, label: String)] = [("homens", "Homens"), ("mulheres", "Mulheres"), ("criancas", "Crianças"), ("jovens", "Jovens"), ("familia", "Família"), ("casais", "Casais")]
struct ResourceRoute: Hashable { let id: String }
/// Conteúdo da biblioteca guardado no nosso servidor (texto editável no CMS).
struct LibraryItem: Decodable {
    let id: String; let kind: String; let source: String; let title: String; let originalUrl: String; let blurb: String?; let body: String?
    let authorName: String?; let audioUrl: String?; let videoUrl: String?; let imageId: String?; let publishedOn: String?; let audiences: [String]
}
struct NotifSettings: Codable {
    var enabled: Bool; var readingReminder: Bool; var nudge: Bool; var newContent: Bool
    var reminderTime: String?; var quietStart: String; var quietEnd: String; var maxPerWeek: Int
}
struct InboxItem: Decodable, Identifiable { let id: String; let title: String; let body: String; let linkKind: String; let linkId: String?; let read: Bool }
struct NotifPayload: Decodable { let settings: NotifSettings; let inbox: [InboxItem] }
struct StepRef: Decodable, Identifiable, Hashable { let id: String; let position: Int; let title: String; let done: Bool }
struct JourneyDetail: Decodable { let id: String; let title: String; let summary: String?; let days: Int; let topicName: String; let topicSlug: String; let steps: [StepRef]; let pacing: Pacing? }
struct Question: Decodable, Identifiable { let id: String; let prompt: String; let options: [String] }
struct Song: Decodable, Identifiable { let id: String; let title: String; let lyrics: String; let credits: String? }
struct Pacing: Decodable { let locked: Bool; let reason: String? }
struct Step: Decodable {
    let id: String; let journeyId: String; let position: Int; let title: String; let context: String?; let explanation: String?
    let application: String?; let extra: String?; let passage: Passage?; let done: Bool?; let questions: [Question]; let songs: [Song]
    let totalSteps: Int; let nextStepId: String?; let pacing: Pacing?
}
struct Feedback: Decodable { let correct: Bool?; let correctIndex: Int?; let explanation: String?; let hint: String? }
struct Activity: Decodable, Identifiable { let id: String; let title: String; let invitation: String?; var done: Bool; var lock: LockInfo? = nil }
struct Week: Decodable { let reflections: Int; let steps: Int; let activities: Int }
struct Day: Decodable, Identifiable { let day: String; let dow: Int; let active: Bool; let today: Bool; var id: String { day } }
struct Milestone: Decodable, Identifiable { let label: String; let done: Bool; var id: String { label } }
struct WelcomeBack: Decodable { let daysAway: Int }
struct MyJourney: Decodable { let counts: Week; let week: Week; let goals: Week; let days: [Day]; let topicsStudied: [String]; let allMilestones: [Milestone]; let activeDays: Int?; let welcomeBack: WelcomeBack? }
/// "Primeiros 7 dias": jornada de entrada (1 minuto por dia). `id == nil` quando o editorial ainda não definiu.
struct Starter: Decodable { let id: String?; let title: String?; let totalSteps: Int?; let doneSteps: Int?; let complete: Bool?; let nextStepId: String?; let nextStepTitle: String?; let day: Int?; let lockedToday: Bool?; let pacingReason: String? }
/// Onde um versículo favorito aparece no conteúdo (etapa de jornada ou reflexão diária).
struct BookmarkSource: Decodable, Identifiable, Hashable { let kind: String; let id: String; let title: String; let journeyId: String?; let journeyTitle: String?; let position: Int?; var available: Bool? = nil }
struct Bookmark: Decodable, Identifiable, Hashable {
    let passageId: String; let reference: String; let text: String?
    var book: String? = nil; var createdAt: String? = nil; var sources: [BookmarkSource]? = nil
    var id: String { passageId }
}
struct Note: Decodable, Identifiable, Hashable {
    let id: String; let body: String; let updatedAt: String
    var createdAt: String? = nil; var refKind: String? = nil; var refId: String? = nil
    var refTitle: String? = nil; var stepPosition: Int? = nil; var journeyId: String? = nil; var journeyTitle: String? = nil; var passageRef: String? = nil
}
struct Bookmarked: Decodable { let bookmarked: Bool }

// Rotas de navegação
struct JourneyRoute: Hashable { let id: String }
struct StepRoute: Hashable { let id: String; let slug: String? }
/// Conteúdo citado por um favorito/anotação: abre se publicado; senão mostra o resumo.
struct SourceRoute: Hashable { let kind: String; let id: String; var title: String? = nil; var subtitle: String? = nil }
/// Telas da biblioteca pessoal. Navegação só por valor (misturar com links por destino causava loop).
enum LibraryRoute: Hashable { case favoritos, anotacoes, favorito(String), nota(String) }
struct ContentSource: Decodable {
    let kind: String; let id: String; let available: Bool; let title: String
    let position: Int?; let journeyId: String?; let journeyTitle: String?; let topicName: String?; let publishDate: String?
    let summary: String?; let body: String?; let application: String?; let question: String?
    let passageRef: String?; let passageText: String?
}
