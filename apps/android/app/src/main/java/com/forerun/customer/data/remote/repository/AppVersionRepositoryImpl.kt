package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.AppVersionApi
import com.forerun.customer.data.remote.mapper.toDomain
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.domain.repository.AppVersionRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppVersionRepositoryImpl @Inject constructor(
    private val appVersionApi: AppVersionApi
) : AppVersionRepository {

    override suspend fun getAppVersion(platform: String): Result<AppVersion?> {
        return try {
            when (val response = appVersionApi.getAppVersion(platform)) {
                is ApiResponse.Success -> Result.success(response.data?.toDomain())
                is ApiResponse.Error -> Result.failure(Exception(response.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
