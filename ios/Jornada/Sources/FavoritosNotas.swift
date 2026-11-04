import SwiftUI

// MARK: - Datas em português

enum Fmt {
    static var pt: Locale { Locale(identifier: "pt_BR") }
    static func date(_ s: String?) -> Date? {
        guard let s else { return nil }
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }
    /// Datas sem hora ("2026-11-04").
    static func day(_ s: String?) -> Date? {
        guard let s else { return nil }
        let f = ISO8601DateFormatter(); f.formatOptions = [.withFullDate]; return f.date(from: s)
    }
    /// "3 de nov. de 2026"
    static func short(_ d: Date) -> String { d.formatted(.dateTime.day().month(.abbreviated).year().locale(pt)) }
    /// "3 de novembro de 2026 às 14:30"
    static func full(_ d: Date) -> String { d.formatted(.dateTime.day().month(.wide).year().hour().minute().locale(pt)) }
    /// "Novembro de 2026" (títulos de seção)
    static func month(_ d: Date?) -> String { guard let d else { return "Sem data" }; return d.formatted(.dateTime.month(.wide).year().locale(pt)).capitalized(with: pt) }
    /// "há 2 dias"
    static func relative(_ d: Date) -> String { let f = RelativeDateTimeFormatter(); f.locale = pt; f.unitsStyle = .full; return f.localizedString(for: d, relativeTo: Date()) }
}

extension String {
    /// Busca sem diferenciar maiúsculas nem acentos.
    func matches(_ q: String) -> Bool { range(of: q.trimmingCharacters(in: .whitespaces), options: [.caseInsensitive, .diacriticInsensitive]) != nil }
}

/// Agrupa itens já ordenados em seções consecutivas com a mesma chave.
func groupAdjacent<T>(_ items: [T], key: (T) -> String) -> [(key: String, items: [T])] {
    var out: [(key: String, items: [T])] = []
    for i in items {
        let k = key(i)
        if let last = out.last, last.key == k { out[out.count - 1].items.append(i) } else { out.append((key: k, items: [i])) }
    }
    return out
}

// MARK: - Apresentação dos modelos

extension BookmarkSource {
    var icon: String { kind == "step" ? "signpost.right" : "sun.max" }
    var line: String {
        if kind == "step" {
            let day = position.map { "Dia \($0) · " } ?? ""
            return "\(day)\(title)\(journeyTitle.map { " — \($0)" } ?? "")"
        }
        return "Reflexão diária · \(title)"
    }
}
extension Bookmark {
    var date: Date? { Fmt.date(createdAt) }
    var bookName: String { book ?? reference }
    var sourceList: [BookmarkSource] { sources ?? [] }
    var shareText: String { "\(text.map { "“\($0)” — " } ?? "")\(reference)" }
}
extension Note {
    var created: Date? { Fmt.date(createdAt) ?? Fmt.date(updatedAt) }
    var updated: Date? { Fmt.date(updatedAt) }
    /// Só consideramos "editada" quando a diferença é perceptível (> 1 min).
    var wasEdited: Bool { guard let c = Fmt.date(createdAt), let u = updated else { return false }; return u.timeIntervalSince(c) > 60 }
    var icon: String {
        switch refKind { case "step": return "signpost.right"; case "reflection": return "sun.max"; case "activity": return "leaf"; default: return "square.and.pencil" }
    }
    /// De onde veio a anotação ("Dia 2 · Título"). `nil` para anotações livres.
    var originTitle: String? {
        guard let kind = refKind else { return nil }
        guard let t = refTitle else { return "Conteúdo que não está mais disponível" }
        switch kind {
        case "step": return "\(stepPosition.map { "Dia \($0) · " } ?? "")\(t)"
        case "reflection": return "Reflexão · \(t)"
        default: return "Prática · \(t)"
        }
    }
    var kindLabel: String {
        switch refKind { case "step": return "Etapa"; case "reflection": return "Reflexão"; case "activity": return "Prática"; default: return "Livre" }
    }
    var canOpenStep: Bool { refKind == "step" && refTitle != nil && refId != nil }
}

