package com.forerun.customer.data.remote.dto.order

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class OrderRunnerDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "whatsapp") val whatsapp: String? = null,
    @Json(name = "phone") val phone: String? = null
)

@JsonClass(generateAdapter = true)
data class CustomerOrderListItemDto(
    @Json(name = "id") val id: String,
    @Json(name = "orderNumber") val orderNumber: String,
    @Json(name = "status") val status: String,
    @Json(name = "totalFee") val totalFee: Int,
    @Json(name = "itemCount") val itemCount: Int,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "deliveredAt") val deliveredAt: String? = null,
    @Json(name = "hasRating") val hasRating: Boolean = false,
    @Json(name = "canRate") val canRate: Boolean = false,
    @Json(name = "runner") val runner: OrderRunnerDto? = null
)

@JsonClass(generateAdapter = true)
data class PaginatedOrdersDto(
    @Json(name = "data") val data: List<CustomerOrderListItemDto>,
    @Json(name = "meta") val meta: OrderPaginationMetaDto? = null
)

@JsonClass(generateAdapter = true)
data class OrderPaginationMetaDto(
    @Json(name = "total") val total: Int,
    @Json(name = "page") val page: Int,
    @Json(name = "limit") val limit: Int,
    @Json(name = "totalPages") val totalPages: Int
)
