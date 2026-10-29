package com.forerun.customer.domain.model

data class PricingDisclosure(
    val baseFee: Int,
    val extraStoreFee: Int,
    val peripheralFee: Int,
    val freeOrdersPromoEnabled: Boolean = false
)
