import Combine
import SwiftUI

/// FixVoice: talk to Fixify like on the phone. Calm start screen (orb, greeting, one pill), plus a black
/// rail on the right edge with rings for the call, screen questions and today's uploads.
struct FixVoiceView: View {
    @State private var call = CallEngine()
    @State private var askConsent = false
    @State private var quota: (left: Int, daily: Int)?
    @State private var recording = ScreenFrames.isBroadcasting
    @State private var voice = AppGroup.voiceGender
    @State private var showSetup = false

    var body: some View {
        ZStack(alignment: .trailing) {
            LinearGradient(colors: [.clear, Color.fxGlowDeep.opacity(0.55), Color.fxGlow.opacity(0.65)], startPoint: .init(x: 0.5, y: 0.45), endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            VStack(spacing: 0) {
                Button(action: primary) {
                    VoiceOrb(level: call.level, thinking: call.phase == .thinking || call.phase == .transcribing || call.phase == .connecting)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(call.inCall ? status : String(localized: "Start call"))
                .padding(.top, FXSpacing.xl)

                VStack(spacing: FXSpacing.m) {
                    if call.inCall {
                        Text(status).font(.fxEyebrow).foregroundStyle(Color.fxSecondaryText)
                        live
                    } else {
                        Text(greeting).font(.fxEyebrow).foregroundStyle(Color.fxSecondaryText)
                        Text("How can I help you today?")
                            .font(.fxHero)
                            .multilineTextAlignment(.center)
                            .accessibilityAddTraits(.isHeader)
                    }
                    if let error = call.error {
                        Text(error).font(.fxCaption).foregroundStyle(Color.fxDanger).multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, FXSpacing.xxl + 28)
                .padding(.top, FXSpacing.l)
                .animation(.smooth(duration: 0.3), value: call.inCall)

                Spacer(minLength: FXSpacing.l)
                pill.padding(.horizontal, FXSpacing.l).padding(.bottom, FXSpacing.l)
            }

            rail
        }
        .background(Color.fxBackground)
        .toolbar(.hidden, for: .navigationBar)
        .task { await refresh() }
        .onReceive(Timer.publish(every: 2, on: .main, in: .common).autoconnect()) { _ in recording = ScreenFrames.isBroadcasting }
        .onDisappear { call.end() }
        .alert("Allow FixVoice?", isPresented: $askConsent) {
            Button("Allow") {
                AppGroup.cloudConsent = true
                Task { await call.start() }
            }
            Button("Not now", role: .cancel) {}
        } message: {
            Text("Your speech, questions and, for screen questions, a screenshot are sent to Fixify Cloud (Groq) to answer. Nothing is stored there.")
        }
        .sheet(isPresented: $showSetup) { ScreenQuestionSetupView() }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        return hour >= 5 && hour < 12 ? String(localized: "Good morning") : hour >= 12 && hour < 18 ? String(localized: "Good afternoon") : String(localized: "Good evening")
    }

    private var status: String {
        switch call.phase {
        case .idle: ""
        case .connecting: String(localized: "Connecting…")
        case .listening: String(localized: "Listening…")
        case .transcribing: String(localized: "Understanding…")
        case .thinking: String(localized: "Thinking…")
        case .speaking: String(localized: "Speaking")
        }
    }

    private func primary() {
        if call.inCall { return call.tap() }
        guard AppGroup.cloudConsent else { return askConsent = true }
        Task { await call.start() }
    }

    private func refresh() async {
        quota = await FixifyCloud().quota()
    }

    /// What is said right now: your words while FixVoice thinks, then its reply, lit up as it is spoken.
    @ViewBuilder private var live: some View {
        if call.phase == .speaking, !call.reply.isEmpty {
            let plain = Speaker.speakable(call.reply)
            let cut = min(max(call.spokenTo, 0), plain.count)
            let index = plain.index(plain.startIndex, offsetBy: cut)
            (Text(plain[..<index]).foregroundStyle(Color.primary) + Text(plain[index...]).foregroundStyle(Color.fxSecondaryText))
                .font(.fxLive)
                .multilineTextAlignment(.center)
                .lineLimit(7)
        } else if !call.heard.isEmpty, call.phase != .listening {
            Text(call.heard).font(.fxLive).multilineTextAlignment(.center).lineLimit(5)
        } else {
            Text("Just talk. I'm listening.").font(.fxLive).foregroundStyle(Color.fxSecondaryText).multilineTextAlignment(.center)
        }
    }

    private var pill: some View {
        HStack(spacing: FXSpacing.s) {
            Button(action: primary) {
                HStack(spacing: FXSpacing.m) {
                    Text(pillText)
                        .font(.fxPill)
                        .foregroundStyle(call.inCall ? Color.primary : Color.fxSecondaryText)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    SoundBars(level: call.level, active: call.inCall)
                }
                .padding(.leading, FXSpacing.xl)
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if call.inCall {
                Button { call.end() } label: {
                    Image(systemName: "xmark").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 48, height: 48)
                        .background(Color.fxDanger, in: Circle())
                }
                .accessibilityLabel("End call")
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.trailing, 8)
        .frame(height: 64)
        .glassEffect(.regular.tint(Color.fxGlow.opacity(0.18)), in: Capsule())
        .animation(.smooth(duration: 0.25), value: call.inCall)
    }

    private var pillText: String {
        switch call.phase {
        case .idle: String(localized: "Tap to talk…")
        case .speaking: String(localized: "Tap or talk to interrupt")
        case .listening: String(localized: "Tap when you are done")
        default: status
        }
    }

    private var uploadsLabel: String {
        guard let quota else { return "" }
        let remaining = quota.left
        let total = quota.daily
        return String(localized: "\(remaining) of \(total) photo uploads left today")
    }

    // MARK: Rail

    private var rail: some View {
        VStack(spacing: FXSpacing.l) {
            RailItem(progress: call.inCall ? 1 : 0.0, systemImage: "waveform", caption: call.inCall ? String(localized: "Live") : String(localized: "Call")) { primary() }

            ZStack {
                RailItem(progress: recording ? 1 : 0, systemImage: "rectangle.dashed.badge.record", caption: recording ? String(localized: "On") : String(localized: "Screen"), action: nil)
                ScreenRecordingPicker()
                    .frame(width: 52, height: 52)
                    .offset(y: -10)
                    .accessibilityLabel("Start screen recording for a question")
            }

            RailItem(progress: quota.map { Double($0.left) / Double(max($0.daily, 1)) } ?? 0,
                     systemImage: "photo",
                     caption: quota.map { "\($0.left)/\($0.daily)" } ?? "–") { Task { await refresh() } }
                .accessibilityLabel(uploadsLabel)

            Menu {
                Picker("Voice", selection: $voice) {
                    Text("Female voice").tag(VoiceGender.female)
                    Text("Male voice").tag(VoiceGender.male)
                }
                Button("How screen questions work", systemImage: "questionmark.circle") { showSetup = true }
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.black, in: Circle())
            }
            .accessibilityLabel("FixVoice settings")
            .onChange(of: voice) { _, new in AppGroup.voiceGender = new }
        }
        .padding(.vertical, FXSpacing.xl + 26)
        .padding(.leading, 14)
        .padding(.trailing, 10)
        .background(EdgeRail().fill(Color.black))
        .shadow(color: .black.opacity(0.5), radius: 18, x: -4)
        .padding(.bottom, 90)
    }
}

/// One ring in the rail: progress ring, symbol, small caption.
private struct RailItem: View {
    var progress: Double
    var systemImage: String
    var caption: String
    var action: (() -> Void)?

    var body: some View {
        let content = VStack(spacing: 6) {
            FixifyRing(progress: progress, systemImage: systemImage, size: 52, tint: .fxGlowLight)
            Text(caption).font(.fxRailCaption).foregroundStyle(.white.opacity(0.85))
        }
        if let action {
            Button(action: action) { content }.buttonStyle(.plain)
        } else {
            content
        }
    }
}

/// Black panel glued to the right edge with soft concave joins at top and bottom (like the reference).
struct EdgeRail: Shape {
    var flare: CGFloat = 26
    var corner: CGFloat = 34

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let f = flare
        // Body, extending past the right edge so only the left corners show.
        path.addRoundedRect(in: CGRect(x: rect.minX, y: rect.minY + f, width: rect.width + corner, height: rect.height - 2 * f),
                            cornerSize: CGSize(width: corner, height: corner), style: .continuous)
        // Top join.
        path.move(to: CGPoint(x: rect.maxX - f, y: rect.minY + f))
        path.addArc(center: CGPoint(x: rect.maxX - f, y: rect.minY), radius: f, startAngle: .degrees(90), endAngle: .degrees(0), clockwise: true)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + f))
        path.closeSubpath()
        // Bottom join.
        path.move(to: CGPoint(x: rect.maxX - f, y: rect.maxY - f))
        path.addArc(center: CGPoint(x: rect.maxX - f, y: rect.maxY), radius: f, startAngle: .degrees(270), endAngle: .degrees(360), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - f))
        path.closeSubpath()
        return path
    }
}

/// Five thin bars, like a sound wave; they move with the voice during a call.
private struct SoundBars: View {
    var level: Double
    var active: Bool

    var body: some View {
        TimelineView(.animation(paused: !active)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(Array([0.45, 0.8, 1, 0.7, 0.4].enumerated()), id: \.offset) { index, scale in
                    let wobble = active ? 0.5 + 0.5 * sin(t * 9 + Double(index) * 1.3) : 0
                    Capsule()
                        .fill(active ? Color.primary : Color.fxSecondaryText)
                        .frame(width: 2.5, height: 6 + scale * (active ? 6 + level * 18 * (0.6 + 0.4 * wobble) : 10))
                }
            }
            .frame(height: 32)
        }
        .accessibilityHidden(true)
    }
}
