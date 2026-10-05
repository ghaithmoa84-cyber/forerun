package com.forerun.customer.data.remote.mapper

import com.forerun.customer.data.remote.dto.order.DetailOrderItemDto
import com.forerun.customer.data.remote.dto.order.OrderDetailResponseDto
import com.forerun.customer.data.remote.dto.order.OrderRatingDto
import com.forerun.customer.data.remote.dto.order.OrderRunnerDetailDto
import com.forerun.customer.data.remote.dto.order.OrderStoreDetailDto
import com.forerun.customer.data.remote.dto.order.OrderTimelineDto
import com.forerun.customer.data.remote.dto.order.StoreItemDetailDto
import com.forerun.customer.data.remote.dto.order.StoreReceiptDetailDto
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.domain.model.DetailOrderItem
import com.forerun.customer.domain.model.OrderRatingInfo
import com.forerun.customer.domain.model.OrderRunnerDetail
import com.forerun.customer.domain.model.OrderStoreDetail
import com.forerun.customer.domain.model.OrderTimeline
import com.forerun.customer.domain.model.StoreItemDetail
import com.forerun.customer.domain.model.StoreReceiptDetail

/**
 * Maps Order detail DTOs to domain models.
 * Extracted from OrderRepositoryImpl as part of Sprint 8D (Item 9 / A21).
 *
 * Potential logic improvements recorded for future sprints (do not modify behavior now):
 * - Parse ISO-8601 date strings (createdAt, deliveredAt, timeline dates) into Instant/OffsetDateTime
 *   similar to AccountMapper to enforce type safety.
 * - Map String status fields (order status, store status, runner status) to domain enums.
 * - Standardize backend DTO representation between legacy 'orderStores' and modern 'stores'.
 * - Clean/trim string values (notes, cancelReason, phone).
 */
object OrderDetailMapper {

    fun OrderDetailResponseDto.toDomain(): CustomerOrderDetail {
        val rawStores = if (stores.isNotEmpty()) stores else orderStores ?: emptyList()
        val mappedStores = rawStores.map { s -> s.toDomain() }

        return CustomerOrderDetail(
            id = id,
            orderNumber = orderNumber,
            status = status,
            isPeripheral = isPeripheral,
            baseFee = baseFee,
            peripheralFee = peripheralFee,
            extraStoresFee = extraStoresFee,
            customFee = customFee,
            customFeeReason = customFeeReason,
            totalFee = totalFee,
            deliveryLat = deliveryLat,
            deliveryLng = deliveryLng,
            deliveryDesc = deliveryDesc,
            notes = notes,
            preferredRunnerId = preferredRunnerId,
            waitForPreferred = waitForPreferred,
            createdAt = createdAt,
            updatedAt = updatedAt,
            deliveredAt = deliveredAt,
            cancelledAt = cancelledAt,
            cancelReason = cancelReason,
            items = items.map { item -> item.toDomain() },
            stores = mappedStores,
            rating = rating?.toDomain(),
            timeline = OrderTimeline(
                createdAt = timeline?.createdAt ?: createdAt,
                reviewedAt = timeline?.reviewedAt,
                assignedAt = timeline?.assignedAt,
                startedAt = timeline?.startedAt,
                deliveredAt = timeline?.deliveredAt ?: deliveredAt,
                cancelledAt = timeline?.cancelledAt ?: cancelledAt
            ),
            runner = runner?.toDomain()
        )
    }

    private fun DetailOrderItemDto.toDomain(): DetailOrderItem = DetailOrderItem(
        id = id,
        itemName = itemName,
        quantity = quantity,
        customStoreName = customStoreName,
        anyStore = anyStore
    )

    private fun OrderStoreDetailDto.toDomain(): OrderStoreDetail = OrderStoreDetail(
        id = id,
        storeName = storeName,
        status = status,
        isExtra = isExtra,
        items = items.map { item -> item.toDomain() },
        receipts = receipts.map { receipt -> receipt.toDomain() }
    )

    private fun StoreItemDetailDto.toDomain(): StoreItemDetail = StoreItemDetail(
        id = id,
        itemName = itemName,
        quantity = quantity
    )

    private fun StoreReceiptDetailDto.toDomain(): StoreReceiptDetail = StoreReceiptDetail(
        id = id,
        imageUrl = imageUrl
    )

    private fun OrderRatingDto.toDomain(): OrderRatingInfo = OrderRatingInfo(
        stars = stars,
        note = note
    )

    private fun OrderRunnerDetailDto.toDomain(): OrderRunnerDetail = OrderRunnerDetail(
        id = id,
        name = name,
        avgRating = avgRating,
        totalRatings = totalRatings,
        status = status,
        whatsapp = whatsapp,
        phone = phone
    )
}
