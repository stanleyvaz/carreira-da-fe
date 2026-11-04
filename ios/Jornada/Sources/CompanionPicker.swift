import SwiftUI

// MARK: - Escolha do personagem (primeira abertura do app; também em Perfil)
/// Mostra os cinco animais bíblicos, com o trecho que liga cada um a Jesus ou a Deus,
/// e uma prévia viva que passa pelas seis fases (estática com "Reduzir movimento").
struct CompanionPickerView: View {
    var initial: CompanionKind? = nil
    var title = "Quem vai caminhar com você?"
    var subtitle = "Escolha seu companheiro de jornada. Ele cresce a cada reflexão, etapa e prática, e nunca encolhe. Dá para trocar depois no Perfil."
    /// Texto do botão: "Caminhar com o leão".
    var confirmPrefix = "Caminhar com"
    var onChoose: (CompanionKind) async throws -> Void

    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var selected: CompanionKind = .sheep
    @State private var reaction = 0
    @State private var previewStage: CompanionStage = .ovelha
    @State private var saving = false
    @State private var error: String?
    @State private var didAppear = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.system(.title, design: .rounded, weight: .bold)).accessibilityAddTraits(.isHeader)
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
                }
                preview
                choices
                info
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .safeAreaInset(edge: .bottom) {
            // Botão sempre à vista
            VStack(spacing: 8) {
                if let error { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
                Button { Task { await confirm() } } label: {
                    if saving { ProgressView().tint(.white) } else { Text("\(confirmPrefix) \(selected.withArticle)").contentTransition(.opacity) }
                }
                .buttonStyle(ProminentButtonStyle()).disabled(saving)
                .accessibilityIdentifier("companion.confirm")
            }
            .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 6)
            .background(.bar)
        }
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            selected = initial ?? .sheep
        }
        .task {
            // Prévia: passa por todas as fases para mostrar como ele cresce
            guard !reduce else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.4))
                if Task.isCancelled { break }
                withAnimation(.spring(duration: 0.5, bounce: 0.3)) {
                    previewStage = previewStage.next ?? .recemNascido
                }
            }
        }
    }

    private var preview: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(colors: [Color(red: 0.55, green: 0.76, blue: 0.97), Color(red: 0.86, green: 0.94, blue: 1)], startPoint: .top, endPoint: .bottom)
            CompanionView(stage: previewStage, kind: selected, reaction: reaction)
                .frame(height: 200).frame(maxWidth: .infinity).padding(.top, 26)
                .id(selected) // ao trocar de animal, começa limpo
                .transition(.scale(scale: 0.85).combined(with: .opacity))
            HStack(spacing: 6) {
                ForEach(CompanionStage.allCases, id: \.rawValue) { s in
                    Circle().fill(.white.opacity(s.rawValue <= previewStage.rawValue ? 1 : 0.4)).frame(width: 6, height: 6)
                }
                Text(selected.stageName(previewStage)).font(.caption.weight(.semibold)).lineLimit(1).contentTransition(.opacity)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Color.black.opacity(0.28), in: Capsule())
            .padding(12)
        }
        .frame(height: 236)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture { reaction &+= 1; FX.shared.tap() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(selected.name), fase \(previewStage.rawValue + 1): \(selected.stageName(previewStage))")
        .accessibilityHint("Toque para fazer carinho")
        .accessibilityAddTraits(.isButton)
    }

    private var choices: some View {
        HStack(spacing: 8) {
            ForEach(CompanionKind.allCases) { k in
                let on = k == selected
                Button {
                    guard k != selected else { reaction &+= 1; FX.shared.tap(); return }
                    withAnimation(.spring(duration: 0.45, bounce: 0.3)) { selected = k }
                    FX.shared.choose()
                    Task { try? await Task.sleep(for: .seconds(0.35)); reaction &+= 1 }
                } label: {
                    VStack(spacing: 4) {
                        CompanionView(stage: .ovelha, kind: k, showGround: false)
                            .frame(height: 58)
                        Text(k.name).font(.caption2.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                            .foregroundStyle(on ? Theme.accent : .primary)
                    }
                    .padding(.vertical, 8).padding(.horizontal, 2)
                    .frame(maxWidth: .infinity)
                    .background(on ? Theme.accent.opacity(0.14) : Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(on ? Theme.accent : .clear, lineWidth: 2))
                    .scaleEffect(on ? 1.04 : 1)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(k.name)
                .accessibilityHint(k.blurb)
                .accessibilityAddTraits(on ? .isSelected : [])
                .accessibilityIdentifier("companion.\(k.rawValue)")
            }
        }
    }

    private var info: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(selected.emoji).font(.title2).accessibilityHidden(true)
                Text(selected.name).font(.title2.bold())
            }
            Text(selected.blurb).font(.body)
            VStack(alignment: .leading, spacing: 4) {
                Text("“\(selected.verse.text)”").font(.callout).italic()
                Text(selected.verse.ref).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .accessibilityElement(children: .combine)
        }
        .card()
        .animation(.easeInOut(duration: 0.25), value: selected)
    }

    private func confirm() async {
        saving = true; error = nil
        do {
            try await onChoose(selected)
            FX.shared.play(.welcome); FX.shared.notify(.success)
        } catch {
            withAnimation { self.error = error.localizedDescription }
            FX.shared.gentle()
        }
        saving = false
    }
}

