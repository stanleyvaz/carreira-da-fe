import SwiftUI

// MARK: - O mundo da ovelhinha: o cenário É a tela (estilo "pet app"), o conteúdo sobe como uma folha por cima.
// O mundo cresce com o que a pessoa faz (flores, árvore, arco-íris) e nunca encolhe.

// MARK: Cores e céu por hora do dia
private struct RGB {
    var r, g, b: Double
    func mix(_ o: RGB, _ k: Double) -> RGB { RGB(r: r + (o.r - r) * k, g: g + (o.g - g) * k, b: b + (o.b - b) * k) }
    var color: Color { Color(red: r, green: g, blue: b) }
}
private func rgb(_ r: Double, _ g: Double, _ b: Double) -> RGB { RGB(r: r, g: g, b: b) }
private func frac(_ x: Double) -> CGFloat { CGFloat(x - floor(x)) }

private enum Sky {
    static let stops: [(Double, RGB, RGB)] = [
        (0, rgb(0.04, 0.06, 0.18), rgb(0.14, 0.17, 0.36)),
        (5, rgb(0.05, 0.07, 0.20), rgb(0.16, 0.18, 0.38)),
        (6.3, rgb(0.42, 0.46, 0.78), rgb(1.0, 0.72, 0.56)),
        (8.5, rgb(0.34, 0.64, 0.95), rgb(0.78, 0.90, 1.0)),
        (16, rgb(0.34, 0.64, 0.95), rgb(0.78, 0.90, 1.0)),
        (18.4, rgb(0.34, 0.30, 0.62), rgb(1.0, 0.56, 0.40)),
        (19.8, rgb(0.07, 0.08, 0.24), rgb(0.20, 0.20, 0.42)),
        (24, rgb(0.04, 0.06, 0.18), rgb(0.14, 0.17, 0.36)),
    ]
    static func colors(_ h: Double) -> (RGB, RGB) {
        for i in 1..<stops.count where h <= stops[i].0 {
            let a = stops[i - 1], b = stops[i]
            let k = (h - a.0) / (b.0 - a.0)
            return (a.1.mix(b.1, k), a.2.mix(b.2, k))
        }
        return (stops[stops.count - 1].1, stops[stops.count - 1].2)
    }
    /// 0 = noite, 1 = dia pleno
    static func light(_ h: Double) -> Double {
        if h < 5.5 { return 0 }
        if h < 7.5 { return (h - 5.5) / 2 }
        if h < 17.5 { return 1 }
        if h < 19.5 { return 1 - (h - 17.5) / 2 }
        return 0
    }
}

