import SwiftUI

/// Base surface for content groups.
struct FXCard<Content: View>: View {
    var padding: CGFloat = FXSpacing.l
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FXRadius.card, style: .continuous)
                    .strokeBorder(Color.fxHairline, lineWidth: 0.5)
            }
    }
}

struct SectionTitle: View {
    var title: String
    var symbol: String?

    init(_ title: String, symbol: String? = nil) {
        self.title = title
        self.symbol = symbol
    }

    var body: some View {
        HStack(spacing: FXSpacing.s) {
            if let symbol {
                Image(systemName: symbol).foregroundStyle(Color.fxAccent)
            }
            Text(title).font(.fxHeadline)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

struct Chip: View {
    var text: String
    var color: Color = .fxAccent
    var symbol: String?

    var body: some View {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol).imageScale(.small) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.13), in: .rect(cornerRadius: FXRadius.chip, style: .continuous))
    }
}

struct StatusBadge: View {
    var status: SessionStatus

    var color: Color {
        switch status {
        case .solved: .fxSuccess
        case .unresolved: .fxDanger
        case .unclear, .partiallySolved: .fxCaution
        case .active, .pendingAnalysis: .fxAccent
        }
    }

    var body: some View { Chip(text: status.title, color: color, symbol: status.symbol) }
}

/// Number marker used both on images and in lists, so the two can be matched at a glance.
struct MarkerBadge: View {
    var number: Int
    var size: CGFloat = 24
    var estimated = false

    var body: some View {
        Text("\(number)")
            .font(.system(size: size * 0.5, weight: .bold, design: .rounded))
            .foregroundStyle(.black)
            .frame(width: size, height: size)
            .background(Color.fxMarker, in: .circle)
            .overlay {
                Circle().strokeBorder(.white.opacity(0.9), style: StrokeStyle(lineWidth: 1.5, dash: estimated ? [3, 2] : []))
            }
            .shadow(color: .black.opacity(0.35), radius: 3, y: 1)
            .accessibilityLabel(Text("Marker \(number)"))
    }
}

struct ProgressRing: View {
    var progress: Double
    var lineWidth: CGFloat = 4
    var color: Color = .fxAccent

    var body: some View {
        ZStack {
            Circle().stroke(Color.fxHairline, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, progress))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .animation(.smooth, value: progress)
        .accessibilityElement()
        .accessibilityLabel(Text("Progress"))
        .accessibilityValue(Text(progress, format: .percent.precision(.fractionLength(0))))
    }
}

/// Loads a thumbnail off the main thread.
struct StoredImageView: View {
    var fileName: String
    var maxPixel: CGFloat = 400
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color.fxSurfaceRaised
            if let image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else {
                Image(systemName: "photo").foregroundStyle(Color.fxSecondaryText)
            }
        }
        .clipped()
        .task(id: fileName) {
            let name = fileName, size = maxPixel
            image = await Task.detached(priority: .userInitiated) {
                ImageStore.shared.thumbnail(for: name, maxPixel: size)
            }.value
        }
        .accessibilityHidden(true)
    }
}

struct SafetyBanner: View {
    var safety: ProblemAnalysis.Safety

    var body: some View {
        if safety.level != .none || safety.recommendProfessional {
            let color: Color = safety.level == .danger ? .fxDanger : .fxCaution
            VStack(alignment: .leading, spacing: FXSpacing.s) {
                Label(safety.level == .danger ? String(localized: "Safety risk") : String(localized: "Be careful"),
                      systemImage: safety.level == .danger ? "exclamationmark.octagon.fill" : "exclamationmark.triangle.fill")
                    .font(.fxHeadline)
                    .foregroundStyle(color)
                ForEach(safety.warnings, id: \.self) { warning in
                    Text(warning).font(.fxBody)
                }
                if safety.recommendProfessional {
                    Text("We recommend getting a qualified professional for this. Do not continue if you are unsure.")
                        .font(.fxBody.weight(.semibold))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(FXSpacing.l)
            .background(color.opacity(0.12), in: .rect(cornerRadius: FXRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FXRadius.card, style: .continuous).strokeBorder(color.opacity(0.4))
            }
            .accessibilityElement(children: .combine)
        }
    }
}

struct InfoRow: View {
    var symbol: String
    var title: String
    var detail: String?

    var body: some View {
        HStack(alignment: .top, spacing: FXSpacing.m) {
            Image(systemName: symbol)
                .foregroundStyle(Color.fxAccent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.fxBody)
                if let detail, !detail.isEmpty {
                    Text(detail).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// Standard screen background.
    func fxScreen() -> some View {
        background(Color.fxBackground.ignoresSafeArea())
    }
}
