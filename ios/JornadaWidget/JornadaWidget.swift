import WidgetKit
import SwiftUI

struct VerseEntry: TimelineEntry { let date: Date; let snap: SharedStore.Snapshot? }

struct VerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> VerseEntry {
        VerseEntry(date: .now, snap: .init(verseText: "A tua palavra é lâmpada para os meus pés e luz para o meu caminho.", verseRef: "Salmos 119:105", doneToday: false, activeDays: 3, anchor: nil, updated: .now))
    }
    func getSnapshot(in context: Context, completion: @escaping (VerseEntry) -> Void) { completion(VerseEntry(date: .now, snap: SharedStore.load() ?? placeholder(in: context).snap)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<VerseEntry>) -> Void) {
        var snap = SharedStore.load()
        // Se o dado é de outro dia, o "feito hoje" deixa de valer.
        if var s = snap, !Calendar.current.isDateInToday(s.updated) { s.doneToday = false; snap = s }
        let next = Calendar.current.nextDate(after: .now, matching: DateComponents(hour: 0, minute: 5), matchingPolicy: .nextTime) ?? .now.addingTimeInterval(3 * 3600)
        completion(Timeline(entries: [VerseEntry(date: .now, snap: snap)], policy: .after(next)))
    }
}

/// Resumo discreto dos últimos 7 dias: um pontinho por dia (cheio = esteve com a Palavra; anel = hoje).
struct WeekDots: View {
    let days: [SharedStore.DayDot]
    var size: CGFloat = 7
    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                Circle().fill(d.active ? Color(red: 0.96, green: 0.67, blue: 0.36) : Color.white.opacity(0.18))
                    .frame(width: size, height: size)
                    .overlay { if d.today { Circle().stroke(Color.white.opacity(0.75), lineWidth: 1).padding(-2) } }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Últimos 7 dias: \(days.filter(\.active).count) com a Palavra")
    }
}

struct VerseWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VerseEntry
    private let accent = Color(red: 0.96, green: 0.67, blue: 0.36)
    var body: some View {
        Group {
            if let s = entry.snap {
                switch family {
                case .accessoryInline: Text("\(s.verseRef) · \(s.doneToday ? "feito hoje" : "seu minuto")")
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.verseRef).font(.caption.bold())
                        Text(s.verseText).font(.caption2).lineLimit(2)
                        if s.activeDays > 0 { Text("\(s.activeDays)/7 dias esta semana").font(.caption2).foregroundStyle(.secondary) }
                    }
                case .systemMedium:
                    HStack(alignment: .top, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("VERSÍCULO DO DIA").font(.caption2.bold()).foregroundStyle(accent)
                            Text(s.verseText).font(.system(.callout, design: .serif)).lineLimit(5).minimumScaleFactor(0.8)
                            Text(s.verseRef).font(.caption.bold()).foregroundStyle(.secondary)
                        }
                        VStack(spacing: 4) {
                            Image(systemName: s.doneToday ? "checkmark.circle.fill" : "sun.max.fill").font(.title).foregroundStyle(s.doneToday ? .green : accent)
                            Text(s.doneToday ? "Feito hoje" : "Seu minuto de hoje").font(.caption2).multilineTextAlignment(.center)
                            if let d = s.days, d.count == 7 { WeekDots(days: d).padding(.top, 4) }
                            if s.activeDays > 0 { Text("\(s.activeDays)/7 dias").font(.caption2).foregroundStyle(.secondary) }
                        }.frame(width: 84)
                    }
                default:
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.verseRef).font(.caption.bold()).foregroundStyle(accent)
                        Text(s.verseText).font(.system(.footnote, design: .serif)).lineLimit(6).minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                        if let d = s.days, d.count == 7 { WeekDots(days: d, size: 6) }
                        Label(s.doneToday ? "Feito hoje" : "Seu minuto te espera", systemImage: s.doneToday ? "checkmark.circle.fill" : "sun.max").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "book.fill").font(.title2).foregroundStyle(accent)
                    Text("Abra o Carreira da Fé para ver o versículo do dia").font(.caption).multilineTextAlignment(.center)
                }
            }
        }
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(red: 0.12, green: 0.1, blue: 0.16), Color(red: 0.22, green: 0.14, blue: 0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        .foregroundStyle(.white)
    }
}

struct JornadaVerseWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "JornadaVerse", provider: VerseProvider()) { VerseWidgetView(entry: $0) }
            .configurationDisplayName("Versículo do dia")
            .description("O versículo de hoje e o seu minuto com a Palavra.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

@main struct JornadaWidgetBundle: WidgetBundle { var body: some Widget { JornadaVerseWidget() } }
