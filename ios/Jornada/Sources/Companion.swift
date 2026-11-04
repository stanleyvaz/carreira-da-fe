import SwiftUI

// MARK: - Companheiro: um animal bíblico que cresce com o que você faz.
// A pessoa escolhe na primeira abertura: ovelha, leão, pomba, águia ou jumentinho.
// Gamificação leve: cresce a cada reflexão, etapa e prática; NUNCA encolhe, nem cobra. Sem ranking.

enum CompanionKind: String, CaseIterable, Identifiable, Codable {
    case sheep, lion, dove, eagle, donkey
    var id: String { rawValue }
    /// Valor salvo no servidor (nil ou desconhecido = ovelha, a personagem original).
    init(_ raw: String?) { self = raw.flatMap(CompanionKind.init(rawValue:)) ?? .sheep }

    var name: String { switch self { case .sheep: "Ovelha"; case .lion: "Leão"; case .dove: "Pomba"; case .eagle: "Águia"; case .donkey: "Jumentinho" } }
    var emoji: String { switch self { case .sheep: "🐑"; case .lion: "🦁"; case .dove: "🕊️"; case .eagle: "🦅"; case .donkey: "🫏" } }
    var feminine: Bool { self == .sheep || self == .dove || self == .eagle }
    /// "a ovelhinha", "o leão"…
    var withArticle: String { (feminine ? "a " : "o ") + pet }
    /// "na ovelhinha", "no leão"…
    var inArticle: String { (feminine ? "na " : "no ") + pet }
    var pet: String { switch self { case .sheep: "ovelhinha"; case .lion: "leão"; case .dove: "pomba"; case .eagle: "águia"; case .donkey: "jumentinho" } }
    var pronoun: String { feminine ? "ela" : "ele" }

    /// Trecho bíblico que liga o animal a Jesus ou a Deus (ACF).
    var verse: (text: String, ref: String) {
        switch self {
        case .sheep: ("Eis o Cordeiro de Deus, que tira o pecado do mundo.", "João 1:29")
        case .lion: ("Eis aqui o Leão da tribo de Judá, a raiz de Davi, que venceu.", "Apocalipse 5:5")
        case .dove: ("E viu o Espírito de Deus descendo como pomba e vindo sobre ele.", "Mateus 3:16")
        case .eagle: ("Os que esperam no Senhor renovarão as forças, subirão com asas como águias.", "Isaías 40:31")
        case .donkey: ("Eis que o teu rei virá a ti, justo e Salvador, pobre, e montado sobre um jumento.", "Zacarias 9:9")
        }
    }
    var blurb: String {
        switch self {
        case .sheep: "Mansa e carinhosa. Lembra que Jesus é o Cordeiro de Deus e o Bom Pastor que cuida de você."
        case .lion: "Corajoso e protetor. Lembra que Jesus é o Leão de Judá, que venceu."
        case .dove: "Calma e gentil. Lembra a paz e o Espírito Santo, que desceu sobre Jesus no batismo."
        case .eagle: "Sábia e perseverante. Lembra que Deus renova as forças de quem espera nEle."
        case .donkey: "Humilde e leal. Foi um jumentinho que levou Jesus na entrada em Jerusalém."
        }
    }
    func stageName(_ s: CompanionStage) -> String {
        switch self {
        case .sheep: ["Recém-nascido", "Cordeirinho", "Ovelhinha", "Ovelha", "Ovelha no campo florido", "Ovelha coroada de flores"][s.rawValue]
        case .lion: ["Filhote", "Leãozinho", "Leão jovem", "Leão de juba", "Leão no campo florido", "Leão de Judá coroado"][s.rawValue]
        case .dove: ["Filhote", "Pombinha", "Pomba jovem", "Pomba branca", "Pomba no campo florido", "Pomba com ramo de oliveira"][s.rawValue]
        case .eagle: ["Filhote", "Aguiazinha", "Águia jovem", "Águia", "Águia no campo florido", "Águia de asas abertas"][s.rawValue]
        case .donkey: ["Recém-nascido", "Jumentinho", "Jumentinho esperto", "Jumento forte", "Jumento no campo florido", "Jumentinho do Rei"][s.rawValue]
        }
    }
    /// Quanto acima do chão vai a cabeça (em múltiplos de R), para posicionar o balão de fala.
    var top: CGFloat { switch self { case .sheep: 2.45; case .lion: 2.6; case .dove: 2.3; case .eagle: 2.35; case .donkey: 2.6 } }

    // Frases padrão (usadas quando o CMS não tem frases habilitadas na categoria).
    var pokes: [String] {
        let common = ["Cosquinha! Hihi", "Sem pressa, eu estou aqui.", "Respira fundo comigo… 🌿", "Você está indo bem.", "Que tal um versículo?", "Gosto quando você aparece."]
        switch self {
        case .sheep: return ["Béé! 🐑"] + common
        case .lion: return ["Rrrr… é um rugido de carinho! 🦁", "Esforça-te e tem bom ânimo! (Js 1:9)"] + common
        case .dove: return ["Pruu, pruu! 🕊️", "Paz para você hoje."] + common
        case .eagle: return ["Kiii! 🦅", "Vamos voar alto hoje?"] + common
        case .donkey: return ["Ióóó! 🫏", "Hihi, isso faz cócegas na orelha!"] + common
        }
    }
    var thanks: [String] { ["Que alegria! 💛", feminine ? "Obrigada por caminhar comigo!" : "Obrigado por caminhar comigo!", "Eu senti isso aqui no coração."] }
    var idle: [String] {
        let common = ["O dia está lindo, não está?", "Deus cuida de cada detalhe.", "Quando quiser, eu estou aqui."]
        switch self {
        case .sheep: return ["Estou pastando um pouquinho… 🌼"] + common
        case .lion: return ["Estou deitado no capim, cuidando do campo… 🌾", "Os justos são ousados como o leão. (Pv 28:1)"] + common
        case .dove: return ["Estou catando sementinhas… 🌾", "Trouxe um raminho de oliveira pra você. 🌿"] + common
        case .eagle: return ["Estou olhando o campo lá de cima… ☁️", "Os que esperam no Senhor renovarão as forças. (Is 40:31)"] + common
        case .donkey: return ["Estou pastando um pouquinho… 🌼", "Quem é fiel no mínimo, também é fiel no muito. (Lc 16:10)"] + common
        }
    }
    var greetingDefault: String { "Oi, {nome}! Que bom te ver. \(emoji)" }
}

enum CompanionStage: Int, CaseIterable {
    case recemNascido, cordeirinho, ovelhinha, ovelha, campoFlorido, coroa

    /// Total de reflexões + etapas + práticas necessário para chegar neste estágio.
    var threshold: Int { [0, 3, 10, 25, 50, 100][rawValue] }
    var next: CompanionStage? { CompanionStage(rawValue: rawValue + 1) }
    /// Tamanho do corpo (cresce de verdade).
    var scale: CGFloat { [0.58, 0.7, 0.82, 0.94, 1, 1][rawValue] }
    /// Quantidade de tufos de lã (mais fofa a cada estágio).
    var puffs: Int { [6, 8, 10, 12, 13, 13][rawValue] }
    /// Quanto do "visual de filhote" (penugem, pintinhas) ainda resta: 1 no início, 0 a partir da fase 4.
    var baby: Double { [1, 0.6, 0.25, 0, 0, 0][rawValue] }

    static func from(total: Int) -> CompanionStage { allCases.last { total >= $0.threshold } ?? .recemNascido }
    func progress(total: Int) -> Double {
        guard let n = next else { return 1 }
        return min(1, max(0, Double(total - threshold) / Double(n.threshold - threshold)))
    }
}

