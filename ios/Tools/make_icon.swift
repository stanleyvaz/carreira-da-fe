// Gera as camadas do ícone (Icon Composer) + uma pré-visualização achatada.
// Uso: swift Tools/make_icon.swift  (saída em Jornada/Icon/AppIcon.icon/Assets e Tools/preview.png)
import AppKit
import ImageIO
import UniformTypeIdentifiers

let S = 1024
let P3 = CGColorSpace(name: CGColorSpace.displayP3)!
func newCtx() -> CGContext {
    let c = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: P3, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    c.translateBy(x: 0, y: CGFloat(S)); c.scaleBy(x: 1, y: -1)   // origem no canto superior esquerdo
    c.setAllowsAntialiasing(true); c.interpolationQuality = .high
    return c
}
func col(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: P3, components: [CGFloat((hex >> 16) & 255) / 255, CGFloat((hex >> 8) & 255) / 255, CGFloat(hex & 255) / 255, a])!
}
func grad(_ cs: [CGColor], _ locs: [CGFloat]? = nil) -> CGGradient { CGGradient(colorsSpace: P3, colors: cs as CFArray, locations: locs)! }
func save(_ c: CGContext, _ path: String) {
    let img = c.makeImage()!
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, img, nil); CGImageDestinationFinalize(d)
}
func rr(_ r: CGRect, _ rad: CGFloat) -> CGPath { CGPath(roundedRect: r, cornerWidth: rad, cornerHeight: rad, transform: nil) }

// ---------- Geometria ----------
let cover = CGRect(x: 160, y: 86, width: 690, height: 812)
let spineW: CGFloat = 68
let center = CGPoint(x: (cover.minX + spineW + cover.maxX) / 2, y: cover.midY)

// ---------- Camada 0: fundo branco (com um leve degradê para não ficar chapado) ----------
func drawBackground() -> CGContext {
    let c = newCtx()
    c.setFillColor(col(0xFFFFFF)); c.fill(CGRect(x: 0, y: 0, width: S, height: S))
    c.drawRadialGradient(grad([col(0xEAF0F9, 0.9), col(0xEAF0F9, 0)]), startCenter: CGPoint(x: 840, y: 1000), startRadius: 0, endCenter: CGPoint(x: 840, y: 1000), endRadius: 620, options: [])
    c.drawRadialGradient(grad([col(0xFFF6E6, 0.8), col(0xFFF6E6, 0)]), startCenter: CGPoint(x: 260, y: 160), startRadius: 0, endCenter: CGPoint(x: 260, y: 160), endRadius: 560, options: [])
    return c
}

// ---------- Camada 1: fita marcadora (aparece sob a Bíblia) ----------
func drawRibbon() -> CGContext {
    let c = newCtx()
    let x: CGFloat = 660, w: CGFloat = 60, top: CGFloat = 840, bottom: CGFloat = 982
    let p = CGMutablePath()
    p.move(to: CGPoint(x: x, y: top)); p.addLine(to: CGPoint(x: x + w, y: top)); p.addLine(to: CGPoint(x: x + w, y: bottom))
    p.addLine(to: CGPoint(x: x + w / 2, y: bottom - 26)); p.addLine(to: CGPoint(x: x, y: bottom)); p.closeSubpath()
    c.saveGState(); c.setShadow(offset: CGSize(width: 0, height: 8), blur: 16, color: col(0x000000, 0.35)); c.addPath(p); c.setFillColor(col(0xB3262F)); c.fillPath(); c.restoreGState()
    c.saveGState(); c.addPath(p); c.clip()
    c.drawLinearGradient(grad([col(0xD8414B), col(0x8E1B24)]), start: CGPoint(x: x, y: 0), end: CGPoint(x: x + w, y: 0), options: [])
    c.setFillColor(col(0xFFFFFF, 0.18)); c.fill(CGRect(x: x + 10, y: top, width: 6, height: bottom - top))
    c.restoreGState()
    return c
}

