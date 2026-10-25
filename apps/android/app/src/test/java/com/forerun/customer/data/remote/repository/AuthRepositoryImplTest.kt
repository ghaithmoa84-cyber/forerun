package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.core.storage.OnboardingPrefs
import com.forerun.customer.core.storage.TokenStorage
import com.forerun.customer.data.remote.api.AuthApi
import com.forerun.customer.data.remote.dto.auth.LoginRequest
import com.forerun.customer.data.remote.dto.auth.LoginResponse
import com.forerun.customer.data.remote.dto.auth.LogoutRequest
import com.forerun.customer.data.remote.dto.auth.RefreshRequest
import com.forerun.customer.data.remote.dto.auth.RefreshResponse
import com.forerun.customer.data.remote.dto.auth.RegisterRequest
import com.forerun.customer.data.remote.dto.auth.RegisterResponse
import com.forerun.customer.data.remote.dto.auth.UserDto
import com.forerun.customer.core.auth.TokenRefreshManager
import com.forerun.customer.domain.model.SessionState
import com.forerun.customer.domain.model.UserStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Provider

@RunWith(AndroidJUnit4::class)
class AuthRepositoryImplTest {

    private class FakeAuthApi : AuthApi {
        var loginResult: ApiResponse<LoginResponse> = ApiResponse.Success(
            LoginResponse(
                accessToken = "access_token_123",
                refreshToken = "refresh_token_123",
                expiresIn = 900L,
                user = UserDto(id = "user_1", name = "Test User", role = "CUSTOMER", status = "VERIFIED")
            )
        )

        var registerResult: ApiResponse<RegisterResponse> = ApiResponse.Success(
            RegisterResponse(
                statusCode = 201,
                message = "Account created",
                userId = "user_new"
            )
        )

        override suspend fun login(body: LoginRequest): ApiResponse<LoginResponse> = loginResult
        override suspend fun register(body: RegisterRequest): ApiResponse<RegisterResponse> = registerResult
        override suspend fun refresh(body: RefreshRequest): ApiResponse<RefreshResponse> =
            ApiResponse.Success(RefreshResponse("new_access", "new_refresh"))
        override suspend fun logout(body: LogoutRequest): ApiResponse<Unit> = ApiResponse.Success(Unit)
    }

    private class FakeTokenStorage : TokenStorage {
        var backingAccessToken: String? = null
        var backingRefreshToken: String? = null
        var backingExpiry: Long = 0L
        var backingUserId: String? = null
        var backingUserName: String? = null
        var backingUserRole: String? = null
        var backingUserStatus: String? = null

        override fun getAccessToken(): String? = backingAccessToken
        override fun setAccessToken(token: String?) { backingAccessToken = token }
        override fun getRefreshToken(): String? = backingRefreshToken
        override fun setRefreshToken(token: String?) { backingRefreshToken = token }
        override fun getTokenExpiry(): Long = backingExpiry
        override fun setTokenExpiry(expiry: Long) { this.backingExpiry = expiry }
        override fun getUserId(): String? = backingUserId
        override fun setUserId(id: String?) { backingUserId = id }
        override fun getUserName(): String? = backingUserName
        override fun setUserName(name: String?) { backingUserName = name }
        override fun getUserRole(): String? = backingUserRole
        override fun setUserRole(role: String?) { backingUserRole = role }
        override fun getUserStatus(): String? = backingUserStatus
        override fun setUserStatus(status: String?) { backingUserStatus = status }
        override fun saveAuthTokens(accessToken: String, refreshToken: String, expiryTimestamp: Long) {
            this.backingAccessToken = accessToken
            this.backingRefreshToken = refreshToken
            this.backingExpiry = expiryTimestamp
        }
        override fun clearAll() {
            backingAccessToken = null
            backingRefreshToken = null
            backingExpiry = 0L
            backingUserId = null
            backingUserName = null
            backingUserRole = null
            backingUserStatus = null
        }
        override fun clearAccessTokenOnly() {
            backingAccessToken = null
            backingExpiry = 0L
        }
        override fun hasValidAccessToken(): Boolean = !backingAccessToken.isNullOrBlank() && (backingExpiry == 0L || backingExpiry > System.currentTimeMillis())
    }

