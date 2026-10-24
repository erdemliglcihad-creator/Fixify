import SwiftUI
import UIKit

/// Fixify color tokens. One restrained accent (signal blue) and one marker color (amber)
/// that stays readable on top of arbitrary camera images.
extension Color {
    static let fxBackground = Color(light: 0xF4F5F7, dark: 0x0B0D12)
    static let fxSurface = Color(light: 0xFFFFFF, dark: 0x151922)
    static let fxSurfaceRaised = Color(light: 0xFFFFFF, dark: 0x1D2230)
    static let fxHairline = Color(light: 0xE3E6EB, dark: 0x2A3040)
    static let fxSecondaryText = Color(light: 0x5B6270, dark: 0x9AA3B5)
    static let fxAccent = Color(light: 0x1F5EFF, dark: 0x5B8CFF)
    static let fxAccentSoft = Color(light: 0xE6EEFF, dark: 0x1B2747)
    static let fxMarker = Color(light: 0xF5A300, dark: 0xFFB61E)
    static let fxSuccess = Color(light: 0x14894E, dark: 0x3DD68C)
    static let fxCaution = Color(light: 0xB86E00, dark: 0xF2A93B)
    static let fxDanger = Color(light: 0xC62828, dark: 0xFF6B6B)

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

extension Font {
    static let fxDisplay = Font.system(.largeTitle, design: .default).weight(.bold)
    static let fxTitle = Font.system(.title2, design: .default).weight(.semibold)
    static let fxHeadline = Font.system(.headline)
    static let fxBody = Font.system(.body)
    static let fxCaption = Font.system(.footnote)
    static let fxMono = Font.system(.footnote, design: .monospaced)
    static let fxNumber = Font.system(.caption, design: .rounded).weight(.bold)
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
