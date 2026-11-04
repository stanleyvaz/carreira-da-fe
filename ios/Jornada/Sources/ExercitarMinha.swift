import SwiftUI

struct ExercitarView: View {
    @EnvironmentObject var api: API
    @State private var items: [Activity] = []
    @State private var week: Week?
    @State private var burst = 0
    @State private var noteFor: String?
    @State private var loaded = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Exercícios, não obrigações. Escolha o que fizer sentido hoje — ou nenhum.").foregroundStyle(.secondary)
                    if let w = week { Label("Esta semana você fez \(w.activities) \(w.activities == 1 ? "exercício" : "exercícios")", systemImage: "leaf.fill").symbolEffect(.bounce, value: w.activities).font(.subheadline).foregroundStyle(Theme.activities) }
                    if loaded && items.isEmpty { ContentUnavailableView("Ainda não há exercícios", systemImage: "heart", description: Text("Novos exercícios chegam em breve.")) }
                    ForEach($items) { $a in
                        if a.lock?.locked == true {
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: "lock.fill").font(.title2).foregroundStyle(.secondary).frame(width: 34, height: 34)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(a.title).font(.headline)
                                    Label(a.lock?.reason ?? "Libera amanhã", systemImage: "hourglass").font(.footnote).foregroundStyle(.secondary)
                                }
                            }.card().opacity(0.8).accessibilityElement(children: .combine).accessibilityHint("Bloqueado por enquanto")
                        } else {
                            HStack(alignment: .top, spacing: 14) {
                                RoundCheck(done: a.done) { Task { await mark($a) } }
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(a.title).font(.headline); Text(a.invitation ?? "").foregroundStyle(.secondary)
                                    Button { noteFor = a.id } label: { Label("Escrever reflexão privada", systemImage: "square.and.pencil").font(.footnote) }.buttonStyle(.plain).foregroundStyle(Theme.accent).padding(.top, 2)
                                }
                            }.card().scrollFade()
                        }
                    }
                }.padding(.horizontal, 16).padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground)).navigationTitle("Exercitar").userMenu()
            .overlay { Burst(trigger: burst, colors: [Theme.activities, .green, Theme.accent, .white]).frame(maxWidth: .infinity, maxHeight: .infinity) }
            .sheet(item: Binding(get: { noteFor.map { IDBox(id: $0) } }, set: { noteFor = $0?.id })) { NoteSheet(kind: "activity", refId: $0.id) }
            .task { await load() }.refreshable { await load() }
        }
    }
    private func mark(_ a: Binding<Activity>) async {
        do { try await api.post("/api/activities/\(a.wrappedValue.id)/complete"); a.wrappedValue.done = true; burst += 1; FX.shared.celebrate(); await load() } catch { FX.shared.gentle() }
    }
    private func load() async { if let r: [Activity] = try? await api.get("/api/activities") { withAnimation(.spring) { items = r }; loaded = true }; await loadWeek() }
    private func loadWeek() async { if let o: MyJourney = try? await api.get("/api/me/journey") { withAnimation { week = o.week } } }
}