    private class FakeOnboardingPrefs(private var seen: Boolean) : OnboardingPrefs {
        override val isOnboardingSeen: Flow<Boolean>
            get() = flowOf(seen)
        override suspend fun setSeen(seen: Boolean) {
            this.seen = seen
        }
    }

    private class FakeCustomerApi : com.forerun.customer.data.remote.api.CustomerApi {
        var meResponse: ApiResponse<com.forerun.customer.data.remote.dto.customer.CustomerProfileDto> =
            ApiResponse.Success(
                com.forerun.customer.data.remote.dto.customer.CustomerProfileDto(
                    id = "user_1",
                    name = "Verified User",
                    whatsapp = "0912345678",
                    altPhone = null,
                    status = "VERIFIED",
                    completedOrders = 0,
                    totalFeesPaid = 0,
                    createdAt = "2026-09-01T00:00:00Z"
                )
            )

        override suspend fun me(): ApiResponse<com.forerun.customer.data.remote.dto.customer.CustomerProfileDto> = meResponse
        override suspend fun updateProfile(body: com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest) = throw NotImplementedError()
        override suspend fun changePassword(body: com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest) = throw NotImplementedError()
        override suspend fun getAddress() = throw NotImplementedError()
        override suspend fun updateAddress(body: com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest) = throw NotImplementedError()
    }

