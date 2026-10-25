package com.forerun.customer.data.remote.repository

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.api.OrderApi
import com.forerun.customer.data.remote.dto.address.CustomerAddressDto
import com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest
import com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest
import com.forerun.customer.data.remote.dto.customer.CustomerProfileDto
import com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest
import com.forerun.customer.data.remote.dto.order.AvailableRunnerDto
import com.forerun.customer.data.remote.dto.order.CancelOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateOrderRequestDto
import com.forerun.customer.data.remote.dto.order.CreateOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateRatingRequestDto
import com.forerun.customer.data.remote.dto.order.OrderDetailResponseDto
import com.forerun.customer.data.remote.dto.order.PaginatedOrdersDto
import com.forerun.customer.data.remote.dto.order.RatingResponseDto
import com.forerun.customer.data.remote.dto.pricing.CustomerPricingDisclosureDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HomeRepositoryImplTest {

    private class FakeCustomerApi : CustomerApi {
        var meResult: ApiResponse<CustomerProfileDto> = ApiResponse.Success(
            CustomerProfileDto(
                id = "cust_123",
                name = "أحمد",
                whatsapp = "0911111111",
                altPhone = null,
                status = "VERIFIED",
                completedOrders = 3,
                totalFeesPaid = 15000,
                createdAt = "2026-09-01T10:00:00Z"
            )
        )

        override suspend fun me(): ApiResponse<CustomerProfileDto> = meResult
        override suspend fun updateProfile(body: UpdateProfileRequest): ApiResponse<CustomerProfileDto> = meResult
        override suspend fun changePassword(body: ChangePasswordRequest): ApiResponse<CustomerProfileDto> = meResult
        override suspend fun getAddress(): ApiResponse<CustomerAddressDto> = throw NotImplementedError()
        override suspend fun updateAddress(body: UpdateCustomerAddressRequest): ApiResponse<CustomerAddressDto> = throw NotImplementedError()
    }

    private class FakeOrderApi : OrderApi {
        var ordersResult: ApiResponse<PaginatedOrdersDto> = ApiResponse.Success(
            PaginatedOrdersDto(
                data = emptyList(),
                meta = null
            )
        )

        override suspend fun getPricingDisclosure(): ApiResponse<CustomerPricingDisclosureDto> = throw NotImplementedError()
        override suspend fun getCustomerOrders(page: Int, limit: Int, status: String?): ApiResponse<PaginatedOrdersDto> = ordersResult
        override suspend fun createOrder(request: CreateOrderRequestDto): ApiResponse<CreateOrderResponseDto> = throw NotImplementedError()
        override suspend fun getOrderDetail(id: String): ApiResponse<OrderDetailResponseDto> = throw NotImplementedError()
        override suspend fun cancelOrder(id: String): ApiResponse<CancelOrderResponseDto> = throw NotImplementedError()
        override suspend fun createRating(id: String, request: CreateRatingRequestDto): ApiResponse<RatingResponseDto> = throw NotImplementedError()
        override suspend fun updateRating(id: String, request: CreateRatingRequestDto): ApiResponse<RatingResponseDto> = throw NotImplementedError()
        override suspend fun getAvailableRunners(): ApiResponse<List<AvailableRunnerDto>> = throw NotImplementedError()
    }

    @Test
    fun getHomeData_profileApiErrorWithTechnicalEnglish_returnsGenericArabicFailure() = runTest {
        val fakeCustomerApi = FakeCustomerApi().apply {
            meResult = ApiResponse.Error(500, "INTERNAL_SERVER_ERROR", "FATAL: Connection pool exhausted at pg_bouncer:6432")
        }
        val fakeOrderApi = FakeOrderApi()
        val repository = HomeRepositoryImpl(fakeCustomerApi, fakeOrderApi)

        val result = repository.getHomeData()

        assertTrue(result.isFailure)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_generic), result.exceptionOrNull()?.message)
    }

    @Test
    fun getHomeData_success_returnsHomeData() = runTest {
        val fakeCustomerApi = FakeCustomerApi()
        val fakeOrderApi = FakeOrderApi()
        val repository = HomeRepositoryImpl(fakeCustomerApi, fakeOrderApi)

        val result = repository.getHomeData()

        assertTrue(result.isSuccess)
        val homeData = result.getOrThrow()
        assertEquals("أحمد", homeData.profile.name)
        assertEquals(3, homeData.profile.completedOrders)
    }
}
