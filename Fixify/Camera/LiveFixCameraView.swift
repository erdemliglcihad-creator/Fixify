import SwiftUI
import PhotosUI
import VisionKit

/// Full-screen camera for Live Fix. Detection overlays here show only on-device text recognition,
/// which really runs on the live frames; the AI analysis happens after capture and is labeled as such.
struct LiveFixCameraView: View {
    var category: ProblemCategory?
    var startWithLibrary = false
    @Binding var captures: [CapturedImage]
    var maxCaptures: Int
    var onClose: () -> Void
    var onNext: () -> Void
    var onDescribeOnly: () -> Void

    @Environment(AppSettings.self) private var settings
    @Environment(\.openURL) private var openURL
    @State private var model = CameraModel()
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showDocumentScanner = false
    @State private var focusPoint: CGPoint?
    @State private var flash = false
    @State private var showTip = true
    @State private var showLibrary = false

    private var isFull: Bool { captures.count >= maxCaptures }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if model.state != .denied && model.state != .unavailable {
                CameraPreview(session: model.camera.session) { point, devicePoint in
                    focusPoint = point
                    model.camera.focus(at: devicePoint)
                    Task {
                        try? await Task.sleep(for: .seconds(1))
                        focusPoint = nil
                    }
                }
                .ignoresSafeArea()
                liveTextOverlay.ignoresSafeArea()
            } else {
                noCameraView
            }

