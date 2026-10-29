package com.forerun.customer.data.remote.dto.order

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CreateOrderItemDto(
    @Json(name = "itemName") val itemName: String,
    @Json(name = "quantity") val quantity: String,
    @Json(name = "customStoreName") val customStoreName: String? = null,
    @Json(name = "anyStore") val anyStore: Boolean
)

@JsonClass(generateAdapter = true)
data class DeliveryAddressDto(
    @Json(name = "lat") val lat: Double,
    @Json(name = "lng") val lng: Double,
    @Json(name = "description") val description: String
)

@JsonClass(generateAdapter = true)
data class CreateOrderRequestDto(
    @Json(name = "items") val items: List<CreateOrderItemDto>,
    @Json(name = "notes") val notes: String? = null,
    @Json(name = "preferredRunnerId") val preferredRunnerId: String? = null,
    @Json(name = "waitForPreferred") val waitForPreferred: Boolean = false,
    @Json(name = "deliveryAddress") val deliveryAddress: DeliveryAddressDto,
    @Json(name = "idempotencyKey") val idempotencyKey: String? = null
)

@JsonClass(generateAdapter = true)
data class EstimatedFeeDto(
    @Json(name = "baseFee") val baseFee: Int,
    @Json(name = "peripheralFee") val peripheralFee: Int,
    @Json(name = "extraStoresFee") val extraStoresFee: Int,
    @Json(name = "totalFee") val totalFee: Int,
    @Json(name = "note") val note: String,
    @Json(name = "isFreeOrder") val isFreeOrder: Boolean = false,
    @Json(name = "freeOrdersRemaining") val freeOrdersRemaining: Int = 0
)

@JsonClass(generateAdapter = true)
data class CreateOrderResponseDto(
    @Json(name = "id") val id: String,
    @Json(name = "orderNumber") val orderNumber: String,
    @Json(name = "status") val status: String,
    @Json(name = "estimatedFee") val estimatedFee: EstimatedFeeDto,
    @Json(name = "wasFreeOrderSlot") val wasFreeOrderSlot: Boolean = false
)

@JsonClass(generateAdapter = true)
data class AvailableRunnerDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "avgRating") val avgRating: Double? = null,
    @Json(name = "totalRatings") val totalRatings: Int? = null,
    @Json(name = "status") val status: String
)
