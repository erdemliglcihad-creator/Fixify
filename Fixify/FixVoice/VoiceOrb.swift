import SwiftUI

/// Glowing wave orb: blurred blue light with wobbling rings that follow the voice level.
struct VoiceOrb: View {
    var level: Double
    var thinking: Bool
    var size: CGFloat = 240

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let energy = 0.14 + level * 0.86 + (thinking ? 0.18 * (0.5 + 0.5 * sin(t * 3)) : 0)
            ZStack {
                Circle()
                    .fill(Color.fxGlow.opacity(0.5))
                    .frame(width: size * 0.62 * (1 + energy * 0.3), height: size * 0.62 * (1 + energy * 0.3))
                    .blur(radius: size * 0.14)
                Canvas { context, canvasSize in
                    let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                    let radius = canvasSize.width * 0.27
                    let rings: [(lobes: Double, speed: Double, phase: Double, amp: Double, scale: Double, color: Color, width: CGFloat)] = [
                        (4, 1.6, 1.2, 0.16, 1.08, Color.fxGlowLight, 2.5),
                        (5, -1.3, 2.4, 0.20, 1.16, Color.fxGlow, 2),
                        (2, 0.9, 3.9, 0.24, 1.26, Color.fxGlowDeep, 1.5),
                    ]
                    context.addFilter(.blur(radius: 1.2))
                    for ring in rings {
                        var path = Path()
                        for i in 0...120 {
                            let a = Double(i) / 120 * 2 * .pi
                            let wobble = sin(a * ring.lobes + t * ring.speed + ring.phase) * 0.6 + sin(a * (ring.lobes + 2) - t * ring.speed * 0.7 + ring.phase * 2) * 0.4
                            let r = radius * ring.scale * (1 + wobble * ring.amp * energy)
                            let point = CGPoint(x: center.x + cos(a) * r, y: center.y + sin(a) * r)
                            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
                        }
                        path.closeSubpath()
                        context.stroke(path, with: .color(ring.color), lineWidth: ring.width)
                    }
                    let core = radius * (0.62 + energy * 0.12)
                    context.fill(
                        Path(ellipseIn: CGRect(x: center.x - core, y: center.y - core, width: core * 2, height: core * 2)),
                        with: .radialGradient(Gradient(colors: [.white.opacity(0.95), Color.fxGlowLight.opacity(0.7), Color.fxGlow.opacity(0)]),
                                              center: center, startRadius: 0, endRadius: core)
                    )
                }
                .frame(width: size, height: size)
                .blendMode(.screen)
            }
            .frame(width: size, height: size)
        }
        .accessibilityHidden(true)
    }
}
