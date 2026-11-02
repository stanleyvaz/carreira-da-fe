import SwiftUI

// MARK: - Companheiro: uma ovelhinha que cresce com o que você faz.
// Gamificação leve: cresce a cada reflexão, etapa e prática; NUNCA encolhe, nem cobra. Sem ranking.

enum CompanionStage: Int, CaseIterable {
    case recemNascido, cordeirinho, ovelhinha, ovelha, campoFlorido, coroa

    var name: String { ["Recém-nascido", "Cordeirinho", "Ovelhinha", "Ovelha", "Ovelha no campo florido", "Ovelha coroada de flores"][rawValue] }
    /// Total de reflexões + etapas + práticas necessário para chegar neste estágio.
    var threshold: Int { [0, 3, 10, 25, 50, 100][rawValue] }
    var next: CompanionStage? { CompanionStage(rawValue: rawValue + 1) }
    /// Tamanho do corpo (cresce de verdade).
    var scale: CGFloat { [0.58, 0.7, 0.82, 0.94, 1, 1][rawValue] }
    /// Quantidade de tufos de lã (mais fofa a cada estágio).
    var puffs: Int { [6, 8, 10, 12, 13, 13][rawValue] }

    static func from(total: Int) -> CompanionStage { allCases.last { total >= $0.threshold } ?? .recemNascido }
    func progress(total: Int) -> Double {
        guard let n = next else { return 1 }
        return min(1, max(0, Double(total - threshold) / Double(n.threshold - threshold)))
    }
}

// MARK: - Desenho (Canvas + TimelineView; estático com "Reduzir movimento")
struct CompanionView: View {
    let stage: CompanionStage
    /// Mude este valor para a ovelhinha reagir (pulinho, olhos felizes, brilhos).
    var reaction: Int = 0
    /// false quando ela vive dentro do cenário (que já desenha o chão); desenha só uma sombra.
    var showGround = true

    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var happyUntil = Date.distantPast
    /// Ritual de conclusão: depois de comemorar, ela abaixa a cabeça e pasta (de onde nasce a flor nova).
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
        func oval(_ c: CGPoint, _ w: CGFloat, _ h: CGFloat) -> Path { Path(ellipseIn: CGRect(x: c.x - w / 2, y: c.y - h / 2, width: w, height: h)) }

        let wool = Color(red: 0.98, green: 0.96, blue: 0.9), woolShade = Color(red: 0.88, green: 0.85, blue: 0.8)
        let skin = Color(red: 0.95, green: 0.85, blue: 0.76), ear = Color(red: 0.93, green: 0.7, blue: 0.66)
        let dark = Color(red: 0.32, green: 0.27, blue: 0.27), ink = Color(red: 0.2, green: 0.13, blue: 0.1)
        let pink = Color(red: 1, green: 0.6, blue: 0.58)

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

        // Dimensões (crescem com o estágio)
        let breathe = 1 + sin(t * 2.2) * 0.016
        let R = s * 0.27 * stage.scale
        let legH = R * 0.38
        let bodyC = CGPoint(x: cx, y: ground - legH - R * 0.9 * breathe)

        // Pernas
        for sgn in [-1.0, 1.0] {
            let r = CGRect(x: cx + CGFloat(sgn) * R * 0.38 - R * 0.11, y: ground - legH - R * 0.1, width: R * 0.22, height: legH + R * 0.1)
            ctx.fill(Path(roundedRect: r, cornerRadius: R * 0.1), with: .color(dark))
        }

        // Lã: nuvem de tufos que balança de leve
        for i in 0..<stage.puffs {
            let a = Double(i) / Double(stage.puffs) * 2 * .pi
            let wob = CGFloat(sin(t * 1.5 + Double(i) * 0.9)) * R * 0.015
            let p = CGPoint(x: bodyC.x + CGFloat(cos(a)) * R * 0.78 + wob, y: bodyC.y + CGFloat(sin(a)) * R * 0.72)
            ctx.fill(oval(p, R * 0.78, R * 0.78), with: .color(i % 2 == 0 ? wool : woolShade))
        }
        ctx.fill(oval(bodyC, R * 1.7, R * 1.6), with: .color(wool))

