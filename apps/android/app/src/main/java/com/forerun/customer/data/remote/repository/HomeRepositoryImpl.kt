package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.api.OrderApi
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.model.HomeData
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.repository.HomeRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeRepositoryImpl @Inject constructor(
    private val customerApi: CustomerApi,
    private val orderApi: OrderApi
) : HomeRepository {

    override suspend fun getHomeData(): Result<HomeData> {
        val profileResponse = customerApi.me()

        val profile = when (profileResponse) {
            is ApiResponse.Success -> {
                val dto = profileResponse.data
                CustomerProfile(
                    id = dto.id,
                    name = dto.name,
                    whatsapp = dto.whatsapp,
                    altPhone = dto.altPhone,
                    status = UserStatus.fromString(dto.status),
                    completedOrders = dto.completedOrders,
                    totalFeesPaid = dto.totalFeesPaid
                )
            }
            is ApiResponse.Error -> {
                return Result.failure(
                    Exception(
                        ErrorSanitizer.getGenericErrorMessage(rawMessage = profileResponse.message, tag = "HomeRepo")
                    )
                )
            }
        }

        var activeOrder: ActiveOrder? = null
        try {
            val ordersResponse = orderApi.getCustomerOrders(page = 1, limit = 10)
            if (ordersResponse is ApiResponse.Success) {
                val terminalStatuses = setOf("DELIVERED", "CANCELLED")
                val activeDto = ordersResponse.data.data.firstOrNull { it.status !in terminalStatuses }
                if (activeDto != null) {
                    activeOrder = ActiveOrder(
                        id = activeDto.id,
                        orderNumber = activeDto.orderNumber,
                        status = activeDto.status,
                        totalFee = activeDto.totalFee,
                        itemCount = activeDto.itemCount,
                        createdAt = activeDto.createdAt,
                        runnerName = activeDto.runner?.name,
                        runnerWhatsapp = activeDto.runner?.whatsapp,
                        runnerPhone = activeDto.runner?.phone
                    )
                }
            }
        } catch (_: Exception) {
            // Orders fetch non-fatal for home screen initial load
        }

        return Result.success(HomeData(profile = profile, activeOrder = activeOrder))
    }
}
