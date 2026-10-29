package com.forerun.customer.data.remote.dto.customer

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CustomerProfileDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "whatsapp") val whatsapp: String,
    @Json(name = "altPhone") val altPhone: String? = null,
    @Json(name = "status") val status: String,
    @Json(name = "completedOrders") val completedOrders: Int,
    @Json(name = "totalFeesPaid") val totalFeesPaid: Int,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "freeOrdersRemaining") val freeOrdersRemaining: Int = 0
)
