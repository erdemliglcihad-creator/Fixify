import SwiftUI

/// The card iOS shows on top of the current app after a screen question: black, rounded, with Fixify's
/// glowing ring (the same look as the FixVoice rail in the app).
struct AskSnippetView: View {
    var question: String
    var answer: String
    var thumbnail: Data?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            FixifyRing(progress: 1, systemImage: "waveform", size: 44)
            VStack(alignment: .leading, spacing: 6) {
                Text(question)
                    .font(.custom("Montserrat-Medium", size: 13, relativeTo: .footnote))
                    .foregroundStyle(Color.white.opacity(0.55))
                    .lineLimit(2)
                Text(answer)
                    .font(.custom("Montserrat-Medium", size: 17, relativeTo: .body))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if let thumbnail, let image = UIImage(data: thumbnail) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 44, height: 78)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.white.opacity(0.15), lineWidth: 0.5))
                    .accessibilityHidden(true)
            }
        }
        .padding(16)
        .background(Color.black, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    }
}

/// A progress ring with a symbol in the middle, like the reference rail (73 %, 21 %, …).
struct FixifyRing: View {
    var progress: Double
    var systemImage: String
    var size: CGFloat = 52
    var tint: Color = Color(red: 0.36, green: 0.61, blue: 1.0)

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.14), lineWidth: size * 0.075)
            Circle()
                .trim(from: 0, to: max(0.001, min(progress, 1)))
                .stroke(tint, style: StrokeStyle(lineWidth: size * 0.075, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: tint.opacity(0.6), radius: 4)
            Image(systemName: systemImage)
                .font(.system(size: size * 0.36, weight: .medium))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}