// ---------- Camada 2: Bíblia (bloco de páginas + capa de couro + ouro) ----------
func drawBook() -> CGContext {
    let c = newCtx()
    // sombra de contato
    c.saveGState(); c.setShadow(offset: CGSize(width: 0, height: 22), blur: 40, color: col(0x2A1206, 0.45))
    c.addPath(rr(cover.offsetBy(dx: 10, dy: 10), 38)); c.setFillColor(col(0x2A1206)); c.fillPath(); c.restoreGState()
    // bloco de páginas (direita e embaixo)
    let pages = cover.offsetBy(dx: 13, dy: 13)
    c.addPath(rr(pages, 36)); c.setFillColor(col(0xF4E9CF)); c.fillPath()
    c.saveGState(); c.addPath(rr(pages, 36)); c.clip(); c.setStrokeColor(col(0xBFA877, 0.55)); c.setLineWidth(1.4)
    var y = pages.minY + 26; while y < pages.maxY - 20 { c.move(to: CGPoint(x: cover.maxX - 4, y: y)); c.addLine(to: CGPoint(x: pages.maxX, y: y)); y += 7 }
    var x = pages.minX + 70; while x < pages.maxX - 24 { c.move(to: CGPoint(x: x, y: cover.maxY - 4)); c.addLine(to: CGPoint(x: x, y: pages.maxY)); x += 7 }
    c.strokePath(); c.restoreGState()
    // capa de couro
    let cp = rr(cover, 38)
    c.saveGState(); c.addPath(cp); c.clip()
    c.drawLinearGradient(grad([col(0x6B3A28), col(0x3F2016), col(0x2C150E)], [0, 0.6, 1]), start: CGPoint(x: 0, y: cover.minY), end: CGPoint(x: 0, y: cover.maxY), options: [])
    c.drawRadialGradient(grad([col(0xFFD9A8, 0.30), col(0xFFD9A8, 0)]), startCenter: CGPoint(x: 360, y: 220), startRadius: 0, endCenter: CGPoint(x: 360, y: 220), endRadius: 520, options: [])
    // textura de couro
    var rng = SystemRandomNumberGenerator()
    for _ in 0..<9000 {
        let px = CGFloat.random(in: cover.minX...cover.maxX, using: &rng), py = CGFloat.random(in: cover.minY...cover.maxY, using: &rng), s = CGFloat.random(in: 1...2.6, using: &rng)
        c.setFillColor(Bool.random(using: &rng) ? col(0x000000, 0.10) : col(0xFFE6C4, 0.07)); c.fillEllipse(in: CGRect(x: px, y: py, width: s, height: s))
    }
    // lombada
    let spine = CGRect(x: cover.minX, y: cover.minY, width: spineW, height: cover.height)
    c.drawLinearGradient(grad([col(0x1B0C07, 0.85), col(0x1B0C07, 0.15)]), start: CGPoint(x: spine.minX, y: 0), end: CGPoint(x: spine.maxX, y: 0), options: [])
    // sulco da dobradiça
    c.setFillColor(col(0x000000, 0.45)); c.fill(CGRect(x: spine.maxX - 3, y: cover.minY, width: 4, height: cover.height))
    c.setFillColor(col(0xFFD9A8, 0.22)); c.fill(CGRect(x: spine.maxX + 1, y: cover.minY, width: 2, height: cover.height))
    c.restoreGState()
    // filetes dourados na lombada
    for dy: CGFloat in [70, 84, cover.height - 84, cover.height - 70] {
        c.setStrokeColor(col(0xE9C877, 0.9)); c.setLineWidth(3); c.move(to: CGPoint(x: cover.minX + 12, y: cover.minY + dy)); c.addLine(to: CGPoint(x: cover.minX + spineW - 16, y: cover.minY + dy)); c.strokePath()
    }
    // moldura em ouro (estampada)
    let inner = CGRect(x: cover.minX + spineW + 26, y: cover.minY + 30, width: cover.width - spineW - 56, height: cover.height - 60)
    for (inset, lw, a) in [(CGFloat(0), CGFloat(5), CGFloat(1)), (CGFloat(14), CGFloat(2), CGFloat(0.8))] {
        c.saveGState(); c.addPath(rr(inner.insetBy(dx: inset, dy: inset), 24 - inset / 2)); c.setLineWidth(lw)
        c.replacePathWithStrokedPath(); c.clip()
        c.drawLinearGradient(grad([col(0xFBE7A6, a), col(0xC79A45, a), col(0xF2D488, a), col(0x9C7330, a)], [0, 0.4, 0.7, 1]), start: CGPoint(x: inner.minX, y: inner.minY), end: CGPoint(x: inner.maxX, y: inner.maxY), options: [])
        c.restoreGState()
    }
    // borda de luz da capa
    c.saveGState(); c.addPath(cp); c.setLineWidth(2.5); c.setStrokeColor(col(0xFFE8C8, 0.28)); c.strokePath(); c.restoreGState()
    return c
}

