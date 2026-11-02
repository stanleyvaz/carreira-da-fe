import SwiftUI

// MARK: - Botão com feedback (escala + som + háptico)
struct PressableStyle: ButtonStyle {
    var sound = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.4), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, p in if p && sound { FX.shared.tap() } }
    }
}
struct ProminentButtonStyle: ButtonStyle {
    var tint: Color = Theme.accent
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            .foregroundStyle(.white).background(tint.gradient, in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.4), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, p in if p { FX.shared.tap() } }
    }
}

// MARK: - Vidro (Liquid Glass no iOS 26+, material antes)
extension View {
    @ViewBuilder func glassCapsule() -> some View {
        if #available(iOS 26.0, *) { self.glassEffect(.regular.interactive(), in: .capsule) }
        else { self.background(.ultraThinMaterial, in: Capsule()) }
    }
    @ViewBuilder func glassCard(_ r: CGFloat = 24) -> some View {
        if #available(iOS 26.0, *) { self.glassEffect(.regular, in: .rect(cornerRadius: r)) }
        else { self.background(.regularMaterial, in: RoundedRectangle(cornerRadius: r, style: .continuous)) }
    }
    func card() -> some View {
        self.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    /// Entrada suave ao rolar (HIG: movimento com propósito).
    func scrollFade() -> some View {
        self.scrollTransition(.animated(.spring(duration: 0.4))) { c, ph in
            c.opacity(ph.isIdentity ? 1 : 0.35).scaleEffect(ph.isIdentity ? 1 : 0.95).blur(radius: ph.isIdentity ? 0 : 2)
        }
    }
}

// MARK: - Gradiente vivo (respira lentamente; estático com "Reduzir movimento")
struct LivingGradient: View {
    let slug: String?
    @Environment(\.accessibilityReduceMotion) private var reduce
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { tl in
            let t = reduce ? 0 : tl.date.timeIntervalSinceReferenceDate
            let a = sin(t / 5) * 0.25
            ZStack {
                Theme.gradient(slug)
                RadialGradient(colors: [.white.opacity(0.28), .clear], center: UnitPoint(x: 0.85 + a, y: 0.05 + a / 2), startRadius: 0, endRadius: 320)
                RadialGradient(colors: [.black.opacity(0.18), .clear], center: UnitPoint(x: 0.1 - a, y: 1.0), startRadius: 0, endRadius: 280)
            }
        }
    }
}
struct Cover<Content: View>: View {
    let slug: String?; @ViewBuilder var content: Content
    var body: some View {
        content.foregroundStyle(.white).padding(22).frame(maxWidth: .infinity, alignment: .leading)
            .background(LivingGradient(slug: slug)).clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 18, y: 10)
    }
}