// MARK: - Cores
private struct Tint {
    var r, g, b: Double
    init(_ r: Double, _ g: Double, _ b: Double) { self.r = r; self.g = g; self.b = b }
    func mix(_ o: Tint, _ k: Double) -> Tint { Tint(r + (o.r - r) * k, g + (o.g - g) * k, b + (o.b - b) * k) }
    var c: Color { Color(red: r, green: g, blue: b) }
}
private let ink = Color(red: 0.2, green: 0.13, blue: 0.1)
private let pink = Color(red: 1, green: 0.6, blue: 0.58)
private let gold = Color(red: 1, green: 0.82, blue: 0.3), goldDeep = Color(red: 0.88, green: 0.62, blue: 0.14)

/// Estado de um quadro: o que é comum a todos os animais (respirar, olhar, piscar, pastar, alegria).
private struct Pose {
    let stage: CompanionStage
    let t: Double
    let happy: Bool
    let s: CGFloat, cx: CGFloat, ground: CGFloat
    let R: CGFloat
    let breathe: CGFloat
    /// 0…1: abaixa a cabeça (pastar, farejar, bicar). Também usado no ritual de conclusão.
    let graze: Double
    let look: CGFloat
    let blink: Bool
    /// Pequeno sacudir de orelhas/asas de vez em quando.
    let flick: Double
}

private func oval(_ c: CGPoint, _ w: CGFloat, _ h: CGFloat) -> Path { Path(ellipseIn: CGRect(x: c.x - w / 2, y: c.y - h / 2, width: w, height: h)) }
/// Desenha uma elipse girada em torno do próprio centro.
private func tilted(_ ctx: GraphicsContext, _ c: CGPoint, _ w: CGFloat, _ h: CGFloat, _ angle: Double, _ color: Color) {
    var g = ctx
    g.translateBy(x: c.x, y: c.y); g.rotate(by: .radians(angle))
    g.fill(oval(.zero, w, h), with: .color(color))
}

// MARK: - Desenho (Canvas + TimelineView; estático com "Reduzir movimento")
struct CompanionView: View {
    let stage: CompanionStage
    var kind: CompanionKind = .sheep
    /// Mude este valor para o personagem reagir (pulinho, olhos felizes, brilhos).
    var reaction: Int = 0
    /// false quando ele vive dentro do cenário (que já desenha o chão); desenha só uma sombra.
    var showGround = true

    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var happyUntil = Date.distantPast
    /// Ritual de conclusão: depois de comemorar, ele abaixa a cabeça (pasta, fareja ou bica) e dali nasce a flor nova.
    @State private var ritualFrom = Date.distantFuture
    @State private var ritualTo = Date.distantFuture

