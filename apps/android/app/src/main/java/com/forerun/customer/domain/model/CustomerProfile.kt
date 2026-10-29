package com.forerun.customer.domain.model

import java.time.Instant

data class CustomerProfile(
    val id: String,
    val name: String,
    val whatsapp: String,
    val altPhone: String? = null,
    val status: UserStatus,
    val completedOrders: Int,
    val totalFeesPaid: Int,
    val createdAt: Instant? = null,
    val freeOrdersRemaining: Int = 0
)