// MARK: - Armazenamento compartilhado (Minha jornada + telas de detalhe)

@MainActor final class LibraryStore: ObservableObject {
    @Published var marks: [Bookmark] = []
    @Published var notes: [Note] = []
    @Published var loaded = false
    @Published var error: String?

    func load(_ api: API) async {
        do {
            async let b: [Bookmark] = api.get("/api/bookmarks"); async let n: [Note] = api.get("/api/notes")
            let (bb, nn) = try await (b, n)
            marks = bb; notes = nn; error = nil; loaded = true
        } catch { self.error = error.localizedDescription }
    }
    /// Remoção otimista: some da lista na hora e volta se o servidor recusar.
    func removeBookmark(_ b: Bookmark, api: API) async {
        let old = marks; withAnimation { marks.removeAll { $0.id == b.id } }
        do { _ = try await api.raw("DELETE", "/api/bookmarks/\(b.passageId)") } catch { withAnimation { marks = old }; self.error = error.localizedDescription }
    }
    func deleteNote(_ n: Note, api: API) async {
        let old = notes; withAnimation { notes.removeAll { $0.id == n.id } }
        do { _ = try await api.raw("DELETE", "/api/notes/\(n.id)") } catch { withAnimation { notes = old }; self.error = error.localizedDescription }
    }
    func saveNote(_ id: String, body: String, api: API) async throws { _ = try await api.raw("PUT", "/api/notes/\(id)", body: ["body": body]); await load(api) }
    func createNote(_ body: String, api: API) async throws { try await api.post("/api/notes", ["body": body]); await load(api) }
}

// MARK: - Cartão de pré-visualização (Minha jornada)

struct LibraryCard<Content: View>: View {
    let title: String; let icon: String; let count: Int; let emptyText: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(title, systemImage: icon).font(.headline).foregroundStyle(.primary)
                Spacer()
                if count > 0 { Text("\(count)").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary); Image(systemName: "chevron.right").font(.footnote.bold()).foregroundStyle(.tertiary) }
            }
            if count == 0 { Text(emptyText).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading) }
            else { content; Text("Ver todos").font(.footnote.weight(.semibold)).foregroundStyle(Theme.accent) }
        }.card()
    }
}

// MARK: - Favoritos

enum FavSort: String, CaseIterable, Identifiable {
    case recent = "Mais recentes", oldest = "Mais antigos", book = "Por livro"
    var id: String { rawValue }
}

struct FavoritosView: View {
    @EnvironmentObject var api: API
    @ObservedObject var store: LibraryStore
    @State private var query = ""
    @State private var sort: FavSort = .recent
    @State private var book: String?

    private var books: [String] { Array(Set(store.marks.map(\.bookName))).sorted() }
    private var shown: [Bookmark] {
        var r = store.marks.filter { book == nil || $0.bookName == book }
        let q = query.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty {
            r = r.filter { b in
                b.reference.matches(q) || (b.text ?? "").matches(q) || b.sourceList.contains { $0.title.matches(q) || ($0.journeyTitle ?? "").matches(q) }
            }
        }
        let far = Date.distantPast
        switch sort {
        case .recent: r.sort { ($0.date ?? far) > ($1.date ?? far) }
        case .oldest: r.sort { ($0.date ?? far) < ($1.date ?? far) }
        case .book: r.sort { $0.bookName == $1.bookName ? ($0.date ?? far) > ($1.date ?? far) : $0.bookName.localizedCompare($1.bookName) == .orderedAscending }
        }
        return r
    }
    private var sections: [(key: String, items: [Bookmark])] { sort == .book ? groupAdjacent(shown) { $0.bookName } : groupAdjacent(shown) { Fmt.month($0.date) } }

