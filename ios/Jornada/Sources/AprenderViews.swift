import SwiftUI

struct AprenderView: View {
    @EnvironmentObject var api: API
    @State private var topics: [Topic] = []
    @State private var journeys: [JourneyItem] = []
    @State private var topic: String?
    @State private var audience: String?
    @State private var more: [Resource] = []
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Trilhas curtas por tema. Comece onde fizer sentido.").foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack { Chip(title: "Todos", on: topic == nil) { topic = nil }
                            ForEach(topics) { t in Chip(title: t.name, on: topic == t.slug) { topic = t.slug } } }.padding(.vertical, 2)
                    }.scrollClipDisabled()
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack { Chip(title: "Para todos", on: audience == nil) { audience = nil }
                            ForEach(audienceOptions, id: \.slug) { o in Chip(title: o.label, on: audience == o.slug) { audience = o.slug } } }.padding(.vertical, 2)
                    }.scrollClipDisabled()
                    if loaded && journeys.isEmpty { ContentUnavailableView("Nenhuma jornada neste tema ainda", systemImage: "book.closed", description: Text("Em breve teremos novos conteúdos.")) }
                    let going = journeys.filter { $0.doneSteps > 0 && $0.doneSteps < $0.totalSteps }
                    if !going.isEmpty { header("Em andamento"); ForEach(going) { card($0) } }
                    let challenges = journeys.filter { c in c.isChallenge && !going.contains(where: { g in g.id == c.id }) }
                    if !challenges.isEmpty { header("Desafios"); ForEach(challenges) { card($0) } }
                    ResourcesSection(title: audience.flatMap { a in audienceOptions.first { $0.slug == a }?.label }.map { "Para \($0.lowercased())" } ?? "Ouvir e ler mais", items: more)
                    let rest = journeys.filter { j in !going.contains(where: { $0.id == j.id }) && !j.isChallenge }
                    if !rest.isEmpty { header(going.isEmpty ? "Jornadas" : "Explorar"); ForEach(rest) { card($0) } }
                    if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                }.padding(.horizontal, 16).padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground)).navigationTitle("Aprender").userMenu()
            .task { topics = (try? await api.get("/api/topics")) ?? []; await load() }
            .onChange(of: topic) { _, _ in Task { await load() } }
            .onChange(of: audience) { _, _ in Task { await load() } }
            .refreshable { await load() }
            .contentDestinations()
        }
    }
    private func header(_ t: String) -> some View { Text(t).font(.title3.bold()).padding(.top, 6) }
    @ViewBuilder private func card(_ j: JourneyItem) -> some View {
        if j.lock?.locked == true { lockedCard(j) } else { openCard(j) }
    }
    /// Desafio visível, porém trancado, com a previsão de quando libera.
    private func lockedCard(_ j: JourneyItem) -> some View {
        HStack(spacing: 14) {
            ZStack { RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(.tertiarySystemFill)); Image(systemName: "lock.fill").font(.title2).foregroundStyle(.secondary) }.frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text("Desafio · \(j.topicName) · \(j.days) dias").font(.caption).foregroundStyle(.secondary)
                Text(j.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                Label(j.lock?.reason ?? "Em breve", systemImage: "hourglass").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading)
            }
        }.card().opacity(0.8)
        .accessibilityElement(children: .combine).accessibilityHint("Bloqueado por enquanto")
    }
    private func openCard(_ j: JourneyItem) -> some View {
        NavigationLink(value: JourneyRoute(id: j.id)) {
            HStack(spacing: 14) {
                TopicTile(slug: j.topicSlug, letter: String(j.topicName.prefix(1)), size: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(j.isChallenge ? "Desafio · " : "")\(j.topicName) · \(j.days) dias").font(.caption).foregroundStyle(.secondary)
                    Text(j.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                    if let s = j.summary { Text(s).font(.footnote).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.leading) }
                    if j.totalSteps > 0 { AnimatedProgress(value: Double(j.doneSteps), total: Double(j.totalSteps)) }
                }
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }.card()
        }.buttonStyle(PressableStyle()).scrollFade()
    }
    private func load() async {
        do { let path = topic.map { "/api/journeys?topic=\($0)" } ?? "/api/journeys"
            let r: [JourneyItem] = try await api.get(path)
            var q: [String] = []; if let topic { q.append("topic=\(topic)") }; if let audience { q.append("audience=\(audience)") }; q.append("limit=8")
            more = (try? await api.get("/api/resources?" + q.joined(separator: "&"))) ?? []
            withAnimation(.spring(duration: 0.5)) { journeys = r; loaded = true }; error = nil
        } catch { self.error = error.localizedDescription }
    }
}

