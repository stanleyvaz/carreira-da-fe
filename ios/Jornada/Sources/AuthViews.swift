import SwiftUI

struct AuthView: View {
    @EnvironmentObject var api: API
    @State private var register = false
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var terms = false
    @State private var busy = false
    @State private var error: String?
    @State private var shake = 0
    @FocusState private var focus: Field?
    enum Field { case name, email, password }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 10) {
                    Image(systemName: "sun.horizon.fill").font(.system(size: 56)).symbolRenderingMode(.palette)
                        .foregroundStyle(Theme.reflections, Theme.accent).symbolEffect(.pulse, options: .repeating.speed(0.4))
                    Text("Carreira da Fé").font(.system(.largeTitle, design: .serif, weight: .bold))
                    Text("A Palavra no seu dia.\nSem pressa, sem cobrança.").multilineTextAlignment(.center).foregroundStyle(.secondary)
                }.padding(.top, 48)

                VStack(spacing: 14) {
                    if register { field("Como quer ser chamado? (opcional)", text: $name, type: .givenName, f: .name) }
                    field("E-mail", text: $email, type: .emailAddress, f: .email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    VStack(alignment: .leading, spacing: 4) {
                        SecureField(register ? "Senha (mín. 10 caracteres)" : "Senha", text: $password)
                            .textContentType(register ? nil : .password).focused($focus, equals: .password)
                            .padding(14).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    if register {
                        Button { FX.shared.choose(); withAnimation(.spring(duration: 0.3, bounce: 0.4)) { terms.toggle() } } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: terms ? "checkmark.square.fill" : "square").font(.title3).foregroundStyle(terms ? Theme.accent : .secondary).symbolEffect(.bounce, value: terms)
                                Text("Li e aceito os termos de uso e a política de privacidade. Minhas reflexões e anotações são privadas e nunca usadas para publicidade.").font(.footnote).multilineTextAlignment(.leading).foregroundStyle(.primary)
                            }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                        }.buttonStyle(.plain).accessibilityAddTraits(terms ? .isSelected : []).transition(.move(edge: .top).combined(with: .opacity))
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading).transition(.opacity) }
                    Button { Task { await submit() } } label: { Group { if busy { ProgressView().tint(.white) } else { Text(register ? "Criar conta" : "Entrar") } } }
                        .buttonStyle(ProminentButtonStyle()).disabled(busy || email.isEmpty || password.isEmpty || (register && !terms))
                }
                .keyframeAnimator(initialValue: 0.0, trigger: shake) { v, x in v.offset(x: x) } keyframes: { _ in
                    KeyframeTrack { CubicKeyframe(10, duration: 0.06); CubicKeyframe(-10, duration: 0.08); CubicKeyframe(6, duration: 0.07); CubicKeyframe(0, duration: 0.06) }
                }

                Button(register ? "Já tenho conta" : "Ainda não tenho conta") {
                    FX.shared.choose(); withAnimation(.spring(duration: 0.4, bounce: 0.3)) { register.toggle(); error = nil }
                }.font(.subheadline)
            }.padding(.horizontal, 24).frame(maxWidth: 520).frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively).background(Color(.systemGroupedBackground)).tint(Theme.accent)
    }
    private func field(_ ph: String, text: Binding<String>, type: UITextContentType, f: Field) -> some View {
        TextField(ph, text: text).textContentType(type).autocorrectionDisabled().focused($focus, equals: f)
            .padding(14).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
    private func submit() async {
        busy = true; error = nil; focus = nil
        do { try await api.authenticate(register: register, email: email.trimmingCharacters(in: .whitespaces), password: password, name: name); FX.shared.play(.welcome); FX.shared.notify(.success) }
        catch { withAnimation { self.error = error.localizedDescription }; shake += 1; FX.shared.gentle() }
        busy = false
    }
}

struct OnboardingView: View {
    @EnvironmentObject var api: API
    @State private var topics: [Topic] = []
    @State private var selected: Set<String> = []
    @State private var mode = "read"
    @State private var minutes = 3
    @State private var goal = ""
    @State private var remind = true
    @State private var anchor = "Depois do café"
    @State private var time = Calendar.current.date(from: DateComponents(hour: 8, minute: 0)) ?? .now
    @State private var saving = false
    @State private var error: String?
    /// Primeiro passo: escolher o personagem (ovelha, leão, pomba, águia ou jumentinho).
    @State private var companion: CompanionKind?