// MARK: - Fundo: céu, astros, nuvens, colinas, grama, flores, árvore, borboletas e vaga-lumes
struct WorldBackdrop: View {
    let stage: CompanionStage
    let total: Int
    var reaction: Int = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    // Ritual: a conclusão faz nascer uma flor nova, depois que a ovelhinha pasta.
    @State private var pendingSince = Date.distantPast
    @State private var lastIncrease = Date.distantPast
    @State private var bloomStart = Date.distantFuture
    @State private var bloomIndex = -1

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduce)) { tl in
            Canvas { ctx, size in draw(ctx, size, date: tl.date) }
        }
        .accessibilityHidden(true)
        .onChange(of: reaction) { _, _ in
            let now = Date()
            pendingSince = now
            // O total pode já ter subido antes da reação (ordem inversa).
            if now.timeIntervalSince(lastIncrease) < 4 { startBloom(total, delay: 2.7 - now.timeIntervalSince(pendingSince)) }
        }
        .onChange(of: total) { old, new in
            guard new > old else { return }
            let now = Date()
            lastIncrease = now
            if now.timeIntervalSince(pendingSince) < 10 { startBloom(new, delay: 2.7 - now.timeIntervalSince(pendingSince)); pendingSince = .distantPast }
        }
    }

    private func startBloom(_ total: Int, delay: Double) {
        bloomIndex = min(44, 4 + total) - 1
        bloomStart = Date().addingTimeInterval(reduce ? 0 : max(0.3, delay))
    }

    private func easeOutBack(_ x: Double) -> CGFloat {
        let c1 = 1.70158, c3 = c1 + 1, y = x - 1
        return CGFloat(1 + c3 * y * y * y + c1 * y * y)
    }

    private func oval(_ c: CGPoint, _ w: CGFloat, _ h: CGFloat) -> Path { Path(ellipseIn: CGRect(x: c.x - w / 2, y: c.y - h / 2, width: w, height: h)) }

    private func draw(_ ctx: GraphicsContext, _ size: CGSize, date: Date) {
        let W = size.width, H = size.height
        let t = reduce ? 0 : date.timeIntervalSinceReferenceDate
        let tf = CGFloat(t)
        let cal = Calendar.current
        var hr = Double(cal.component(.hour, from: date)) + Double(cal.component(.minute, from: date)) / 60
        #if DEBUG
        let dbg = UserDefaults.standard.double(forKey: "debugHour")   // ex.: -debugHour 21 para ver a noite
        if dbg > 0 { hr = dbg }
        #endif
        let light = Sky.light(hr)
        let (top, bot) = Sky.colors(hr)
        func tone(_ day: RGB, _ night: RGB) -> RGB { night.mix(day, light) }

        // Céu
        ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .linearGradient(Gradient(colors: [top.color, bot.color]), startPoint: .zero, endPoint: CGPoint(x: 0, y: H * 0.75)))

        // Estrelas
        if light < 0.95 {
            for i in 0..<70 {
                let x = frac(sin(Double(i) * 12.9898) * 43758.5453) * W
                let y = frac(sin(Double(i) * 78.233) * 12345.6789) * H * 0.5
                let tw = 0.5 + 0.5 * sin(t * 1.5 + Double(i))
                let r = 0.6 + 1.3 * frac(Double(i) * 0.37)
                ctx.fill(oval(CGPoint(x: x, y: y), r * 2, r * 2), with: .color(.white.opacity((1 - light) * tw * 0.9)))
            }
        }

        // Sol ou lua percorrendo o céu
        let isDay = hr >= 6 && hr <= 18.6
        let p: Double = isDay ? (hr - 6) / 12.6 : (hr > 18.6 ? (hr - 18.6) / 11.4 : (hr + 5.4) / 11.4)
        let ax = W * CGFloat(0.12 + 0.76 * p), ay = H * CGFloat(0.46 - 0.36 * sin(p * .pi))
        let ac = CGPoint(x: ax, y: ay)
        if isDay {
            let warm = rgb(1, 0.93, 0.55).mix(rgb(1, 0.6, 0.35), max(0, 1 - light * 1.4))
            ctx.fill(oval(ac, 190, 190), with: .radialGradient(Gradient(colors: [warm.color.opacity(0.55), .clear]), center: ac, startRadius: 0, endRadius: 95))
            ctx.fill(oval(ac, 40, 40), with: .color(warm.color))
        } else {
            ctx.fill(oval(ac, 150, 150), with: .radialGradient(Gradient(colors: [Color.white.opacity(0.22), .clear]), center: ac, startRadius: 0, endRadius: 75))
            ctx.fill(oval(ac, 34, 34), with: .color(Color(red: 0.97, green: 0.96, blue: 0.88)))
            ctx.fill(oval(CGPoint(x: ax + 9, y: ay - 5), 30, 30), with: .color(top.mix(bot, 0.25).color))
        }

        // Nuvens à deriva
        let cloudColor = rgb(1, 1, 1).mix(bot, 0.35).color.opacity(0.28 + 0.62 * light)
        for i in 0..<5 {
            let speed = 5.0 + Double(i) * 2.4
            let x = CGFloat((Double(i) * Double(W) / 4.2 + t * speed).truncatingRemainder(dividingBy: Double(W) + 260)) - 130
            let y = H * (0.1 + 0.07 * CGFloat(i % 3)) + CGFloat(i) * 6
            let sc = 0.8 + 0.25 * CGFloat(i % 3)
            for (dx, dy, w, hh) in [(0.0, 0.0, 90.0, 34.0), (-34.0, 6.0, 60.0, 26.0), (36.0, 8.0, 70.0, 28.0), (8.0, -12.0, 56.0, 28.0)] {
                ctx.fill(oval(CGPoint(x: x + CGFloat(dx) * sc, y: y + CGFloat(dy) * sc), CGFloat(w) * sc, CGFloat(hh) * sc), with: .color(cloudColor))
            }
        }

        // Arco-íris (estágio final, de dia)
        if stage == .coroa && light > 0.5 {
            let cs = CGPoint(x: W * 0.82, y: H * 0.64)
            let cols: [Color] = [.red, .orange, .yellow, .green, .cyan, .purple]
            for (i, c) in cols.enumerated() {
                var arc = Path()
                arc.addArc(center: cs, radius: W * 0.5 - CGFloat(i) * 7, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
                ctx.stroke(arc, with: .color(c.opacity(0.33 * (light - 0.4))), lineWidth: 7)
            }
        }

        // Colinas em camadas
        func hill(_ base: CGFloat, _ amp: CGFloat, _ freq: CGFloat, _ phase: CGFloat, _ shading: GraphicsContext.Shading) {
            var path = Path(); path.move(to: CGPoint(x: 0, y: H))
            var x: CGFloat = 0
            while x <= W + 8 { path.addLine(to: CGPoint(x: x, y: H * base + sin(x / W * freq * 2 * .pi + phase) * H * amp)); x += 8 }
            path.addLine(to: CGPoint(x: W, y: H)); path.closeSubpath()
            ctx.fill(path, with: shading)
        }
        let far = tone(rgb(0.62, 0.80, 0.72), rgb(0.10, 0.17, 0.30)).mix(bot, 0.3)
        let mid = tone(rgb(0.45, 0.72, 0.50), rgb(0.09, 0.20, 0.24)).mix(bot, 0.12)
        let nearTop = tone(rgb(0.42, 0.72, 0.38), rgb(0.09, 0.24, 0.20))
        let nearBot = tone(rgb(0.30, 0.58, 0.32), rgb(0.06, 0.16, 0.15))
        hill(0.56, 0.025, 1.1, 0.6, .color(far.color))
        hill(0.63, 0.03, 1.6, 2.0, .color(mid.color))
        hill(0.70, 0.012, 1.0, 4.0, .linearGradient(Gradient(colors: [nearTop.color, nearBot.color]), startPoint: CGPoint(x: 0, y: H * 0.68), endPoint: CGPoint(x: 0, y: H)))
        func gy(_ x: CGFloat) -> CGFloat { H * 0.70 + sin(x / W * 2 * .pi + 4) * H * 0.012 }

        // Grama balançando
        var blades = Path()
        for i in 0..<90 {
            let x = W * frac(sin(Double(i) * 12.7) * 917.3)
            let y = H * (0.715 + 0.12 * frac(sin(Double(i) * 5.9) * 313.7))
            let len = W * 0.025 * (0.7 + frac(Double(i) * 0.713))
            let sw = sin(tf * 1.6 + CGFloat(i)) * len * 0.25
            blades.move(to: CGPoint(x: x, y: y))
            blades.addQuadCurve(to: CGPoint(x: x + sw, y: y - len), control: CGPoint(x: x + sw * 0.3, y: y - len * 0.5))
        }
        ctx.stroke(blades, with: .color(nearTop.mix(rgb(0, 0.15, 0.05), 0.25).color), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))

        // Árvore (a partir da fase "Ovelha")
        if stage.rawValue >= 3 {
            let k: CGFloat = stage.rawValue == 3 ? 0.8 : (stage.rawValue == 4 ? 0.95 : 1.1)
            let bx = W * 0.14, by = gy(W * 0.14) + H * 0.012
            let bark = tone(rgb(0.5, 0.35, 0.22), rgb(0.2, 0.15, 0.12))
            ctx.fill(Path(roundedRect: CGRect(x: bx - W * 0.014, y: by - W * 0.15 * k, width: W * 0.028, height: W * 0.15 * k), cornerRadius: W * 0.01), with: .color(bark.color))
            let leaf = tone(rgb(0.36, 0.70, 0.40), rgb(0.10, 0.28, 0.22)), leaf2 = tone(rgb(0.27, 0.58, 0.34), rgb(0.07, 0.22, 0.18))
            let blobs: [(CGFloat, CGFloat, CGFloat)] = [(-0.05, -0.15, 0.07), (0.05, -0.15, 0.07), (0, -0.21, 0.085), (0, -0.13, 0.08)]
            for (i, b) in blobs.enumerated() {
                let sway = sin(tf * 1.2 + CGFloat(i)) * W * 0.003
                ctx.fill(oval(CGPoint(x: bx + W * b.0 * k + sway, y: by + W * b.1 * k), W * b.2 * 2 * k, W * b.2 * 1.8 * k), with: .color((i % 2 == 0 ? leaf : leaf2).color))
            }
            if stage.rawValue >= 4 {
                for (i, d) in [(-0.06, -0.17), (0.06, -0.19), (0.0, -0.25), (-0.02, -0.12), (0.08, -0.13)].enumerated() {
                    ctx.fill(oval(CGPoint(x: bx + W * CGFloat(d.0) * k, y: by + W * CGFloat(d.1) * k + sin(tf + CGFloat(i)) * 1.5), W * 0.02, W * 0.02), with: .color(Color(red: 1, green: 0.75, blue: 0.85)))
                }
            }
        }

        // Flores: uma nova para cada passo dado (o mundo cresce, nunca murcha)
        let n = min(44, 4 + total)
        let pal: [Color] = [Color(red: 1, green: 0.82, blue: 0.3), Color(red: 1, green: 0.7, blue: 0.82), .white, Color(red: 0.7, green: 0.8, blue: 1), Color(red: 1, green: 0.6, blue: 0.5)]
        let stem = nearTop.mix(rgb(0, 0.3, 0.1), 0.4).color
        for i in 0..<n {
            let fi = CGFloat(i)
            let x = W * (0.04 + 0.92 * frac(sin(Double(i) * 91.3 + 3.1) * 437.5))
            let yy = H * (0.735 + 0.1 * frac(sin(Double(i) * 17.7 + 1.3) * 913.1))
            let depth = (yy - H * 0.735) / (H * 0.1)
            var sz = W * (0.02 + 0.022 * depth)
            if i == bloomIndex {
                // A flor nova brota: cresce com um pequeno "pulo" e solta brilhos
                let e = date.timeIntervalSince(bloomStart)
                if e < 0 { continue }
                sz *= e < 1 ? easeOutBack(e) : 1
                if e < 1.6 {
                    let c = CGPoint(x: x, y: yy - sz * 1.7)
                    ctx.fill(oval(c, sz * 5, sz * 5), with: .radialGradient(Gradient(colors: [Color(red: 1, green: 0.9, blue: 0.5).opacity(0.7 * (1 - e / 1.6)), .clear]), center: c, startRadius: 0, endRadius: sz * 2.5))
                    for k in 0..<6 {
                        let a = Double(k) / 6 * 2 * .pi + e * 2
                        let r = sz * (1.2 + CGFloat(e) * 2.2)
                        ctx.draw(Text("✦").font(.system(size: sz * 0.7)).foregroundStyle(Color(red: 1, green: 0.88, blue: 0.4).opacity(max(0, 1 - e / 1.6))), at: CGPoint(x: c.x + CGFloat(cos(a)) * r, y: c.y + CGFloat(sin(a)) * r))
                    }
                }
            }
            let sw = sin(tf * 1.3 + fi) * sz * 0.12
            let head = CGPoint(x: x + sw, y: yy - sz * 1.7)
            var st = Path(); st.move(to: CGPoint(x: x, y: yy)); st.addLine(to: head)
            ctx.stroke(st, with: .color(stem), lineWidth: max(1, sz * 0.1))
            let col = pal[i % pal.count].opacity(0.55 + 0.45 * light)
            for kk in 0..<5 {
                let a = Double(kk) * 2 * .pi / 5 + Double(i)
                ctx.fill(oval(CGPoint(x: head.x + CGFloat(cos(a)) * sz * 0.42, y: head.y + CGFloat(sin(a)) * sz * 0.42), sz * 0.5, sz * 0.5), with: .color(col))
            }
            ctx.fill(oval(head, sz * 0.36, sz * 0.36), with: .color(Color(red: 0.95, green: 0.7, blue: 0.2)))
        }

        // Borboletas de dia (a partir da fase "Ovelhinha")
        if stage.rawValue >= 2 && light > 0.4 {
            for i in 0..<(stage.rawValue - 1) {
                let fi = Double(i)
                let cx0 = Double(W) * (0.2 + 0.6 * Double(frac(fi * 0.37)))
                let px = CGFloat(cx0 + sin(t * 0.4 + fi * 2) * Double(W) * 0.25)
                let py = H * 0.5 + CGFloat(sin(t * 0.7 + fi)) * H * 0.07 + CGFloat(cos(t * 0.3 + fi * 3)) * H * 0.04
                let flap = CGFloat(abs(sin(t * 10 + fi))) * 9 + 2
                let wing = [Color(red: 1, green: 0.6, blue: 0.3), Color(red: 0.6, green: 0.7, blue: 1), Color(red: 1, green: 0.7, blue: 0.85)][i % 3]
                for sgn in [-1.0, 1.0] { ctx.fill(oval(CGPoint(x: px + CGFloat(sgn) * flap * 0.55, y: py), flap, 11), with: .color(wing.opacity(0.9))) }
                ctx.fill(oval(CGPoint(x: px, y: py), 2.5, 10), with: .color(.black.opacity(0.6)))
            }
        }

        // Vaga-lumes à noite
        if light < 0.5 {
            for i in 0..<16 {
                let fi = Double(i)
                let x = W * (0.1 + 0.8 * frac(fi * 0.618)) + CGFloat(sin(t * 0.5 + fi) * 20)
                let y = H * (0.45 + 0.3 * frac(fi * 0.381)) + CGFloat(cos(t * 0.4 + fi * 2) * 14)
                let a = (1 - light * 2) * (0.5 + 0.5 * sin(t * 2 + fi * 1.7))
                let c = CGPoint(x: x, y: y)
                ctx.fill(oval(c, 22, 22), with: .radialGradient(Gradient(colors: [Color(red: 0.85, green: 1, blue: 0.4).opacity(a * 0.8), .clear]), center: c, startRadius: 0, endRadius: 11))
                ctx.fill(oval(c, 3, 3), with: .color(Color(red: 1, green: 1, blue: 0.7).opacity(a)))
            }
        }
    }
}

