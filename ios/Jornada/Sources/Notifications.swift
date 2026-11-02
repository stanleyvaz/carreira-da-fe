import SwiftUI
import UserNotifications
import UIKit

/// Lembretes locais (hora da Palavra / fim do dia) e registro para avisos enviados pelo CMS.
@MainActor final class Notifier: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    @Published var pendingLink: (kind: String, id: String?)?
    private let center = UNUserNotificationCenter.current()
    weak var api: API?

    func start(api: API) { self.api = api; center.delegate = self }

    func requestAuthorization() async -> Bool {
        let ok = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if ok { UIApplication.shared.registerForRemoteNotifications() }
        return ok
    }
    func registerDevice(token: Data) async {
        guard let api, api.isAuthed else { return }
        struct B: Encodable { let platform = "ios"; let token: String; let env: String }
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        try? await api.post("/api/me/devices", B(token: token.map { String(format: "%02x", $0) }.joined(), env: env))
    }

    /// Reagenda os próximos 14 dias. Hoje só entra se a reflexão do dia ainda não foi feita.
    func reschedule(settings: NotifSettings, doneToday: Bool, anchor: String? = nil) async {
        let ids = (0..<14).flatMap { ["jornada.reading.\($0)", "jornada.nudge.\($0)"] }
        center.removePendingNotificationRequests(withIdentifiers: ids)
        guard settings.enabled, (await center.notificationSettings()).authorizationStatus == .authorized else { return }
        let cal = Calendar.current
        func parts(_ hm: String) -> (Int, Int)? { let p = hm.split(separator: ":").compactMap { Int($0) }; return p.count == 2 ? (p[0], p[1]) : nil }
        for day in 0..<14 {
            if day == 0 && doneToday { continue }
            guard let base = cal.date(byAdding: .day, value: day, to: Date()) else { continue }
            func add(_ id: String, _ hm: (Int, Int), _ title: String, _ body: String) {
                var c = cal.dateComponents([.year, .month, .day], from: base); c.hour = hm.0; c.minute = hm.1
                guard let when = cal.date(from: c), when > Date() else { return }
                let n = UNMutableNotificationContent(); n.title = title; n.body = body; n.sound = .default; n.userInfo = ["linkKind": "today"]
                center.add(UNNotificationRequest(identifier: id, content: n, trigger: UNCalendarNotificationTrigger(dateMatching: cal.dateComponents([.year, .month, .day, .hour, .minute], from: when), repeats: false)))
            }
            if settings.readingReminder, let t = settings.reminderTime, let hm = parts(t) {
                add("jornada.reading.\(day)", hm, "Hora da Palavra", anchor.map { "\($0): seu minuto com a Palavra está pronto." } ?? "Seu momento de hoje está pronto. Poucos minutos, no seu ritmo.")
            }
            if settings.nudge {
                add("jornada.nudge.\(day)", (19, 30), "Ainda dá tempo", "A reflexão de hoje está esperando por você. Se não der hoje, sem problema — amanhã tem outra.")
            }
        }
    }
    /// Carrega as preferências do servidor e reagenda (chamado ao abrir o app e ao concluir a reflexão).
    func refresh(doneToday: Bool) async {
        guard let api, api.isAuthed, let p: NotifPayload = try? await api.get("/api/me/notifications") else { return }
        await reschedule(settings: p.settings, doneToday: doneToday, anchor: api.prefs?.anchor)
    }

    nonisolated func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }
    nonisolated func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse) async {
        let u = r.notification.request.content.userInfo
        let kind = u["linkKind"] as? String ?? "none"; let id = (u["linkId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        await MainActor.run { Notifier.shared.pendingLink = (kind, id) }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) { Task { @MainActor in await Notifier.shared.registerDevice(token: token) } }
    func application(_ app: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}
}

struct RemindersView: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    @State private var s: NotifSettings?
    @State private var time = Date()
    @State private var msg: String?
    @State private var denied = false
    var body: some View {
        NavigationStack {
            Form {
                if var cur = s {
                    let b = Binding(get: { cur }, set: { cur = $0; s = $0 })
                    Section {
                        Toggle("Receber notificações", isOn: b.enabled).onChange(of: cur.enabled) { _, on in if on { Task { denied = !(await Notifier.shared.requestAuthorization()) } } }
                        if denied { Text("As notificações estão desativadas para o Carreira da Fé. Ative em Ajustes > Notificações.").font(.footnote).foregroundStyle(.secondary) }
                    } footer: { Text("Tudo opcional e no seu ritmo.") }
                    if cur.enabled {
                        Section("Hora da Palavra") {
                            Toggle("Lembrar todo dia", isOn: b.readingReminder)
                            if cur.readingReminder { DatePicker("Horário", selection: $time, displayedComponents: .hourAndMinute) }
                        }
                        Section { Toggle("Lembrete gentil no fim do dia", isOn: b.nudge) } footer: { Text("Uma mensagem curta às 19h30, só se a reflexão de hoje ainda não foi feita. Sem cobrança.") }
                        Section {
                            Toggle("Avisar sobre novos conteúdos", isOn: b.newContent)
                            Stepper("Máximo por semana: \(cur.maxPerWeek)", value: b.maxPerWeek, in: 0...7)
                        } footer: { Text("Não enviamos avisos entre \(cur.quietStart) e \(cur.quietEnd).") }
                    }
                    if let msg { Text(msg).font(.footnote).foregroundStyle(.secondary) }
                } else { ProgressView() }
            }
            .navigationTitle("Lembretes").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Salvar") { Task { await save() } }.disabled(s == nil) }
            }
            .task { await load() }
        }
    }
    private func hm(_ d: Date) -> String { let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX"); return f.string(from: d) }
    private func load() async {
        guard let p: NotifPayload = try? await api.get("/api/me/notifications") else { msg = "Não foi possível carregar."; return }
        s = p.settings
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        time = p.settings.reminderTime.flatMap { f.date(from: $0) } ?? f.date(from: "07:30")!
    }
    private func save() async {
        guard var cur = s else { return }
        cur.reminderTime = cur.readingReminder ? hm(time) : cur.reminderTime
        do {
            try await api.send("PUT", "/api/me/notifications", cur, as: Empty.self)
            let done = (try? await api.get("/api/today") as Today)?.done ?? false
            await Notifier.shared.reschedule(settings: cur, doneToday: done, anchor: api.prefs?.anchor)
            FX.shared.play(.success); dismiss()
        } catch { msg = error.localizedDescription }
    }
}