// MARK: - Anéis animados (estilo Fitness). Metas flexíveis, sem penalidade.
struct RingsView: View {
    let week: Week; let goals: Week; var size: CGFloat = 150
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    private var items: [(String, Int, Int, Color)] { [("Palavra", week.reflections, goals.reflections, Theme.reflections), ("Aprender", week.steps, goals.steps, Theme.steps), ("Exercitar", week.activities, goals.activities, Theme.activities)] }
    var body: some View {
        ZStack {
            ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                let inset = CGFloat(i) * size * 0.135
                let p = min(1, Double(it.1) / Double(max(1, it.2)))
                Circle().stroke(it.3.opacity(0.2), lineWidth: size * 0.09).padding(inset)
                Circle().trim(from: 0, to: shown ? max(p, p > 0 ? 0.001 : 0) : 0)
                    .stroke(it.3.gradient, style: StrokeStyle(lineWidth: size * 0.09, lineCap: .round)).rotationEffect(.degrees(-90)).padding(inset)
                    .animation(reduce ? .none : .spring(duration: 1.2, bounce: 0.25).delay(Double(i) * 0.15), value: shown)
                    .animation(reduce ? .none : .spring(duration: 0.9, bounce: 0.3), value: it.1)
            }
        }
        .frame(width: size, height: size)
        .onAppear { shown = true }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(items.map { "\($0.0): \($0.1) de \($0.2)" }.joined(separator: ". "))
    }
}
/// Legenda numa linha, para o cabeçalho compacto da Home.
struct RingLegendInline: View {
    let week: Week; let goals: Week
    var body: some View {
        HStack(spacing: 10) {
            item("Palavra", week.reflections, goals.reflections, Theme.reflections)
            item("Aprender", week.steps, goals.steps, Theme.steps)
            item("Exercitar", week.activities, goals.activities, Theme.activities)
        }
    }
    private func item(_ l: String, _ v: Int, _ g: Int, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(l).font(.caption2).foregroundStyle(.secondary)
            (Text("\(v)").font(.subheadline.bold().monospacedDigit()).foregroundStyle(c) + Text("/\(g)").font(.caption).foregroundStyle(.secondary))
        }
    }
}
struct RingLegend: View {
    let week: Week; let goals: Week
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            row("Palavra", week.reflections, goals.reflections, Theme.reflections)
            row("Aprender", week.steps, goals.steps, Theme.steps)
            row("Exercitar", week.activities, goals.activities, Theme.activities)
        }
    }
    private func row(_ l: String, _ v: Int, _ g: Int, _ c: Color) -> some View {
        HStack(spacing: 10) {
            Capsule().fill(c.gradient).frame(width: 6, height: 34)
            VStack(alignment: .leading, spacing: 0) {
                Text(l).font(.caption).foregroundStyle(.secondary)
                (Text("\(v)").font(.title2.bold().monospacedDigit()).foregroundStyle(c) + Text(" /\(g)").font(.subheadline).foregroundStyle(.secondary))
                    .contentTransition(.numericText()).animation(.spring, value: v)
            }
        }.accessibilityElement(children: .combine)
    }
}

// MARK: - Faixa de 7 dias (dias sem atividade são neutros, nunca falhas)
struct WeekStrip: View {
    let days: [Day]
    @State private var shown = false
    private let letters = ["D", "S", "T", "Q", "Q", "S", "S"]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(days.enumerated()), id: \.element.id) { i, d in
                VStack(spacing: 5) {
                    Text(letters[d.dow]).font(.caption2.bold()).foregroundStyle(.secondary)
                    ZStack {
                        Circle().fill(d.active ? AnyShapeStyle(Theme.accent.gradient) : AnyShapeStyle(Color(.tertiarySystemFill)))
                        if d.active { Image(systemName: "checkmark").font(.footnote.bold()).foregroundStyle(.white) }
                        else { Text(String(d.day.suffix(2))).font(.footnote).foregroundStyle(.secondary) }
                    }
                    .frame(width: 38, height: 38).overlay { if d.today { Circle().stroke(Theme.accent, lineWidth: 2).padding(-4) } }
                    .scaleEffect(shown ? 1 : 0.2).opacity(shown ? 1 : 0)
                    .animation(.spring(duration: 0.5, bounce: 0.5).delay(Double(i) * 0.05), value: shown)
                }.frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore).accessibilityLabel("\(d.day)\(d.active ? ", com atividade" : "")")
            }
        }.onAppear { shown = true }
    }
}

// MARK: - Confete suave (celebração do aprendizado, nunca "prêmio")
struct Burst: View {
    let trigger: Int
    var colors: [Color] = [Theme.reflections, Theme.steps, Theme.activities, Theme.accent, .white]
    @State private var go = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    private struct P { let dx, dy, rot, size: CGFloat; let c: Color; let round: Bool }
    @State private var parts: [P] = []
    var body: some View {
        ZStack {
            ForEach(Array(parts.enumerated()), id: \.offset) { _, p in
                RoundedRectangle(cornerRadius: p.round ? p.size / 2 : 2)
                    .fill(p.c).frame(width: p.size, height: p.size * (p.round ? 1 : 0.5))
                    .rotationEffect(.degrees(go ? p.rot : 0)).offset(x: go ? p.dx : 0, y: go ? p.dy : 0)
                    .scaleEffect(go ? 0.6 : 1).opacity(go ? 0 : 1)
            }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            guard !reduce else { return }
            parts = (0..<28).map { _ in
                let a = Double.random(in: 0..<(2 * .pi)), d = CGFloat.random(in: 70...190)
                return P(dx: CGFloat(cos(a)) * d, dy: CGFloat(sin(a)) * d - 40, rot: .random(in: -540...540), size: .random(in: 6...11), c: colors.randomElement()!, round: Bool.random())
            }
            go = false
            withAnimation(.easeOut(duration: 1.3)) { go = true }
        }
    }
}

