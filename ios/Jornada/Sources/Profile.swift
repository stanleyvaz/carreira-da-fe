import SwiftUI
import PhotosUI

struct ProfileView: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var pick: PhotosPickerItem?
    @State private var version = 0
    @State private var has = false
    @State private var current = ""; @State private var next = ""
    @State private var msg: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 16) {
                        Group {
                            if has { AuthImage(path: "/api/me/avatar-view", version: version) }
                            else { Circle().fill(Theme.accent.opacity(0.2)).overlay(Text(String((name.isEmpty ? (api.user?.email ?? "?") : name).prefix(1)).uppercased()).font(.title.bold())) }
                        }.frame(width: 72, height: 72).clipShape(Circle())
                        VStack(alignment: .leading) {
                            PhotosPicker(selection: $pick, matching: .images) { Text("Trocar foto") }
                            if has { Button("Remover foto", role: .destructive) { Task { try? await api.send("DELETE", "/api/me/avatar", as: Empty.self); has = false; await api.refreshProfile() } } }
                        }
                    }
                    TextField("Nome", text: $name).textContentType(.name)
                    if let e = api.user?.email { Text(e).font(.footnote).foregroundStyle(.secondary) }
                }
                Section("Trocar senha") {
                    SecureField("Senha atual", text: $current).textContentType(.password)
                    SecureField("Nova senha (mín. 10 caracteres)", text: $next).textContentType(.newPassword)
                    Button("Alterar senha") { Task { await changePassword() } }.disabled(current.isEmpty || next.count < 10)
                }
                if let msg { Text(msg).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("Perfil").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Salvar") { Task { await saveName() } } }
            }
            .onAppear { name = api.user?.displayName ?? ""; has = api.user?.hasAvatar ?? false }
            .onChange(of: pick) { _, item in Task { await upload(item) } }
        }
        .usageArea("perfil", parent: "tab")
    }
    private func saveName() async {
        struct B: Encodable { let displayName: String }
        do { try await api.send("PUT", "/api/me/profile", B(displayName: name), as: Empty.self); await api.refreshProfile(); dismiss() } catch { msg = error.localizedDescription }
    }
    private func upload(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) else { return }
        let side: CGFloat = 512, scale = min(1, side / max(img.size.width, img.size.height))
        let size = CGSize(width: img.size.width * scale, height: img.size.height * scale)
        let jpeg = UIGraphicsImageRenderer(size: size).jpegData(withCompressionQuality: 0.85) { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        do { try await api.upload("PUT", "/api/me/avatar", data: jpeg, contentType: "image/jpeg"); has = true; version += 1; await api.refreshProfile(); msg = "Foto atualizada." }
        catch { msg = error.localizedDescription }
    }
    private func changePassword() async {
        struct B: Encodable { let currentPassword: String; let newPassword: String }
        do { try await api.send("POST", "/api/me/password", B(currentPassword: current, newPassword: next), as: Empty.self); current = ""; next = ""; msg = "Senha alterada. Outros aparelhos foram desconectados." }
        catch { msg = error.localizedDescription }
    }
}

struct InboxSection: View {
    @EnvironmentObject var api: API
    @State private var items: [InboxItem] = []
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !items.isEmpty {
                HStack { Text("Novidades").font(.title3.bold()); Spacer()
                    Button("Marcar como lidas") { Task { try? await api.post("/api/me/notifications", [String: String]()); items = [] } }.font(.footnote) }
                ForEach(items) { n in
                    Group {
                        if n.linkKind == "resource", let id = n.linkId { NavigationLink(value: ResourceRoute(id: id)) { row(n) } }
                        else if n.linkKind == "journey", let id = n.linkId { NavigationLink(value: JourneyRoute(id: id)) { row(n) } }
                        else { row(n) }
                    }.buttonStyle(PressableStyle()).simultaneousGesture(TapGesture().onEnded { Task { try? await api.post("/api/me/notifications", ["id": n.id]) } })
                }
            }
        }.task { await reload() }
    }
    private func row(_ n: InboxItem) -> some View {
        HStack { VStack(alignment: .leading, spacing: 3) { Text(n.title).font(.headline).foregroundStyle(.primary); Text(n.body).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading) }; Spacer(minLength: 0) }.card()
    }
    func reload() async { if let p: NotifPayload = try? await api.get("/api/me/notifications") { items = p.inbox.filter { !$0.read }.prefix(5).map { $0 } } }
}


/// Ícone do usuário no canto superior direito de todas as telas principais.
struct UserMenu: ViewModifier {
    @EnvironmentObject var api: API
    enum Sheet: String, Identifiable { case profile, reminders; var id: String { rawValue } }
    @State private var sheet: Sheet?
    private var initial: String { String((api.user?.displayName?.isEmpty == false ? api.user!.displayName! : (api.user?.email ?? "?")).prefix(1)).uppercased() }
    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let u = api.user { Section(u.displayName ?? u.email) { } }
                        Button { sheet = .profile } label: { Label("Perfil, foto e senha", systemImage: "person.crop.circle") }
                        Button { sheet = .reminders } label: { Label("Lembretes e notificações", systemImage: "bell") }
                        Divider()
                        Button(role: .destructive) { Task { await api.signOut() } } label: { Label("Sair", systemImage: "rectangle.portrait.and.arrow.right") }
                    } label: {
                        Group {
                            if api.user?.hasAvatar == true { AuthImage(path: "/api/me/avatar-view", version: api.avatarVersion) }
                            else { Circle().fill(Theme.accent.opacity(0.25)).overlay(Text(initial).font(.subheadline.bold())) }
                        }.frame(width: 34, height: 34).clipShape(Circle())
                    }.accessibilityLabel("Menu do usuário")
                }
            }
            .sheet(item: $sheet) { s in
                switch s { case .profile: ProfileView(); case .reminders: RemindersView() }
            }
    }
}
extension View { func userMenu() -> some View { modifier(UserMenu()) } }