    var body: some View {
        Group {
            if store.loaded && store.marks.isEmpty {
                ContentUnavailableView("Nenhum versículo favorito", systemImage: "star", description: Text("Toque em “Favoritar” em um versículo para guardá-lo aqui."))
            } else if !store.loaded && store.marks.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if shown.isEmpty {
                if query.isEmpty { ContentUnavailableView("Nada neste filtro", systemImage: "line.3.horizontal.decrease.circle", description: Text("Escolha outro livro ou limpe o filtro.")) }
                else { ContentUnavailableView.search(text: query) }
            } else {
                List {
                    Section { Text("\(shown.count) de \(store.marks.count) \(store.marks.count == 1 ? "versículo" : "versículos")").font(.footnote).foregroundStyle(.secondary).listRowBackground(Color.clear) }
                    ForEach(sections, id: \.key) { s in
                        Section { ForEach(s.items) { row($0) } } header: { Text(s.key) }
                    }
                }.listStyle(.insetGrouped)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Versículos favoritos").navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Buscar versículo ou jornada")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Ordenar", selection: $sort) { ForEach(FavSort.allCases) { Text($0.rawValue).tag($0) } }
                    if books.count > 1 {
                        Picker("Livro", selection: $book) { Text("Todos os livros").tag(String?.none); ForEach(books, id: \.self) { Text($0).tag(String?.some($0)) } }
                    }
                } label: { Image(systemName: book == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill") }
                .accessibilityLabel("Ordenar e filtrar")
            }
        }
        .refreshable { await store.load(api) }
        .task { if !store.loaded { await store.load(api) } }
        .alert("Não foi possível concluir", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(store.error ?? "") }
    }

    private func row(_ b: Bookmark) -> some View {
        NavigationLink(value: LibraryRoute.favorito(b.passageId)) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(b.reference).font(.subheadline.bold()).foregroundStyle(Theme.accent)
                    Spacer()
                    if let d = b.date { Text(Fmt.short(d)).font(.caption).foregroundStyle(.secondary) }
                }
                if let t = b.text { Text(t).font(.system(.body, design: .serif)).lineLimit(3).multilineTextAlignment(.leading) }
                if let s = b.sourceList.first {
                    Label(s.line, systemImage: s.icon).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }.padding(.vertical, 4)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) { Task { await store.removeBookmark(b, api: api) } } label: { Label("Remover", systemImage: "star.slash") }
        }
        .contextMenu {
            Button { UIPasteboard.general.string = b.shareText } label: { Label("Copiar", systemImage: "doc.on.doc") }
            ShareLink(item: b.shareText) { Label("Compartilhar", systemImage: "square.and.arrow.up") }
            Button(role: .destructive) { Task { await store.removeBookmark(b, api: api) } } label: { Label("Remover dos favoritos", systemImage: "star.slash") }
        }
        .accessibilityElement(children: .combine)
    }
}

