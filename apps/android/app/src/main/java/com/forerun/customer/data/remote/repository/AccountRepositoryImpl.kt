package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest
import com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest
import com.forerun.customer.data.remote.mapper.AccountMapper.toDomain
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.repository.AccountRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AccountRepositoryImpl @Inject constructor(
    private val customerApi: CustomerApi
) : AccountRepository {

    override suspend fun getProfile(): Result<CustomerProfile> {
        return when (val response = customerApi.me()) {
            is ApiResponse.Success -> Result.success(response.data.toDomain())
            is ApiResponse.Error -> Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "AccountRepo")))
        }
    }

    override suspend fun updateProfile(name: String, altPhone: String?): Result<CustomerProfile> {
        val request = UpdateProfileRequest(name = name, altPhone = altPhone)
        return when (val response = customerApi.updateProfile(request)) {
            is ApiResponse.Success -> Result.success(response.data.toDomain())
            is ApiResponse.Error -> Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "AccountRepo")))
        }
    }

    override suspend fun changePassword(password: String): Result<Unit> {
        val request = ChangePasswordRequest(password = password)
        return when (val response = customerApi.changePassword(request)) {
            is ApiResponse.Success -> Result.success(Unit)
            is ApiResponse.Error -> Result.failure(Exception(ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "AccountRepo")))
        }
    }
}