// MARK: - Layout de chips
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320; var x: CGFloat = 0, y: CGFloat = 0, h: CGFloat = 0
        for s in subviews { let z = s.sizeThatFits(.unspecified); if x + z.width > w { x = 0; y += h + spacing; h = 0 }; x += z.width + spacing; h = max(h, z.height) }
        return CGSize(width: w, height: y + h)
    }
    func placeSubviews(in b: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = b.minX, y = b.minY, h: CGFloat = 0
        for s in subviews { let z = s.sizeThatFits(.unspecified); if x + z.width > b.maxX { x = b.minX; y += h + spacing; h = 0 }; s.place(at: CGPoint(x: x, y: y), proposal: .unspecified); x += z.width + spacing; h = max(h, z.height) }
    }
}
struct Chip: View {
    let title: String; let on: Bool; let action: () -> Void
    var body: some View {
        Button { FX.shared.choose(); withAnimation(.spring(duration: 0.3, bounce: 0.4)) { action() } } label: {
            Text(title).font(.subheadline.weight(on ? .semibold : .regular)).padding(.horizontal, 14).frame(minHeight: 40)
                .background(on ? AnyShapeStyle(Theme.accent.opacity(0.18)) : AnyShapeStyle(Color(.tertiarySystemFill)), in: Capsule())
                .overlay(Capsule().stroke(on ? Theme.accent : .clear, lineWidth: 1.5)).foregroundStyle(on ? Theme.accent : .primary)
        }.buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - Check animado (desenha o traço)
struct CheckShape: Shape {
    func path(in r: CGRect) -> Path { var p = Path(); p.move(to: CGPoint(x: r.width * 0.22, y: r.height * 0.52)); p.addLine(to: CGPoint(x: r.width * 0.43, y: r.height * 0.72)); p.addLine(to: CGPoint(x: r.width * 0.78, y: r.height * 0.30)); return p }
}
struct RoundCheck: View {
    let done: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().stroke(Color(.separator), lineWidth: 2).opacity(done ? 0 : 1)
                Circle().fill(Color.green.gradient).scaleEffect(done ? 1 : 0.3).opacity(done ? 1 : 0)
                CheckShape().trim(from: 0, to: done ? 1 : 0).stroke(.white, style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round)).padding(10)
            }
            .frame(width: 46, height: 46).animation(.spring(duration: 0.5, bounce: 0.45), value: done)
        }.buttonStyle(PressableStyle(sound: false)).disabled(done).accessibilityLabel(done ? "Feito" : "Marcar como feito")
    }
}


/// "Quer saber mais?" — conteúdos da biblioteca (lidos no app) ou links para a fonte quando não há texto local.
struct ResourcesSection: View {
    let title: String; let items: [Resource]
    @Environment(\.openURL) private var openURL
    private func row(_ r: Resource, external: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: r.icon).font(.title3).foregroundStyle(.tint).frame(width: 32)
            VStack(alignment: .leading, spacing: 3) {
                Text("\(r.verb) · \(r.source)").font(.caption).foregroundStyle(.secondary)
                Text(r.title).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                if let b = r.blurb { Text(b).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading) }
            }
            Spacer(minLength: 0)
            Image(systemName: external ? "arrow.up.right" : "chevron.right").font(.footnote).foregroundStyle(.tertiary)
        }.card()
    }
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(.title3.bold()).padding(.top, 6)
                ForEach(items) { r in
                    if r.hasContent == true {
                        NavigationLink(value: ResourceRoute(id: r.id)) { row(r, external: false) }.buttonStyle(PressableStyle())
                    } else if let u = r.safeURL {
                        Button { FX.shared.play(.tap); openURL(u) } label: {
                            row(r, external: true)
                        }.buttonStyle(PressableStyle()).accessibilityHint("Abre no site de origem")
                    }
                }
            }
        }
    }
}