    var body: some View {
        Group {
            if let companion { form(companion) }
            else {
                CompanionPickerView { k in
                    // Salva já (se falhar, vai de novo junto com as preferências em "Começar").
                    try? await api.setCompanion(k)
                    withAnimation(.spring(duration: 0.5, bounce: 0.15)) { self.companion = k }
                }
                .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
        .onAppear { if companion == nil, let c = api.prefs?.companion { companion = CompanionKind(c) } }
    }

    private func form(_ companion: CompanionKind) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 12) {
                        CompanionView(stage: .ovelha, kind: companion, showGround: false).frame(width: 56, height: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Seu companheiro").font(.footnote).foregroundStyle(.secondary)
                            Text(companion.name).font(.headline)
                        }
                        Spacer()
                        Button("Trocar") { withAnimation(.spring(duration: 0.5, bounce: 0.15)) { self.companion = nil } }.font(.subheadline.weight(.semibold))
                    }.card()
                    Text("Tudo aqui é opcional e pode ser mudado depois.").foregroundStyle(.secondary)
                    section("O que gostaria de priorizar?") {
                        TextField("Ex.: ter um momento de calma no dia", text: $goal).padding(12).background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    section("Quais assuntos?") {
                        FlowLayout { ForEach(topics) { t in Chip(title: t.name, on: selected.contains(t.slug)) { if selected.contains(t.slug) { selected.remove(t.slug) } else { selected.insert(t.slug) } } } }
                    }
                    section("Prefere ler ou ouvir?") {
                        Picker("Modo", selection: $mode) { Text("Ler").tag("read"); Text("Ouvir").tag("listen") }.pickerStyle(.segmented)
                            .onChange(of: mode) { _, _ in FX.shared.choose() }
                    }
                    section("Quanto tempo por dia?") {
                        HStack { ForEach([1, 3, 5, 10], id: \.self) { m in Chip(title: "\(m) min", on: minutes == m) { minutes = m } } }
                    }
                    section("Quando fica melhor para o seu minuto com a Palavra?") {
                        Text("Hábito novo pega mais fácil quando fica colado a algo que você já faz.").font(.footnote).foregroundStyle(.secondary)
                        FlowLayout {
                            ForEach(Self.anchors, id: \.label) { a in
                                Chip(title: a.label, on: remind && anchor == a.label) { remind = true; anchor = a.label; time = Calendar.current.date(from: DateComponents(hour: a.hour, minute: a.minute)) ?? time }
                            }
                            Chip(title: "Sem lembrete", on: !remind) { remind = false }
                        }
                        if remind {
                            DatePicker("Horário do lembrete", selection: $time, displayedComponents: .hourAndMinute).transition(.opacity)
                            Text("Um lembrete gentil, no máximo uma vez por dia. Você muda ou desliga quando quiser.").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                    Button { Task { await save(companion) } } label: { if saving { ProgressView().tint(.white) } else { Text("Começar") } }
                        .buttonStyle(ProminentButtonStyle()).disabled(saving)
                }.padding(20).animation(.spring(duration: 0.4), value: remind)
            }
            .background(Color(.systemGroupedBackground)).navigationTitle("Vamos começar").tint(Theme.accent)
            .task { topics = (try? await api.get("/api/topics")) ?? [] }
        }
        .transition(.move(edge: .trailing).combined(with: .opacity))
    }
    static let anchors: [(label: String, hour: Int, minute: Int)] = [("Ao acordar", 6, 30), ("Depois do café", 8, 0), ("Na hora do almoço", 12, 30), ("No fim do dia", 19, 30), ("Antes de dormir", 21, 30)]
    private func section<C: View>(_ t: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) { Text(t).font(.headline); c() }.card()
    }
    private func save(_ companion: CompanionKind) async {
        struct Body: Encodable { let goal: String?; let topicSlugs: [String]; let mode: String; let dailyMinutes: Int; let reminderTime: String?; let anchor: String?; let companion: String }
        saving = true
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        do {
            try await api.send("PUT", "/api/me/preferences", Body(goal: goal.isEmpty ? nil : goal, topicSlugs: Array(selected), mode: mode, dailyMinutes: minutes, reminderTime: remind ? f.string(from: time) : nil, anchor: remind ? anchor : nil, companion: companion.rawValue), as: Empty.self)
            if remind { _ = await Notifier.shared.requestAuthorization() }
            FX.shared.play(.welcome); FX.shared.notify(.success)
            await api.refreshProfile()
            await Notifier.shared.refresh(doneToday: false)
        } catch { self.error = error.localizedDescription }
        saving = false
    }
}