// MARK: - Balão de fala
private struct Triangle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(); p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY)); p.closeSubpath(); return p
    }
}
private struct SpeechBubble: View {
    let text: String
    var body: some View {
        Text(text).font(.callout.weight(.medium)).multilineTextAlignment(.center)
            .foregroundStyle(Color(red: 0.2, green: 0.13, blue: 0.1))
            .padding(.horizontal, 16).padding(.vertical, 11)
            .background(Color.white.opacity(0.96), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(alignment: .bottom) { Triangle().fill(Color.white.opacity(0.96)).frame(width: 16, height: 9).offset(y: 8) }
            .shadow(color: .black.opacity(0.18), radius: 8, y: 3)
            .frame(maxWidth: 270)
    }
}

/// Texto que sobe e some (recompensa "+1").
private struct RisingLabel: View {
    let text: String
    @State private var p: CGFloat = 0
    var body: some View {
        Text(text).font(.title3.bold()).foregroundStyle(.white).shadow(color: .black.opacity(0.35), radius: 4, y: 1)
            .offset(y: -70 * p).opacity(p < 0.65 ? 1 : Double((1 - p) / 0.35)).scaleEffect(0.8 + 0.4 * min(1, p * 3))
            .onAppear { withAnimation(.easeOut(duration: 1.7)) { p = 1 } }
            .accessibilityHidden(true)
    }
}

// MARK: - Cena: fundo + ovelhinha grande, que fala e reage ao toque
struct WorldScene: View {
    let stage: CompanionStage
    let total: Int
    var name: String?
    var todayDone: Bool?
    var reaction: Int
    var poke: Int

