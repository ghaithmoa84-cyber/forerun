package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.OrderApi
import com.forerun.customer.data.remote.dto.order.CreateOrderItemDto
import com.forerun.customer.data.remote.dto.order.CreateOrderRequestDto
import com.forerun.customer.data.remote.dto.order.DeliveryAddressDto
import com.forerun.customer.domain.model.ApiException
import com.forerun.customer.domain.model.CreatedOrder
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import com.forerun.customer.domain.model.PricingDisclosure
import com.forerun.customer.domain.model.RunnerInfo
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.data.remote.mapper.OrderDetailMapper.toDomain
import com.forerun.customer.domain.repository.OrderRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepositoryImpl @Inject constructor(
    private val orderApi: OrderApi
) : OrderRepository {

    override suspend fun getPricingDisclosure(): Result<PricingDisclosure> {
        return when (val response = orderApi.getPricingDisclosure()) {
            is ApiResponse.Success -> {
                val dto = response.data
                Result.success(
                    PricingDisclosure(
                        baseFee = dto.baseFee,
                        extraStoreFee = dto.extraStoreFee,
                        peripheralFee = dto.peripheralFee
                    )
                )
            }
            is ApiResponse.Error -> Result.failure(
                ApiException(statusCode = response.statusCode, errorCode = response.error)
            )
        }
    }

    override suspend fun createOrder(

        items: List<OrderItem>,
        notes: String?,
        preferredRunnerId: String?,
        waitForPreferred: Boolean,
        deliveryAddress: CustomerAddress
    ): Result<CreatedOrder> {
        val requestDto = CreateOrderRequestDto(
            items = items.map { item ->
                CreateOrderItemDto(
                    itemName = item.itemName.trim(),
                    quantity = item.quantity.trim(),
                    customStoreName = if (item.anyStore) null else item.customStoreName?.trim()?.ifEmpty { null },
                    anyStore = item.anyStore
                )
            },
            notes = notes?.trim()?.ifEmpty { null },
            preferredRunnerId = preferredRunnerId?.trim()?.ifEmpty { null },
            waitForPreferred = waitForPreferred,
            deliveryAddress = DeliveryAddressDto(
                lat = deliveryAddress.lat,
                lng = deliveryAddress.lng,
                description = deliveryAddress.description.trim()
            )
        )

        return when (val response = orderApi.createOrder(requestDto)) {
            is ApiResponse.Success -> {
                val data = response.data
                Result.success(
                    CreatedOrder(
                        id = data.id,
                        orderNumber = data.orderNumber,
                        status = data.status,
                        totalFee = data.estimatedFee.totalFee,
                        feeNote = data.estimatedFee.note
                    )
                )
            }
            is ApiResponse.Error -> {
                Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "OrderRepo")))
            }
        }
    }

    override suspend fun getAvailableRunners(): Result<List<RunnerInfo>> {
        return when (val response = orderApi.getAvailableRunners()) {
            is ApiResponse.Success -> {
                val runners = response.data.map { dto ->
                    RunnerInfo(
                        id = dto.id,
                        name = dto.name,
                        avgRating = dto.avgRating,
                        totalRatings = dto.totalRatings,
                        status = dto.status
                    )
                }
                Result.success(runners)
            }
            is ApiResponse.Error -> {
                Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "OrderRepo")))
            }
        }
    }

    override suspend fun getCustomerOrders(
        page: Int,
        limit: Int,
        status: String?
    ): Result<com.forerun.customer.domain.model.OrdersPage> {
        return when (val response = orderApi.getCustomerOrders(page = page, limit = limit, status = status)) {
            is ApiResponse.Success -> {
                val data = response.data
                val orders = data.data.map { dto ->
                    com.forerun.customer.domain.model.CustomerOrder(
                        id = dto.id,
                        orderNumber = dto.orderNumber,
                        status = dto.status,
                        totalFee = dto.totalFee,
                        itemCount = dto.itemCount,
                        createdAt = dto.createdAt,
                        deliveredAt = dto.deliveredAt,
                        runnerName = dto.runner?.name
                    )
                }
                val meta = data.meta
                val ordersPage = com.forerun.customer.domain.model.OrdersPage(
                    orders = orders,
                    total = meta?.total ?: orders.size,
                    page = meta?.page ?: page,
                    limit = meta?.limit ?: limit,
                    totalPages = meta?.totalPages ?: 1
                )
                Result.success(ordersPage)
            }
            is ApiResponse.Error -> {
                Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "OrderRepo")))
            }
        }
    }

    override suspend fun getOrderDetail(orderId: String): Result<CustomerOrderDetail> {
        return when (val response = orderApi.getOrderDetail(orderId)) {
            is ApiResponse.Success -> Result.success(response.data.toDomain())
            is ApiResponse.Error -> Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "OrderRepo")))
        }
    }

    override suspend fun cancelOrder(orderId: String): Result<Unit> {
        return when (val response = orderApi.cancelOrder(orderId)) {
            is ApiResponse.Success -> Result.success(Unit)
            is ApiResponse.Error -> Result.failure(
                ApiException(statusCode = response.statusCode, errorCode = response.error)
            )
        }
    }

    override suspend fun submitRating(
        orderId: String,
        stars: Int,
        note: String?,
        isUpdate: Boolean
    ): Result<com.forerun.customer.domain.model.RatingResult> {
        val request = com.forerun.customer.data.remote.dto.order.CreateRatingRequestDto(
            stars = stars,
            note = note?.trim()?.ifEmpty { null }
        )
        val response = if (isUpdate) {
            orderApi.updateRating(orderId, request)
        } else {
            orderApi.createRating(orderId, request)
        }

        return when (response) {
            is ApiResponse.Success -> {
                val data = response.data
                Result.success(
                    com.forerun.customer.domain.model.RatingResult(
                        id = data.id,
                        orderId = data.orderId,
                        stars = data.stars,
                        note = data.note,
                        isFinal = data.isFinal,
                        expiresAt = data.expiresAt
                    )
                )
            }
            is ApiResponse.Error -> {
                Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "OrderRepo")))
            }
        }
    }
}
