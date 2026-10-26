package com.forerun.customer.data

import com.forerun.customer.domain.model.CreatedOrder
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import com.forerun.customer.domain.model.RunnerInfo
import com.forerun.customer.domain.repository.OrderRepository

class FakeOrderRepository : OrderRepository {
    var createOrderResult: Result<CreatedOrder> = Result.success(
        CreatedOrder(
            id = "order_123",
            orderNumber = "ORD-001",
            status = "PENDING",
            totalFee = 5000,
            feeNote = "رسوم التوصيل الأساسية"
        )
    )

    var availableRunnersResult: Result<List<RunnerInfo>> = Result.success(
        listOf(
            RunnerInfo(id = "runner_1", name = "الكابتن أحمد", avgRating = 4.8, totalRatings = 15, status = "AVAILABLE")
        )
    )

    var lastCreatedItems: List<OrderItem>? = null
    var createOrderCallCount: Int = 0
    var createOrderDelayMs: Long = 0
    var lastIdempotencyKey: String? = null
    val idempotencyKeysSent = mutableListOf<String?>()

    override suspend fun createOrder(
        items: List<OrderItem>,
        notes: String?,
        preferredRunnerId: String?,
        waitForPreferred: Boolean,
        deliveryAddress: CustomerAddress,
        idempotencyKey: String?
    ): Result<CreatedOrder> {
        createOrderCallCount++
        lastIdempotencyKey = idempotencyKey
        idempotencyKeysSent.add(idempotencyKey)
        if (createOrderDelayMs > 0) {
            kotlinx.coroutines.delay(createOrderDelayMs)
        }
        lastCreatedItems = items
        return createOrderResult
    }

    override suspend fun getAvailableRunners(): Result<List<RunnerInfo>> = availableRunnersResult

    var getCustomerOrdersResult: Result<com.forerun.customer.domain.model.OrdersPage> = Result.success(
        com.forerun.customer.domain.model.OrdersPage(
            orders = listOf(
                com.forerun.customer.domain.model.CustomerOrder(
                    id = "order_1",
                    orderNumber = "FW-000015",
                    status = "PENDING_REVIEW",
                    totalFee = 80,
                    itemCount = 3,
                    createdAt = "2026-09-28T12:48:09.688Z",
                    deliveredAt = null,
                    runnerName = null
                )
            ),
            total = 1,
            page = 1,
            limit = 20,
            totalPages = 1
        )
    )

    var getCustomerOrdersCallCount: Int = 0

    override suspend fun getCustomerOrders(
        page: Int,
        limit: Int,
        status: String?
    ): Result<com.forerun.customer.domain.model.OrdersPage> {
        getCustomerOrdersCallCount++
        return getCustomerOrdersResult
    }

    var getOrderDetailResult: Result<com.forerun.customer.domain.model.CustomerOrderDetail> = Result.success(
        com.forerun.customer.domain.model.CustomerOrderDetail(
            id = "order_123",
            orderNumber = "FW-000123",
            status = "PENDING_REVIEW",
            isPeripheral = false,
            baseFee = 5000,
            peripheralFee = 0,
            extraStoresFee = 0,
            totalFee = 5000,
            deliveryDesc = "القنجرة",
            createdAt = "2026-09-28T12:00:00Z",
            items = listOf(
                com.forerun.customer.domain.model.DetailOrderItem(
                    id = "item_1",
                    itemName = "خبز",
                    quantity = "2 ربطات",
                    anyStore = true
                )
            )
        )
    )

    var getOrderDetailCallCount: Int = 0

    override suspend fun getOrderDetail(
        orderId: String
    ): Result<com.forerun.customer.domain.model.CustomerOrderDetail> {
        getOrderDetailCallCount++
        return getOrderDetailResult
    }

    var cancelOrderResult: Result<Unit> = Result.success(Unit)

    override suspend fun cancelOrder(
        orderId: String
    ): Result<Unit> = cancelOrderResult

    var submitRatingResult: Result<com.forerun.customer.domain.model.RatingResult> = Result.success(
        com.forerun.customer.domain.model.RatingResult(
            id = "rating_123",
            orderId = "order_123",
            stars = 5,
            note = "ممتاز وسريع",
            isFinal = false,
            expiresAt = "2026-09-29T12:00:00Z"
        )
    )
    var submitRatingCallCount: Int = 0
    var submitRatingDelayMs: Long = 0
    var lastSubmitRatingStars: Int? = null
    var lastSubmitRatingNote: String? = null
    var lastSubmitRatingIsUpdate: Boolean? = null

    override suspend fun submitRating(
        orderId: String,
        stars: Int,
        note: String?,
        isUpdate: Boolean
    ): Result<com.forerun.customer.domain.model.RatingResult> {
        submitRatingCallCount++
        lastSubmitRatingStars = stars
        lastSubmitRatingNote = note
        lastSubmitRatingIsUpdate = isUpdate
        if (submitRatingDelayMs > 0) {
            kotlinx.coroutines.delay(submitRatingDelayMs)
        }
        return submitRatingResult.map { it.copy(stars = stars, note = note) }
    }

    var getPricingDisclosureResult: Result<com.forerun.customer.domain.model.PricingDisclosure> = Result.success(
        com.forerun.customer.domain.model.PricingDisclosure(
            baseFee = 60,
            extraStoreFee = 20,
            peripheralFee = 40
        )
    )
    var getPricingDisclosureCallCount: Int = 0

    override suspend fun getPricingDisclosure(): Result<com.forerun.customer.domain.model.PricingDisclosure> {
        getPricingDisclosureCallCount++
        return getPricingDisclosureResult
    }
}
