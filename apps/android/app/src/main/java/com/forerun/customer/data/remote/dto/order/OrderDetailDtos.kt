package com.forerun.customer.data.remote.dto.order

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class OrderDetailResponseDto(
    @Json(name = "id") val id: String,
    @Json(name = "orderNumber") val orderNumber: String,
    @Json(name = "status") val status: String,
    @Json(name = "isPeripheral") val isPeripheral: Boolean = false,
    @Json(name = "baseFee") val baseFee: Int = 0,
    @Json(name = "peripheralFee") val peripheralFee: Int = 0,
    @Json(name = "extraStoresFee") val extraStoresFee: Int = 0,
    @Json(name = "customFee") val customFee: Int = 0,
    @Json(name = "customFeeReason") val customFeeReason: String? = null,
    @Json(name = "totalFee") val totalFee: Int = 0,
    @Json(name = "deliveryLat") val deliveryLat: Double? = null,
    @Json(name = "deliveryLng") val deliveryLng: Double? = null,
    @Json(name = "deliveryDesc") val deliveryDesc: String? = null,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "preferredRunnerId") val preferredRunnerId: String? = null,
    @Json(name = "waitForPreferred") val waitForPreferred: Boolean = false,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    @Json(name = "deliveredAt") val deliveredAt: String? = null,
    @Json(name = "cancelledAt") val cancelledAt: String? = null,
    @Json(name = "cancelReason") val cancelReason: String? = null,
    @Json(name = "items") val items: List<DetailOrderItemDto> = emptyList(),
    @Json(name = "stores") val stores: List<OrderStoreDetailDto> = emptyList(),
    @Json(name = "orderStores") val orderStores: List<OrderStoreDetailDto>? = null,
    @Json(name = "rating") val rating: OrderRatingDto? = null,
    @Json(name = "timeline") val timeline: OrderTimelineDto? = null,
    @Json(name = "runner") val runner: OrderRunnerDetailDto? = null
)

@JsonClass(generateAdapter = true)
data class DetailOrderItemDto(
    @Json(name = "id") val id: String,
    @Json(name = "itemName") val itemName: String,
    @Json(name = "quantity") val quantity: String,
    @Json(name = "customStoreName") val customStoreName: String? = null,
    @Json(name = "anyStore") val anyStore: Boolean = true
)

@JsonClass(generateAdapter = true)
data class OrderStoreDetailDto(
    @Json(name = "id") val id: String,
    @Json(name = "storeName") val storeName: String,
    @Json(name = "status") val status: String = "PENDING",
    @Json(name = "isExtra") val isExtra: Boolean = false,
    @Json(name = "items") val items: List<StoreItemDetailDto> = emptyList(),
    @Json(name = "receipts") val receipts: List<StoreReceiptDetailDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class StoreItemDetailDto(
    @Json(name = "id") val id: String,
    @Json(name = "itemName") val itemName: String,
    @Json(name = "quantity") val quantity: String
)

@JsonClass(generateAdapter = true)
data class StoreReceiptDetailDto(
    @Json(name = "id") val id: String,
    @Json(name = "imageUrl") val imageUrl: String
)

@JsonClass(generateAdapter = true)
data class OrderRatingDto(
    @Json(name = "stars") val stars: Int,
    @Json(name = "note") val note: String? = null
)

@JsonClass(generateAdapter = true)
data class OrderTimelineDto(
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "reviewedAt") val reviewedAt: String? = null,
    @Json(name = "assignedAt") val assignedAt: String? = null,
    @Json(name = "startedAt") val startedAt: String? = null,
    @Json(name = "deliveredAt") val deliveredAt: String? = null,
    @Json(name = "cancelledAt") val cancelledAt: String? = null
)

@JsonClass(generateAdapter = true)
data class OrderRunnerDetailDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "avgRating") val avgRating: Double? = null,
    @Json(name = "totalRatings") val totalRatings: Int? = null,
    @Json(name = "status") val status: String = "AVAILABLE",
    @Json(name = "whatsapp") val whatsapp: String,
    @Json(name = "phone") val phone: String? = null
)

@JsonClass(generateAdapter = true)
data class CancelOrderResponseDto(
    @Json(name = "success") val success: Boolean = true,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateRatingRequestDto(
    @Json(name = "stars") val stars: Int,
    @Json(name = "note") val note: String? = null
)

@JsonClass(generateAdapter = true)
data class RatingResponseDto(
    @Json(name = "id") val id: String,
    @Json(name = "orderId") val orderId: String,
    @Json(name = "customerId") val customerId: String? = null,
    @Json(name = "runnerId") val runnerId: String? = null,
    @Json(name = "stars") val stars: Int,
    @Json(name = "note") val note: String? = null,
    @Json(name = "isFinal") val isFinal: Boolean = false,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    @Json(name = "expiresAt") val expiresAt: String? = null
)