    @State private var phrase: String?
    @State private var bubbleID = 0
    @State private var plusID: Int?

    private static let pokes = ["Béé! 🐑", "Cosquinha! Hihi", "Sem pressa, eu estou aqui.", "Respira fundo comigo… 🌿", "Você está indo bem.", "Que tal um versículo?", "Gosto quando você aparece."]
    private static let thanks = ["Que alegria! 💛", "Obrigada por caminhar comigo!", "Eu senti isso aqui no coração."]
    private static let idle = ["O dia está lindo, não está?", "Estou pastando um pouquinho… 🌼", "Deus cuida de cada detalhe.", "Quando quiser, eu estou aqui."]

    private var greetingPhrase: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let n = name ?? ""
        if todayDone == false {
            if hour < 12 { return Phrases.shared.pick("greeting_morning", name: n, fallback: ["Bom dia, {nome}! Vamos ler a Palavra de hoje?"]) }
            if hour < 18 { return Phrases.shared.pick("greeting_afternoon", name: n, fallback: ["Boa tarde, {nome}! A reflexão de hoje está te esperando."]) }
            return Phrases.shared.pick("greeting_evening", name: n, fallback: ["Boa noite, {nome}. Um minutinho com a Palavra antes de dormir?"])
        }
        if todayDone == true { return Phrases.shared.pick("greeting_done", name: n, fallback: ["Hoje já foi lindo, {nome}. Pode descansar comigo."]) }
        return Phrases.shared.pick("greeting_default", name: n, fallback: ["Oi, {nome}! Que bom te ver. 🐑"])
    }

