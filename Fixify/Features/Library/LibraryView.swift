import SwiftUI
import SwiftData

/// Everything Fixify has stored: sessions, photos and guides, searchable across titles, descriptions,
/// analyses and the text recognized in photos.
struct LibraryView: View {
    enum Scope: String, CaseIterable, Identifiable {
        case sessions, photos, guides
        var id: String { rawValue }
        var title: String {
            switch self {
            case .sessions: String(localized: "Sessions")
            case .photos: String(localized: "Photos")
            case .guides: String(localized: "Guides")
            }
        }
    }

    @Environment(Router.self) private var router
    @Query(sort: \FixSession.updatedAt, order: .reverse) private var sessions: [FixSession]
    @Query(sort: \SessionImage.createdAt, order: .reverse) private var images: [SessionImage]

    @State private var query = ""
    @State private var scope: Scope = .sessions
    @State private var category: ProblemCategory?

    private var normalizedQuery: String { query.trimmingCharacters(in: .whitespaces).lowercased() }

    private var filteredSessions: [FixSession] {
        sessions.filter { session in
            (category == nil || session.category == category)
                && (normalizedQuery.isEmpty || session.searchText.contains(normalizedQuery))
        }
    }

    private var filteredImages: [SessionImage] {
        images.filter { image in
            guard let session = image.session else { return false }
            return (category == nil || session.category == category)
                && (normalizedQuery.isEmpty || image.ocrText.lowercased().contains(normalizedQuery) || session.searchText.contains(normalizedQuery))
        }
    }

    private var guides: [FixSession] { filteredSessions.filter { $0.analysis?.steps.isEmpty == false } }

    var body: some View {
        Group {
            if sessions.isEmpty {
                ContentUnavailableView("Your library is empty",
                                       systemImage: "books.vertical",
                                       description: Text("Photos, analyses and guides from your sessions are collected here."))
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: FXSpacing.l) {
                        Picker("Show", selection: $scope) {
                            ForEach(Scope.allCases) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)

                        switch scope {
                        case .sessions: sessionList(filteredSessions)
                        case .photos: photoGrid
                        case .guides: guideList
                        }
                    }
                    .padding(.horizontal, FXSpacing.l)
                    .padding(.bottom, FXSpacing.xxl)
                }
            }
        }
        .fxScreen()
        .navigationTitle("Library")
        .searchable(text: $query, prompt: Text("Search problems, steps and recognized text"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Picker("Topic", selection: $category) {
                        Text("All topics").tag(ProblemCategory?.none)
                        ForEach(ProblemCategory.allCases) { Label($0.title, systemImage: $0.symbol).tag(ProblemCategory?.some($0)) }
                    }
                } label: {
                    Label("Filter", systemImage: category == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                }
            }
        }
    }

    @ViewBuilder
    private func sessionList(_ items: [FixSession]) -> some View {
        if items.isEmpty {
            noResults
        } else {
            VStack(spacing: 0) {
                ForEach(items) { session in
                    Button { router.open(session.id) } label: {
                        SessionRow(session: session).padding(.vertical, FXSpacing.s)
                    }
                    .buttonStyle(.plain)
                    if session.id != items.last?.id { Divider() }
                }
            }
            .padding(.horizontal, FXSpacing.l)
            .padding(.vertical, FXSpacing.s)
            .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
        }
    }

    @ViewBuilder
    private var photoGrid: some View {
        if filteredImages.isEmpty {
            noResults
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 4)], spacing: 4) {
                ForEach(filteredImages) { image in
                    Button {
                        if let id = image.session?.id { router.open(id) }
                    } label: {
                        StoredImageView(fileName: image.fileName, maxPixel: 300)
                            .aspectRatio(1, contentMode: .fill)
                            .clipShape(.rect(cornerRadius: 8))
                            .overlay(alignment: .bottomLeading) {
                                if !image.ocrText.isEmpty {
                                    Image(systemName: "text.viewfinder")
                                        .font(.caption2)
                                        .padding(4)
                                        .background(.black.opacity(0.5), in: .rect(cornerRadius: 4))
                                        .foregroundStyle(.white)
                                        .padding(4)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text(image.session?.analysis?.title ?? image.session?.title ?? ""))
                }
            }
        }
    }

    @ViewBuilder
    private var guideList: some View {
        if guides.isEmpty {
            noResults
        } else {
            VStack(spacing: FXSpacing.m) {
                ForEach(guides) { session in
                    if let analysis = session.analysis {
                        Button { router.open(session.id) } label: {
                            FXCard {
                                HStack {
                                    Chip(text: analysis.category.title, symbol: analysis.category.symbol)
                                    Spacer()
                                    StatusBadge(status: session.status)
                                }
                                Text(analysis.title).font(.fxHeadline)
                                Text(analysis.steps.prefix(3).enumerated().map { "\($0.offset + 1). \($0.element.title)" }.joined(separator: "\n"))
                                    .font(.fxCaption)
                                    .foregroundStyle(Color.fxSecondaryText)
                                if analysis.steps.count > 3 {
                                    Text("+ \(analysis.steps.count - 3) more steps").font(.caption).foregroundStyle(Color.fxSecondaryText)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var noResults: some View {
        ContentUnavailableView.search(text: query)
            .frame(minHeight: 260)
    }
}
