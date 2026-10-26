package com.forerun.customer.domain.repository

import com.forerun.customer.domain.model.CreatedOrder
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import com.forerun.customer.domain.model.PricingDisclosure
import com.forerun.customer.domain.model.RunnerInfo

interface OrderRepository {
    suspend fun getPricingDisclosure(): Result<PricingDisclosure>

    suspend fun createOrder(
        items: List<OrderItem>,
        notes: String?,
        preferredRunnerId: String?,
        waitForPreferred: Boolean,
        deliveryAddress: CustomerAddress,
        idempotencyKey: String? = null
    ): Result<CreatedOrder>

    suspend fun getAvailableRunners(): Result<List<RunnerInfo>>

    suspend fun getCustomerOrders(
        page: Int = 1,
        limit: Int = 20,
        status: String? = null
    ): Result<com.forerun.customer.domain.model.OrdersPage>

    suspend fun getOrderDetail(
        orderId: String
    ): Result<com.forerun.customer.domain.model.CustomerOrderDetail>

    suspend fun cancelOrder(
        orderId: String
    ): Result<Unit>

    suspend fun submitRating(
        orderId: String,
        stars: Int,
        note: String?,
        isUpdate: Boolean = false
    ): Result<com.forerun.customer.domain.model.RatingResult>
}