// ---------- Camada 3: coroa de louros (vidro dourado) ----------
func drawLaurel() -> CGContext {
    let c = newCtx()
    let R: CGFloat = 214, N = 9
    let gold = (top: UInt32(0xFFE08A), bot: UInt32(0xE0A020), light: UInt32(0xFFF3C4))
    func pt(_ a: CGFloat) -> CGPoint { CGPoint(x: center.x + cos(a) * R, y: center.y + sin(a) * R) }
    func leaf(from p: CGPoint, dir: CGPoint, len: CGFloat) {
        let w = len * 0.40, n = CGPoint(x: -dir.y, y: dir.x)
        let tip = CGPoint(x: p.x + dir.x * len, y: p.y + dir.y * len)
        let path = CGMutablePath(); path.move(to: p)
        path.addQuadCurve(to: tip, control: CGPoint(x: p.x + dir.x * len * 0.5 + n.x * w, y: p.y + dir.y * len * 0.5 + n.y * w))
        path.addQuadCurve(to: p, control: CGPoint(x: p.x + dir.x * len * 0.5 - n.x * w, y: p.y + dir.y * len * 0.5 - n.y * w))
        path.closeSubpath()
        // luz dourada projetada na capa
        c.saveGState(); c.setShadow(offset: CGSize(width: 0, height: 10), blur: 26, color: col(gold.bot, 0.70)); c.addPath(path); c.setFillColor(col(gold.bot, 0.55)); c.fillPath(); c.restoreGState()
        // corpo de vidro: claro na ponta, profundo na base
        c.saveGState(); c.addPath(path); c.clip()
        c.drawLinearGradient(grad([col(gold.bot, 0.62), col(gold.top, 0.88)]), start: p, end: tip, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
        // brilho no lado de cima da folha
        c.setStrokeColor(col(gold.light, 0.55)); c.setLineWidth(len * 0.10); c.move(to: p); c.addQuadCurve(to: tip, control: CGPoint(x: p.x + dir.x * len * 0.5 + n.x * w * 0.45, y: p.y + dir.y * len * 0.5 + n.y * w * 0.45)); c.strokePath()
        c.restoreGState()
        // nervura central e aro de vidro
        c.saveGState(); c.setStrokeColor(col(0xFFFFFF, 0.45)); c.setLineWidth(2.6); c.setLineCap(.round)
        c.move(to: p); c.addLine(to: CGPoint(x: p.x + dir.x * len * 0.86, y: p.y + dir.y * len * 0.86)); c.strokePath(); c.restoreGState()
        c.saveGState(); c.addPath(path); c.setStrokeColor(col(0xFFFFFF, 0.60)); c.setLineWidth(2.2); c.strokePath(); c.restoreGState()
    }
    for s in [CGFloat(1), CGFloat(-1)] {
        let a0: CGFloat = 0.10, a1: CGFloat = 2.78
        // haste
        c.saveGState(); c.setShadow(offset: CGSize(width: 0, height: 8), blur: 18, color: col(gold.bot, 0.5))
        c.addArc(center: center, radius: R, startAngle: .pi / 2 + s * a0, endAngle: .pi / 2 + s * a1, clockwise: s < 0)
        c.setStrokeColor(col(gold.bot, 0.85)); c.setLineWidth(11); c.setLineCap(.round); c.strokePath(); c.restoreGState()
        c.saveGState(); c.addArc(center: center, radius: R, startAngle: .pi / 2 + s * a0, endAngle: .pi / 2 + s * a1, clockwise: s < 0)
        c.setStrokeColor(col(gold.light, 0.7)); c.setLineWidth(3); c.setLineCap(.round); c.strokePath(); c.restoreGState()
        for k in 0..<N {
            let t = CGFloat(k) / CGFloat(N - 1), ang = .pi / 2 + s * (a0 + (a1 - a0) * t)
            let p = pt(ang), nrm = CGPoint(x: cos(ang), y: sin(ang)), tan = CGPoint(x: -sin(ang) * s, y: cos(ang) * s)
            let len = 88 - 31 * t
            let f: CGFloat = 0.82, g: CGFloat = 0.57 // ~35° em relação à haste
            leaf(from: p, dir: CGPoint(x: tan.x * f - nrm.x * g, y: tan.y * f - nrm.y * g), len: len * 0.92)   // interna
            leaf(from: p, dir: CGPoint(x: tan.x * f + nrm.x * g, y: tan.y * f + nrm.y * g), len: len)          // externa
        }
        // folha da ponta, na direção da haste
        let ae = .pi / 2 + s * a1, pe = pt(ae)
        leaf(from: pe, dir: CGPoint(x: -sin(ae) * s, y: cos(ae) * s), len: 58)
    }
    // nó/laço na base da coroa
    for dx in [CGFloat(-16), CGFloat(16)] {
        c.saveGState(); c.setShadow(offset: CGSize(width: 0, height: 6), blur: 14, color: col(gold.bot, 0.6))
        c.setFillColor(col(gold.top, 0.9)); c.fillEllipse(in: CGRect(x: center.x + dx - 17, y: center.y + R - 4, width: 34, height: 34)); c.restoreGState()
        c.setStrokeColor(col(0xFFFFFF, 0.6)); c.setLineWidth(2); c.strokeEllipse(in: CGRect(x: center.x + dx - 17, y: center.y + R - 4, width: 34, height: 34))
    }
    return c
}

// ---------- Saída ----------
let out = "Jornada/Icon/AppIcon.icon/Assets"
let bg = drawBackground(), ribbon = drawRibbon(), book = drawBook(), laurel = drawLaurel()
save(bg, "\(out)/background.png"); save(ribbon, "\(out)/ribbon.png"); save(book, "\(out)/bible.png"); save(laurel, "\(out)/laurel.png")

// pré-visualização achatada (aproximação: o vidro real é aplicado pelo sistema)
let prev = newCtx()
for l in [bg, ribbon, book, laurel] { prev.saveGState(); prev.scaleBy(x: 1, y: -1); prev.translateBy(x: 0, y: -CGFloat(S)); prev.draw(l.makeImage()!, in: CGRect(x: 0, y: 0, width: S, height: S)); prev.restoreGState() }
save(prev, "Tools/preview.png")
print("ok")
