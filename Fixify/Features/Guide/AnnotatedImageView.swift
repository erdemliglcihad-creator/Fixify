import SwiftUI

/// A stored image with numbered markers for the findings that can be located honestly.
/// Exact markers come from on-device OCR boxes; AI-estimated ones are drawn dashed and labeled as approximate.
struct AnnotatedImageView: View {
    let image: SessionImage
    let markers: [ResolvedMarker]
    @Binding var selected: String?
    var maxPixel: CGFloat = 1400
    var onSelect: (ResolvedMarker) -> Void = { _ in }

    @State private var uiImage: UIImage?

    var body: some View {
        GeometryReader { geo in
            let container = CGRect(origin: .zero, size: geo.size)
            ZStack(alignment: .topLeading) {
                if let uiImage {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: geo.size.width, height: geo.size.height)
                        .accessibilityHidden(true)
                } else {
                    Color.fxSurfaceRaised
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                ForEach(markers) { marker in
                    let rect = marker.rect.rect(in: container, imageSize: image.pixelSize)
                    let isSelected = selected == marker.id
                    let dimmed = selected != nil && !isSelected

                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Color.fxMarker,
                                style: StrokeStyle(lineWidth: isSelected ? 3 : 2, dash: marker.precision == .estimated ? [6, 4] : []))
                        .background(Color.fxMarker.opacity(isSelected ? 0.18 : 0.06), in: .rect(cornerRadius: 6))
                        .frame(width: max(rect.width, 14), height: max(rect.height, 14))
                        .position(x: rect.midX, y: rect.midY)
                        .opacity(dimmed ? 0.35 : 1)
                        .allowsHitTesting(false)

                    Button {
                        selected = marker.id
                        onSelect(marker)
                    } label: {
                        MarkerBadge(number: marker.number, size: isSelected ? 30 : 26, estimated: marker.precision == .estimated)
                            .frame(width: 44, height: 44)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .position(x: min(max(rect.minX, 16), geo.size.width - 16),
                              y: min(max(rect.minY, 16), geo.size.height - 16))
                    .opacity(dimmed ? 0.55 : 1)
                    .accessibilityLabel(Text("Marker \(marker.number): \(marker.finding.label)"))
                    .accessibilityHint(Text("Shows what Fixify found here"))
                }
            }
            .animation(.smooth(duration: 0.25), value: selected)
        }
        .aspectRatio(image.pixelWidth > 0 ? image.pixelWidth / max(image.pixelHeight, 1) : 0.75, contentMode: .fit)
        .task(id: image.fileName) {
            let name = image.fileName, size = maxPixel
            uiImage = await Task.detached(priority: .userInitiated) {
                ImageStore.shared.thumbnail(for: name, maxPixel: size)
            }.value
        }
    }
}

/// Swipeable gallery of session images with their markers, plus a zoomable full-screen view.
struct EvidenceGallery: View {
    let session: FixSession
    let analysis: ProblemAnalysis?
    @Binding var selectedFinding: String?
    @Binding var page: Int
    var onSelect: (ResolvedMarker) -> Void

    @State private var fullScreen = false

    var body: some View {
        let images = session.sortedImages
        VStack(spacing: FXSpacing.s) {
            TabView(selection: $page) {
                ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                    AnnotatedImageView(image: image,
                                       markers: markers(for: image),
                                       selected: $selectedFinding,
                                       onSelect: onSelect)
                        .clipShape(.rect(cornerRadius: FXRadius.card, style: .continuous))
                        .padding(.horizontal, 2)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: images.count > 1 ? .automatic : .never))
            .frame(height: 340)
            .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Button { fullScreen = true } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right").frame(width: 36, height: 36)
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .padding(10)
                .accessibilityLabel(Text("Show image full screen"))
            }

            legend
        }
        .fullScreenCover(isPresented: $fullScreen) {
            ZoomableEvidence(session: session, analysis: analysis, page: page, selectedFinding: $selectedFinding)
        }
    }

    private func markers(for image: SessionImage) -> [ResolvedMarker] {
        guard let analysis, let index = session.latestRevision?.sentImageIndex(of: image.id) else { return [] }
        return analysis.markers(forImage: index, blocks: image.textBlocks)
    }

    @ViewBuilder
    private var legend: some View {
        let all = session.sortedImages.flatMap { markers(for: $0) }
        if !all.isEmpty {
            HStack(spacing: FXSpacing.l) {
                if all.contains(where: { $0.precision == .textMatch }) {
                    Label("Exact (recognized text)", systemImage: "square").font(.caption)
                }
                if all.contains(where: { $0.precision == .estimated }) {
                    Label("Approximate (AI estimate)", systemImage: "square.dashed").font(.caption)
                }
            }
            .foregroundStyle(Color.fxSecondaryText)
        }
    }
}

struct ZoomableEvidence: View {
    let session: FixSession
    let analysis: ProblemAnalysis?
    @State var page: Int
    @Binding var selectedFinding: String?

    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        let images = session.sortedImages
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            if images.indices.contains(page) {
                let image = images[page]
                let sent = session.latestRevision?.sentImageIndex(of: image.id)
                AnnotatedImageView(image: image,
                                   markers: sent.flatMap { idx in analysis?.markers(forImage: idx, blocks: image.textBlocks) } ?? [],
                                   selected: $selectedFinding,
                                   maxPixel: 2400)
                    .scaleEffect(scale)
                    .offset(offset)
                    .gesture(
                        MagnifyGesture()
                            .onChanged { scale = max(1, min(lastScale * $0.magnification, 5)) }
                            .onEnded { _ in lastScale = scale; if scale == 1 { offset = .zero; lastOffset = .zero } }
                            .simultaneously(with: DragGesture()
                                .onChanged { value in
                                    guard scale > 1 else { return }
                                    offset = CGSize(width: lastOffset.width + value.translation.width,
                                                    height: lastOffset.height + value.translation.height)
                                }
                                .onEnded { _ in lastOffset = offset })
                    )
                    .onTapGesture(count: 2) {
                        withAnimation(.smooth) {
                            scale = scale > 1 ? 1 : 2.5
                            lastScale = scale
                            if scale == 1 { offset = .zero; lastOffset = .zero }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .padding()
            .accessibilityLabel(Text("Close"))
        }
        .foregroundStyle(.white)
    }
}
