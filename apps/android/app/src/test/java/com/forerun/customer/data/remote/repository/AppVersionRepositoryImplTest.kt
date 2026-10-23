package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.AppVersionApi
import com.forerun.customer.data.remote.dto.version.AppVersionDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class AppVersionRepositoryImplTest {

    private class FakeAppVersionApi : AppVersionApi {
        var response: ApiResponse<AppVersionDto?> = ApiResponse.Success(null)
        var shouldThrow: Exception? = null

        override suspend fun getAppVersion(platform: String): ApiResponse<AppVersionDto?> {
            shouldThrow?.let { throw it }
            return response
        }
    }

    private lateinit var fakeApi: FakeAppVersionApi
    private lateinit var repository: AppVersionRepositoryImpl

    @Before
    fun setup() {
        fakeApi = FakeAppVersionApi()
        repository = AppVersionRepositoryImpl(fakeApi)
    }

    @Test
    fun getAppVersion_success_returnsDomainModel() = runTest {
        val dto = AppVersionDto(
            platform = "android",
            latestVersionCode = 10,
            latestVersionName = "1.0.0",
            minSupportedVersionCode = 8,
            downloadUrl = "https://faow.run/download/app-release.apk",
            releaseNotes = "Fixes & improvements"
        )
        fakeApi.response = ApiResponse.Success(dto)

        val result = repository.getAppVersion("android")

        assertTrue(result.isSuccess)
        val domain = result.getOrThrow()
        assertEquals("android", domain?.platform)
        assertEquals(10, domain?.latestVersionCode)
        assertEquals("1.0.0", domain?.latestVersionName)
        assertEquals(8, domain?.minSupportedVersionCode)
        assertEquals("https://faow.run/download/app-release.apk", domain?.downloadUrl)
        assertEquals("Fixes & improvements", domain?.releaseNotes)
    }

    @Test
    fun getAppVersion_204NoContent_returnsSuccessNull() = runTest {
        fakeApi.response = ApiResponse.Success(null)

        val result = repository.getAppVersion("android")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun getAppVersion_apiError_returnsFailure() = runTest {
        fakeApi.response = ApiResponse.Error(
            statusCode = 500,
            error = "INTERNAL_SERVER_ERROR",
            message = "Server failure"
        )

        val result = repository.getAppVersion("android")

        assertTrue(result.isFailure)
        assertEquals("Server failure", result.exceptionOrNull()?.message)
    }

    @Test
    fun getAppVersion_networkException_returnsFailure() = runTest {
        fakeApi.shouldThrow = IOException("Timeout")

        val result = repository.getAppVersion("android")

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IOException)
    }
}
