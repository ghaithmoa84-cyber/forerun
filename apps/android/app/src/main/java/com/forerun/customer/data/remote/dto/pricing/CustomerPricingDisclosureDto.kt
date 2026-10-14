package com.forerun.customer.data.remote.dto.pricing

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CustomerPricingDisclosureDto(
    @Json(name = "baseFee") val baseFee: Int = 0,
    @Json(name = "extraStoreFee") val extraStoreFee: Int = 0,
    @Json(name = "peripheralFee") val peripheralFee: Int = 0
)
