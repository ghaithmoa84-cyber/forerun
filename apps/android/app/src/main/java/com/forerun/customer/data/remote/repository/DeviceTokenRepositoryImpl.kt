package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.core.storage.TokenStorage
import com.forerun.customer.data.remote.api.DeviceTokenApi
import com.forerun.customer.data.remote.dto.devicetoken.DeviceTokenRequest
import com.forerun.customer.domain.repository.DeviceTokenRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceTokenRepositoryImpl @Inject constructor(
    private val deviceTokenApi: DeviceTokenApi,
    private val tokenStorage: TokenStorage
) : DeviceTokenRepository {

    override suspend fun registerDeviceToken(token: String): ApiResponse<Unit> {
        val response = deviceTokenApi.registerDeviceToken(DeviceTokenRequest(token = token, platform = "android"))
        return when (response) {
            is ApiResponse.Success -> {
                tokenStorage.setDeviceToken(token)
                response
            }
            is ApiResponse.Error -> {
                ApiResponse.Error(
                    statusCode = response.statusCode,
                    error = response.error,
                    message = com.forerun.customer.core.error.ErrorSanitizer.getGenericErrorMessage(
                        rawMessage = response.message,
                        tag = "DeviceTokenRepo"
                    )
                )
            }
        }
    }

    override suspend fun unregisterDeviceToken(token: String): ApiResponse<Unit> {
        val response = deviceTokenApi.unregisterDeviceToken(DeviceTokenRequest(token = token, platform = "android"))
        return when (response) {
            is ApiResponse.Success -> {
                if (tokenStorage.getDeviceToken() == token) {
                    tokenStorage.setDeviceToken(null)
                }
                response
            }
            is ApiResponse.Error -> {
                ApiResponse.Error(
                    statusCode = response.statusCode,
                    error = response.error,
                    message = com.forerun.customer.core.error.ErrorSanitizer.getGenericErrorMessage(
                        rawMessage = response.message,
                        tag = "DeviceTokenRepo"
                    )
                )
            }
        }
    }

    override suspend fun registerCurrentToken(): ApiResponse<Unit> {
        val token = tokenStorage.getDeviceToken() ?: return ApiResponse.Success(Unit)
        return registerDeviceToken(token)
    }

    override suspend fun unregisterCurrentToken(): ApiResponse<Unit> {
        val token = tokenStorage.getDeviceToken() ?: return ApiResponse.Success(Unit)
        return unregisterDeviceToken(token)
    }
}