    private struct Hop { var sx = 1.0, sy = 1.0, y = 0.0 }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { tl in
            let t = reduce ? 0 : tl.date.timeIntervalSinceReferenceDate
            let left = happyUntil.timeIntervalSince(tl.date)
            let span = ritualTo.timeIntervalSince(ritualFrom)
            let x = tl.date.timeIntervalSince(ritualFrom) / max(span, 0.001)
            let ritual: Double = (x >= 0 && x <= 1) ? min(1, sin(x * .pi) * 1.7) : 0
            Canvas { ctx, size in draw(ctx, size, t: t, happy: left > 0, happyLeft: left, ritual: ritual) }
        }
        .keyframeAnimator(initialValue: Hop(), trigger: reaction) { v, h in
            v.scaleEffect(x: h.sx, y: h.sy, anchor: .bottom).offset(y: h.y)
        } keyframes: { _ in
            KeyframeTrack(\.sy) { SpringKeyframe(0.86, duration: 0.14); SpringKeyframe(1.1, duration: 0.2, spring: .bouncy); SpringKeyframe(1, duration: 0.3) }
            KeyframeTrack(\.sx) { SpringKeyframe(1.1, duration: 0.14); SpringKeyframe(0.95, duration: 0.2); SpringKeyframe(1, duration: 0.3) }
            KeyframeTrack(\.y) { LinearKeyframe(0, duration: 0.14); SpringKeyframe(-18, duration: 0.2); SpringKeyframe(0, duration: 0.3, spring: .bouncy) }
        }
        .onChange(of: reaction) { _, _ in
            let now = Date()
            happyUntil = now.addingTimeInterval(reduce ? 0 : 1.8)
            if !reduce { ritualFrom = now.addingTimeInterval(1.9); ritualTo = now.addingTimeInterval(4.6) }
        }
        .accessibilityHidden(true)
    }

    private func draw(_ ctx: GraphicsContext, _ size: CGSize, t: Double, happy: Bool, happyLeft: Double, ritual: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2, ground = size.height * 0.86

        // Chão e campo
        if showGround {
            ctx.fill(oval(CGPoint(x: cx, y: ground + s * 0.02), s * 0.84, s * 0.16), with: .color(Color(red: 0.36, green: 0.58, blue: 0.34).opacity(0.9)))
            ctx.fill(oval(CGPoint(x: cx, y: ground), s * 0.76, s * 0.12), with: .color(Color(red: 0.46, green: 0.7, blue: 0.4)))
        } else {
            ctx.fill(oval(CGPoint(x: cx, y: ground + s * 0.004), s * 0.62 * stage.scale, s * 0.07), with: .color(.black.opacity(0.2)))
        }
        if showGround && stage.rawValue >= CompanionStage.campoFlorido.rawValue {
            let cols = [Color(red: 1, green: 0.82, blue: 0.3), Color(red: 1, green: 0.7, blue: 0.82), Color.white, Color(red: 0.7, green: 0.8, blue: 1)]
            for (i, p) in [(-0.36, 0.0), (-0.28, 0.035), (-0.4, 0.04), (0.34, 0.0), (0.27, 0.04), (0.4, 0.03), (-0.2, 0.05), (0.18, 0.05)].enumerated() {
                let sw = CGFloat(sin(t * 1.4 + Double(i))) * s * 0.004
                let c = CGPoint(x: cx + s * p.0 + sw, y: ground + s * p.1)
                ctx.fill(oval(c, s * 0.04, s * 0.04), with: .color(cols[i % cols.count]))
                ctx.fill(oval(c, s * 0.016, s * 0.016), with: .color(Color(red: 0.95, green: 0.7, blue: 0.2)))
            }
        }

        // Vida própria (comum a todos): respira, olha de um lado a outro, pisca e, de tempos em tempos, abaixa a cabeça.
        let R = s * 0.27 * stage.scale
        let ph = t.truncatingRemainder(dividingBy: 13)
        let graze: Double = max(ph > 9.5 ? sin((ph - 9.5) / 3.5 * .pi) : 0, ritual)
        let pose = Pose(
            stage: stage, t: t, happy: happy, s: s, cx: cx, ground: ground, R: R,
            breathe: 1 + CGFloat(sin(t * 2.2)) * 0.016,
            graze: graze,
            look: CGFloat(sin(t * 0.55)) * R * 0.08,
            blink: !reduce && (t.truncatingRemainder(dividingBy: 4.2) < 0.13 || graze > 0.4),
            flick: sin(t * 0.9) > 0.92 ? sin(t * 40) * 0.12 : 0)

        let bodyC: CGPoint
        switch kind {
        case .sheep: bodyC = drawSheep(ctx, pose)
        case .lion: bodyC = drawLion(ctx, pose)
        case .dove: bodyC = drawDove(ctx, pose)
        case .eagle: bodyC = drawEagle(ctx, pose)
        case .donkey: bodyC = drawDonkey(ctx, pose)
        }

        // Brilhos ao reagir: corações e estrelas sobem em volta
        if happy && !reduce {
            let prog = 1 - happyLeft / 1.8
            for i in 0..<8 {
                let seed = Double(i) * 1.9
                let dx = CGFloat(sin(seed * 2.3 + prog * 4)) * R * (0.5 + 0.13 * CGFloat(i))
                let rise = CGFloat(prog) * R * (1.5 + 0.25 * CGFloat(i % 4))
                let p = CGPoint(x: bodyC.x + dx - R * 0.5 + CGFloat(i) * R * 0.14, y: bodyC.y - R * 0.5 - rise)
                let col = (i % 2 == 0 ? Color(red: 1, green: 0.45, blue: 0.55) : Color(red: 1, green: 0.85, blue: 0.35)).opacity(max(0, 1 - prog * prog))
                ctx.draw(Text(i % 2 == 0 ? "♥" : "✦").font(.system(size: R * (0.3 + 0.05 * CGFloat(i % 3)))).foregroundStyle(col), at: p)
            }
        }
    }

    // MARK: Rosto (comum)
    /// Olhos: abertos com brilho; fechados ao piscar; arquinhos felizes ao reagir.
    private func eyes(_ ctx: GraphicsContext, x: CGFloat, y: CGFloat, dx: CGFloat, r: CGFloat, R: CGFloat, _ p: Pose) {
        for sgn in [-1.0, 1.0] {
            let e = CGPoint(x: x + CGFloat(sgn) * dx, y: y)
            if p.happy {
                var a = Path(); a.addArc(center: CGPoint(x: e.x, y: e.y + r), radius: r * 1.3, startAngle: .degrees(200), endAngle: .degrees(340), clockwise: false)
                ctx.stroke(a, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.05, lineCap: .round))
            } else if p.blink {
                var l = Path(); l.move(to: CGPoint(x: e.x - r, y: e.y)); l.addLine(to: CGPoint(x: e.x + r, y: e.y))
                ctx.stroke(l, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.04, lineCap: .round))
            } else {
                ctx.fill(oval(e, r * 2, r * 2.3), with: .color(ink))
                ctx.fill(oval(CGPoint(x: e.x + r * 0.3, y: e.y - r * 0.4), r * 0.7, r * 0.7), with: .color(.white))
            }
        }
    }
    private func cheeks(_ ctx: GraphicsContext, x: CGFloat, y: CGFloat, dx: CGFloat, R: CGFloat, _ p: Pose, w: CGFloat = 0.18, h: CGFloat = 0.11) {
        for sgn in [-1.0, 1.0] {
            ctx.fill(oval(CGPoint(x: x + CGFloat(sgn) * dx, y: y), R * w, R * h), with: .color(pink.opacity(p.happy ? 0.7 : 0.4)))
        }
    }
    private func smile(_ ctx: GraphicsContext, at c: CGPoint, R: CGFloat, _ p: Pose, small: CGFloat = 0.11, big: CGFloat = 0.17) {
        var m = Path()
        m.addArc(center: c, radius: p.happy ? R * big : R * small, startAngle: .degrees(25), endAngle: .degrees(155), clockwise: false)
        ctx.stroke(m, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.04, lineCap: .round))
    }
    /// Brilho suave atrás do personagem (fase final de alguns animais).
    private func glow(_ ctx: GraphicsContext, _ c: CGPoint, _ radius: CGFloat, _ t: Double, _ color: Color) {
        let k = 0.85 + 0.15 * CGFloat(sin(t * 1.3))
        ctx.fill(oval(c, radius * 2 * k, radius * 2 * k), with: .radialGradient(Gradient(colors: [color.opacity(0.55), color.opacity(0)]), center: c, startRadius: 0, endRadius: radius * k))
    }
    private func sparkle(_ ctx: GraphicsContext, _ c: CGPoint, _ size: CGFloat, _ t: Double, _ seed: Double) {
        let a = max(0, sin(t * 2.1 + seed))
        guard a > 0.05 else { return }
        ctx.draw(Text("✦").font(.system(size: size * CGFloat(0.6 + 0.4 * a))).foregroundStyle(Color.white.opacity(a)), at: c)
    }

    // MARK: Ovelha (Jo 1:29): lã em tufos, orelhas rosadas; coroa de flores na fase final.
    private func drawSheep(_ ctx: GraphicsContext, _ p: Pose) -> CGPoint {
        let R = p.R, cx = p.cx, ground = p.ground, t = p.t
        let wool = Color(red: 0.98, green: 0.96, blue: 0.9), woolShade = Color(red: 0.88, green: 0.85, blue: 0.8)
        let skin = Color(red: 0.95, green: 0.85, blue: 0.76), ear = Color(red: 0.93, green: 0.7, blue: 0.66)
        let dark = Color(red: 0.32, green: 0.27, blue: 0.27)

        let legH = R * 0.38
        let bodyC = CGPoint(x: cx, y: ground - legH - R * 0.9 * p.breathe)
        for sgn in [-1.0, 1.0] {
            let r = CGRect(x: cx + CGFloat(sgn) * R * 0.38 - R * 0.11, y: ground - legH - R * 0.1, width: R * 0.22, height: legH + R * 0.1)
            ctx.fill(Path(roundedRect: r, cornerRadius: R * 0.1), with: .color(dark))
        }
        // Lã: nuvem de tufos que balança de leve
        for i in 0..<p.stage.puffs {
            let a = Double(i) / Double(p.stage.puffs) * 2 * .pi
            let wob = CGFloat(sin(t * 1.5 + Double(i) * 0.9)) * R * 0.015
            let q = CGPoint(x: bodyC.x + CGFloat(cos(a)) * R * 0.78 + wob, y: bodyC.y + CGFloat(sin(a)) * R * 0.72)
            ctx.fill(oval(q, R * 0.78, R * 0.78), with: .color(i % 2 == 0 ? wool : woolShade))
        }
        ctx.fill(oval(bodyC, R * 1.7, R * 1.6), with: .color(wool))

        let headC = CGPoint(x: cx + p.look, y: bodyC.y + R * 0.2 + CGFloat(p.graze) * R * 0.32)
        for sgn in [-1.0, 1.0] {
            var c = ctx
            c.translateBy(x: headC.x + CGFloat(sgn) * R * 0.62, y: headC.y - R * 0.08)
            c.rotate(by: .radians(sgn * (0.75 + p.flick) + (p.happy ? -sgn * 0.35 : 0)))
            c.fill(oval(.zero, R * 0.55, R * 0.3), with: .color(ear))
        }
        ctx.fill(oval(headC, R * 1.02, R * 1.12), with: .color(skin))
        ctx.fill(oval(CGPoint(x: headC.x, y: headC.y - R * 0.5), R * 0.62, R * 0.4), with: .color(wool))
        ctx.fill(oval(CGPoint(x: headC.x - R * 0.2, y: headC.y - R * 0.46), R * 0.32, R * 0.3), with: .color(woolShade))

        if p.stage == .coroa {
            for i in 0..<7 {
                let a = Double.pi * (1.1 + 0.8 * Double(i) / 6)
                let q = CGPoint(x: headC.x + CGFloat(cos(a)) * R * 0.52, y: headC.y + CGFloat(sin(a)) * R * 0.58 - R * 0.06)
                ctx.fill(oval(q, R * 0.2, R * 0.2), with: .color([Color(red: 1, green: 0.7, blue: 0.82), Color(red: 1, green: 0.88, blue: 0.4), .white][i % 3]))
            }
        }
        let eyeY = headC.y - R * 0.04
        eyes(ctx, x: headC.x, y: eyeY, dx: R * 0.22, r: R * 0.075, R: R, p)
        ctx.fill(oval(CGPoint(x: headC.x, y: eyeY + R * 0.2), R * 0.16, R * 0.1), with: .color(pink))
        smile(ctx, at: CGPoint(x: headC.x, y: eyeY + R * 0.26), R: R, p)
        cheeks(ctx, x: headC.x, y: eyeY + R * 0.18, dx: R * 0.39, R: R, p)
        return bodyC
    }

    // MARK: Leão de Judá (Ap 5:5): a juba cresce a cada fase; coroa dourada na fase final.
    private func drawLion(_ ctx: GraphicsContext, _ p: Pose) -> CGPoint {
        let R = p.R, cx = p.cx, ground = p.ground, t = p.t
        let fur = Tint(0.97, 0.79, 0.45), furShade = Tint(0.9, 0.67, 0.35), belly = Tint(1, 0.93, 0.76)
        let mane = Tint(0.85, 0.49, 0.22), maneShade = Tint(0.72, 0.38, 0.17)
        let nose = Color(red: 0.52, green: 0.3, blue: 0.26), earIn = Color(red: 0.95, green: 0.68, blue: 0.58)
        let grown: CGFloat = [0, 0.3, 0.6, 0.85, 1, 1][p.stage.rawValue]

        let bodyC = CGPoint(x: cx, y: ground - R * 0.3 - R * 0.78 * p.breathe)
        if p.stage == .coroa { glow(ctx, CGPoint(x: cx, y: bodyC.y - R * 0.5), R * 1.9, t, Color(red: 1, green: 0.85, blue: 0.4)) }

        // Cauda com tufo (abana mais rápido quando está feliz)
        let swing = CGFloat(sin(t * (p.happy ? 7 : 1.6))) * R * 0.14
        let tip = CGPoint(x: cx + R * 1.02 + swing, y: bodyC.y - R * 0.5)
        var tail = Path(); tail.move(to: CGPoint(x: cx + R * 0.5, y: ground - R * 0.2))
        tail.addQuadCurve(to: tip, control: CGPoint(x: cx + R * 1.25, y: ground - R * 0.05))
        ctx.stroke(tail, with: .color(furShade.c), style: StrokeStyle(lineWidth: R * 0.09, lineCap: .round))
        ctx.fill(oval(tip, R * (0.16 + 0.1 * grown), R * (0.2 + 0.1 * grown)), with: .color(mane.c))

        // Patas traseiras (sentado), corpo e barriga
        for sgn in [-1.0, 1.0] { ctx.fill(oval(CGPoint(x: cx + CGFloat(sgn) * R * 0.55, y: ground - R * 0.3), R * 0.64, R * 0.58), with: .color(furShade.c)) }
        ctx.fill(oval(bodyC, R * 1.42, R * 1.5), with: .color(fur.c))
        ctx.fill(oval(CGPoint(x: cx, y: bodyC.y + R * 0.22), R * 0.78, R * 0.98), with: .color(belly.c))
        // Pintinhas de filhote (somem à medida que cresce)
        if p.stage.baby > 0 {
            for (dx, dy) in [(-0.42, 0.05), (-0.5, 0.3), (0.44, 0.1), (0.52, 0.32), (-0.35, -0.25), (0.36, -0.22)] {
                ctx.fill(oval(CGPoint(x: cx + R * dx, y: bodyC.y + R * dy), R * 0.11, R * 0.09), with: .color(furShade.c.opacity(0.8 * p.stage.baby)))
            }
        }
        // Patas da frente
        for sgn in [-1.0, 1.0] {
            let x = cx + CGFloat(sgn) * R * 0.25
            ctx.fill(Path(roundedRect: CGRect(x: x - R * 0.13, y: bodyC.y + R * 0.2, width: R * 0.26, height: ground - bodyC.y - R * 0.24), cornerRadius: R * 0.12), with: .color(fur.c))
            let paw = CGPoint(x: x, y: ground - R * 0.06)
            ctx.fill(oval(paw, R * 0.38, R * 0.22), with: .color(belly.c))
            for k in [-1.0, 1.0] {
                var l = Path(); l.move(to: CGPoint(x: paw.x + CGFloat(k) * R * 0.06, y: paw.y - R * 0.02)); l.addLine(to: CGPoint(x: paw.x + CGFloat(k) * R * 0.06, y: paw.y + R * 0.07))
                ctx.stroke(l, with: .color(furShade.c), style: StrokeStyle(lineWidth: R * 0.025, lineCap: .round))
            }
        }

        // Cabeça (abaixa para farejar a flor)
        let headC = CGPoint(x: cx + p.look, y: bodyC.y - R * 0.6 + CGFloat(p.graze) * R * 0.36)
        // Juba: anel de tufos que fica mais cheio a cada fase e "pula" de alegria
        if grown > 0 {
            let n = 14, bounce = p.happy ? CGFloat(abs(sin(t * 9))) * R * 0.04 : 0
            for layer in 0..<2 {
                for i in 0..<n {
                    let a = Double(i) / Double(n) * 2 * .pi + (layer == 0 ? 0.22 : 0)
                    let wob = CGFloat(sin(t * 1.5 + Double(i) * 0.8)) * R * 0.012
                    let rr = R * (0.44 + 0.22 * grown) + (layer == 0 ? R * 0.06 : 0) + bounce + wob
                    let size = R * (0.26 + 0.3 * grown) * (layer == 0 ? 1.05 : 0.92)
                    let q = CGPoint(x: headC.x + CGFloat(cos(a)) * rr, y: headC.y + CGFloat(sin(a)) * rr * 0.95 + R * 0.04)
                    ctx.fill(oval(q, size, size), with: .color(layer == 0 ? maneShade.c : (i % 2 == 0 ? mane.c : mane.mix(maneShade, 0.35).c)))
                }
            }
        }
        // Orelhas redondas (sacodem de vez em quando, levantam de alegria)
        for sgn in [-1.0, 1.0] {
            var c = ctx
            c.translateBy(x: headC.x + CGFloat(sgn) * R * 0.36, y: headC.y - R * 0.36 - (p.happy ? R * 0.04 : 0))
            c.rotate(by: .radians(sgn * (0.3 + p.flick * 1.5)))
            c.fill(oval(.zero, R * 0.32, R * 0.3), with: .color(fur.c))
            c.fill(oval(CGPoint(x: 0, y: R * 0.02), R * 0.17, R * 0.15), with: .color(earIn))
        }
        ctx.fill(oval(headC, R * 1.0, R * 0.92), with: .color(fur.c))
        if grown == 0 { // topetinho de filhote
            ctx.fill(oval(CGPoint(x: headC.x - R * 0.04, y: headC.y - R * 0.44), R * 0.16, R * 0.12), with: .color(mane.c))
            ctx.fill(oval(CGPoint(x: headC.x + R * 0.06, y: headC.y - R * 0.46), R * 0.12, R * 0.1), with: .color(mane.c))
        }
        // Focinho
        for sgn in [-1.0, 1.0] { ctx.fill(oval(CGPoint(x: headC.x + CGFloat(sgn) * R * 0.11, y: headC.y + R * 0.2), R * 0.3, R * 0.24), with: .color(belly.c)) }
        ctx.fill(oval(CGPoint(x: headC.x, y: headC.y + R * 0.31), R * 0.2, R * 0.12), with: .color(belly.c))
        for sgn in [-1.0, 1.0] {
            for (k, dy) in [(0.0, 0.17), (1.0, 0.24)] {
                ctx.fill(oval(CGPoint(x: headC.x + CGFloat(sgn) * R * (0.12 + 0.05 * k), y: headC.y + R * dy), R * 0.03, R * 0.03), with: .color(furShade.c))
            }
        }
        // Nariz (triângulo arredondado) e boquinha em "w"
        let ny = headC.y + R * 0.08
        var n = Path()
        n.move(to: CGPoint(x: headC.x - R * 0.1, y: ny - R * 0.04))
        n.addQuadCurve(to: CGPoint(x: headC.x + R * 0.1, y: ny - R * 0.04), control: CGPoint(x: headC.x, y: ny - R * 0.09))
        n.addQuadCurve(to: CGPoint(x: headC.x, y: ny + R * 0.07), control: CGPoint(x: headC.x + R * 0.08, y: ny + R * 0.03))
        n.addQuadCurve(to: CGPoint(x: headC.x - R * 0.1, y: ny - R * 0.04), control: CGPoint(x: headC.x - R * 0.08, y: ny + R * 0.03))
        ctx.fill(n, with: .color(nose))
        if p.happy { ctx.fill(oval(CGPoint(x: headC.x, y: ny + R * 0.17), R * 0.16, R * 0.12), with: .color(Color(red: 0.85, green: 0.38, blue: 0.4))) }
        for sgn in [-1.0, 1.0] {
            var m = Path()
            m.addArc(center: CGPoint(x: headC.x + CGFloat(sgn) * R * 0.055, y: ny + R * 0.08), radius: R * 0.055, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
            ctx.stroke(m, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.03, lineCap: .round))
        }
        let eyeY = headC.y - R * 0.08
        eyes(ctx, x: headC.x, y: eyeY, dx: R * 0.2, r: R * 0.068, R: R, p)
        cheeks(ctx, x: headC.x, y: eyeY + R * 0.17, dx: R * 0.34, R: R, p, w: 0.15, h: 0.09)

        // Coroa do Rei (fase final)
        if p.stage == .coroa {
            let base = CGPoint(x: headC.x, y: headC.y - R * 0.46)
            let w = R * 0.5, h = R * 0.3
            var cr = Path()
            cr.move(to: CGPoint(x: base.x - w / 2, y: base.y))
            cr.addLine(to: CGPoint(x: base.x - w / 2, y: base.y - h))
            cr.addLine(to: CGPoint(x: base.x - w / 4, y: base.y - h * 0.5))
            cr.addLine(to: CGPoint(x: base.x, y: base.y - h * 1.15))
            cr.addLine(to: CGPoint(x: base.x + w / 4, y: base.y - h * 0.5))
            cr.addLine(to: CGPoint(x: base.x + w / 2, y: base.y - h))
            cr.addLine(to: CGPoint(x: base.x + w / 2, y: base.y))
            cr.closeSubpath()
            ctx.fill(cr, with: .linearGradient(Gradient(colors: [gold, goldDeep]), startPoint: CGPoint(x: base.x, y: base.y - h), endPoint: base))
            ctx.stroke(cr, with: .color(goldDeep), style: StrokeStyle(lineWidth: R * 0.025, lineJoin: .round))
            ctx.fill(Path(roundedRect: CGRect(x: base.x - w / 2, y: base.y - h * 0.22, width: w, height: h * 0.22), cornerRadius: R * 0.02), with: .color(goldDeep))
            for (dx, col) in [(-w / 4, Color(red: 0.9, green: 0.25, blue: 0.3)), (0, Color(red: 0.3, green: 0.55, blue: 0.95)), (w / 4, Color(red: 0.9, green: 0.25, blue: 0.3))] {
                ctx.fill(oval(CGPoint(x: base.x + dx, y: base.y - h * 0.11), R * 0.07, R * 0.07), with: .color(col))
            }
            for (i, d) in [(-w / 2, -h), (0, -h * 1.15), (w / 2, -h)].enumerated() {
                ctx.fill(oval(CGPoint(x: base.x + d.0, y: base.y + d.1), R * 0.06, R * 0.06), with: .color(gold))
                sparkle(ctx, CGPoint(x: base.x + d.0, y: base.y + d.1 - R * 0.08), R * 0.18, t, Double(i) * 2.1)
            }
        }
        return bodyC
    }

    // MARK: Pomba (Mt 3:16; Gn 8:11): branquinha, asas que batem de alegria; ramo de oliveira e luz na fase final.
    private func drawDove(_ ctx: GraphicsContext, _ p: Pose) -> CGPoint {
        let R = p.R, cx = p.cx, ground = p.ground, t = p.t, baby = p.stage.baby
        let down = Tint(0.93, 0.91, 0.86)
        let white = Tint(0.995, 0.995, 0.99).mix(down, baby), shade = Tint(0.86, 0.89, 0.94).mix(down.mix(Tint(0.8, 0.78, 0.74), 0.5), baby)
        let tipC = Tint(0.74, 0.79, 0.87).mix(shade, baby)
        let beak = Color(red: 0.94, green: 0.62, blue: 0.56), feet = Color(red: 0.95, green: 0.52, blue: 0.5)

        let bodyC = CGPoint(x: cx, y: ground - R * 0.2 - R * 0.75 * p.breathe)
        if p.stage == .coroa { glow(ctx, CGPoint(x: cx, y: bodyC.y - R * 0.55), R * 1.8, t, Color(red: 1, green: 0.95, blue: 0.7)) }

        // Patinhas
        for sgn in [-1.0, 1.0] {
            let f = CGPoint(x: cx + CGFloat(sgn) * R * 0.22, y: ground - R * 0.04)
            for k in [-1.0, 0.0, 1.0] {
                var l = Path(); l.move(to: CGPoint(x: f.x, y: f.y - R * 0.12)); l.addLine(to: CGPoint(x: f.x + CGFloat(k) * R * 0.09, y: f.y + R * 0.02))
                ctx.stroke(l, with: .color(feet), style: StrokeStyle(lineWidth: R * 0.05, lineCap: .round))
            }
        }
        // Corpo com volume (luz de cima, sombra embaixo), para o branco não sumir no céu claro
        func shaded(_ c: CGPoint, _ w: CGFloat, _ h: CGFloat) {
            let path = oval(c, w, h)
            ctx.fill(path, with: .radialGradient(Gradient(colors: [white.c, white.c, shade.c]), center: CGPoint(x: c.x - w * 0.12, y: c.y - h * 0.18), startRadius: 0, endRadius: max(w, h) * 0.62))
            ctx.stroke(path, with: .color(shade.mix(Tint(0.6, 0.65, 0.75), 0.35).c.opacity(0.55)), lineWidth: R * 0.02)
        }
        shaded(bodyC, R * 1.36, R * 1.48)
        // Penugem de filhote
        if baby > 0 {
            for i in 0..<10 {
                let a = Double(i) / 10 * 2 * .pi
                ctx.fill(oval(CGPoint(x: bodyC.x + CGFloat(cos(a)) * R * 0.6, y: bodyC.y + CGFloat(sin(a)) * R * 0.64), R * 0.34, R * 0.34), with: .color(down.c.opacity(baby)))
            }
        }
        // Asas por cima das laterais: dobradas; batem quando está feliz e se ajeitam de vez em quando
        let flap = p.happy ? abs(sin(t * 13)) * 0.9 : abs(p.flick) * 3
        for sgn in [-1.0, 1.0] {
            var c = ctx
            c.translateBy(x: cx + CGFloat(sgn) * R * 0.56, y: bodyC.y - R * 0.3)
            c.rotate(by: .radians(sgn * (0.36 + flap)))
            let wing = oval(CGPoint(x: 0, y: R * 0.42), R * 0.42, R * 0.92)
            c.fill(wing, with: .linearGradient(Gradient(colors: [white.c, shade.c, tipC.c]), startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: R * 0.88)))
            c.stroke(wing, with: .color(tipC.c.opacity(0.6)), lineWidth: R * 0.02)
            if p.stage.rawValue >= 2 {
                for k in 0..<3 {
                    var l = Path(); l.move(to: CGPoint(x: -R * 0.1 + CGFloat(k) * R * 0.1, y: R * 0.36)); l.addLine(to: CGPoint(x: -R * 0.08 + CGFloat(k) * R * 0.08, y: R * 0.76))
                    c.stroke(l, with: .color(tipC.c.opacity(0.7)), style: StrokeStyle(lineWidth: R * 0.025, lineCap: .round))
                }
            }
        }

        // Cabeça: bica o chão quando abaixa
        let peck = p.graze > 0.2 ? CGFloat(abs(sin(t * 9))) * R * 0.07 * CGFloat(p.graze) : 0
        let headC = CGPoint(x: cx + p.look, y: bodyC.y - R * 0.72 + CGFloat(p.graze) * R * 0.5 + peck)
        ctx.fill(oval(CGPoint(x: headC.x, y: headC.y + R * 0.36), R * 0.62, R * 0.2), with: .color(shade.c.opacity(0.7))) // sombra do pescoço
        shaded(headC, R * 0.86, R * 0.84)
        if baby > 0 { // topetinho de penugem
            for (dx, sz) in [(-0.08, 0.16), (0.04, 0.2), (0.14, 0.14)] {
                ctx.fill(oval(CGPoint(x: headC.x + R * dx, y: headC.y - R * 0.44), R * sz, R * sz), with: .color(down.c.opacity(baby)))
            }
        }
        let eyeY = headC.y - R * 0.05
        eyes(ctx, x: headC.x, y: eyeY, dx: R * 0.17, r: R * 0.066, R: R, p)
        // Bico (abre um pouquinho de alegria)
        let by = headC.y + R * 0.07
        ctx.fill(oval(CGPoint(x: headC.x, y: by - R * 0.01), R * 0.14, R * 0.07), with: .color(Color(red: 0.97, green: 0.92, blue: 0.9)))
        var up = Path(); up.move(to: CGPoint(x: headC.x - R * 0.08, y: by)); up.addLine(to: CGPoint(x: headC.x + R * 0.08, y: by))
        up.addQuadCurve(to: CGPoint(x: headC.x, y: by + R * 0.13), control: CGPoint(x: headC.x + R * 0.05, y: by + R * 0.08)); up.closeSubpath()
        if p.happy {
            var lo = Path(); lo.move(to: CGPoint(x: headC.x - R * 0.05, y: by + R * 0.09)); lo.addLine(to: CGPoint(x: headC.x + R * 0.05, y: by + R * 0.09)); lo.addLine(to: CGPoint(x: headC.x, y: by + R * 0.18)); lo.closeSubpath()
            ctx.fill(lo, with: .color(beak.opacity(0.85)))
        }
        ctx.fill(up, with: .color(beak))
        cheeks(ctx, x: headC.x, y: eyeY + R * 0.15, dx: R * 0.27, R: R, p, w: 0.14, h: 0.08)

        // Ramo de oliveira no bico (fase final, Gn 8:11)
        if p.stage == .coroa {
            let a = CGPoint(x: headC.x + R * 0.03, y: by + R * 0.08), b = CGPoint(x: headC.x + R * 0.62, y: by + R * 0.02 + CGFloat(sin(t * 1.4)) * R * 0.02)
            var st = Path(); st.move(to: a); st.addQuadCurve(to: b, control: CGPoint(x: headC.x + R * 0.3, y: by + R * 0.16))
            ctx.stroke(st, with: .color(Color(red: 0.45, green: 0.36, blue: 0.22)), style: StrokeStyle(lineWidth: R * 0.03, lineCap: .round))
            let leaf = Color(red: 0.47, green: 0.62, blue: 0.32), leaf2 = Color(red: 0.38, green: 0.52, blue: 0.26)
            for i in 0..<5 {
                let k = 0.25 + Double(i) * 0.18
                let q = CGPoint(x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + R * 0.1 * CGFloat(sin(k * .pi)))
                let side = i % 2 == 0 ? -1.0 : 1.0
                tilted(ctx, CGPoint(x: q.x + R * 0.02, y: q.y + CGFloat(side) * R * 0.06), R * 0.2, R * 0.08, side * 0.6, i % 2 == 0 ? leaf : leaf2)
            }
            ctx.fill(oval(CGPoint(x: a.x + (b.x - a.x) * 0.55, y: a.y + R * 0.18), R * 0.07, R * 0.08), with: .color(Color(red: 0.35, green: 0.4, blue: 0.2)))
            for i in 0..<3 { sparkle(ctx, CGPoint(x: cx + CGFloat(i - 1) * R * 0.7, y: headC.y - R * (0.7 + 0.15 * CGFloat(i % 2))), R * 0.2, t, Double(i) * 1.7) }
        }
        return bodyC
    }

    // MARK: Águia (Êx 19:4; Is 40:31): filhote de penugem branca vira águia dourada; abre as asas na fase final.
    private func drawEagle(_ ctx: GraphicsContext, _ p: Pose) -> CGPoint {
        let R = p.R, cx = p.cx, ground = p.ground, t = p.t, baby = p.stage.baby
        let fluff = Tint(0.97, 0.96, 0.93)
        let brown = Tint(0.5, 0.33, 0.21).mix(fluff, baby), brownDark = Tint(0.38, 0.24, 0.15).mix(Tint(0.86, 0.84, 0.8), baby)
        let primary = Tint(0.27, 0.17, 0.11).mix(Tint(0.8, 0.78, 0.74), baby)
        let headT = Tint(0.9, 0.7, 0.42).mix(fluff, baby), cream = Tint(0.97, 0.88, 0.7).mix(fluff, baby)
        let yellow = Color(red: 0.99, green: 0.79, blue: 0.26), yellowDeep = Color(red: 0.9, green: 0.6, blue: 0.12)

        let bodyC = CGPoint(x: cx, y: ground - R * 0.24 - R * 0.8 * p.breathe)
        if p.stage == .coroa { glow(ctx, CGPoint(x: cx, y: bodyC.y - R * 0.45), R * 2.1, t, Color(red: 1, green: 0.86, blue: 0.45)) }

        // Asas: 0 = dobradas, 1 = abertas (sempre abertas na fase final; abrem e batem de alegria)
        let open: Double = p.stage == .coroa ? 0.92 + 0.08 * sin(t * 1.2) : (p.happy ? 0.35 + 0.35 * abs(sin(t * 10)) : abs(p.flick) * 1.2)
        for sgn in [-1.0, 1.0] {
            let sh = CGPoint(x: cx + CGFloat(sgn) * R * 0.58, y: bodyC.y - R * 0.3)
            func dir(_ theta: Double) -> CGPoint { CGPoint(x: CGFloat(sgn * sin(theta)), y: CGFloat(cos(theta))) }
            // Rêmiges (penas longas e escuras), da de baixo para a de cima
            for k in (0..<6).reversed() {
                let fk = Double(k)
                let theta = (0.1 + fk * 0.06) * (1 - open) + (0.9 + fk * 0.3) * open
                let L = R * (1.08 - 0.05 * CGFloat(fk)) * CGFloat(0.95 + 0.45 * open)
                let d = dir(theta)
                tilted(ctx, CGPoint(x: sh.x + d.x * L * 0.52, y: sh.y + d.y * L * 0.52), L, R * 0.36, atan2(Double(d.y), Double(d.x)), (k % 2 == 0 ? primary : primary.mix(brownDark, 0.5)).c)
            }
            // Coberteiras (a parte "do braço"), que unem as penas num desenho de asa só
            let mid = dir(0.15 * (1 - open) + 1.55 * open)
            let Lc = R * CGFloat(0.8 + 0.2 * open)
            tilted(ctx, CGPoint(x: sh.x + mid.x * Lc * 0.42, y: sh.y + mid.y * Lc * 0.42), Lc, R * CGFloat(0.5 + 0.25 * open), atan2(Double(mid.y), Double(mid.x)), brown.c)
            tilted(ctx, CGPoint(x: sh.x + mid.x * Lc * 0.25, y: sh.y + mid.y * Lc * 0.25), Lc * 0.55, R * CGFloat(0.42 + 0.15 * open), atan2(Double(mid.y), Double(mid.x)), brownDark.c)
        }
        // "Calças" de penas e pés amarelos com garrinhas arredondadas
        for sgn in [-1.0, 1.0] {
            let x = cx + CGFloat(sgn) * R * 0.26
            ctx.fill(oval(CGPoint(x: x, y: ground - R * 0.2), R * 0.42, R * 0.34), with: .color(brownDark.c))
            for k in [-1.0, 0.0, 1.0] {
                ctx.fill(oval(CGPoint(x: x + CGFloat(k) * R * 0.09, y: ground - R * 0.03), R * 0.09, R * 0.12), with: .color(yellow))
                ctx.fill(oval(CGPoint(x: x + CGFloat(k) * R * 0.09, y: ground + R * 0.025), R * 0.04, R * 0.04), with: .color(Color(red: 0.3, green: 0.25, blue: 0.22)))
            }
        }
        // Corpo: peito um pouco mais claro, sem "escamas" (para não parecer coruja)
        ctx.fill(oval(bodyC, R * 1.3, R * 1.5), with: .color(brown.c))
        ctx.fill(oval(CGPoint(x: cx, y: bodyC.y + R * 0.18), R * 0.7, R * 0.95), with: .linearGradient(Gradient(colors: [brown.mix(cream, 0.3).c, brown.c]), startPoint: CGPoint(x: cx, y: bodyC.y - R * 0.3), endPoint: CGPoint(x: cx, y: bodyC.y + R * 0.65)))
        // Penugem de filhote (contorno fofinho)
        if baby >= 0.5 {
            for i in 0..<12 {
                let a = Double(i) / 12 * 2 * .pi
                ctx.fill(oval(CGPoint(x: bodyC.x + CGFloat(cos(a)) * R * 0.6, y: bodyC.y + CGFloat(sin(a)) * R * 0.7), R * 0.3, R * 0.3), with: .color(brown.c))
            }
        }

        // Cabeça: topo mais reto, penas da nuca para trás (dos lados, não em cima)
        let headC = CGPoint(x: cx + p.look, y: bodyC.y - R * 0.76 + CGFloat(p.graze) * R * 0.42)
        for sgn in [-1.0, 1.0] {
            for (k, dy) in [(0.0, 0.08), (1.0, 0.22)] {
                tilted(ctx, CGPoint(x: headC.x + CGFloat(sgn) * R * (0.4 + 0.02 * k), y: headC.y + R * dy), R * 0.34, R * 0.16, sgn * (0.5 + 0.25 * k), headT.mix(brown, 0.25 + 0.2 * k).c)
            }
        }
        ctx.fill(oval(headC, R * 0.92, R * 0.8), with: .color(headT.c))
        ctx.fill(oval(CGPoint(x: headC.x, y: headC.y - R * 0.28), R * 0.62, R * 0.26), with: .color(headT.mix(brown, 0.12).c)) // topo levemente mais escuro
        if baby >= 0.5 { // topetinho de penugem
            for (dx, sz) in [(-0.1, 0.18), (0.05, 0.22), (0.16, 0.15)] {
                ctx.fill(oval(CGPoint(x: headC.x + R * dx, y: headC.y - R * 0.4), R * sz, R * sz), with: .color(fluff.c))
            }
        }
        for sgn in [-1.0, 1.0] { ctx.fill(oval(CGPoint(x: headC.x + CGFloat(sgn) * R * 0.2, y: headC.y + R * 0.16), R * 0.3, R * 0.22), with: .color(cream.c)) }
        let eyeY = headC.y - R * 0.04
        eyes(ctx, x: headC.x, y: eyeY, dx: R * 0.21, r: R * 0.068, R: R, p)
        // Sobrancelhas: a marca da águia (suaves, para não ficar brava)
        if baby < 0.5 {
            for sgn in [-1.0, 1.0] {
                var b = Path()
                b.move(to: CGPoint(x: headC.x + CGFloat(sgn) * R * 0.34, y: eyeY - R * 0.1))
                b.addQuadCurve(to: CGPoint(x: headC.x + CGFloat(sgn) * R * 0.1, y: eyeY - R * 0.13), control: CGPoint(x: headC.x + CGFloat(sgn) * R * 0.22, y: eyeY - R * 0.2))
                ctx.stroke(b, with: .color(brownDark.c), style: StrokeStyle(lineWidth: R * 0.05, lineCap: .round))
            }
        }
        // Bico grande e curvo (amarelo, ponta escura)
        let by = headC.y + R * 0.04
        if p.happy { ctx.fill(oval(CGPoint(x: headC.x, y: by + R * 0.27), R * 0.14, R * 0.09), with: .color(Color(red: 0.85, green: 0.38, blue: 0.4))) }
        var bk = Path()
        bk.move(to: CGPoint(x: headC.x - R * 0.14, y: by))
        bk.addLine(to: CGPoint(x: headC.x + R * 0.14, y: by))
        bk.addQuadCurve(to: CGPoint(x: headC.x + R * 0.02, y: by + R * 0.32), control: CGPoint(x: headC.x + R * 0.17, y: by + R * 0.2))
        bk.addQuadCurve(to: CGPoint(x: headC.x - R * 0.05, y: by + R * 0.2), control: CGPoint(x: headC.x - R * 0.02, y: by + R * 0.28))
        bk.addQuadCurve(to: CGPoint(x: headC.x - R * 0.14, y: by), control: CGPoint(x: headC.x - R * 0.14, y: by + R * 0.12))
        ctx.fill(bk, with: .linearGradient(Gradient(colors: [yellow, yellowDeep]), startPoint: CGPoint(x: headC.x, y: by), endPoint: CGPoint(x: headC.x, y: by + R * 0.32)))
        ctx.fill(oval(CGPoint(x: headC.x + R * 0.04, y: by + R * 0.28), R * 0.07, R * 0.07), with: .color(Color(red: 0.42, green: 0.32, blue: 0.22)))
        ctx.fill(oval(CGPoint(x: headC.x, y: by + R * 0.01), R * 0.3, R * 0.08), with: .color(Color(red: 1, green: 0.88, blue: 0.5)))
        cheeks(ctx, x: headC.x, y: eyeY + R * 0.15, dx: R * 0.33, R: R, p, w: 0.14, h: 0.08)
        if p.stage == .coroa {
            for i in 0..<4 { sparkle(ctx, CGPoint(x: cx + CGFloat(i < 2 ? -1 : 1) * R * (1.2 + 0.35 * CGFloat(i % 2)), y: bodyC.y - R * (0.9 + 0.4 * CGFloat(i % 2))), R * 0.22, t, Double(i) * 1.3) }
        }
        return bodyC
    }

    // MARK: Jumentinho (Zc 9:9; Mt 21:1-7): orelhas compridas; manto e ramo de palmeira na fase final.
    private func drawDonkey(_ ctx: GraphicsContext, _ p: Pose) -> CGPoint {
        let R = p.R, cx = p.cx, ground = p.ground, t = p.t, baby = p.stage.baby
        let grey = Tint(0.68, 0.65, 0.63).mix(Tint(0.74, 0.7, 0.67), baby * 0.6), greyShade = Tint(0.58, 0.55, 0.54)
        let light = Color(red: 0.94, green: 0.92, blue: 0.89), dark = Color(red: 0.33, green: 0.29, blue: 0.28)
        let earIn = Color(red: 0.94, green: 0.76, blue: 0.73)

        let legH = R * 0.42
        let bodyC = CGPoint(x: cx, y: ground - legH - R * 0.74 * p.breathe)

        // Ramo de palmeira no chão (Jo 12:13), atrás dele
        if p.stage == .coroa {
            let a = CGPoint(x: cx - R * 1.15, y: ground + R * 0.02), b = CGPoint(x: cx - R * 0.72, y: ground - R * 1.35)
            var st = Path(); st.move(to: a); st.addQuadCurve(to: b, control: CGPoint(x: cx - R * 1.15, y: ground - R * 0.8))
            ctx.stroke(st, with: .color(Color(red: 0.36, green: 0.55, blue: 0.27)), style: StrokeStyle(lineWidth: R * 0.04, lineCap: .round))
            for i in 0..<9 {
                let k = 0.15 + Double(i) * 0.095
                let u = 1 - k
                let q = CGPoint(x: u * u * a.x + 2 * u * k * (cx - R * 1.15) + k * k * b.x, y: u * u * a.y + 2 * u * k * (ground - R * 0.8) + k * k * b.y)
                let sway = sin(t * 1.3 + Double(i)) * 0.05
                for sgn in [-1.0, 1.0] {
                    tilted(ctx, CGPoint(x: q.x + CGFloat(sgn) * R * 0.14, y: q.y + R * 0.05), R * 0.32 * CGFloat(1 - k * 0.4), R * 0.07, sgn * 0.5 + sway, Color(red: 0.42, green: 0.66, blue: 0.32))
                }
            }
        }
        // Cauda fininha com tufo escuro
        let swing = CGFloat(sin(t * (p.happy ? 8 : 1.4))) * R * 0.1
        var tail = Path(); tail.move(to: CGPoint(x: cx + R * 0.7, y: bodyC.y - R * 0.05))
        tail.addQuadCurve(to: CGPoint(x: cx + R * 1.0 + swing, y: bodyC.y + R * 0.6), control: CGPoint(x: cx + R * 1.05, y: bodyC.y))
        ctx.stroke(tail, with: .color(greyShade.c), style: StrokeStyle(lineWidth: R * 0.06, lineCap: .round))
        ctx.fill(oval(CGPoint(x: cx + R * 1.0 + swing, y: bodyC.y + R * 0.68), R * 0.12, R * 0.22), with: .color(dark))
        // Pernas com cascos
        for sgn in [-1.0, 1.0] {
            let x = cx + CGFloat(sgn) * R * 0.36
            ctx.fill(Path(roundedRect: CGRect(x: x - R * 0.11, y: ground - legH - R * 0.12, width: R * 0.22, height: legH + R * 0.12), cornerRadius: R * 0.08), with: .color(grey.c))
            ctx.fill(Path(roundedRect: CGRect(x: x - R * 0.12, y: ground - R * 0.12, width: R * 0.24, height: R * 0.13), cornerRadius: R * 0.05), with: .color(dark))
        }
        ctx.fill(oval(bodyC, R * 1.6, R * 1.32), with: .color(grey.mix(greyShade, 0.55).c))
        // Manto sobre as costas (Mt 21:7)
        if p.stage == .coroa {
            let red = Color(red: 0.78, green: 0.2, blue: 0.27), redDeep = Color(red: 0.62, green: 0.13, blue: 0.2)
            var m = Path()
            m.move(to: CGPoint(x: cx - R * 0.76, y: bodyC.y - R * 0.05))
            m.addQuadCurve(to: CGPoint(x: cx + R * 0.76, y: bodyC.y - R * 0.05), control: CGPoint(x: cx, y: bodyC.y - R * 0.95))
            m.addLine(to: CGPoint(x: cx + R * 0.7, y: bodyC.y + R * 0.3))
            m.addQuadCurve(to: CGPoint(x: cx - R * 0.7, y: bodyC.y + R * 0.3), control: CGPoint(x: cx, y: bodyC.y + R * 0.05))
            m.closeSubpath()
            ctx.fill(m, with: .linearGradient(Gradient(colors: [red, redDeep]), startPoint: CGPoint(x: cx, y: bodyC.y - R * 0.5), endPoint: CGPoint(x: cx, y: bodyC.y + R * 0.3)))
            var trim = Path()
            trim.move(to: CGPoint(x: cx + R * 0.7, y: bodyC.y + R * 0.3))
            trim.addQuadCurve(to: CGPoint(x: cx - R * 0.7, y: bodyC.y + R * 0.3), control: CGPoint(x: cx, y: bodyC.y + R * 0.05))
            ctx.stroke(trim, with: .color(gold), style: StrokeStyle(lineWidth: R * 0.05, lineCap: .round))
            for i in 0..<9 { // franjinha dourada
                let k = CGFloat(i) / 8, x = cx - R * 0.66 + k * R * 1.32
                let y = bodyC.y + R * 0.3 - (1 - pow(2 * k - 1, 2)) * R * 0.12
                ctx.fill(oval(CGPoint(x: x, y: y + R * 0.05), R * 0.05, R * 0.08), with: .color(gold))
            }
        }

        // Cabeça comprida, abaixa para pastar
        let headC = CGPoint(x: cx + p.look, y: bodyC.y - R * 0.18 + CGFloat(p.graze) * R * 0.36)
        // Orelhas compridas: giram a partir da base; sacodem de vez em quando e levantam de alegria
        for sgn in [-1.0, 1.0] {
            var c = ctx
            c.translateBy(x: headC.x + CGFloat(sgn) * R * 0.22, y: headC.y - R * 0.42)
            c.rotate(by: .radians(sgn * (0.42 + p.flick * 2) - (p.happy ? sgn * 0.25 : 0)))
            let L = R * (0.72 + 0.1 * baby)
            c.fill(oval(CGPoint(x: 0, y: -L / 2), R * 0.3, L), with: .color(grey.c))
            c.fill(oval(CGPoint(x: 0, y: -L / 2 + R * 0.04), R * 0.15, L * 0.72), with: .color(earIn))
            c.fill(oval(CGPoint(x: 0, y: -L + R * 0.1), R * 0.2, R * 0.16), with: .color(dark))
        }
        ctx.fill(oval(headC, R * 0.84, R * 1.12), with: .color(grey.c))
        // Florzinha atrás da orelha (a partir do campo florido)
        if p.stage.rawValue >= 4 {
            let f = CGPoint(x: headC.x + R * 0.36, y: headC.y - R * 0.4)
            for k in 0..<5 {
                let a = Double(k) * 2 * .pi / 5 + 0.3
                ctx.fill(oval(CGPoint(x: f.x + CGFloat(cos(a)) * R * 0.07, y: f.y + CGFloat(sin(a)) * R * 0.07), R * 0.09, R * 0.09), with: .color(Color(red: 1, green: 0.72, blue: 0.82)))
            }
            ctx.fill(oval(f, R * 0.07, R * 0.07), with: .color(Color(red: 1, green: 0.85, blue: 0.35)))
        }
        // Topete: mechinhas penteadas para a frente (mais arrepiadas no filhote)
        let mane = Color(red: 0.42, green: 0.37, blue: 0.36)
        for (dx, a) in [(-0.07, -0.45), (0.0, 0.0), (0.07, 0.45)] {
            tilted(ctx, CGPoint(x: headC.x + R * dx, y: headC.y - R * (0.5 + 0.03 * baby)), R * 0.1 * (1 + 0.3 * baby), R * 0.26 * (1 + 0.3 * baby), a, mane)
        }
        // Focinho claro e comprido, com narinas
        let mz = CGPoint(x: headC.x, y: headC.y + R * 0.34)
        ctx.fill(oval(mz, R * 0.76, R * 0.52), with: .color(light))
        for sgn in [-1.0, 1.0] { ctx.fill(oval(CGPoint(x: mz.x + CGFloat(sgn) * R * 0.14, y: mz.y - R * 0.04), R * 0.07, R * 0.09), with: .color(greyShade.c)) }
        smile(ctx, at: CGPoint(x: mz.x, y: mz.y + R * 0.02), R: R, p, small: 0.1, big: 0.15)
        let eyeY = headC.y - R * 0.1
        eyes(ctx, x: headC.x, y: eyeY, dx: R * 0.21, r: R * 0.07, R: R, p)
        cheeks(ctx, x: headC.x, y: eyeY + R * 0.18, dx: R * 0.32, R: R, p, w: 0.14, h: 0.08)
        if p.stage == .coroa {
            for i in 0..<3 { sparkle(ctx, CGPoint(x: cx + CGFloat(i - 1) * R * 0.8, y: headC.y - R * (0.95 + 0.2 * CGFloat(i % 2))), R * 0.2, t, Double(i) * 1.9) }
        }
        return bodyC
    }
}
