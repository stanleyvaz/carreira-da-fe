import SwiftUI
import AVFoundation
import UIKit

enum Sound: String, CaseIterable { case tap, select, success, complete, bookmark, gentle, welcome }

/// Sons e háptico. Respeita o modo silencioso (categoria .ambient) e o ajuste "Sons e vibração".
@MainActor final class FX {
    static let shared = FX()
    private var players: [Sound: AVAudioPlayer] = [:]
    var enabled: Bool { UserDefaults.standard.object(forKey: "fxEnabled") as? Bool ?? true }

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        for s in Sound.allCases {
            if let url = Bundle.main.url(forResource: s.rawValue, withExtension: "wav", subdirectory: "Sounds") ?? Bundle.main.url(forResource: s.rawValue, withExtension: "wav"),
               let p = try? AVAudioPlayer(contentsOf: url) { p.prepareToPlay(); p.volume = 0.7; players[s] = p }
        }
    }
    func play(_ s: Sound) {
        guard enabled, let p = players[s] else { return }
        p.currentTime = 0; p.play()
    }
    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) { if enabled { UIImpactFeedbackGenerator(style: style).impactOccurred() } }
    func notify(_ t: UINotificationFeedbackGenerator.FeedbackType) { if enabled { UINotificationFeedbackGenerator().notificationOccurred(t) } }
    func selection() { if enabled { UISelectionFeedbackGenerator().selectionChanged() } }

    // Atalhos semânticos
    func tap() { play(.tap); impact(.light) }
    func choose() { play(.select); selection() }
    func celebrate() { play(.success); notify(.success) }
    func bigCelebrate() { play(.complete); notify(.success) }
    func bookmarked() { play(.bookmark); impact(.medium) }
    func gentle() { play(.gentle); notify(.warning) }
}