    private func say(_ s: String, for seconds: Double = 4.5) {
        withAnimation(.spring(duration: 0.45, bounce: 0.35)) { phrase = s }
        bubbleID += 1
        let id = bubbleID
        Task {
            try? await Task.sleep(for: .seconds(seconds))
            if id == bubbleID { withAnimation(.easeIn(duration: 0.3)) { phrase = nil } }
        }
    }

    var body: some View {
        GeometryReader { geo in
            let W = geo.size.width, H = geo.size.height
            let side = min(W * 0.84, H * 0.5)
            let groundY = H * 0.795
            let frameTop = groundY - side * 0.86
            let R = 0.27 * side * stage.scale
            let bubbleY = frameTop + side * 0.86 - R * 2.5 - 30
            ZStack {
                WorldBackdrop(stage: stage, total: total, reaction: reaction)
                CompanionView(stage: stage, reaction: reaction &+ poke, showGround: false)
                    .frame(width: side, height: side)
                    .position(x: W / 2, y: frameTop + side / 2)
                if let phrase {
                    SpeechBubble(text: phrase)
                        .position(x: W / 2, y: bubbleY)
                        .transition(.scale(scale: 0.5, anchor: .bottom).combined(with: .opacity))
                }
                if let id = plusID {
                    RisingLabel(text: "+1 🌼").id(id).position(x: W / 2 + side * 0.24, y: frameTop + side * 0.5)
                }
            }
            .frame(width: W, height: H)
        }
        .onChange(of: poke) { _, _ in say(Phrases.shared.pick("poke", name: name, fallback: Self.pokes), for: 3.5) }
        .onChange(of: reaction) { _, _ in
            say(Phrases.shared.pick("thanks", name: name, fallback: Self.thanks), for: 4)
            // Ritual: comemora, pasta e, quando a flor nasce, toca um som suave e aparece "+1"
            Task {
                try? await Task.sleep(for: .seconds(2.9))
                FX.shared.bookmarked()
                plusID = (plusID ?? 0) + 1
                try? await Task.sleep(for: .seconds(1.8))
                plusID = nil
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(1.2))
            say(greetingPhrase)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(24))
                if Task.isCancelled { break }
                say(Phrases.shared.pick("idle", name: name, fallback: Self.idle), for: 4)
            }
        }
    }
}

