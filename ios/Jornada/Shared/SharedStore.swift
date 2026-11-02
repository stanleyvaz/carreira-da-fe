import Foundation

/// Dados que o app compartilha com o widget (App Group). Nada sensível: só o versículo do dia e o estado do dia.
enum SharedStore {
    static let group = "group.org.universal.jornada"
    /// Um dia dos últimos 7 (do mais antigo ao de hoje).
    struct DayDot: Codable { var letter: String; var active: Bool; var today: Bool }
    struct Snapshot: Codable {
        var verseText: String; var verseRef: String; var doneToday: Bool; var activeDays: Int; var anchor: String?; var updated: Date
        var days: [DayDot]? = nil
    }
    private static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static func save(_ s: Snapshot) { if let d = try? JSONEncoder().encode(s) { defaults?.set(d, forKey: "snapshot") } }
    static func load() -> Snapshot? { defaults?.data(forKey: "snapshot").flatMap { try? JSONDecoder().decode(Snapshot.self, from: $0) } }
    static func clear() { defaults?.removeObject(forKey: "snapshot") }
}