struct FavoritoDetailView: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: LibraryStore
    let passageId: String
    @State private var confirm = false
    @State private var copied = false
    private var bookmark: Bookmark? { store.marks.first { $0.passageId == passageId } }

    var body: some View {
        Group {
            if let b = bookmark { content(b) } else { Color.clear.onAppear { dismiss() } }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(bookmark?.reference ?? "").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let b = bookmark {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { UIPasteboard.general.string = b.shareText; copied = true; FX.shared.tap() } label: { Image(systemName: copied ? "checkmark" : "doc.on.doc") }.accessibilityLabel("Copiar versículo")
                    ShareLink(item: b.shareText) { Image(systemName: "square.and.arrow.up") }
                }
            }
        }
        .confirmationDialog("Remover este versículo dos favoritos?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Remover", role: .destructive) { if let b = bookmark { Task { await store.removeBookmark(b, api: api); dismiss() } } }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private func content(_ bookmark: Bookmark) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    if let t = bookmark.text { Text(t).font(.system(.title3, design: .serif)).lineSpacing(4).textSelection(.enabled) }
                    Text(bookmark.reference).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.accent)
                    if let d = bookmark.date {
                        Label("Favoritado em \(Fmt.full(d)) · \(Fmt.relative(d))", systemImage: "star.fill").font(.footnote).foregroundStyle(.secondary)
                    }
                }.card()
                if !bookmark.sourceList.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Aparece em").font(.headline)
                        ForEach(bookmark.sourceList) { s in
                            NavigationLink(value: SourceRoute(kind: s.kind, id: s.id, title: s.title, subtitle: s.line)) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Label(s.line, systemImage: s.icon).multilineTextAlignment(.leading)
                                        if s.available == false { Text("Não está mais disponível · ver resumo").font(.caption).foregroundStyle(.secondary) }
                                    }
                                    Spacer(minLength: 8); Image(systemName: "chevron.right").font(.footnote.bold()).foregroundStyle(.tertiary)
                                }.contentShape(Rectangle())
                            }.buttonStyle(.plain)
                            if s.id != bookmark.sourceList.last?.id { Divider() }
                        }
                    }.card()
                }
                Button(role: .destructive) { confirm = true } label: { Label("Remover dos favoritos", systemImage: "star.slash").frame(maxWidth: .infinity, minHeight: 48) }
                    .buttonStyle(.bordered)
            }.padding(.horizontal, 16).padding(.bottom, 28)
        }
    }
}

/// Abre o conteúdo citado. Se ele saiu do ar, mostra um aviso gentil e um resumo do que ele trazia.
struct SourceView: View {
    @EnvironmentObject var api: API
    let route: SourceRoute
    @State private var src: ContentSource?
    @State private var failed = false

    var body: some View {
        Group {
            if let src, src.available, src.kind == "step" { StepDetailView(id: src.id, slug: nil) }
            else if let src { ScrollView { summary(src).padding(.horizontal, 16).padding(.bottom, 28) }.background(Color(.systemGroupedBackground)) }
            else if failed { ScrollView { gone(title: route.title, subtitle: route.subtitle, text: nil).padding(.horizontal, 16) }.background(Color(.systemGroupedBackground)) }
            else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
        }
        .navigationTitle(src?.available == true && src?.kind == "step" ? "" : (route.kind == "step" ? "Etapa" : "Reflexão")).navigationBarTitleDisplayMode(.inline)
        .task {
            guard src == nil else { return }
            do { src = try await api.get("/api/sources/\(route.kind)/\(route.id)") } catch { failed = true }
        }
    }

    @ViewBuilder private func summary(_ s: ContentSource) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if !s.available { unavailableBox }
            VStack(alignment: .leading, spacing: 10) {
                if let t = s.topicName { Text(t.uppercased()).font(.caption.bold()).foregroundStyle(.secondary) }
                Text(s.title).font(.title2.bold())
                if let j = s.journeyTitle { Label("\(s.position.map { "Dia \($0) · " } ?? "")\(j)", systemImage: "signpost.right").font(.subheadline).foregroundStyle(Theme.accent) }
                if let d = s.publishDate, let date = Fmt.day(d) { Label("Reflexão de \(Fmt.short(date))", systemImage: "sun.max").font(.subheadline).foregroundStyle(Theme.accent) }
            }.card()
            if let p = s.passageRef {
                VStack(alignment: .leading, spacing: 8) {
                    if let t = s.passageText { Text(t).font(.system(.body, design: .serif)).lineSpacing(3) }
                    Text(p).font(.footnote.weight(.semibold)).foregroundStyle(Theme.accent)
                }.card()
            }
            if let b = s.body ?? s.summary {
                VStack(alignment: .leading, spacing: 8) {
                    Text(s.available ? "Reflexão" : "Em resumo").font(.headline)
                    Text(b).lineSpacing(4).textSelection(.enabled)
                }.card()
            }
            if s.available, let a = s.application { VStack(alignment: .leading, spacing: 8) { Text("Para viver hoje").font(.headline); Text(a).lineSpacing(4) }.card() }
            if s.available, let q = s.question { VStack(alignment: .leading, spacing: 8) { Text("Para pensar").font(.headline); Text(q).lineSpacing(4) }.card() }
            if !s.available {
                Label("Seu versículo favorito e suas anotações continuam guardados com você.", systemImage: "heart.fill")
                    .font(.footnote).foregroundStyle(.secondary).padding(.horizontal, 4)
            }
        }
    }

    private var unavailableBox: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles").font(.title2).foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text("Este conteúdo não está mais disponível").font(.headline)
                Text("Ele saiu do app, mas guardamos um resumo para você relembrar o que ele trazia.").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func gone(title: String?, subtitle: String?, text: String?) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            unavailableBox
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 8) {
                    if let t = title { Text(t).font(.title3.bold()) }
                    if let s = subtitle { Text(s).font(.subheadline).foregroundStyle(.secondary) }
                }.card()
            }
            Label("Seu versículo favorito e suas anotações continuam guardados com você.", systemImage: "heart.fill")
                .font(.footnote).foregroundStyle(.secondary).padding(.horizontal, 4)
        }
    }
}

