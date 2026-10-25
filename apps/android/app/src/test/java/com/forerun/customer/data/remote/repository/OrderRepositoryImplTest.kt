package com.forerun.customer.data.remote.repository

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.OrderApi
import com.forerun.customer.data.remote.dto.order.AvailableRunnerDto
import com.forerun.customer.data.remote.dto.order.CancelOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateOrderRequestDto
import com.forerun.customer.data.remote.dto.order.CreateOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateRatingRequestDto
import com.forerun.customer.data.remote.dto.order.EstimatedFeeDto
import com.forerun.customer.data.remote.dto.order.OrderDetailResponseDto
import com.forerun.customer.data.remote.dto.order.PaginatedOrdersDto
import com.forerun.customer.data.remote.dto.order.RatingResponseDto
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OrderRepositoryImplTest {

    private class FakeOrderApi : OrderApi {
        var availableRunnersResult: ApiResponse<List<AvailableRunnerDto>> = ApiResponse.Success(emptyList())
        var createOrderResult: ApiResponse<CreateOrderResponseDto> = ApiResponse.Success(
            CreateOrderResponseDto(
                id = "order_123",
                orderNumber = "ORD-001",
                status = "PENDING",
                estimatedFee = EstimatedFeeDto(
                    baseFee = 5000,
                    peripheralFee = 0,
                    extraStoresFee = 0,
                    totalFee = 5000,
                    note = "تقديري"
                )
            )
        )
        var orderDetailResult: ApiResponse<OrderDetailResponseDto> = ApiResponse.Success(
            OrderDetailResponseDto(
                id = "order_123",
                orderNumber = "ORD-001",
                status = "ASSIGNED",
                createdAt = "2026-10-01T10:00:00Z"
            )
        )
        var cancelOrderResult: ApiResponse<CancelOrderResponseDto> = ApiResponse.Success(
            CancelOrderResponseDto(
                id = "order_123",
                orderNumber = "FW-000001",
                status = "CANCELLED",
                cancelledAt = "2026-10-22T12:00:00Z"
            )
        )
        var getPricingDisclosureResult: ApiResponse<com.forerun.customer.data.remote.dto.pricing.CustomerPricingDisclosureDto> =
            ApiResponse.Success(
                com.forerun.customer.data.remote.dto.pricing.CustomerPricingDisclosureDto(
                    baseFee = 60,
                    extraStoreFee = 20,
                    peripheralFee = 40
                )
            )

        override suspend fun getPricingDisclosure(): ApiResponse<com.forerun.customer.data.remote.dto.pricing.CustomerPricingDisclosureDto> =
            getPricingDisclosureResult

        override suspend fun getCustomerOrders(page: Int, limit: Int, status: String?): ApiResponse<PaginatedOrdersDto> =
            throw NotImplementedError()


        override suspend fun createOrder(request: CreateOrderRequestDto): ApiResponse<CreateOrderResponseDto> =
            createOrderResult

        override suspend fun getOrderDetail(id: String): ApiResponse<OrderDetailResponseDto> =
            orderDetailResult

        override suspend fun cancelOrder(id: String): ApiResponse<CancelOrderResponseDto> =
            cancelOrderResult

        override suspend fun createRating(id: String, request: CreateRatingRequestDto): ApiResponse<RatingResponseDto> =
            throw NotImplementedError()

        override suspend fun updateRating(id: String, request: CreateRatingRequestDto): ApiResponse<RatingResponseDto> =
            throw NotImplementedError()

        override suspend fun getAvailableRunners(): ApiResponse<List<AvailableRunnerDto>> =
            availableRunnersResult
    }

    @Test
    fun getAvailableRunners_success_mapsRunners() = runTest {
        val fakeApi = FakeOrderApi().apply {
            availableRunnersResult = ApiResponse.Success(
                listOf(
                    AvailableRunnerDto(
                        id = "run_1",
                        name = "خالد",
                        avgRating = 4.8,
                        totalRatings = 20,
                        status = "AVAILABLE"
                    )
                )
            )
        }
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.getAvailableRunners()

        assertTrue(result.isSuccess)
        val runners = result.getOrThrow()
        assertEquals(1, runners.size)
        assertEquals("run_1", runners[0].id)
        assertEquals("خالد", runners[0].name)
        assertEquals(4.8, runners[0].avgRating!!, 0.01)
        assertEquals(20, runners[0].totalRatings)
        assertEquals("AVAILABLE", runners[0].status)
    }

    @Test
    fun getAvailableRunners_error_returnsFailure() = runTest {
        val fakeApi = FakeOrderApi().apply {
            availableRunnersResult = ApiResponse.Error(statusCode = 500, error = "Internal Server Error", message = "Server error")
        }
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.getAvailableRunners()

        assertTrue(result.isFailure)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_generic), result.exceptionOrNull()?.message)
    }

    @Test
    fun createOrder_apiError_returnsGenericArabicFailure() = runTest {
        val fakeApi = FakeOrderApi().apply {
            createOrderResult = ApiResponse.Error(statusCode = 500, error = "Internal Server Error", message = "SQL connection crashed at db:5432")
        }
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.createOrder(
            items = listOf(OrderItem("حليب", "1", "بقالية", false)),
            notes = "ملاحظة",
            preferredRunnerId = null,
            waitForPreferred = false,
            deliveryAddress = CustomerAddress(33.5, 36.2, "دمشق")
        )

        assertTrue(result.isFailure)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_generic), result.exceptionOrNull()?.message)
    }

    @Test
    fun createOrder_success_returnsCreatedOrder() = runTest {
        val fakeApi = FakeOrderApi()
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.createOrder(
            items = listOf(OrderItem("حليب", "1", "بقالية", false)),
            notes = "ملاحظة",
            preferredRunnerId = null,
            waitForPreferred = false,
            deliveryAddress = CustomerAddress(33.5, 36.2, "دمشق")
        )

        assertTrue(result.isSuccess)
        val order = result.getOrThrow()
        assertEquals("order_123", order.id)
        assertEquals("ORD-001", order.orderNumber)
        assertEquals(5000, order.totalFee)
    }

    @Test
    fun getOrderDetail_success_returnsCustomerOrderDetail() = runTest {
        val fakeApi = FakeOrderApi()
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.getOrderDetail("order_123")

        assertTrue(result.isSuccess)
        val detail = result.getOrThrow()
        assertEquals("order_123", detail.id)
        assertEquals("ORD-001", detail.orderNumber)
        assertEquals("ASSIGNED", detail.status)
    }

    @Test
    fun cancelOrder_success_returnsUnit() = runTest {
        val fakeApi = FakeOrderApi()
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.cancelOrder("order_123")

        assertTrue(result.isSuccess)
    }

    @Test
    fun getPricingDisclosure_success_returnsPricingDisclosure() = runTest {
        val fakeApi = FakeOrderApi()
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.getPricingDisclosure()

        assertTrue(result.isSuccess)
        val disclosure = result.getOrThrow()
        assertEquals(60, disclosure.baseFee)
        assertEquals(20, disclosure.extraStoreFee)
        assertEquals(40, disclosure.peripheralFee)
    }

    @Test
    fun getPricingDisclosure_error_returnsFailure() = runTest {
        val fakeApi = FakeOrderApi()
        fakeApi.getPricingDisclosureResult = ApiResponse.Error(500, "INTERNAL_ERROR", "Server Error")
        val repository = OrderRepositoryImpl(fakeApi)

        val result = repository.getPricingDisclosure()

        assertTrue(result.isFailure)
    }
}

