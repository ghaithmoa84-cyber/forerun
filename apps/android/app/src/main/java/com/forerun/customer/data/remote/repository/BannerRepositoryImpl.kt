package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.BannerApi
import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.forerun.customer.domain.repository.BannerRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BannerRepositoryImpl @Inject constructor(
    private val bannerApi: BannerApi
) : BannerRepository {

    override suspend fun getActiveBanners(): Result<List<BannerDto>> {
        return try {
            when (val response = bannerApi.getActiveBanners()) {
                is ApiResponse.Success -> Result.success(response.data)
                is ApiResponse.Error -> Result.failure(Exception(response.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