// MARK: - Anotações privadas

enum NoteSort: String, CaseIterable, Identifiable {
    case edited = "Última edição", newest = "Mais recentes", oldest = "Mais antigas"
    var id: String { rawValue }
}
enum NoteFilter: String, CaseIterable, Identifiable {
    case all = "Todas", step = "Etapas", reflection = "Reflexões", activity = "Práticas", free = "Livres"
    var id: String { rawValue }
    func accepts(_ n: Note) -> Bool {
        switch self {
        case .all: return true
        case .step: return n.refKind == "step"
        case .reflection: return n.refKind == "reflection"
        case .activity: return n.refKind == "activity"
        case .free: return n.refKind == nil
        }
    }
}

struct AnotacoesView: View {
    @EnvironmentObject var api: API
    @ObservedObject var store: LibraryStore
    @State private var query = ""
    @State private var sort: NoteSort = .edited
    @State private var filter: NoteFilter = .all
    @State private var editing: Note?
    @State private var creating = false
    @State private var toDelete: Note?

    private func date(_ n: Note) -> Date { (sort == .edited ? n.updated : n.created) ?? .distantPast }
    private var shown: [Note] {
        var r = store.notes.filter { filter.accepts($0) }
        let q = query.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty {
            r = r.filter { n in
                n.body.matches(q) || (n.refTitle ?? "").matches(q) || (n.journeyTitle ?? "").matches(q) || (n.passageRef ?? "").matches(q)
            }
        }
        r.sort { sort == .oldest ? date($0) < date($1) : date($0) > date($1) }
        return r
    }
    private var sections: [(key: String, items: [Note])] { groupAdjacent(shown) { Fmt.month(date($0)) } }

