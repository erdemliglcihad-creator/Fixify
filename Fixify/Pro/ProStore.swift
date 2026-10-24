import Foundation
import Observation
import StoreKit

/// Fixify Pro via StoreKit 2. Product ids must exist in App Store Connect (or Fixify.storekit for local testing).
/// If products cannot be loaded, the paywall says so instead of showing prices that do not exist.
@MainActor
@Observable
final class ProStore {
    static let productIDs = ["app.fixify.pro.monthly", "app.fixify.pro.yearly"]

    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var loadState: LoadState = .idle
    private(set) var activeProductID: String?
    private var updates: Task<Void, Never>?

    enum LoadState: Equatable { case idle, loading, loaded, unavailable(String) }

    var limits: UsageLimits { .current(isPro: isPro) }

    func start() async {
        if updates == nil {
            updates = Task { [weak self] in
                for await result in Transaction.updates {
                    if case .verified(let transaction) = result { await transaction.finish() }
                    await self?.refreshEntitlements()
                }
            }
        }
        await refreshEntitlements()
        await loadProducts()
    }

    func loadProducts() async {
        loadState = .loading
        do {
            let loaded = try await Product.products(for: Self.productIDs)
            products = loaded.sorted { $0.price < $1.price }
            loadState = loaded.isEmpty
                ? .unavailable(String(localized: "Fixify Pro is not available in this build yet."))
                : .loaded
        } catch {
            loadState = .unavailable(String(localized: "The App Store could not be reached."))
        }
    }

    func refreshEntitlements() async {
        var active: String?
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               Self.productIDs.contains(transaction.productID),
               transaction.revocationDate == nil {
                active = transaction.productID
            }
        }
        activeProductID = active
        isPro = active != nil
    }

    enum PurchaseOutcome { case purchased, pending, cancelled }

    func purchase(_ product: Product) async throws -> PurchaseOutcome {
        switch try await product.purchase() {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                throw StoreError.unverified
            }
            await transaction.finish()
            await refreshEntitlements()
            return .purchased
        case .pending:
            return .pending
        case .userCancelled:
            return .cancelled
        @unknown default:
            return .cancelled
        }
    }

    func restore() async throws {
        try await AppStore.sync()
        await refreshEntitlements()
    }

    enum StoreError: LocalizedError {
        case unverified
        var errorDescription: String? { String(localized: "The purchase could not be verified.") }
    }
}
