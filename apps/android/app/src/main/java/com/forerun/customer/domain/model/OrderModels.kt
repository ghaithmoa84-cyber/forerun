package com.forerun.customer.domain.model

import java.util.UUID

data class OrderItem(
    val id: String = UUID.randomUUID().toString(),
    val itemName: String,
    val quantity: String,
    val anyStore: Boolean = true,
    val customStoreName: String? = null
)

data class CreatedOrder(
    val id: String,
    val orderNumber: String,
    val status: String,
    val totalFee: Int,
    val feeNote: String
)

data class RunnerInfo(
    val id: String,
    val name: String,
    val avgRating: Double? = null,
    val totalRatings: Int? = null,
    val status: String
)

data class CustomerOrder(
    val id: String,
    val orderNumber: String,
    val status: String,
    val totalFee: Int,
    val itemCount: Int,
    val createdAt: String,
    val deliveredAt: String? = null,
    val runnerName: String? = null
)

data class OrdersPage(
    val orders: List<CustomerOrder>,
    val total: Int,
    val page: Int,
    val limit: Int,
    val totalPages: Int
)

data class CustomerOrderDetail(
    val id: String,
    val orderNumber: String,
    val status: String,
    val isPeripheral: Boolean = false,
    val baseFee: Int = 0,
    val peripheralFee: Int = 0,
    val extraStoresFee: Int = 0,
    val customFee: Int = 0,
    val customFeeReason: String? = null,
    val totalFee: Int = 0,
    val deliveryLat: Double? = null,
    val deliveryLng: Double? = null,
    val deliveryDesc: String? = null,
    val notes: String? = null,
    val preferredRunnerId: String? = null,
    val waitForPreferred: Boolean = false,
    val createdAt: String,
    val updatedAt: String? = null,
    val deliveredAt: String? = null,
    val cancelledAt: String? = null,
    val cancelReason: String? = null,
    val items: List<DetailOrderItem> = emptyList(),
    val stores: List<OrderStoreDetail> = emptyList(),
    val rating: OrderRatingInfo? = null,
    val timeline: OrderTimeline = OrderTimeline(createdAt = createdAt),
    val runner: OrderRunnerDetail? = null
)

data class DetailOrderItem(
    val id: String,
    val itemName: String,
    val quantity: String,
    val customStoreName: String? = null,
    val anyStore: Boolean = true
)

data class OrderStoreDetail(
    val id: String,
    val storeName: String,
    val status: String = "PENDING",
    val isExtra: Boolean = false,
    val items: List<StoreItemDetail> = emptyList(),
    val receipts: List<StoreReceiptDetail> = emptyList()
)

data class StoreItemDetail(
    val id: String,
    val itemName: String,
    val quantity: String
)

data class StoreReceiptDetail(
    val id: String,
    val imageUrl: String
)

data class OrderRatingInfo(
    val stars: Int,
    val note: String? = null
)

data class OrderTimeline(
    val createdAt: String,
    val reviewedAt: String? = null,
    val assignedAt: String? = null,
    val startedAt: String? = null,
    val deliveredAt: String? = null,
    val cancelledAt: String? = null
)

data class OrderRunnerDetail(
    val id: String,
    val name: String,
    val avgRating: Double? = null,
    val totalRatings: Int? = null,
    val status: String = "AVAILABLE",
    val whatsapp: String,
    val phone: String? = null
)

data class RatingResult(
    val id: String,
    val orderId: String,
    val stars: Int,
    val note: String? = null,
    val isFinal: Boolean = false,
    val expiresAt: String? = null
)
