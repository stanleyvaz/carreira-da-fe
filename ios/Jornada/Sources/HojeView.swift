import SwiftUI
import WidgetKit

struct HojeView: View {
    @EnvironmentObject var api: API
    @State private var today: Today?
    @State private var overview: MyJourney?
    @State private var current: JourneyItem?
    @State private var featured: Featured?
    @State private var more: [Resource] = []
    @State private var starter: Starter?
    @State private var marked: Set<String> = []
    @State private var burst = 0
    @State private var noteFor: String?
    @State private var error: String?
    @State private var appeared = false

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        let g = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
        if let n = api.user?.displayName, !n.isEmpty { return "\(g), \(n)" }; return g
    }
    var body: some View {
        NavigationStack {
            WorldScreen(counts: overview?.counts ?? Week(reflections: 0, steps: 0, activities: 0), greeting: greeting, name: api.user?.displayName,
                        todayDone: today.flatMap { $0.empty == true ? nil : $0.done }, activeDays: overview?.activeDays, reaction: burst, sceneFraction: 0.66,
                        onRefresh: { await load() }) {
                LazyVStack(spacing: 16) {
                    if let o = overview {
                        HStack(spacing: 14) {
                            RingsView(week: o.week, goals: o.goals, size: 68)
                            VStack(alignment: .leading, spacing: 6) {
                                Text("SUA SEMANA").font(.caption2.bold()).foregroundStyle(.secondary)
                                RingLegendInline(week: o.week, goals: o.goals)
                                if let a = o.activeDays, a > 0 { Text("Com a Palavra em \(a) dos últimos 7 dias · sem cobrança").font(.caption2).foregroundStyle(.secondary) }
                            }
                            Spacer(minLength: 0)
                        }.padding(.vertical, 2).card().scrollFade()
                    }
                    if overview?.welcomeBack != nil { welcomeBackCard.scrollFade() }
                    if let st = starter, st.id != nil, st.complete != true, let nid = st.nextStepId { starterCard(st, nextId: nid).scrollFade() }
                    if let f = featured, let fid = f.id { featuredCard(f, id: fid).scrollFade() }
                    if let t = today, t.empty != true { reflection(t) }
                    else if today != nil { Text("Ainda não há reflexão publicada para hoje. Que tal explorar uma jornada?").card() }
                    InboxSection()
                    ResourcesSection(title: "Quer saber mais?", items: more)
                    if let j = current { continueCard(j).scrollFade() }
                    if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                }.padding(.horizontal, 16).padding(.bottom, 24)
                .opacity(appeared ? 1 : 0).offset(y: appeared ? 0 : 20)
            }
            .navigationTitle("").navigationBarTitleDisplayMode(.inline).toolbarBackground(.hidden, for: .navigationBar).userMenu()
            .overlay { Burst(trigger: burst).frame(maxWidth: .infinity, maxHeight: .infinity) }
            .task { await load(); withAnimation(.spring(duration: 0.7, bounce: 0.2)) { appeared = true } }
            .contentDestinations()
            .sheet(item: Binding(get: { noteFor.map { IDBox(id: $0) } }, set: { noteFor = $0?.id })) { NoteSheet(kind: "reflection", refId: $0.id) }
        }
    }

    @ViewBuilder private func reflection(_ t: Today) -> some View {
        Cover(slug: t.topicSlug) {
            VStack(alignment: .leading, spacing: 12) {
                Text("VERSÍCULO DO DIA").font(.caption.bold()).opacity(0.85)
                if let p = t.passage {
                    if let text = p.text { Text(text).font(.system(.title2, design: .serif)).lineSpacing(4).fixedSize(horizontal: false, vertical: true) }
                    HStack {
                        Text("\(p.reference)\(p.translation.map { " · \($0)" } ?? "")").font(.subheadline.weight(.semibold))
                        Spacer()
                        BookmarkButton(passageId: p.id, initial: marked.contains(p.id))
                    }
                } else { Text(t.title ?? "").font(.title.bold()) }
            }
        }.scrollFade()
        VStack(alignment: .leading, spacing: 12) {
            Text(t.title ?? "").font(.system(.title3, design: .serif, weight: .semibold))
            Text(t.body ?? "").font(.body)
            if let a = t.application { Text("Para o seu dia").font(.headline); Text(a) }
            if let q = t.question { Text("Para refletir").font(.headline); Text(q).italic() }
            HStack {
                Button { noteFor = t.id } label: { Label("Anotar", systemImage: "square.and.pencil").font(.subheadline.weight(.medium)).padding(.horizontal, 14).frame(minHeight: 44).glassCapsule() }.buttonStyle(PressableStyle())
                Spacer()
            }
            CompleteButton(done: t.done == true, title: "Concluir reflexão", doneTitle: "Reflexão concluída") {
                try await api.post("/api/reflections/\(t.id ?? "")/complete"); burst += 1; FX.shared.bigCelebrate(); await load()
            }
        }.card().scrollFade()
    }
    private var welcomeBackCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Que bom te ver de volta").font(.headline)
            Text("Sem pressa e sem cobrança. Que tal só um minuto hoje? Comece pelo versículo abaixo.").font(.subheadline).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).card()
    }
    @ViewBuilder private func starterCard(_ st: Starter, nextId: String) -> some View {
        if st.lockedToday == true {
            VStack(alignment: .leading, spacing: 8) {
                Text("PRIMEIROS 7 DIAS · \(st.doneSteps ?? 0) DE \(st.totalSteps ?? 7)").font(.caption.bold()).foregroundStyle(Theme.accent)
                Label("Feito por hoje", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(.green)
                Text(st.pacingReason ?? "Volte amanhã.").font(.footnote).foregroundStyle(.secondary)
                AnimatedProgress(value: Double(st.doneSteps ?? 0), total: Double(max(1, st.totalSteps ?? 7)))
            }.frame(maxWidth: .infinity, alignment: .leading).card()
        } else { starterLink(st, nextId: nextId) }
    }
    private func starterLink(_ st: Starter, nextId: String) -> some View {
        NavigationLink(value: StepRoute(id: nextId, slug: nil)) {
            VStack(alignment: .leading, spacing: 8) {
                Text("PRIMEIROS 7 DIAS · DIA \(st.day ?? 1) DE \(st.totalSteps ?? 7)").font(.caption.bold()).foregroundStyle(Theme.accent)
                Text(st.nextStepTitle ?? "Seu minuto de hoje").font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                Text("Cerca de 1 minuto. Se faltar um dia, é só voltar de onde parou.").font(.footnote).foregroundStyle(.secondary)
                AnimatedProgress(value: Double(st.doneSteps ?? 0), total: Double(max(1, st.totalSteps ?? 7)))
            }.frame(maxWidth: .infinity, alignment: .leading).card()
        }.buttonStyle(PressableStyle())
    }
    @ViewBuilder private func featuredCard(_ f: Featured, id: String) -> some View {
        if f.lock?.locked == true {
            VStack(alignment: .leading, spacing: 8) {
                Label("DESAFIO EM DESTAQUE", systemImage: "lock.fill").font(.caption.bold()).foregroundStyle(.secondary)
                Text(f.headline ?? f.title ?? "").font(.system(.title3, design: .serif, weight: .bold))
                Label(f.lock?.reason ?? "Em breve", systemImage: "hourglass").font(.footnote).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, alignment: .leading).card().opacity(0.85)
        } else { featuredOpen(f, id: id) }
    }
    private func featuredOpen(_ f: Featured, id: String) -> some View {
        let done = f.doneSteps ?? 0, total = max(1, f.totalSteps ?? 1)
        return NavigationLink(value: JourneyRoute(id: id)) {
            Cover(slug: f.topicSlug) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack { Image(systemName: f.kind == "challenge" ? "flame.fill" : "star.fill").symbolEffect(.pulse, options: .repeating.speed(0.5))
                        Text(f.kind == "challenge" ? "DESAFIO EM DESTAQUE" : "EM DESTAQUE").font(.caption.bold()) }.opacity(0.9)
                    Text(f.headline ?? f.title ?? "").font(.system(.title2, design: .serif, weight: .bold)).multilineTextAlignment(.leading)
                    Text("\(f.title ?? "") · \(f.days ?? 0) dias").font(.subheadline).opacity(0.9)
                    if done > 0 { ProgressView(value: Double(done), total: Double(total)).tint(.white) }
                    Text(done > 0 ? "Continuar" : "Conhecer").font(.headline).foregroundStyle(.black).padding(.horizontal, 20).frame(minHeight: 44).background(.white, in: Capsule())
                }
            }
        }.buttonStyle(PressableStyle())
    }
    private func continueCard(_ j: JourneyItem) -> some View {
        NavigationLink(value: JourneyRoute(id: j.id)) {
            HStack(spacing: 14) {
                TopicTile(slug: j.topicSlug, letter: String(j.topicName.prefix(1)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(j.doneSteps > 0 ? "Continuar de onde parou" : "Sugestão para você").font(.caption).foregroundStyle(.secondary)
                    Text(j.title).font(.headline).foregroundStyle(.primary)
                    AnimatedProgress(value: Double(j.doneSteps), total: Double(max(1, j.totalSteps)))
                }
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }.card()
        }.buttonStyle(PressableStyle())
    }
    private func load() async {
        do {
            async let t: Today = api.get("/api/today"); async let o: MyJourney = api.get("/api/me/journey")
            async let js: [JourneyItem] = api.get("/api/journeys"); async let bm: [Bookmark] = api.get("/api/bookmarks")
            async let ft: Featured? = try? api.get("/api/featured")
            async let sr: Starter? = try? api.get("/api/starter")
            let (tt, oo, jj, bb, ff) = try await (t, o, js, bm, ft)
            featured = ff; starter = await sr
            publishWidget(today: tt, overview: oo)
            withAnimation(.spring(duration: 0.6)) { today = tt; overview = oo }
            if let slug = tt.topicSlug { more = (try? await api.get("/api/resources?topic=\(slug)&limit=3")) ?? [] } else { more = [] }
            marked = Set(bb.map(\.passageId))
            await Notifier.shared.refresh(doneToday: tt.done ?? false)
            current = jj.first { $0.doneSteps > 0 && $0.doneSteps < $0.totalSteps } ?? jj.first { $0.doneSteps == 0 && $0.id != ff?.id && $0.lock?.locked != true }
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}
extension HojeView {
    /// Alimenta o widget (versículo do dia + estado de hoje).
    fileprivate func publishWidget(today: Today, overview: MyJourney) {
        guard let p = today.passage, let text = p.text else { return }
        let letters = ["D", "S", "T", "Q", "Q", "S", "S"]
        let dots = overview.days.map { SharedStore.DayDot(letter: letters[$0.dow % 7], active: $0.active, today: $0.today) }
        SharedStore.save(.init(verseText: text, verseRef: p.reference, doneToday: today.done ?? false, activeDays: overview.activeDays ?? 0, anchor: api.prefs?.anchor, updated: .now, days: dots))
        WidgetCenter.shared.reloadAllTimelines()
    }
}
struct IDBox: Identifiable { let id: String }

// MARK: - Peças compartilhadas
struct TopicTile: View {
    let slug: String?; let letter: String; var size: CGFloat = 60
    var body: some View {
        Text(letter).font(.system(size: size * 0.42, weight: .bold, design: .serif)).foregroundStyle(.white)
            .frame(width: size, height: size).background(LivingGradient(slug: slug)).clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)).accessibilityHidden(true)
    }
}
struct AnimatedProgress: View {
    let value: Double; let total: Double
    @State private var shown = false
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.tertiarySystemFill))
                Capsule().fill(Theme.accent.gradient).frame(width: shown ? g.size.width * min(1, value / total) : 0)
            }
        }.frame(height: 7).onAppear { withAnimation(.spring(duration: 1, bounce: 0.2).delay(0.2)) { shown = true } }
        .accessibilityLabel("\(Int(value)) de \(Int(total))")
    }
}
struct CompleteButton: View {
    let done: Bool; let title: String; let doneTitle: String; let action: () async throws -> Void
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 6) {
            Button { Task { busy = true; do { try await action() } catch { self.error = error.localizedDescription; FX.shared.gentle() }; busy = false } } label: {
                HStack { if done { Image(systemName: "checkmark.circle.fill").symbolEffect(.bounce, value: done) }; Text(done ? doneTitle : title) }
            }.buttonStyle(ProminentButtonStyle(tint: done ? .green : Theme.accent)).disabled(done || busy)
            if let error { Text(error).font(.footnote).foregroundStyle(.red) }
        }.animation(.spring(duration: 0.4, bounce: 0.3), value: done)
    }
}
struct BookmarkButton: View {
    @EnvironmentObject var api: API
    let passageId: String; let initial: Bool
    @State private var on: Bool?
    var body: some View {
        let state = on ?? initial
        Button {
            Task { if let r: Bookmarked = try? await api.send("POST", "/api/bookmarks", ["passageId": passageId], as: Bookmarked.self) { withAnimation(.spring(duration: 0.4, bounce: 0.6)) { on = r.bookmarked }; if r.bookmarked { FX.shared.bookmarked() } else { FX.shared.tap() } } }
        } label: {
            Label(state ? "Favoritado" : "Favoritar", systemImage: state ? "star.fill" : "star").font(.subheadline.weight(.medium)).padding(.horizontal, 14).frame(minHeight: 44)
                .symbolEffect(.bounce, value: state).glassCapsule()
        }.buttonStyle(PressableStyle(sound: false)).foregroundStyle(.white)
    }
}
struct NoteSheet: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    let kind: String; let refId: String
    @State private var text = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                Text("Só você pode ler. É guardada de forma cifrada.").font(.footnote).foregroundStyle(.secondary)
                TextEditor(text: $text).padding(8).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            }.padding().background(Color(.systemGroupedBackground)).navigationTitle("Anotação privada").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task {
                    struct B: Encodable { let body: String; let refKind: String; let refId: String }
                    do { try await api.post("/api/notes", B(body: text, refKind: kind, refId: refId)); FX.shared.celebrate(); dismiss() } catch { self.error = error.localizedDescription }
                } }.disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
            }
        }.presentationDetents([.medium, .large]).tint(Theme.accent)
    }
}
extension View {
    func contentDestinations() -> some View {
        self.navigationDestination(for: JourneyRoute.self) { JourneyDetailView(id: $0.id) }
            .navigationDestination(for: ResourceRoute.self) { ReaderView(id: $0.id) }
            .navigationDestination(for: StepRoute.self) { StepDetailView(id: $0.id, slug: $0.slug) }
            .navigationDestination(for: SourceRoute.self) { SourceView(route: $0) }
    }
}
