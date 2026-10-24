import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings
    @Query(sort: \FixSession.updatedAt, order: .reverse) private var sessions: [FixSession]

    private var openSessions: [FixSession] { sessions.filter { $0.status.isOpen } }
    private var solvedSessions: [FixSession] { sessions.filter { $0.status == .solved }.prefix(3).map { $0 } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FXSpacing.xl) {
                header
                liveFixCard
                if settings.provider == .proxy && !settings.isProxyConfigured {
                    setupHint
                }
                if !openSessions.isEmpty { activeSection }
                suggestions
                if !solvedSessions.isEmpty { solvedSection }
            }
            .padding(.horizontal, FXSpacing.l)
            .padding(.bottom, FXSpacing.xxl)
        }
        .fxScreen()
        .toolbar(.hidden, for: .navigationBar)
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<12: String(localized: "Good morning")
        case 12..<18: String(localized: "Good afternoon")
        default: String(localized: "Good evening")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FXSpacing.xs) {
            Text(greeting).font(.fxDisplay)
            Text("What needs fixing?")
                .font(.title3)
                .foregroundStyle(Color.fxSecondaryText)
        }
        .padding(.top, FXSpacing.xl)
    }

    private var liveFixCard: some View {
        VStack(alignment: .leading, spacing: FXSpacing.l) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: FXSpacing.s) {
                    Text("Live Fix").font(.fxTitle).foregroundStyle(.white)
                    Text("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")
                        .font(.fxBody)
                        .foregroundStyle(.white.opacity(0.82))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: FXSpacing.m)
                Image(systemName: "viewfinder")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(.white.opacity(0.9))
                    .accessibilityHidden(true)
            }
            HStack(spacing: FXSpacing.m) {
                Button {
                    router.startScan()
                } label: {
                    Label("Open camera", systemImage: "camera.fill")
                        .font(.fxHeadline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)
                .tint(.white)
                .foregroundStyle(Color.fxAccent)

                Button {
                    router.startScan(library: true)
                } label: {
                    Label("Photos", systemImage: "photo.on.rectangle")
                        .font(.fxHeadline)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glass)
                .foregroundStyle(.white)
                .accessibilityHint(Text("Pick a photo or screenshot of the problem"))
            }
        }
        .padding(FXSpacing.xl)
        .background {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color(light: 0x1546D6, dark: 0x1D3FA8))
        }
    }

    private var setupHint: some View {
        Button {
            router.tab = .settings
        } label: {
            FXCard {
                HStack(spacing: FXSpacing.m) {
                    Image(systemName: "server.rack").font(.title2).foregroundStyle(Color.fxCaution)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AI analysis is not set up").font(.fxHeadline)
                        Text("Text recognition works on this iPhone. For full analyses, connect your Fixify server in Settings.")
                            .font(.fxCaption)
                            .foregroundStyle(Color.fxSecondaryText)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(Color.fxSecondaryText)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var activeSection: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) {
            SectionTitle(String(localized: "In progress"), symbol: "wrench.adjustable")
            ScrollView(.horizontal) {
                HStack(spacing: FXSpacing.m) {
                    ForEach(openSessions.prefix(8)) { session in
                        Button { router.open(session.id) } label: { ActiveSessionCard(session: session) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
        }
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) {
            SectionTitle(String(localized: "Start with a topic"), symbol: "square.grid.2x2")
            LazyVGrid(columns: [GridItem(.flexible(), spacing: FXSpacing.m), GridItem(.flexible(), spacing: FXSpacing.m)], spacing: FXSpacing.m) {
                ForEach(ProblemCategory.suggestions) { category in
                    Button { router.startScan(category: category) } label: {
                        HStack(spacing: FXSpacing.s) {
                            Image(systemName: category.symbol)
                                .foregroundStyle(Color.fxAccent)
                                .frame(width: 26)
                            Text(category.title)
                                .font(.subheadline.weight(.medium))
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .padding(FXSpacing.m)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.control, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var solvedSection: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) {
            SectionTitle(String(localized: "Recently solved"), symbol: "checkmark.seal")
            VStack(spacing: 0) {
                ForEach(solvedSessions) { session in
                    Button { router.open(session.id) } label: {
                        SessionRow(session: session).padding(.vertical, FXSpacing.s)
                    }
                    .buttonStyle(.plain)
                    if session.id != solvedSessions.last?.id { Divider() }
                }
            }
            .padding(.horizontal, FXSpacing.l)
            .padding(.vertical, FXSpacing.s)
            .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
        }
    }
}

struct ActiveSessionCard: View {
    let session: FixSession

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.s) {
            ZStack(alignment: .topTrailing) {
                if let image = session.sortedImages.first {
                    StoredImageView(fileName: image.fileName, maxPixel: 500)
                } else {
                    ZStack {
                        Color.fxAccentSoft
                        Image(systemName: session.category?.symbol ?? "text.bubble")
                            .font(.title)
                            .foregroundStyle(Color.fxAccent)
                    }
                }
                ProgressRing(progress: session.progress, lineWidth: 3.5, color: .white)
                    .frame(width: 26, height: 26)
                    .padding(8)
                    .background(.black.opacity(0.35), in: .circle)
                    .padding(8)
            }
            .frame(width: 220, height: 124)
            .clipShape(.rect(cornerRadius: 16, style: .continuous))

            Text(session.analysis?.title ?? session.title)
                .font(.fxHeadline)
                .lineLimit(1)
            if let step = session.currentStep {
                Text("Next: \(step.title)")
                    .font(.fxCaption)
                    .foregroundStyle(Color.fxSecondaryText)
                    .lineLimit(1)
            } else {
                Text(session.status.title).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
            }
        }
        .frame(width: 220, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