/// Linha do Perfil: mostra o personagem atual e leva para a troca.
struct CompanionProfileRow: View {
    @EnvironmentObject var api: API
    var body: some View {
        NavigationLink {
            ChangeCompanionView()
        } label: {
            HStack(spacing: 12) {
                CompanionView(stage: .ovelha, kind: api.companion, showGround: false).frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(api.companion.name).font(.headline)
                    Text("Trocar de companheiro").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityLabel("Companheiro: \(api.companion.name). Trocar")
    }
}

private struct ChangeCompanionView: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        CompanionPickerView(initial: api.companion, title: "Trocar de companheiro",
                            subtitle: "Seu progresso continua o mesmo: o novo companheiro já chega na fase em que você está.",
                            confirmPrefix: "Escolher") { k in
            try await api.setCompanion(k)
            dismiss()
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Primeira abertura depois da atualização (quem já tinha conta e nunca escolheu): pergunta uma vez.
struct FirstCompanionView: View {
    @EnvironmentObject var api: API
    var body: some View {
        CompanionPickerView(subtitle: "Agora você pode escolher seu companheiro de jornada. Seu progresso continua o mesmo, e dá para trocar depois no Perfil.") { k in
            try await api.setCompanion(k)
        }
    }
}

#if DEBUG
/// Só para desenvolvimento: -debugCompanionGallery 1 mostra todos os animais em todas as fases
/// (-debugHappy 1 dispara a reação depois de 1 s; -debugCompanionScene lion -debugStage 5 mostra a cena).
struct CompanionGallery: View {
    @State private var reaction = 0
    var body: some View {
        let happy = UserDefaults.standard.bool(forKey: "debugHappy")
        let only = UserDefaults.standard.string(forKey: "debugGalleryKind").flatMap(CompanionKind.init(rawValue:))
        ScrollView {
            if let k = only {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 0) {
                    ForEach(CompanionStage.allCases, id: \.rawValue) { s in
                        CompanionView(stage: s, kind: k, reaction: reaction).frame(height: 250)
                    }
                }
            } else {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(CompanionKind.allCases) { k in
                    Text(k.name).font(.caption.bold())
                    HStack(spacing: 2) {
                        ForEach(CompanionStage.allCases, id: \.rawValue) { s in
                            CompanionView(stage: s, kind: k, reaction: reaction).frame(height: 118).frame(maxWidth: .infinity)
                        }
                    }
                }
            }.padding(.horizontal, 4)
            }
        }
        .background(Color(red: 0.86, green: 0.94, blue: 1))
        .task { if happy { try? await Task.sleep(for: .seconds(1)); reaction += 1 } }
    }
}
struct CompanionSceneDebug: View {
    let kind: CompanionKind
    @State private var reaction = 0
    var body: some View {
        let st = CompanionStage(rawValue: UserDefaults.standard.integer(forKey: "debugStage")) ?? .ovelha
        WorldScene(stage: st, kind: kind, total: st.threshold, name: "Stanley", todayDone: false, reaction: reaction, poke: 0)
            .ignoresSafeArea()
            .task { if UserDefaults.standard.bool(forKey: "debugHappy") { try? await Task.sleep(for: .seconds(1)); reaction += 1 } }
    }
}
#endif
