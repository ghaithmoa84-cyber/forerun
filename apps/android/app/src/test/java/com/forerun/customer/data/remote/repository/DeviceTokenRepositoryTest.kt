package com.forerun.customer.data.remote.repository

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.core.storage.TokenStorage
import com.forerun.customer.data.remote.api.DeviceTokenApi
import com.forerun.customer.data.remote.dto.devicetoken.DeviceTokenRequest
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DeviceTokenRepositoryTest {

    private class FakeDeviceTokenApi : DeviceTokenApi {
        var registerResponse: ApiResponse<Unit> = ApiResponse.Success(Unit)
        var unregisterResponse: ApiResponse<Unit> = ApiResponse.Success(Unit)

        var lastRegisteredRequest: DeviceTokenRequest? = null
        var lastUnregisteredRequest: DeviceTokenRequest? = null

        override suspend fun registerDeviceToken(body: DeviceTokenRequest): ApiResponse<Unit> {
            lastRegisteredRequest = body
            return registerResponse
        }

        override suspend fun unregisterDeviceToken(body: DeviceTokenRequest): ApiResponse<Unit> {
            lastUnregisteredRequest = body
            return unregisterResponse
        }
    }

    private class InMemoryTokenStorage : TokenStorage {
        private var backingDeviceToken: String? = null
        private var backingAccessToken: String? = "mock_access_token"

        override fun getDeviceToken(): String? = backingDeviceToken
        override fun setDeviceToken(token: String?) { backingDeviceToken = token }

        override fun getAccessToken(): String? = backingAccessToken
        override fun setAccessToken(token: String?) { backingAccessToken = token }
        override fun getRefreshToken(): String? = null
        override fun setRefreshToken(token: String?) {}
        override fun getTokenExpiry(): Long = 0L
        override fun setTokenExpiry(expiry: Long) {}
        override fun getUserId(): String? = "user_1"
        override fun setUserId(id: String?) {}
        override fun getUserName(): String? = "User"
        override fun setUserName(name: String?) {}
        override fun getUserRole(): String? = "CUSTOMER"
        override fun setUserRole(role: String?) {}
        override fun getUserStatus(): String? = "VERIFIED"
        override fun setUserStatus(status: String?) {}
        override fun saveAuthTokens(accessToken: String, refreshToken: String, expiryTimestamp: Long) {}
        override fun clearAll() { backingDeviceToken = null }
        override fun clearAccessTokenOnly() {}
        override fun hasValidAccessToken(): Boolean = !backingAccessToken.isNullOrBlank()
    }

    private lateinit var fakeApi: FakeDeviceTokenApi
    private lateinit var fakeStorage: InMemoryTokenStorage
    private lateinit var repository: DeviceTokenRepositoryImpl

    @Before
    fun setUp() {
        fakeApi = FakeDeviceTokenApi()
        fakeStorage = InMemoryTokenStorage()
        repository = DeviceTokenRepositoryImpl(fakeApi, fakeStorage)
    }

    @Test
    fun registerDeviceToken_success_callsApiAndSavesTokenInStorage() = runTest {
        val token = "fcm_test_token_123"
        val response = repository.registerDeviceToken(token)

        assertTrue(response is ApiResponse.Success)
        assertEquals(token, fakeApi.lastRegisteredRequest?.token)
        assertEquals("android", fakeApi.lastRegisteredRequest?.platform)
        assertEquals(token, fakeStorage.getDeviceToken())
    }

    @Test
    fun registerDeviceToken_error_doesNotSaveTokenInStorage() = runTest {
        fakeApi.registerResponse = ApiResponse.Error(500, "INTERNAL_ERROR", "Server error")
        val token = "fcm_token_fail"
        val response = repository.registerDeviceToken(token)

        assertTrue(response is ApiResponse.Error)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_generic), (response as ApiResponse.Error).message)
        assertNull(fakeStorage.getDeviceToken())
    }

    @Test
    fun unregisterDeviceToken_success_clearsMatchingTokenInStorage() = runTest {
        val token = "fcm_token_to_remove"
        fakeStorage.setDeviceToken(token)

        val response = repository.unregisterDeviceToken(token)

        assertTrue(response is ApiResponse.Success)
        assertEquals(token, fakeApi.lastUnregisteredRequest?.token)
        assertNull(fakeStorage.getDeviceToken())
    }

    @Test
    fun unregisterDeviceToken_error_preservesTokenInStorage() = runTest {
        fakeApi.unregisterResponse = ApiResponse.Error(500, "INTERNAL_ERROR", "Server error")
        val token = "fcm_token_retained"
        fakeStorage.setDeviceToken(token)

        val response = repository.unregisterDeviceToken(token)

        assertTrue(response is ApiResponse.Error)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_generic), (response as ApiResponse.Error).message)
        assertEquals(token, fakeStorage.getDeviceToken())
    }

    @Test
    fun registerCurrentToken_whenTokenExists_registersIt() = runTest {
        val token = "stored_fcm_token"
        fakeStorage.setDeviceToken(token)

        val response = repository.registerCurrentToken()

        assertTrue(response is ApiResponse.Success)
        assertEquals(token, fakeApi.lastRegisteredRequest?.token)
    }

    @Test
    fun registerCurrentToken_whenNoToken_returnsSuccessWithoutApiCall() = runTest {
        fakeStorage.setDeviceToken(null)

        val response = repository.registerCurrentToken()

        assertTrue(response is ApiResponse.Success)
        assertNull(fakeApi.lastRegisteredRequest)
    }

    @Test
    fun unregisterCurrentToken_whenTokenExists_unregistersIt() = runTest {
        val token = "active_token"
        fakeStorage.setDeviceToken(token)

        val response = repository.unregisterCurrentToken()

        assertTrue(response is ApiResponse.Success)
        assertEquals(token, fakeApi.lastUnregisteredRequest?.token)
        assertNull(fakeStorage.getDeviceToken())
    }

    @Test
    fun unregisterCurrentToken_whenNoToken_returnsSuccessWithoutApiCall() = runTest {
        fakeStorage.setDeviceToken(null)

        val response = repository.unregisterCurrentToken()

        assertTrue(response is ApiResponse.Success)
        assertNull(fakeApi.lastUnregisteredRequest)
    }
}