struct MinhaView: View {
    @EnvironmentObject var api: API
    @AppStorage("fxEnabled") private var fx = true
    @ObservedObject private var usage = Usage.shared
    @State private var m: MyJourney?
    @StateObject private var store = LibraryStore()
    @State private var topics: [String] = []
    @State private var exportURL: URL?
    @State private var confirmDelete = false
    @State private var showProfile = false
    @State private var showReminders = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            WorldScreen(counts: m?.counts ?? Week(reflections: 0, steps: 0, activities: 0), greeting: "Minha jornada", name: api.user?.displayName,
                        activeDays: m?.activeDays, sceneFraction: 0.58, onRefresh: { await load() }) {
                VStack(spacing: 16) {
                    if let m {
                        HStack(spacing: 20) {
                            RingsView(week: m.week, goals: m.goals, size: 140)
                            VStack(alignment: .leading, spacing: 8) { Text("RETROSPECTIVA DA SEMANA").font(.caption.bold()).foregroundStyle(.secondary); RingLegend(week: m.week, goals: m.goals) }
                            Spacer(minLength: 0)
                        }.card().scrollFade()
                        WeekStrip(days: m.days).card().scrollFade()
                        HStack(spacing: 10) { stat(m.counts.reflections, "reflexões"); stat(m.counts.steps, "etapas"); stat(m.counts.activities, "práticas") }
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Marcos").font(.headline)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(m.allMilestones) { x in
                                    HStack(spacing: 10) {
                                        Image(systemName: x.done ? "medal.fill" : "medal").font(.title2).foregroundStyle(x.done ? Theme.accent : .secondary).symbolEffect(.bounce, value: x.done)
                                        Text(x.label).font(.footnote).foregroundStyle(x.done ? .primary : .secondary).multilineTextAlignment(.leading)
                                    }.padding(12).frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                                    .background(x.done ? Theme.accent.opacity(0.14) : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                                }
                            }
                            Text("Marcos registram o que você fez, não a sua fé. Não há ranking nem comparação.").font(.footnote).foregroundStyle(.secondary)
                        }.card().scrollFade()
                        if !m.topicsStudied.isEmpty { VStack(alignment: .leading, spacing: 8) { Text("Temas estudados").font(.headline); FlowLayout { ForEach(m.topicsStudied, id: \.self) { Text($0).font(.footnote).padding(.horizontal, 12).frame(minHeight: 30).background(Color(.tertiarySystemFill), in: Capsule()) } } }.card() }
                    }
                    NavigationLink(value: LibraryRoute.favoritos) {
                        LibraryCard(title: "Versículos favoritos", icon: "star.fill", count: store.marks.count,
                                    emptyText: "Nenhum ainda. Toque em “Favoritar” em um versículo para guardá-lo aqui.") {
                            ForEach(store.marks.prefix(2)) { b in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(b.reference).font(.subheadline.bold()).foregroundStyle(Theme.accent)
                                    if let t = b.text { Text(t).font(.system(.subheadline, design: .serif)).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading) }
                                }
                            }
                        }
                    }.buttonStyle(.plain)
                    NavigationLink(value: LibraryRoute.anotacoes) {
                        LibraryCard(title: "Anotações privadas", icon: "square.and.pencil", count: store.notes.count,
                                    emptyText: "Nenhuma ainda. Use “Anotação privada” nas etapas e exercícios.") {
                            ForEach(store.notes.prefix(2)) { n in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(n.body).font(.subheadline).foregroundStyle(.primary).lineLimit(2).multilineTextAlignment(.leading)
                                    HStack(spacing: 6) {
                                        if let o = n.originTitle { Text(o).lineLimit(1) }
                                        if let d = n.updated { Text("· \(Fmt.short(d))") }
                                    }.font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }.buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Conta e privacidade").font(.headline)
                        Toggle("Sons e vibração", isOn: $fx).tint(Theme.accent).onChange(of: fx) { _, v in if v { FX.shared.choose() } }
                        VStack(alignment: .leading, spacing: 4) {
                            Toggle("Ajudar com estatísticas de uso", isOn: Binding(get: { usage.consent }, set: { v in Task { do { try await usage.setConsent(v, api: api) } catch { self.error = error.localizedDescription } } })).tint(Theme.accent)
                            Text("Opcional. Enviamos só quanto tempo o app fica em cada área, somado com o de todos, sem identificar você. Pode desligar quando quiser.").font(.caption).foregroundStyle(.secondary)
                        }
                        if let u = api.user { Text(u.email).font(.footnote).foregroundStyle(.secondary) }
                        Button { showProfile = true } label: { Label("Perfil, foto e senha", systemImage: "person.crop.circle") }
                        Button { showReminders = true } label: { Label("Lembretes e notificações", systemImage: "bell") }
                        if let url = exportURL { ShareLink(item: url) { Label("Compartilhar arquivo de dados", systemImage: "square.and.arrow.up") } }
                        else { Button("Exportar meus dados") { Task { await export() } } }
                        Button("Sair") { Task { FX.shared.tap(); await api.signOut() } }
                        Button("Excluir conta", role: .destructive) { confirmDelete = true }
                        if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                    }.card()
                }.padding(.horizontal, 16).padding(.bottom, 24)
            }
            .navigationTitle("").navigationBarTitleDisplayMode(.inline).toolbarBackground(.hidden, for: .navigationBar).userMenu()
            .contentDestinations()
            .onAppear { Usage.shared.enter("minha") }
            .navigationDestination(for: LibraryRoute.self) { r in
                switch r {
                case .favoritos: FavoritosView(store: store).usageArea("favoritos")
                case .anotacoes: AnotacoesView(store: store).usageArea("favoritos")
                case .favorito(let id): FavoritoDetailView(store: store, passageId: id).usageArea("favoritos")
                case .nota(let id): NoteDetailView(store: store, noteId: id).usageArea("favoritos")
                }
            }
            .task { await load() }
            .sheet(isPresented: $showProfile) { ProfileView() }
            .sheet(isPresented: $showReminders) { RemindersView() }
            .confirmationDialog("Excluir sua conta e todos os seus dados? Isso não pode ser desfeito.", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Excluir conta", role: .destructive) { Task { try? await api.send("DELETE", "/api/me", as: Empty.self); api.signOutLocally() } }
                Button("Cancelar", role: .cancel) {}
            }
        }
    }
    private func stat(_ n: Int, _ l: String) -> some View {
        VStack(spacing: 2) { Text("\(n)").font(.system(.title, design: .serif, weight: .bold)).contentTransition(.numericText()); Text(l).font(.caption).foregroundStyle(.secondary) }
            .frame(maxWidth: .infinity).padding(.vertical, 14).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    private func load() async {
        async let lib: Void = store.load(api)
        do { let aa: MyJourney = try await api.get("/api/me/journey"); withAnimation(.spring(duration: 0.6)) { m = aa }; error = nil }
        catch { self.error = error.localizedDescription }
        await lib
    }
    private func export() async {
        do { let d = try await api.raw("GET", "/api/me/export"); let u = FileManager.default.temporaryDirectory.appendingPathComponent("jornada-meus-dados.json"); try d.write(to: u); exportURL = u; FX.shared.celebrate() }
        catch { self.error = error.localizedDescription }
    }
}
