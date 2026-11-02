// Ajusta uma arte pronta de ícone para 1024x1024 (opaca) com zoom, e gera pré-visualizações com a máscara do iOS.
// Uso: swift Tools/fit_icon.swift <arte.png> <zoom> <saida.png> [preview.png]
import AppKit
import ImageIO
import UniformTypeIdentifiers
let a = CommandLine.arguments
guard a.count >= 4, let src = NSImage(contentsOfFile: a[1])?.cgImage(forProposedRect: nil, context: nil, hints: nil), let zoom = Double(a[2]) else { print("uso: fit_icon <arte> <zoom> <saida> [preview]"); exit(1) }
let S = 1024, cs = CGColorSpace(name: CGColorSpace.sRGB)!
func render(mask: Bool) -> CGImage {
    let c = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    c.interpolationQuality = .high
    if mask { c.setFillColor(CGColor(red: 0.93, green: 0.93, blue: 0.95, alpha: 1)); c.fill(CGRect(x: 0, y: 0, width: S, height: S)); c.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: S, height: S), cornerWidth: 229, cornerHeight: 229, transform: nil)); c.clip() }
    let side = CGFloat(S) * CGFloat(zoom)
    c.draw(src, in: CGRect(x: (CGFloat(S) - side) / 2, y: (CGFloat(S) - side) / 2, width: side, height: side))
    return c.makeImage()!
}
func save(_ img: CGImage, _ path: String) { let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!; CGImageDestinationAddImage(d, img, nil); CGImageDestinationFinalize(d) }
save(render(mask: false), a[3])
if a.count > 4 { save(render(mask: true), a[4]) }
