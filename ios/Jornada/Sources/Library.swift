import SwiftUI
import AVFoundation
import WebKit

/// Imagem do nosso servidor (exige o token, então não dá para usar AsyncImage).
struct AuthImage: View {
    @EnvironmentObject var api: API
    let path: String; var version: Int = 0
    @State private var image: UIImage?
    var body: some View {
        Group { if let image { Image(uiImage: image).resizable().scaledToFill() } else { Rectangle().fill(Color(.tertiarySystemFill)) } }
            .task(id: "\(path)#\(version)") {
                if let d = try? await api.raw("GET", path), let i = UIImage(data: d) { image = i } else { image = nil }
            }
    }
}

struct VideoEmbed: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let c = WKWebViewConfiguration(); c.allowsInlineMediaPlayback = true
        let v = WKWebView(frame: .zero, configuration: c); v.scrollView.isScrollEnabled = false; v.isOpaque = false; return v
    }
    func updateUIView(_ v: WKWebView, context: Context) { if v.url != url { v.load(URLRequest(url: url)) } }
}

@MainActor final class AudioPlayer: ObservableObject {
    @Published var playing = false
    private var player: AVPlayer?
    func toggle(_ url: URL) {
        if player == nil { try? AVAudioSession.sharedInstance().setCategory(.playback); player = AVPlayer(url: url) }
        if playing { player?.pause() } else { player?.play() }
        playing.toggle()
    }
    func stop() { player?.pause(); playing = false }
}

/// Leitor do conteúdo guardado no servidor. A fonte aparece como crédito.
struct ReaderView: View {
    @EnvironmentObject var api: API
    @Environment(\.openURL) private var openURL
    let id: String
    @State private var item: LibraryItem?
    @State private var error: String?
    @StateObject private var audio = AudioPlayer()
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let r = item {
                    Text("\(r.source)\(r.publishedOn.map { " · " + $0.split(separator: "-").reversed().joined(separator: "/") } ?? "")").font(.caption).foregroundStyle(.secondary)
                    Text(r.title).font(.system(.title, design: .serif, weight: .bold))
                    if let a = r.authorName { Text("Por \(a)").font(.footnote).foregroundStyle(.secondary) }
                    if let img = r.imageId {
                        AuthImage(path: "/api/media/\(img)").frame(height: 200).frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous)).accessibilityHidden(true)
                    }
                    if let v = r.videoUrl, let u = URL(string: v.replacingOccurrences(of: "www.youtube.com/embed", with: "www.youtube-nocookie.com/embed")), u.scheme == "https" {
                        VideoEmbed(url: u).aspectRatio(16.0 / 9.0, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    if let a = r.audioUrl, let u = URL(string: a), u.scheme == "https" {
                        Button { FX.shared.tap(); audio.toggle(u) } label: {
                            Label(audio.playing ? "Pausar áudio" : "Ouvir", systemImage: audio.playing ? "pause.circle.fill" : "play.circle.fill").font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 50)
                        }.buttonStyle(ProminentButtonStyle())
                    }
                    let blocks = (r.body ?? "").components(separatedBy: "\n\n").filter { !$0.isEmpty }
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(Array(blocks.enumerated()), id: \.offset) { _, b in
                            if b.hasPrefix("> ") {
                                Text(String(b.dropFirst(2))).font(.system(.body, design: .serif)).italic().padding(.leading, 12)
                                    .overlay(alignment: .leading) { Rectangle().fill(Theme.accent).frame(width: 3) }
                            } else { Text(b).font(.body) }
                        }
                        if blocks.isEmpty, let bl = r.blurb { Text(bl) }
                    }.frame(maxWidth: .infinity, alignment: .leading).card()
                    if let u = URL(string: r.originalUrl), u.scheme == "https" {
                        Button { openURL(u) } label: { Label("Ver original em \(u.host ?? "")", systemImage: "arrow.up.right") }.font(.footnote)
                    }
                } else if let error { Text(error).foregroundStyle(.red) } else { ProgressView().frame(maxWidth: .infinity).padding(.top, 40) }
            }.padding(.horizontal, 16).padding(.bottom, 24)
        }
        .background(Color(.systemGroupedBackground)).navigationBarTitleDisplayMode(.inline)
        .task { do { item = try await api.get("/api/resources/\(id)") } catch { self.error = error.localizedDescription } }
        .onDisappear { audio.stop() }
    }
}
