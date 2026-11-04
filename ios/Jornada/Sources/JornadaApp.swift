import SwiftUI

@main struct JornadaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var api: API
    init() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["JORNADA_RESET"] != nil { Keychain.set(nil) } // testes de UI
        #endif
        _api = StateObject(wrappedValue: API())
    }
    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if UserDefaults.standard.bool(forKey: "debugCompanionGallery") { CompanionGallery() }
            else if let k = UserDefaults.standard.string(forKey: "debugCompanionScene").flatMap(CompanionKind.init(rawValue:)) { CompanionSceneDebug(kind: k) }
            else if UserDefaults.standard.bool(forKey: "debugCompanionPicker") { CompanionPickerView { _ in }.tint(Theme.accent) }
            else { main }
            #else
            main
            #endif
        }
    }
    private var main: some View { RootView().environmentObject(api).tint(Theme.accent).task { Notifier.shared.start(api: api) } }
}

struct RootView: View {
    @EnvironmentObject var api: API
    @State private var checking = true
    var body: some View {
        Group {
            if !api.isAuthed { AuthView().transition(.opacity) }
            else if checking && api.prefs == nil && api.user?.mustChangePassword != true { ProgressView().task { await api.refreshProfile(); checking = false } }
            else if api.user?.mustChangePassword == true { ForcedPasswordView() }
            else if api.prefs?.onboarded == false { OnboardingView().transition(.move(edge: .trailing)) }
            else if api.prefs != nil && api.prefs?.companion == nil { FirstCompanionView().transition(.opacity) } // quem já usava o app escolhe uma vez
            else { MainTabs().transition(.opacity.combined(with: .scale(scale: 1.03))) }
        }
        .animation(.spring(duration: 0.6, bounce: 0.15), value: api.isAuthed)
        .animation(.spring(duration: 0.6, bounce: 0.15), value: api.prefs?.onboarded)
        .animation(.spring(duration: 0.6, bounce: 0.15), value: api.prefs?.companion)
        #if DEBUG
        .task { // Somente builds de desenvolvimento: login automático para testes no simulador.
            if !api.isAuthed, let c = ProcessInfo.processInfo.environment["JORNADA_DEBUG_LOGIN"], let i = c.firstIndex(of: ":") {
                try? await api.authenticate(register: false, email: String(c[..<i]), password: String(c[c.index(after: i)...]), name: "")
            }
        }
        #endif
        .onChange(of: api.isAuthed) { _, v in if !v { checking = true } }
    }
}

struct MainTabs: View {
    #if DEBUG
    @State private var tab = Int(ProcessInfo.processInfo.environment["JORNADA_DEBUG_TAB"] ?? "0") ?? 0
    #else
    @State private var tab = 0
    #endif
    @ObservedObject private var notifier = Notifier.shared
    @Environment(\.scenePhase) private var phase
    private static let areas = ["hoje", "aprender", "exercitar", "minha"]
    private var tabArea: String { Self.areas.indices.contains(tab) ? Self.areas[tab] : "hoje" }
    @State private var link: LinkSheet?
    struct LinkSheet: Identifiable { let id = UUID(); let kind: String; let target: String }
    var body: some View {
        TabView(selection: $tab) {
            HojeView().tabItem { Label("Hoje", systemImage: "sun.max.fill") }.tag(0)
            AprenderView().tabItem { Label("Aprender", systemImage: "book.fill") }.tag(1)
            ExercitarView().tabItem { Label("Exercitar", systemImage: "heart.fill") }.tag(2)
            MinhaView().tabItem { Label("Minha jornada", systemImage: "chart.pie.fill") }.tag(3)
        }
        .onChange(of: tab) { _, _ in FX.shared.choose(); Usage.shared.tabArea = tabArea; Usage.shared.enter(tabArea) }
        .onAppear { Usage.shared.tabArea = tabArea; Usage.shared.enter(tabArea) }
        .onChange(of: phase) { _, p in if p == .active { Usage.shared.resume(Usage.shared.tabArea) } else { Usage.shared.pause() } }
        .onChange(of: notifier.pendingLink?.kind) { _, _ in
            guard let l = notifier.pendingLink else { return }
            notifier.pendingLink = nil
            switch l.kind {
            case "praticar": tab = 2
            case "resource", "journey": if let id = l.id { link = LinkSheet(kind: l.kind, target: id) }
            default: tab = 0
            }
        }
        .sheet(item: $link) { l in
            NavigationStack { (l.kind == "resource" ? AnyView(ReaderView(id: l.target)) : AnyView(JourneyDetailView(id: l.target))).contentDestinations() }
        }
        .modifier(MinimizeTabBar())
    }
}
struct MinimizeTabBar: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) { content.tabBarMinimizeBehavior(.onScrollDown) } else { content }
    }
}
