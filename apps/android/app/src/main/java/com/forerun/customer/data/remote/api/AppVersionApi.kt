package com.forerun.customer.data.remote.api

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.dto.version.AppVersionDto
import retrofit2.http.GET
import retrofit2.http.Query

interface AppVersionApi {
    @GET("app/version")
    suspend fun getAppVersion(
        @Query("platform") platform: String = "android"
    ): ApiResponse<AppVersionDto?>
}
