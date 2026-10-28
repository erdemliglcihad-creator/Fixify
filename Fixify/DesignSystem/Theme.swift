import SwiftUI
import UIKit

/// Fixify color tokens: one color world, black with a deep blue glow and an ice-blue accent,
/// plus an amber marker color that stays readable on arbitrary camera images.
extension Color {
    static let fxBackground = Color(light: 0xF3F6FB, dark: 0x020409)
    static let fxSurface = Color(light: 0xFFFFFF, dark: 0x0A0F1A)
    static let fxSurfaceRaised = Color(light: 0xFFFFFF, dark: 0x111827)
    static let fxHairline = Color(light: 0xDCE3EE, dark: 0x1C2333)
    static let fxSecondaryText = Color(light: 0x5A6478, dark: 0x8A94A8)
    static let fxAccent = Color(light: 0x1E5BFF, dark: 0x5B9BFF)
    static let fxAccentSoft = Color(light: 0xE4ECFF, dark: 0x0D1A33)
    static let fxMarker = Color(light: 0xF5A300, dark: 0xFFB61E)
    static let fxSuccess = Color(light: 0x14894E, dark: 0x3DD68C)
    static let fxCaution = Color(light: 0xB86E00, dark: 0xF2A93B)
    static let fxDanger = Color(light: 0xC62828, dark: 0xFF6B6B)
    // FixVoice glow.
    static let fxGlow = Color(light: 0x1E5BFF, dark: 0x1E5BFF)
    static let fxGlowLight = Color(light: 0x5AA8FF, dark: 0x5AA8FF)
    static let fxGlowDeep = Color(light: 0x0B2A6B, dark: 0x0B2A6B)

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

enum FXSpacing {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 12
    static let l: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum FXRadius {
    static let card: CGFloat = 22
    static let control: CGFloat = 14
    static let chip: CGFloat = 9
}

/// Montserrat everywhere (bundled, OFL). Sizes scale with Dynamic Type.
extension Font {
    static let fxDisplay = Font.custom("Montserrat-SemiBold", size: 32, relativeTo: .largeTitle)
    static let fxTitle = Font.custom("Montserrat-SemiBold", size: 21, relativeTo: .title2)
    static let fxHeadline = Font.custom("Montserrat-SemiBold", size: 16, relativeTo: .headline)
    static let fxBody = Font.custom("Montserrat-Regular", size: 16, relativeTo: .body)
    static let fxCaption = Font.custom("Montserrat-Regular", size: 13, relativeTo: .footnote)
    static let fxMono = Font.system(.footnote, design: .monospaced)
    static let fxNumber = Font.custom("Montserrat-Bold", size: 12, relativeTo: .caption)
    // FixVoice.
    static let fxHero = Font.custom("Montserrat-Medium", size: 33, relativeTo: .largeTitle)
    static let fxLive = Font.custom("Montserrat-Medium", size: 23, relativeTo: .title2)
    static let fxEyebrow = Font.custom("Montserrat-Regular", size: 15, relativeTo: .subheadline)
    static let fxPill = Font.custom("Montserrat-Medium", size: 16, relativeTo: .body)
    static let fxRailCaption = Font.custom("Montserrat-Medium", size: 12, relativeTo: .caption)
}

enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: String(localized: "System")
        case .light: String(localized: "Light")
        case .dark: String(localized: "Dark")
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
