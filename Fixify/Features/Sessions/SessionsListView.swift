import SwiftUI
import SwiftData

struct SessionsListView: View {
    @Environment(Router.self) private var router
    @Environment(\.modelContext) private var context
    @Query(sort: \FixSession.updatedAt, order: .reverse) private var sessions: [FixSession]
    @State private var pendingDelete: FixSession?

    private var open: [FixSession] { sessions.filter { $0.status.isOpen } }
    private var closed: [FixSession] { sessions.filter { !$0.status.isOpen } }

    var body: some View {
        Group {
            if sessions.isEmpty {
                ContentUnavailableView {
                    Label("No fix sessions yet", systemImage: "wrench.and.screwdriver")
                } description: {
                    Text("Each problem you scan becomes a session with its analysis, steps and result.")
                } actions: {
                    Button("Start Live Fix") { router.startScan() }
                        .buttonStyle(.glassProminent)
                }
            } else {
                List {
                    if !open.isEmpty {
                        Section("Active") { rows(open) }
                    }
                    if !closed.isEmpty {
                        Section("Completed") { rows(closed) }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .fxScreen()
        .navigationTitle("Fix Sessions")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { router.startScan() } label: { Label("New scan", systemImage: "plus") }
            }
        }
        .confirmationDialog("Delete this session?", isPresented: .init(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
                            titleVisibility: .visible, presenting: pendingDelete) { session in
            Button("Delete session and photos", role: .destructive) {
                SessionStore(context: context).delete(session)
            }
        } message: { _ in
            Text("The analysis, steps, history and photos of this session are removed from this iPhone.")
        }
    }

    @ViewBuilder
    private func rows(_ items: [FixSession]) -> some View {
        ForEach(items) { session in
            NavigationLink(value: session.id) { SessionRow(session: session) }
                .swipeActions {
                    Button(role: .destructive) { pendingDelete = session } label: { Label("Delete", systemImage: "trash") }
                }
        }
    }
}

struct SessionRow: View {
    let session: FixSession

    var body: some View {
        HStack(spacing: FXSpacing.m) {
            Group {
                if let image = session.sortedImages.first {
                    StoredImageView(fileName: image.fileName, maxPixel: 160)
                } else {
                    ZStack {
                        Color.fxAccentSoft
                        Image(systemName: session.category?.symbol ?? "text.bubble").foregroundStyle(Color.fxAccent)
                    }
                }
            }
            .frame(width: 52, height: 52)
            .clipShape(.rect(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(session.analysis?.title ?? session.title)
                    .font(.fxHeadline)
                    .lineLimit(1)
                HStack(spacing: FXSpacing.s) {
                    StatusBadge(status: session.status)
                    Text(session.updatedAt, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(Color.fxSecondaryText)
                }
            }
            Spacer(minLength: 0)
            if session.analysis?.steps.isEmpty == false {
                ProgressRing(progress: session.progress, lineWidth: 3)
                    .frame(width: 24, height: 24)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