    var body: some View {
        Group {
            if store.loaded && store.notes.isEmpty {
                ContentUnavailableView {
                    Label("Nenhuma anotação", systemImage: "square.and.pencil")
                } description: { Text("Escreva reflexões durante as etapas e exercícios, ou crie uma anotação livre.") } actions: {
                    Button("Nova anotação") { creating = true }.buttonStyle(.borderedProminent)
                }
            } else if !store.loaded && store.notes.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section { chips }.listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                    if shown.isEmpty {
                        Section { if query.isEmpty { Text("Nenhuma anotação neste filtro.").foregroundStyle(.secondary) } else { ContentUnavailableView.search(text: query) } }
                    } else {
                        Section { Text("\(shown.count) de \(store.notes.count) \(store.notes.count == 1 ? "anotação" : "anotações")").font(.footnote).foregroundStyle(.secondary).listRowBackground(Color.clear) }
                        ForEach(sections, id: \.key) { s in Section { ForEach(s.items) { row($0) } } header: { Text(s.key) } }
                    }
                }.listStyle(.insetGrouped)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Anotações privadas").navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Buscar no texto, etapa ou versículo")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Menu {
                    Picker("Ordenar", selection: $sort) { ForEach(NoteSort.allCases) { Text($0.rawValue).tag($0) } }
                } label: { Image(systemName: "arrow.up.arrow.down.circle") }.accessibilityLabel("Ordenar")
                Button { creating = true } label: { Image(systemName: "plus") }.accessibilityLabel("Nova anotação")
            }
        }
        .refreshable { await store.load(api) }
        .task { if !store.loaded { await store.load(api) } }
        .sheet(item: $editing) { NoteEditorSheet(store: store, note: $0) }
        .sheet(isPresented: $creating) { NoteEditorSheet(store: store, note: nil) }
        .confirmationDialog("Excluir esta anotação? Isso não pode ser desfeito.", isPresented: Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } }), titleVisibility: .visible) {
            Button("Excluir", role: .destructive) { if let n = toDelete { Task { await store.deleteNote(n, api: api) } }; toDelete = nil }
            Button("Cancelar", role: .cancel) { toDelete = nil }
        }
        .alert("Não foi possível concluir", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK", role: .cancel) {} } message: { Text(store.error ?? "") }
    }

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NoteFilter.allCases) { f in
                    let n = store.notes.filter { f.accepts($0) }.count
                    if f == .all || n > 0 || f == filter {
                        Button { withAnimation { filter = f } } label: {
                            Text("\(f.rawValue) \(n)").font(.footnote.weight(.semibold)).padding(.horizontal, 14).frame(minHeight: 36)
                                .background(filter == f ? Theme.accent : Color(.tertiarySystemFill), in: Capsule())
                                .foregroundStyle(filter == f ? Color.white : Color.primary)
                        }.buttonStyle(.plain).accessibilityAddTraits(filter == f ? .isSelected : [])
                    }
                }
            }.padding(.horizontal, 16).padding(.vertical, 4)
        }
    }

    private func row(_ n: Note) -> some View {
        NavigationLink(value: LibraryRoute.nota(n.id)) {
            VStack(alignment: .leading, spacing: 6) {
                Text(n.body).lineLimit(4).multilineTextAlignment(.leading)
                Label(n.originTitle ?? "Anotação livre", systemImage: n.icon).font(.caption).foregroundStyle(Theme.accent).lineLimit(1)
                if let p = n.passageRef { Label(p, systemImage: "book").font(.caption).foregroundStyle(.secondary) }
                HStack(spacing: 4) {
                    if let d = (sort == .edited ? n.updated : n.created) { Text("\(sort == .edited && n.wasEdited ? "Editada em" : "Criada em") \(Fmt.short(d))") }
                }.font(.caption).foregroundStyle(.secondary)
            }.padding(.vertical, 4)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) { toDelete = n } label: { Label("Excluir", systemImage: "trash") }
        }
        .swipeActions(edge: .leading) {
            Button { editing = n } label: { Label("Editar", systemImage: "pencil") }.tint(Theme.accent)
        }
        .contextMenu {
            Button { editing = n } label: { Label("Editar", systemImage: "pencil") }
            Button { UIPasteboard.general.string = n.body } label: { Label("Copiar texto", systemImage: "doc.on.doc") }
            Button(role: .destructive) { toDelete = n } label: { Label("Excluir", systemImage: "trash") }
        }
    }
}

