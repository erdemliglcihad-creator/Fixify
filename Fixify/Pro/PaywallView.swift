import SwiftUI
import StoreKit

/// Shown only after the user has hit a limit or asked for it. No timers, no pre-checked upsells.
/// Every listed benefit maps to a real limit in UsageLimits.
struct PaywallView: View {
    let reason: PaywallReason

    @Environment(ProStore.self) private var pro
    @Environment(UsageMeter.self) private var usage
    @Environment(\.dismiss) private var dismiss
    @State private var purchasing: String?
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FXSpacing.xl) {
                    VStack(alignment: .leading, spacing: FXSpacing.s) {
                        Image(systemName: "sparkles").font(.system(size: 36)).foregroundStyle(Color.fxAccent)
                        Text("Fixify Pro").font(.fxDisplay)
                        Text(reasonText).font(.fxBody).foregroundStyle(Color.fxSecondaryText)
                    }

                    comparison

                    switch pro.loadState {
                    case .loaded:
                        VStack(spacing: FXSpacing.m) {
                            ForEach(pro.products, id: \.id) { product in productButton(product) }
                        }
                    case .loading, .idle:
                        ProgressView().frame(maxWidth: .infinity)
                    case .unavailable(let text):
                        FXCard {
                            Label(text, systemImage: "info.circle").font(.fxBody)
                            Text("Your free analyses renew every month. Text recognition and on-device analysis are always free.")
                                .font(.fxCaption)
                                .foregroundStyle(Color.fxSecondaryText)
                        }
                    }

                    Text("Subscriptions renew automatically until cancelled in your Apple account settings. Cancel anytime; you keep Pro until the end of the period.")
                        .font(.caption)
                        .foregroundStyle(Color.fxSecondaryText)

                    Button("Restore purchases") {
                        Task {
                            try? await pro.restore()
                            if pro.isPro { dismiss() } else { message = String(localized: "No active Fixify Pro purchase was found.") }
                        }
                    }
                    .font(.fxCaption)
                }
                .padding(FXSpacing.xl)
            }
            .fxScreen()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } }
            }
            .alert("Fixify Pro", isPresented: .init(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(message ?? "")
            }
        }
    }

    private var reasonText: String {
        switch reason {
        case .monthlyAnalyses:
            String(localized: "You've used your \(UsageLimits.free.analysesPerMonth) free analyses this month. They renew on the 1st.")
        case .sessionUpdates:
            String(localized: "This session reached the \(UsageLimits.free.updatesPerSession) free plan updates. Pro allows longer, connected troubleshooting.")
        case .storedSessions:
            String(localized: "You've saved \(UsageLimits.free.storedSessions ?? 0) sessions. Delete old ones, or keep your full repair history with Pro.")
        case .browse:
            String(localized: "For longer troubleshooting and a complete repair history.")
        }
    }

    private var comparison: some View {
        FXCard {
            row(String(localized: "AI analyses per month"), free: "\(UsageLimits.free.analysesPerMonth)", pro: "\(UsageLimits.pro.analysesPerMonth)")
            Divider()
            row(String(localized: "Plan updates per session"), free: "\(UsageLimits.free.updatesPerSession)", pro: "\(UsageLimits.pro.updatesPerSession)")
            Divider()
            row(String(localized: "Photos per analysis"), free: "\(UsageLimits.free.imagesPerAnalysis)", pro: "\(UsageLimits.pro.imagesPerAnalysis)")
            Divider()
            row(String(localized: "Saved sessions"), free: "\(UsageLimits.free.storedSessions ?? 0)", pro: String(localized: "Unlimited"))
            Divider()
            row(String(localized: "Text recognition, on-device analysis"), free: String(localized: "Unlimited"), pro: String(localized: "Unlimited"))
        }
    }

    private func row(_ title: String, free: String, pro: String) -> some View {
        HStack {
            Text(title).font(.fxCaption)
            Spacer()
            Text(free).font(.fxCaption).foregroundStyle(Color.fxSecondaryText).frame(width: 70)
            Text(pro).font(.fxCaption.weight(.semibold)).foregroundStyle(Color.fxAccent).frame(width: 70)
        }
    }

    private func productButton(_ product: Product) -> some View {
        Button {
            purchasing = product.id
            Task {
                defer { purchasing = nil }
                do {
                    if try await pro.purchase(product) == .purchased { dismiss() }
                } catch {
                    message = error.localizedDescription
                }
            }
        } label: {
            HStack {
                VStack(alignment: .leading) {
                    Text(product.displayName).font(.fxHeadline)
                    if let period = product.subscription?.subscriptionPeriod {
                        Text(periodText(period)).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
                    }
                }
                Spacer()
                if purchasing == product.id { ProgressView() } else { Text(product.displayPrice).font(.fxHeadline) }
            }
            .padding(FXSpacing.l)
            .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.control, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: FXRadius.control, style: .continuous).strokeBorder(Color.fxHairline) }
        }
        .buttonStyle(.plain)
        .disabled(purchasing != nil)
    }

    private func periodText(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .month: period.value == 1 ? String(localized: "per month") : String(localized: "every \(period.value) months")
        case .year: String(localized: "per year")
        case .week: String(localized: "per week")
        case .day: String(localized: "per day")
        @unknown default: ""
        }
    }
}
