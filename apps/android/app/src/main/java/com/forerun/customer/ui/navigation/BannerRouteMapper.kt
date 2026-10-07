package com.forerun.customer.ui.navigation

/**
 * Maps backend banner actionValue strings to Android navigation route constants.
 *
 * Backend Whitelist (BANNER_IN_APP_ROUTES):
 * - "/create-order" -> [Routes.CREATE_ORDER] ("create_order")
 * - "/orders"       -> [Routes.ORDERS] ("orders")
 * - "/account"      -> [Routes.ACCOUNT] ("account")
 * - "/support"      -> [Routes.SUPPORT] ("support")
 * - "/home"         -> [Routes.HOME] ("home")
 *
 * Safe Fallback:
 * If actionValue is null, blank, malformed, or not in the whitelist (e.g. future backend
 * routes added before Android is updated), returns null silently to ensure zero crashes.
 */
object BannerRouteMapper {

    private val ROUTE_MAP: Map<String, String> = mapOf(
        "/create-order" to Routes.CREATE_ORDER,
        "/orders" to Routes.ORDERS,
        "/account" to Routes.ACCOUNT,
        "/support" to Routes.SUPPORT,
        "/home" to Routes.HOME
    )

    /**
     * Maps the given [actionValue] to its corresponding Android route constant.
     *
     * @param actionValue Stored backend route path (e.g. "/create-order")
     * @return Matching Android route constant, or null if unknown or invalid
     */
    fun toRoute(actionValue: String?): String? {
        if (actionValue.isNullOrBlank()) return null

        val trimmed = actionValue.trim()
        val normalized = if (trimmed.length > 1 && trimmed.endsWith('/')) {
            trimmed.dropLast(1)
        } else {
            trimmed
        }

        return ROUTE_MAP[normalized]
    }

    /**
     * Checks if the given [actionValue] resolves to a supported in-app destination.
     */
    fun isSupported(actionValue: String?): Boolean = toRoute(actionValue) != null

    /**
     * Immutable set of all supported backend route keys.
     */
    val supportedBackendRoutes: Set<String> = ROUTE_MAP.keys
}
