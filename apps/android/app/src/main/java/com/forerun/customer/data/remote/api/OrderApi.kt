package com.forerun.customer.data.remote.api

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.dto.order.AvailableRunnerDto
import com.forerun.customer.data.remote.dto.order.CancelOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateOrderRequestDto
import com.forerun.customer.data.remote.dto.order.CreateOrderResponseDto
import com.forerun.customer.data.remote.dto.order.CreateRatingRequestDto
import com.forerun.customer.data.remote.dto.order.OrderDetailResponseDto
import com.forerun.customer.data.remote.dto.order.PaginatedOrdersDto
import com.forerun.customer.data.remote.dto.order.RatingResponseDto
import com.forerun.customer.data.remote.dto.pricing.CustomerPricingDisclosureDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface OrderApi {
    @GET("customer/pricing/disclosure")
    suspend fun getPricingDisclosure(): ApiResponse<CustomerPricingDisclosureDto>

    @GET("customer/orders")
    suspend fun getCustomerOrders(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null
    ): ApiResponse<PaginatedOrdersDto>


    @POST("customer/orders")
    suspend fun createOrder(
        @Body request: CreateOrderRequestDto
    ): ApiResponse<CreateOrderResponseDto>

    @GET("customer/orders/{id}")
    suspend fun getOrderDetail(
        @Path("id") id: String
    ): ApiResponse<OrderDetailResponseDto>

    @DELETE("customer/orders/{id}")
    suspend fun cancelOrder(
        @Path("id") id: String
    ): ApiResponse<CancelOrderResponseDto>

    @POST("customer/orders/{id}/ratings")
    suspend fun createRating(
        @Path("id") id: String,
        @Body request: CreateRatingRequestDto
    ): ApiResponse<RatingResponseDto>

    @PUT("customer/orders/{id}/ratings")
    suspend fun updateRating(
        @Path("id") id: String,
        @Body request: CreateRatingRequestDto
    ): ApiResponse<RatingResponseDto>

    @GET("customer/runners")
    suspend fun getAvailableRunners(): ApiResponse<List<AvailableRunnerDto>>
}