struct NoteDetailView: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: LibraryStore
    let noteId: String
    @State private var editing = false
    @State private var confirm = false
    private var note: Note? { store.notes.first { $0.id == noteId } }

    var body: some View {
        Group {
            if let n = note { content(n) } else { Color.clear.onAppear { dismiss() } }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Anotação").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let n = note {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { editing = true } label: { Label("Editar", systemImage: "pencil") }
                        ShareLink(item: n.body) { Label("Compartilhar", systemImage: "square.and.arrow.up") }
                        Button { UIPasteboard.general.string = n.body } label: { Label("Copiar texto", systemImage: "doc.on.doc") }
                        Button(role: .destructive) { confirm = true } label: { Label("Excluir", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("Ações da anotação")
                }
            }
        }
        .sheet(isPresented: $editing) { if let n = note { NoteEditorSheet(store: store, note: n) } }
        .confirmationDialog("Excluir esta anotação? Isso não pode ser desfeito.", isPresented: $confirm, titleVisibility: .visible) {
            Button("Excluir", role: .destructive) { if let n = note { Task { await store.deleteNote(n, api: api); dismiss() } } }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private func content(_ n: Note) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Label(n.originTitle ?? "Anotação livre", systemImage: n.icon).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.accent)
                    if let j = n.journeyTitle { Text("Jornada: \(j)").font(.footnote).foregroundStyle(.secondary) }
                    if let p = n.passageRef { Label(p, systemImage: "book").font(.footnote).foregroundStyle(.secondary) }
                    if let kind = n.refKind, kind == "step" || kind == "reflection", let id = n.refId {
                        NavigationLink(value: SourceRoute(kind: kind, id: id, title: n.refTitle, subtitle: n.originTitle)) {
                            Label(kind == "step" ? "Abrir esta etapa" : "Abrir esta reflexão", systemImage: "arrow.right.circle").font(.footnote.weight(.semibold))
                        }
                    }
                }.card()
                Text(n.body).font(.body).lineSpacing(4).textSelection(.enabled).card()
                VStack(alignment: .leading, spacing: 4) {
                    if let c = n.created { Text("Criada em \(Fmt.full(c))") }
                    if n.wasEdited, let u = n.updated { Text("Editada em \(Fmt.full(u)) · \(Fmt.relative(u))") }
                    Text("Só você pode ler. Guardada de forma cifrada.")
                }.font(.footnote).foregroundStyle(.secondary).padding(.horizontal, 4)
            }.padding(.horizontal, 16).padding(.bottom, 28)
        }
    }
}

/// Criar (note == nil, anotação livre) ou editar uma anotação.
struct NoteEditorSheet: View {
    @EnvironmentObject var api: API
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: LibraryStore
    let note: Note?
    @State private var text: String
    @State private var saving = false
    @State private var error: String?
    @State private var discard = false
    private let limit = 5000

    init(store: LibraryStore, note: Note?) { self.store = store; self.note = note; _text = State(initialValue: note?.body ?? "") }
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var changed: Bool { trimmed != (note?.body ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                if let n = note, let o = n.originTitle { Label(o, systemImage: n.icon).font(.footnote).foregroundStyle(.secondary) }
                Text("Só você pode ler. É guardada de forma cifrada.").font(.footnote).foregroundStyle(.secondary)
                TextEditor(text: $text).padding(8).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .onChange(of: text) { _, v in if v.count > limit { text = String(v.prefix(limit)) } }
                HStack {
                    if let error { Text(error).foregroundStyle(.red).font(.footnote) }
                    Spacer()
                    Text("\(text.count)/\(limit)").font(.caption.monospacedDigit()).foregroundStyle(text.count >= limit ? .red : .secondary)
                }
            }
            .padding().background(Color(.systemGroupedBackground))
            .navigationTitle(note == nil ? "Nova anotação" : "Editar anotação").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { if changed { discard = true } else { dismiss() } } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }.disabled(trimmed.isEmpty || !changed || saving)
                }
            }
            .confirmationDialog("Descartar as alterações?", isPresented: $discard, titleVisibility: .visible) {
                Button("Descartar", role: .destructive) { dismiss() }
                Button("Continuar editando", role: .cancel) {}
            }
        }
        .interactiveDismissDisabled(changed)
        .presentationDetents([.medium, .large]).tint(Theme.accent)
    }

    private func save() async {
        saving = true; defer { saving = false }
        do {
            if let n = note { try await store.saveNote(n.id, body: trimmed, api: api) } else { try await store.createNote(trimmed, api: api) }
            FX.shared.celebrate(); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
