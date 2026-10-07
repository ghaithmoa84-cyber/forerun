package com.forerun.customer.data.remote.dto.banner

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Action type for client banner interactions, corresponding to backend BannerActionType.
 */
enum class BannerActionType {
    NONE,
    EXTERNAL_URL,
    IN_APP_ROUTE,
    WHATSAPP_ADMIN;

    companion object {
        fun fromString(value: String?): BannerActionType = when (value?.trim()?.uppercase()) {
            "EXTERNAL_URL" -> EXTERNAL_URL
            "IN_APP_ROUTE" -> IN_APP_ROUTE
            "WHATSAPP_ADMIN" -> WHATSAPP_ADMIN
            else -> NONE
        }
    }
}

/**
 * DTO matching backend ActiveBannerResponse (GET /api/v1/banners/active).
 */
@JsonClass(generateAdapter = true)
data class BannerDto(
    @Json(name = "id") val id: String,
    @Json(name = "headline") val headline: String? = null,
    @Json(name = "subtitle") val subtitle: String? = null,
    @Json(name = "imageUrl") val imageUrl: String,
    @Json(name = "actionType") val actionType: String,
    @Json(name = "actionValue") val actionValue: String? = null,
    @Json(name = "ctaLabel") val ctaLabel: String? = null,
    @Json(name = "sortOrder") val sortOrder: Int
) {
    /**
     * Resolves the raw string [actionType] into a type-safe [BannerActionType] with safe NONE fallback.
     */
    val resolvedActionType: BannerActionType
        get() = BannerActionType.fromString(actionType)
}