struct JourneyDetailView: View {
    @EnvironmentObject var api: API
    let id: String
    @State private var j: JourneyDetail?
    @State private var error: String?
    var body: some View {
        ScrollView {
            if let j {
                let done = j.steps.filter(\.done).count
                let next = j.steps.first { !$0.done }
                VStack(spacing: 16) {
                    Cover(slug: j.topicSlug) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("\(j.topicName.uppercased()) · \(j.days) DIAS").font(.caption.bold()).opacity(0.85)
                            Text(j.title).font(.system(.title, design: .serif, weight: .bold))
                            if let s = j.summary { Text(s).opacity(0.92) }
                            ProgressView(value: Double(done), total: Double(max(1, j.steps.count))).tint(.white)
                            Text("\(done) de \(j.steps.count) etapas — no seu ritmo").font(.footnote).opacity(0.9)
                            if next != nil, j.pacing?.locked == true, let r = j.pacing?.reason {
                                Label(r, systemImage: "hourglass").font(.footnote).padding(12).background(.white.opacity(0.18), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            } else if let n = next {
                                NavigationLink(value: StepRoute(id: n.id, slug: j.topicSlug)) { Text(done > 0 ? "Continuar" : "Começar").font(.headline).foregroundStyle(.black).padding(.horizontal, 22).frame(minHeight: 46).background(.white, in: Capsule()) }.buttonStyle(PressableStyle())
                            }
                        }
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) { ForEach(j.steps) { s in
                            NavigationLink(value: StepRoute(id: s.id, slug: j.topicSlug)) {
                                VStack(spacing: 4) {
                                    Text("DIA").font(.caption2.bold()).foregroundStyle(.secondary)
                                    ZStack { Circle().fill(s.done ? AnyShapeStyle(Color.green.gradient) : s.id == next?.id ? AnyShapeStyle(Theme.accent.opacity(0.2)) : AnyShapeStyle(Color(.tertiarySystemFill)))
                                        if s.done { Image(systemName: "checkmark").bold().foregroundStyle(.white) } else { Text("\(s.position)").font(.headline).foregroundStyle(s.id == next?.id ? Theme.accent : .primary) } }
                                    .frame(width: 46, height: 46).overlay { if s.id == next?.id { Circle().stroke(Theme.accent, lineWidth: 2.5).padding(-4) } }
                                }
                            }.buttonStyle(PressableStyle())
                        } }.padding(.vertical, 6).padding(.horizontal, 4)
                    }.scrollClipDisabled()
                    ForEach(j.steps) { s in
                        NavigationLink(value: StepRoute(id: s.id, slug: j.topicSlug)) {
                            HStack(spacing: 14) {
                                Image(systemName: s.done ? "checkmark.circle.fill" : "\(s.position).circle").font(.title).foregroundStyle(s.done ? .green : Theme.accent).symbolEffect(.bounce, value: s.done)
                                VStack(alignment: .leading) { Text("Dia \(s.position)").font(.caption).foregroundStyle(.secondary); Text(s.title).font(.headline).foregroundStyle(.primary) }
                                Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                            }.card().overlay { if s.id == next?.id { RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.accent, lineWidth: 1.5) } }
                        }.buttonStyle(PressableStyle()).scrollFade()
                    }
                    if done == j.steps.count && !j.steps.isEmpty {
                        VStack(spacing: 8) { Image(systemName: "sparkles").font(.largeTitle).symbolEffect(.pulse).foregroundStyle(Theme.accent); Text("Jornada concluída").font(.headline); Text("Que bom ter caminhado por aqui.").foregroundStyle(.secondary) }.card()
                    }
                }.padding(.horizontal, 16).padding(.bottom, 24)
            } else if let error { Text(error).foregroundStyle(.red).padding() } else { ProgressView().padding(.top, 80) }
        }
        .background(Color(.systemGroupedBackground)).navigationBarTitleDisplayMode(.inline)
        .task { await load() }.onAppear { Task { await load() } }
    }
    private func load() async { do { let r: JourneyDetail = try await api.get("/api/journeys/\(id)"); withAnimation(.spring) { j = r } } catch { self.error = error.localizedDescription } }
}

