package com.forerun.customer.data.remote.api

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.dto.banner.BannerDto
import retrofit2.http.GET

interface BannerApi {
    @GET("banners/active")
    suspend fun getActiveBanners(): ApiResponse<List<BannerDto>>
}