// MARK: - Tela-mundo: cenário de fundo fixo (com parallax) + folha de conteúdo que sobe por cima
struct WorldScreen<Content: View>: View {
    let counts: Week
    var greeting: String
    var name: String? = nil
    var todayDone: Bool? = nil
    var activeDays: Int? = nil
    var reaction: Int = 0
    var sceneFraction: CGFloat = 0.66
    var onRefresh: (() async -> Void)? = nil
    @ViewBuilder var content: Content

    @AppStorage("companionStageSeen") private var seen = -1
    @State private var grew = false
    @State private var burstTick = 0
    @State private var poke = 0
    @State private var scroll: CGFloat = 0
    @State private var base: CGFloat?

    @State private var debugBonus = 0   // só usado em DEBUG (-debugRitual 1) para ver o ritual sem concluir nada
    @State private var debugTick = 0

    private var total: Int { counts.reflections + counts.steps + counts.activities + debugBonus }
    private var stage: CompanionStage { .from(total: total) }

    var body: some View {
        GeometryReader { geo in
            let top = geo.safeAreaInsets.top
            let W = geo.size.width
            let fullH = geo.size.height + top
            let sceneH = fullH * sceneFraction
            ZStack(alignment: .top) {
                Color(.systemGroupedBackground).ignoresSafeArea()
                // Cenário (fica atrás; sobe devagar ao rolar e estica ao puxar)
                ZStack(alignment: .topLeading) {
                    WorldScene(stage: stage, total: total, name: name, todayDone: todayDone, reaction: reaction &+ debugTick, poke: poke)
                    hud(top: top)
                    Burst(trigger: burstTick).frame(maxWidth: .infinity, maxHeight: .infinity)
                    if grew { banner.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center).offset(y: -sceneH * 0.1) }
                }
                .frame(width: W, height: sceneH)
                .scaleEffect(scroll < 0 ? 1 + (-scroll) / 700 : 1, anchor: .top)
                .offset(y: -top + (scroll > 0 ? -scroll * 0.45 : 0))
                .accessibilityElement(children: .contain)

                ScrollView {
                    VStack(spacing: 0) {
                        // Área "vazia" sobre o cenário: tocar nela faz carinho na ovelhinha
                        Color.clear.frame(height: max(0, sceneH * 0.86 - top))
                            .contentShape(Rectangle())
                            .onTapGesture { poke &+= 1; FX.shared.tap() }
                            .accessibilityLabel("Fazer carinho na ovelhinha").accessibilityAddTraits(.isButton)
                        VStack(spacing: 0) {
                            Capsule().fill(Color.secondary.opacity(0.35)).frame(width: 40, height: 5).padding(.top, 10).padding(.bottom, 8)
                            content
                        }
                        .frame(maxWidth: .infinity, minHeight: fullH * 0.75, alignment: .top)
                        .background(Color(.systemGroupedBackground), in: UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32, style: .continuous))
                        .shadow(color: .black.opacity(0.14), radius: 14, y: -4)
                    }
                    .background(GeometryReader { g in
                        Color.clear.preference(key: WorldScrollKey.self, value: g.frame(in: .named("world")).minY)
                    })
                }
                .coordinateSpace(name: "world")
                .onPreferenceChange(WorldScrollKey.self) { y in
                    if base == nil { base = y }
                    scroll = (base ?? y) - y
                }
                .refreshable { await onRefresh?() }
            }
        }
        .onAppear { sync() }
        .onChange(of: stage) { _, _ in sync() }
        #if DEBUG
        .task {
            guard UserDefaults.standard.bool(forKey: "debugRitual") else { return }
            try? await Task.sleep(for: .seconds(5))
            debugTick += 1                                   // reação primeiro…
            try? await Task.sleep(for: .seconds(1))
            debugBonus += 1                                  // …e o total sobe depois (mesma ordem do app)
        }
        #endif
    }

    private var banner: some View {
        VStack(spacing: 4) {
            Text("Ela cresceu! 🎉").font(.headline)
            Text("Agora: \(stage.name)").font(.subheadline)
        }
        .padding(.horizontal, 22).padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .transition(.scale(scale: 0.6).combined(with: .opacity))
    }

    private func hud(top: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(greeting).font(.system(.largeTitle, design: .rounded, weight: .bold)).foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 6, y: 2).lineLimit(2).minimumScaleFactor(0.7)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 8) {
                HStack(spacing: 7) {
                    ZStack {
                        Circle().stroke(.white.opacity(0.3), lineWidth: 3)
                        Circle().trim(from: 0, to: max(0.03, stage.progress(total: total))).stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
                    }.frame(width: 18, height: 18)
                    Text("Fase \(stage.rawValue + 1) · \(stage.name)").lineLimit(1).minimumScaleFactor(0.75)
                }.chip()
                HStack(spacing: 4) { Text("🌼"); Text("\(total)").monospacedDigit().contentTransition(.numericText()) }.chip()
                    .accessibilityElement(children: .combine).accessibilityLabel("\(total) flores no campo")
                if let d = activeDays, d > 0 { HStack(spacing: 4) { Text("☀️"); Text("\(d)d").monospacedDigit() }.chip().accessibilityElement(children: .combine).accessibilityLabel("Com a Palavra em \(d) dos últimos 7 dias") }
            }
            if let n = stage.next {
                Text("Faltam \(max(0, n.threshold - total)) para ela crescer").font(.caption).foregroundStyle(.white.opacity(0.92)).shadow(color: .black.opacity(0.3), radius: 4, y: 1)
            }
        }
        .padding(.horizontal, 20).padding(.top, top + 6)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Celebra apenas quando a fase sobe (nunca na primeira abertura).
    private func sync() {
        defer { seen = max(seen, stage.rawValue) }
        guard seen >= 0, stage.rawValue > seen else { return }
        FX.shared.bigCelebrate(); burstTick += 1
        withAnimation(.spring(duration: 0.5, bounce: 0.3)) { grew = true }
        Task { try? await Task.sleep(for: .seconds(6)); withAnimation { grew = false } }
    }
}

private struct WorldScrollKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

private extension View {
    func chip() -> some View {
        self.font(.caption.weight(.semibold)).foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Color.black.opacity(0.24), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.25), lineWidth: 0.5))
    }
}