            if let focusPoint {
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.fxMarker, lineWidth: 1.5)
                    .frame(width: 72, height: 72)
                    .position(focusPoint)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }

            if flash {
                Color.white.ignoresSafeArea().allowsHitTesting(false)
            }

            VStack(spacing: FXSpacing.m) {
                topBar
                if showTip { tipCard.transition(.move(edge: .top).combined(with: .opacity)) }
                Spacer()
                if !captures.isEmpty { captureStrip }
                modePicker
                controls
            }
            .padding(.horizontal, FXSpacing.l)
            .padding(.bottom, FXSpacing.s)
        }
        .statusBarHidden()
        .task {
            if startWithLibrary { showLibrary = true }
            await model.start()
        }
        .photosPicker(isPresented: $showLibrary, selection: $pickerItems,
                      maxSelectionCount: max(1, maxCaptures - captures.count), matching: .images)
        .onDisappear { model.stop() }
        .onChange(of: pickerItems) { _, items in loadPicked(items) }
        .onChange(of: model.mode) { _, mode in
            if mode == .document {
                showDocumentScanner = true
            }
        }
        .fullScreenCover(isPresented: $showDocumentScanner, onDismiss: { model.mode = .photo }) {
            DocumentScannerView(onScan: { images in
                append(images.map { CapturedImage(image: $0, source: .document) })
            }, onClose: { showDocumentScanner = false })
            .ignoresSafeArea()
        }
        .alert("Camera", isPresented: .init(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
        .sensoryFeedback(.impact(weight: .light), trigger: captures.count)
    }

    // MARK: Overlays

    private var liveTextOverlay: some View {
        GeometryReader { geo in
            let frame = CGRect(origin: .zero, size: geo.size)
            ForEach(model.liveText) { block in
                let rect = block.box.rect(in: frame, imageSize: model.liveFrameSize, fill: true)
                RoundedRectangle(cornerRadius: 3)
                    .stroke(.white.opacity(0.75), lineWidth: 1)
                    .background(Color.white.opacity(0.06))
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)
            }
        }
        .allowsHitTesting(false)
        .animation(.easeOut(duration: 0.2), value: model.liveText)
        .accessibilityHidden(true)
    }

    private var topBar: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "xmark").font(.headline).frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel(Text("Close camera"))

            Spacer()

            HStack(spacing: 6) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                if case .recording(let since) = model.state {
                    TimelineView(.periodic(from: since, by: 1)) { context in
                        Text("\(model.statusText) \(Int(context.date.timeIntervalSince(since)))s")
                    }
                } else {
                    Text(model.statusText)
                }
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .glassEffect(.regular, in: .capsule)
            .accessibilityElement(children: .combine)

            Spacer()

            Button {
                model.torchOn.toggle()
            } label: {
                Image(systemName: model.torchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                    .font(.headline)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .disabled(model.state == .denied || model.state == .unavailable)
            .accessibilityLabel(Text(model.torchOn ? String(localized: "Turn light off") : String(localized: "Turn light on")))
        }
        .foregroundStyle(.white)
    }

    private var statusColor: Color {
        switch model.state {
        case .recording: .red
        case .ready: model.liveText.isEmpty ? .white.opacity(0.7) : .fxMarker
        case .denied, .unavailable: .fxDanger
        default: .white.opacity(0.5)
        }
    }

    private var tipCard: some View {
        HStack(alignment: .top, spacing: FXSpacing.m) {
            Image(systemName: "lightbulb").foregroundStyle(Color.fxMarker)
            VStack(alignment: .leading, spacing: 4) {
                Text((category ?? .general).captureTip).font(.subheadline)
                Text("Boxes show text this iPhone recognizes. The AI analysis starts after you take the photo.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.75))
            }
            Spacer(minLength: 0)
            Button {
                withAnimation(.smooth) { showTip = false }
                settings.hasSeenCameraIntro = true
            } label: {
                Image(systemName: "xmark.circle.fill").foregroundStyle(.white.opacity(0.7))
            }
            .accessibilityLabel(Text("Hide tip"))
        }
        .foregroundStyle(.white)
        .padding(FXSpacing.m)
        .glassEffect(.regular, in: .rect(cornerRadius: 18))
        .onAppear { if settings.hasSeenCameraIntro && category == nil { showTip = false } }
    }

    private var captureStrip: some View {
        HStack(spacing: FXSpacing.s) {
            ScrollView(.horizontal) {
                HStack(spacing: FXSpacing.s) {
                    ForEach(captures) { capture in
                        Image(uiImage: capture.image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 48, height: 48)
                            .clipShape(.rect(cornerRadius: 10))
                            .overlay(alignment: .topTrailing) {
                                Button {
                                    captures.removeAll { $0.id == capture.id }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .symbolRenderingMode(.palette)
                                        .foregroundStyle(.white, .black.opacity(0.6))
                                }
                                .offset(x: 6, y: -6)
                                .accessibilityLabel(Text("Remove photo"))
                            }
                    }
                }
                .padding(.top, 6)
            }
            .scrollIndicators(.hidden)

            Button(action: onNext) {
                Label("Next", systemImage: "arrow.right")
                    .labelStyle(.titleAndIcon)
                    .font(.headline)
                    .padding(.horizontal, 6)
            }
            .buttonStyle(.glassProminent)
        }
    }

    private var modePicker: some View {
        HStack(spacing: 4) {
            ForEach(CaptureMode.allCases) { mode in
                Button {
                    withAnimation(.snappy) { model.mode = mode }
                } label: {
                    Text(mode.title)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .foregroundStyle(model.mode == mode ? Color.black : .white)
                        .background(model.mode == mode ? Color.fxMarker : .clear, in: .capsule)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(model.mode == mode ? .isSelected : [])
            }
        }
        .padding(4)
        .glassEffect(.regular, in: .capsule)
        .disabled(isRecording || model.state == .denied || model.state == .unavailable)
    }

    private var isRecording: Bool {
        if case .recording = model.state { return true }
        return false
    }

    private var controls: some View {
        HStack {
            PhotosPicker(selection: $pickerItems, maxSelectionCount: max(1, maxCaptures - captures.count), matching: .images) {
                Image(systemName: "photo.on.rectangle").font(.title3).frame(width: 52, height: 52)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .disabled(isFull)
            .accessibilityLabel(Text("Choose from photos"))

            Spacer()
            shutter
            Spacer()

            Button(action: onDescribeOnly) {
                Image(systemName: "text.bubble").font(.title3).frame(width: 52, height: 52)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .accessibilityLabel(Text("Describe the problem instead"))
        }
        .foregroundStyle(.white)
    }

    private var shutter: some View {
        Button {
            shutterTapped()
        } label: {
            ZStack {
                Circle().stroke(.white, lineWidth: 4).frame(width: 78, height: 78)
                if isRecording {
                    RoundedRectangle(cornerRadius: 6).fill(.red).frame(width: 30, height: 30)
                } else {
                    Circle().fill(model.mode == .video ? Color.red : .white).frame(width: 64, height: 64)
                }
                if model.state == .capturing || model.state == .extractingFrames {
                    ProgressView().tint(.black)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(isFull || !(model.state == .ready || isRecording))
        .opacity(isFull ? 0.4 : 1)
        .accessibilityLabel(Text(model.mode == .video ? (isRecording ? String(localized: "Stop recording") : String(localized: "Record video")) : String(localized: "Take photo")))
        .accessibilityHint(Text(isFull ? String(localized: "Maximum number of photos reached") : ""))
    }

    private var noCameraView: some View {
        VStack(spacing: FXSpacing.l) {
            Image(systemName: "camera.badge.ellipsis").font(.system(size: 44)).foregroundStyle(.white.opacity(0.8))
            Text(model.state == .denied ? String(localized: "Camera access is off") : String(localized: "No camera available"))
                .font(.fxTitle)
                .foregroundStyle(.white)
            Text("You can still choose a photo or screenshot, or describe the problem in words.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.75))
            if model.state == .denied {
                Button("Open iOS Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .buttonStyle(.glassProminent)
            }
        }
        .padding(FXSpacing.xxl)
    }

    // MARK: Actions

    private func shutterTapped() {
        switch model.mode {
        case .photo:
            Task {
                withAnimation(.easeOut(duration: 0.08)) { flash = true }
                let image = await model.takePhoto()
                withAnimation(.easeIn(duration: 0.25)) { flash = false }
                if let image { append([CapturedImage(image: image, source: .camera)]) }
            }
        case .video:
            if isRecording {
                model.stopRecording()
            } else {
                Task {
                    let frames = await model.recordClip()
                    append(frames.map { CapturedImage(image: $0, source: .videoFrame) })
                }
            }
        case .document:
            showDocumentScanner = true
        }
    }

    private func append(_ new: [CapturedImage]) {
        let room = maxCaptures - captures.count
        guard room > 0 else { return }
        withAnimation(.snappy) { captures.append(contentsOf: new.prefix(room)) }
        showTip = false
    }

    private func loadPicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var images: [CapturedImage] = []
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    images.append(CapturedImage(image: image, source: .library))
                }
            }
            append(images)
            pickerItems = []
        }
    }
}

/// VisionKit document scanner: edge detection and perspective correction on device.
struct DocumentScannerView: UIViewControllerRepresentable {
    var onScan: ([UIImage]) -> Void
    var onClose: () -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        var parent: DocumentScannerView
        init(parent: DocumentScannerView) { self.parent = parent }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            parent.onScan((0..<scan.pageCount).map { scan.imageOfPage(at: $0) })
            parent.onClose()
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            parent.onClose()
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            parent.onClose()
        }
    }
}