struct StepDetailView: View {
    @EnvironmentObject var api: API
    let id: String; let slug: String?
    @State private var step: Step?
    @State private var selected: Int?
    @State private var wrong: Set<Int> = []
    @State private var hint: String?
    @State private var feedback: Feedback?
    @State private var burst = 0
    @State private var finished = false
    @State private var noteOpen = false
    @State private var marked = false
    @State private var error: String?
    @State private var wrongShake = 0

    var body: some View {
        ScrollView {
            if let s = step {
                VStack(spacing: 16) {
                    ProgressView(value: Double(s.position), total: Double(max(1, s.totalSteps))).tint(Theme.accent).padding(.top, 4)
                    Cover(slug: slug) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("DIA \(s.position) DE \(s.totalSteps)").font(.caption.bold()).opacity(0.85)
                            Text(s.title).font(.system(.title, design: .serif, weight: .bold))
                            if let p = s.passage {
                                if let t = p.text { Text(t).font(.system(.title3, design: .serif)).lineSpacing(4).fixedSize(horizontal: false, vertical: true) }
                                HStack { Text("\(p.reference)\(p.translation.map { " · \($0)" } ?? "")").font(.subheadline.weight(.semibold)); Spacer(); BookmarkButton(passageId: p.id, initial: false) }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        if let c = s.context { block("Contexto", c) }
                        if let e = s.explanation { block("Explicação", e) }
                        if let a = s.application { block("No cotidiano", a) }
                    }.card().scrollFade()
                    if s.pacing?.locked == true, s.done != true {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Por hoje, é isso", systemImage: "hourglass").font(.headline)
                            Text(s.pacing?.reason ?? "Volte amanhã.").foregroundStyle(.secondary)
                            NavigationLink(value: JourneyRoute(id: s.journeyId)) { Text("Voltar à jornada").font(.headline) }.buttonStyle(ProminentButtonStyle())
                        }.card().scrollFade()
                    } else if let q = s.questions.first { quiz(q, s) }
                    if finished, let extra = s.extra { VStack(alignment: .leading, spacing: 6) { Text("Para ir além").font(.headline); Text(extra) }.card().transition(.scale.combined(with: .opacity)) }
                    if !s.songs.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Louvor relacionado", systemImage: "music.note").font(.headline)
                            ForEach(s.songs) { m in
                                DisclosureGroup(m.title) { VStack(alignment: .leading, spacing: 8) { Text(m.lyrics).font(.system(.body, design: .serif)); if let c = m.credits { Text(c).font(.caption).foregroundStyle(.secondary) } }.padding(.top, 6) }
                                    .tint(Theme.accent)
                            }
                        }.card()
                    }
                    Button { noteOpen = true } label: { Label("Anotação privada", systemImage: "square.and.pencil").frame(maxWidth: .infinity, minHeight: 48).glassCapsule() }.buttonStyle(PressableStyle())
                }.padding(.horizontal, 16).padding(.bottom, 28)
            } else if let error { Text(error).foregroundStyle(.red).padding() } else { ProgressView().padding(.top, 80) }
        }
        .background(Color(.systemGroupedBackground)).navigationBarTitleDisplayMode(.inline)
        .overlay { Burst(trigger: burst).frame(maxWidth: .infinity, maxHeight: .infinity) }
        .sheet(isPresented: $noteOpen) { NoteSheet(kind: "step", refId: id) }
        .task { await load() }
    }
    private func block(_ t: String, _ b: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(t).font(.headline); Text(b) } }

    @ViewBuilder private func quiz(_ q: Question, _ s: Step) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Para compreender").font(.headline); Text(q.prompt)
            ForEach(Array(q.options.enumerated()), id: \.offset) { i, o in
                let isCorrect = feedback?.correctIndex == i, isWrong = wrong.contains(i)
                Button { guard feedback == nil else { return }; FX.shared.choose(); withAnimation(.spring(duration: 0.3, bounce: 0.4)) { selected = i } } label: {
                    HStack { Text(o).multilineTextAlignment(.leading); Spacer()
                        if isCorrect { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).symbolEffect(.bounce, value: feedback?.correctIndex) }
                        else if isWrong { Image(systemName: "arrow.uturn.backward.circle").foregroundStyle(.orange) }
                        else if selected == i { Image(systemName: "circle.inset.filled").foregroundStyle(Theme.accent) } else { Image(systemName: "circle").foregroundStyle(.tertiary) } }
                        .padding(14).frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                        .background(isCorrect ? Color.green.opacity(0.15) : isWrong ? Color.orange.opacity(0.15) : selected == i ? Theme.accent.opacity(0.14) : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(selected == i && feedback == nil ? Theme.accent : .clear, lineWidth: 1.5))
                }.buttonStyle(PressableStyle(sound: false)).foregroundStyle(.primary).disabled(feedback != nil || isWrong)
            }
            if let h = hint, feedback == nil { Text(h).font(.footnote).foregroundStyle(.orange).transition(.opacity) }
            if let f = feedback, let e = f.explanation { Text(e).font(.footnote).foregroundStyle(.secondary).transition(.opacity.combined(with: .move(edge: .top))) }
            if feedback == nil {
                CompleteButton(done: false, title: !wrong.isEmpty ? "Tentar de novo" : s.done == true ? "Refazer" : "Concluir etapa", doneTitle: "") { try await complete(s) }
                    .disabled(selected == nil)
            } else {
                Text("Etapa concluída. Não há nota — apenas aprendizado.").font(.footnote).foregroundStyle(.green)
                if s.nextStepId != nil {
                    Text("A próxima etapa libera amanhã. Até lá, deixe a Palavra assentar.").font(.footnote).foregroundStyle(.secondary)
                    NavigationLink(value: JourneyRoute(id: s.journeyId)) { Text("Voltar à jornada").font(.headline) }.buttonStyle(ProminentButtonStyle())
                } else { NavigationLink(value: JourneyRoute(id: s.journeyId)) { Text("Ver a jornada").font(.headline) }.buttonStyle(ProminentButtonStyle()) }
            }
        }.card().scrollFade()
    }
    private func complete(_ s: Step) async throws {
        struct B: Encodable { let answerIndex: Int? }
        let f: Feedback = try await api.send("POST", "/api/steps/\(s.id)/complete", B(answerIndex: selected), as: Feedback.self)
        if f.correct == false { // não avança até acertar; sem nota nem punição
            withAnimation(.spring(duration: 0.4, bounce: 0.3)) { if let s = selected { wrong.insert(s) }; selected = nil; hint = f.hint ?? "Tente outra resposta." }
            FX.shared.play(.gentle); FX.shared.impact(.soft); return
        }
        hint = nil
        withAnimation(.spring(duration: 0.5, bounce: 0.3)) { feedback = f; finished = true }
        burst += 1; FX.shared.bigCelebrate()
    }
    private func load() async {
        do { let s: Step = try await api.get("/api/steps/\(id)"); withAnimation(.spring) { step = s; finished = s.done == true } } catch { self.error = error.localizedDescription }
    }
}
