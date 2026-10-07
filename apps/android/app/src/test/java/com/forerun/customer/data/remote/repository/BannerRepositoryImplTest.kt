package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.BannerApi
import com.forerun.customer.data.remote.dto.banner.BannerDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class BannerRepositoryImplTest {

    private class FakeBannerApi : BannerApi {
        var response: ApiResponse<List<BannerDto>> = ApiResponse.Success(emptyList())
        var shouldThrow: Exception? = null

        override suspend fun getActiveBanners(): ApiResponse<List<BannerDto>> {
            shouldThrow?.let { throw it }
            return response
        }
    }

    private lateinit var fakeBannerApi: FakeBannerApi
    private lateinit var repository: BannerRepositoryImpl

    @Before
    fun setup() {
        fakeBannerApi = FakeBannerApi()
        repository = BannerRepositoryImpl(fakeBannerApi)
    }

    @Test
    fun getActiveBanners_success_returnsBannersList() = runTest {
        val sampleBanners = listOf(
            BannerDto(
                id = "b1",
                headline = "Title 1",
                subtitle = "Sub 1",
                imageUrl = "https://example.com/1.png",
                actionType = "IN_APP_ROUTE",
                actionValue = "/create-order",
                ctaLabel = "Order",
                sortOrder = 0
            ),
            BannerDto(
                id = "b2",
                headline = null,
                subtitle = null,
                imageUrl = "https://example.com/2.png",
                actionType = "NONE",
                actionValue = null,
                ctaLabel = null,
                sortOrder = 1
            )
        )
        fakeBannerApi.response = ApiResponse.Success(sampleBanners)

        val result = repository.getActiveBanners()

        assertTrue(result.isSuccess)
        val banners = result.getOrThrow()
        assertEquals(2, banners.size)
        assertEquals("b1", banners[0].id)
        assertEquals("b2", banners[1].id)
    }

    @Test
    fun getActiveBanners_emptyList_returnsSuccessEmpty() = runTest {
        fakeBannerApi.response = ApiResponse.Success(emptyList())

        val result = repository.getActiveBanners()

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().isEmpty())
    }

    @Test
    fun getActiveBanners_apiError_returnsFailure() = runTest {
        fakeBannerApi.response = ApiResponse.Error(
            statusCode = 500,
            error = "INTERNAL_SERVER_ERROR",
            message = "Server encountered an error"
        )

        val result = repository.getActiveBanners()

        assertTrue(result.isFailure)
        assertEquals("Server encountered an error", result.exceptionOrNull()?.message)
    }

    @Test
    fun getActiveBanners_networkException_returnsFailureSafely() = runTest {
        fakeBannerApi.shouldThrow = IOException("Connection reset by peer")

        val result = repository.getActiveBanners()

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IOException)
        assertEquals("Connection reset by peer", result.exceptionOrNull()?.message)
    }
}