        // Orelhas (balançam)
        let flick = sin(t * 0.9) > 0.92 ? sin(t * 40) * 0.12 : 0
        // Vida própria: olha de um lado a outro e, de tempos em tempos, abaixa a cabeça para pastar
        let ph = t.truncatingRemainder(dividingBy: 13)
        let graze: Double = max(ph > 9.5 ? sin((ph - 9.5) / 3.5 * .pi) : 0, ritual)
        let look = CGFloat(sin(t * 0.55)) * R * 0.08
        let headC = CGPoint(x: cx + look, y: bodyC.y + R * 0.2 + CGFloat(graze) * R * 0.32)
        for sgn in [-1.0, 1.0] {
            var c = ctx
            c.translateBy(x: headC.x + CGFloat(sgn) * R * 0.62, y: headC.y - R * 0.08)
            c.rotate(by: .radians(sgn * (0.75 + flick) + (happy ? -sgn * 0.35 : 0)))
            c.fill(oval(.zero, R * 0.55, R * 0.3), with: .color(ear))
        }
        // Cabeça e topete
        ctx.fill(oval(headC, R * 1.02, R * 1.12), with: .color(skin))
        ctx.fill(oval(CGPoint(x: headC.x, y: headC.y - R * 0.5), R * 0.62, R * 0.4), with: .color(wool))
        ctx.fill(oval(CGPoint(x: headC.x - R * 0.2, y: headC.y - R * 0.46), R * 0.32, R * 0.3), with: .color(woolShade))

        // Coroa de flores (estágio final)
        if stage == .coroa {
            for i in 0..<7 {
                let a = Double.pi * (1.1 + 0.8 * Double(i) / 6)
                let p = CGPoint(x: headC.x + CGFloat(cos(a)) * R * 0.52, y: headC.y + CGFloat(sin(a)) * R * 0.58 - R * 0.06)
                ctx.fill(oval(p, R * 0.2, R * 0.2), with: .color([Color(red: 1, green: 0.7, blue: 0.82), Color(red: 1, green: 0.88, blue: 0.4), .white][i % 3]))
            }
        }

        // Rosto
        let eyeDX = R * 0.22, eyeR = R * 0.075, eyeY = headC.y - R * 0.04
        let blink = t.truncatingRemainder(dividingBy: 4.2) < 0.13 || graze > 0.4
        for sgn in [-1.0, 1.0] {
            let e = CGPoint(x: headC.x + CGFloat(sgn) * eyeDX, y: eyeY)
            if happy {
                var p = Path(); p.addArc(center: CGPoint(x: e.x, y: e.y + eyeR), radius: eyeR * 1.3, startAngle: .degrees(200), endAngle: .degrees(340), clockwise: false)
                ctx.stroke(p, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.05, lineCap: .round))
            } else if blink {
                var p = Path(); p.move(to: CGPoint(x: e.x - eyeR, y: e.y)); p.addLine(to: CGPoint(x: e.x + eyeR, y: e.y))
                ctx.stroke(p, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.04, lineCap: .round))
            } else {
                ctx.fill(oval(e, eyeR * 2, eyeR * 2.3), with: .color(ink))
                ctx.fill(oval(CGPoint(x: e.x + eyeR * 0.3, y: e.y - eyeR * 0.4), eyeR * 0.7, eyeR * 0.7), with: .color(.white))
            }
        }
        ctx.fill(oval(CGPoint(x: headC.x, y: eyeY + R * 0.2), R * 0.16, R * 0.1), with: .color(pink))
        var mouth = Path()
        mouth.addArc(center: CGPoint(x: headC.x, y: eyeY + R * 0.26), radius: happy ? R * 0.17 : R * 0.11, startAngle: .degrees(25), endAngle: .degrees(155), clockwise: false)
        ctx.stroke(mouth, with: .color(ink), style: StrokeStyle(lineWidth: R * 0.04, lineCap: .round))
        for sgn in [-1.0, 1.0] {
            ctx.fill(oval(CGPoint(x: headC.x + CGFloat(sgn) * (eyeDX + R * 0.17), y: eyeY + R * 0.18), R * 0.18, R * 0.11), with: .color(pink.opacity(happy ? 0.7 : 0.4)))
        }

        // Brilhos ao reagir
        if happy && !reduce {
            let prog = 1 - happyLeft / 1.8
            // Corações e estrelas sobem em volta dela
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
}
