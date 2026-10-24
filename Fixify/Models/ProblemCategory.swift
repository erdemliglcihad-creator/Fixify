import Foundation

/// Problem categories. Adding one means: a case here, the same raw value in server/src/schema.mjs.
enum ProblemCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case computer, network, peripheral, software, object, appliance, document, general

    var id: String { rawValue }

    var title: String {
        switch self {
        case .computer: String(localized: "Computer")
        case .network: String(localized: "Wi-Fi & Bluetooth")
        case .peripheral: String(localized: "Devices & accessories")
        case .software: String(localized: "Apps & settings")
        case .object: String(localized: "Everyday objects")
        case .appliance: String(localized: "Appliances")
        case .document: String(localized: "Documents & forms")
        case .general: String(localized: "Something else")
        }
    }

    var symbol: String {
        switch self {
        case .computer: "desktopcomputer"
        case .network: "wifi"
        case .peripheral: "printer"
        case .software: "app.badge"
        case .object: "wrench.and.screwdriver"
        case .appliance: "washer"
        case .document: "doc.text.viewfinder"
        case .general: "questionmark.circle"
        }
    }

    /// Short capture tip shown in the camera when the user starts from this category.
    var captureTip: String {
        switch self {
        case .computer, .software: String(localized: "Fill the frame with the error message or the setting you are stuck on.")
        case .network: String(localized: "Photograph the connection screen or the device's status lights.")
        case .peripheral: String(localized: "Show the device and its cable or status lights.")
        case .object: String(localized: "Show the part that is broken, with something for scale if you can.")
        case .appliance: String(localized: "Show the display, error code or the area that is not working. Unplug before touching anything inside.")
        case .document: String(localized: "Use Document mode for a straight, readable scan.")
        case .general: String(localized: "Show what is wrong. You can add a description afterwards.")
        }
    }

    /// Categories offered as quick starts on Home.
    static let suggestions: [ProblemCategory] = [.computer, .network, .peripheral, .appliance, .object, .document]
}