    @Test
    fun login_success_saves_tokens_and_returns_user() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage()
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi(),
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val result = repository.login("0912345678", "password123")
        assertTrue(result is ApiResponse.Success)
        val user = (result as ApiResponse.Success).data
        assertEquals("user_1", user.id)
        assertEquals("Test User", user.name)
        assertEquals(UserStatus.VERIFIED, user.status)
        assertEquals("access_token_123", fakeStorage.getAccessToken())
        assertEquals("refresh_token_123", fakeStorage.getRefreshToken())
    }

    @Test
    fun checkSession_when_onboarding_not_seen_returns_NeedsOnboarding() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage()
        val fakePrefs = FakeOnboardingPrefs(seen = false)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi(),
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val session = repository.checkSession()
        assertEquals(SessionState.NeedsOnboarding, session)
    }

    @Test
    fun checkSession_when_authenticated_returns_Authenticated_user() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage().apply {
            setAccessToken("valid_token")
            setTokenExpiry(System.currentTimeMillis() + 60_000L)
            setUserId("user_42")
            setUserName("Ahmad")
            setUserRole("CUSTOMER")
            setUserStatus("VERIFIED")
        }
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi().apply {
                meResponse = ApiResponse.Success(
                    com.forerun.customer.data.remote.dto.customer.CustomerProfileDto(
                        id = "user_42",
                        name = "Ahmad",
                        whatsapp = "0912345678",
                        altPhone = null,
                        status = "VERIFIED",
                        completedOrders = 0,
                        totalFeesPaid = 0,
                        createdAt = "2026-09-01T00:00:00Z"
                    )
                )
            },
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val session = repository.checkSession()
        assertTrue(session is SessionState.Authenticated)
        val user = (session as SessionState.Authenticated).user
        assertEquals("user_42", user.id)
        assertEquals("Ahmad", user.name)
        assertEquals(UserStatus.VERIFIED, user.status)
    }

    private class FakeSocketManager(storage: TokenStorage) : com.forerun.customer.core.websocket.SocketManager(storage) {
        var connectCalled = false
        var disconnectCalled = false

        override fun connect() {
            connectCalled = true
        }

        override fun disconnect() {
            disconnectCalled = true
        }
    }

    @Test
    fun login_success_triggers_socket_connect() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage()
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })
        val fakeSocket = FakeSocketManager(fakeStorage)

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi(),
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager,
            socketManager = fakeSocket
        )

        val result = repository.login("0912345678", "password123")
        assertTrue(result is ApiResponse.Success)
        assertTrue(fakeSocket.connectCalled)
    }

    @Test
    fun logout_triggers_socket_disconnect() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage().apply {
            setAccessToken("token_123")
            setRefreshToken("refresh_123")
        }
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })
        val fakeSocket = FakeSocketManager(fakeStorage)

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi(),
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager,
            socketManager = fakeSocket
        )

        val result = repository.logout()
        assertTrue(result is ApiResponse.Success)
        assertTrue(fakeSocket.disconnectCalled)
        assertEquals(null, fakeStorage.getAccessToken())
    }

    @Test
    fun checkSession_updates_pending_user_to_verified_when_server_me_returns_verified() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage().apply {
            setAccessToken("valid_token")
            setTokenExpiry(System.currentTimeMillis() + 60_000L)
            setUserId("user_pending")
            setUserName("Pending User")
            setUserRole("CUSTOMER")
            setUserStatus("PENDING_VERIFICATION")
        }
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })
        val fakeCustomerApi = FakeCustomerApi().apply {
            meResponse = ApiResponse.Success(
                com.forerun.customer.data.remote.dto.customer.CustomerProfileDto(
                    id = "user_pending",
                    name = "Approved User",
                    whatsapp = "0912345678",
                    altPhone = null,
                    status = "VERIFIED",
                    completedOrders = 1,
                    totalFeesPaid = 5000,
                    createdAt = "2026-09-01T00:00:00Z"
                )
            )
        }

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = fakeCustomerApi,
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val session = repository.checkSession()
        assertTrue(session is SessionState.Authenticated)
        val user = (session as SessionState.Authenticated).user
        assertEquals(UserStatus.VERIFIED, user.status)
        assertEquals("Approved User", user.name)
        assertEquals("VERIFIED", fakeStorage.getUserStatus())
    }

    @Test
    fun checkSession_handles_401_with_force_refresh_and_updates_status() = runTest {
        val fakeApi = FakeAuthApi()
        val fakeStorage = FakeTokenStorage().apply {
            setAccessToken("expired_access")
            setRefreshToken("valid_refresh")
            setTokenExpiry(System.currentTimeMillis() + 60_000L)
            setUserId("user_42")
            setUserName("Old Name")
            setUserStatus("PENDING_VERIFICATION")
        }
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })
        var meCallCount = 0
        val fakeCustomerApi = object : com.forerun.customer.data.remote.api.CustomerApi {
            override suspend fun me(): ApiResponse<com.forerun.customer.data.remote.dto.customer.CustomerProfileDto> {
                meCallCount++
                return if (meCallCount == 1) {
                    ApiResponse.Error(401, "UNAUTHORIZED", "Token expired")
                } else {
                    ApiResponse.Success(
                        com.forerun.customer.data.remote.dto.customer.CustomerProfileDto(
                            id = "user_42",
                            name = "Refreshed Name",
                            whatsapp = "0912345678",
                            altPhone = null,
                            status = "VERIFIED",
                            completedOrders = 0,
                            totalFeesPaid = 0,
                            createdAt = "2026-09-01T00:00:00Z"
                        )
                    )
                }
            }
            override suspend fun updateProfile(body: com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest) = throw NotImplementedError()
            override suspend fun changePassword(body: com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest) = throw NotImplementedError()
            override suspend fun getAddress() = throw NotImplementedError()
            override suspend fun updateAddress(body: com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest) = throw NotImplementedError()
        }

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = fakeCustomerApi,
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val session = repository.checkSession()
        assertTrue(session is SessionState.Authenticated)
        val user = (session as SessionState.Authenticated).user
        assertEquals(UserStatus.VERIFIED, user.status)
        assertEquals("new_access", fakeStorage.getAccessToken())
        assertEquals(2, meCallCount)
    }

    @Test
    fun login_apiErrorWithTechnicalEnglish_returnsSanitizedGenericArabicError() = runTest {
        val fakeApi = FakeAuthApi().apply {
            loginResult = ApiResponse.Error(
                statusCode = 401,
                error = "UNAUTHORIZED",
                message = "Invalid password or technical signature error"
            )
        }
        val fakeStorage = FakeTokenStorage()
        val fakePrefs = FakeOnboardingPrefs(seen = true)
        val refreshManager = TokenRefreshManager(fakeStorage, Provider { fakeApi })

        val repository = AuthRepositoryImpl(
            authApi = fakeApi,
            customerApi = FakeCustomerApi(),
            tokenStorage = fakeStorage,
            onboardingPrefs = fakePrefs,
            tokenRefreshManager = refreshManager
        )

        val response = repository.login("0912345678", "password123")
        assertTrue(response is ApiResponse.Error)
        val error = response as ApiResponse.Error
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, error.message)
    }
}
