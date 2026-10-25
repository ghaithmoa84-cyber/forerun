package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.dto.address.CustomerAddressDto
import com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest
import com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest
import com.forerun.customer.data.remote.dto.customer.CustomerProfileDto
import com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest
import com.forerun.customer.domain.model.UserStatus
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AccountRepositoryImplTest {

    private class FakeCustomerApi : CustomerApi {
        var meResult: ApiResponse<CustomerProfileDto> = ApiResponse.Success(
            CustomerProfileDto(
                id = "cust_123",
                name = "محمد علي",
                whatsapp = "0912345678",
                altPhone = "0987654321",
                status = "VERIFIED",
                completedOrders = 7,
                totalFeesPaid = 35000,
                createdAt = "2026-09-01T10:00:00Z"
            )
        )
        var lastProfileRequest: UpdateProfileRequest? = null
        var lastPasswordRequest: ChangePasswordRequest? = null

        override suspend fun me(): ApiResponse<CustomerProfileDto> = meResult

        override suspend fun updateProfile(body: UpdateProfileRequest): ApiResponse<CustomerProfileDto> {
            lastProfileRequest = body
            val response = meResult
            return if (response is ApiResponse.Success) {
                ApiResponse.Success(response.data.copy(name = body.name, altPhone = body.altPhone))
            } else {
                response
            }
        }

        override suspend fun changePassword(body: ChangePasswordRequest): ApiResponse<CustomerProfileDto> {
            lastPasswordRequest = body
            return meResult
        }

        override suspend fun getAddress(): ApiResponse<CustomerAddressDto> = throw NotImplementedError()
        override suspend fun updateAddress(body: UpdateCustomerAddressRequest): ApiResponse<CustomerAddressDto> = throw NotImplementedError()
    }

    @Test
    fun getProfile_returnsDomainProfile_withConvertedCreatedAt() = runTest {
        val repo = AccountRepositoryImpl(FakeCustomerApi())

        val result = repo.getProfile()

        assertTrue(result.isSuccess)
        val profile = result.getOrNull()!!
        assertEquals("cust_123", profile.id)
        assertEquals("محمد علي", profile.name)
        assertEquals("0912345678", profile.whatsapp)
        assertEquals("0987654321", profile.altPhone)
        assertEquals(UserStatus.VERIFIED, profile.status)
        assertEquals(7, profile.completedOrders)
        assertEquals(35000, profile.totalFeesPaid)
        assertEquals(Instant.parse("2026-09-01T10:00:00Z"), profile.createdAt)
    }

    @Test
    fun getProfile_returnsFailure_whenApiReturnsError() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            meResult = ApiResponse.Error(
                statusCode = 500,
                error = "INTERNAL_SERVER_ERROR",
                message = "تعذر جلب البيانات"
            )
        }
        val repo = AccountRepositoryImpl(fakeApi)

        val result = repo.getProfile()

        assertTrue(result.isFailure)
        assertEquals("تعذر جلب البيانات", result.exceptionOrNull()?.message)
    }

    @Test
    fun getProfile_sanitizesTechnicalEnglishServerError_returnsGenericArabic() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            meResult = ApiResponse.Error(
                statusCode = 500,
                error = "INTERNAL_SERVER_ERROR",
                message = "Internal Server Error: DB connection failed"
            )
        }
        val repo = AccountRepositoryImpl(fakeApi)

        val result = repo.getProfile()

        assertTrue(result.isFailure)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, result.exceptionOrNull()?.message)
    }

    @Test
    fun updateProfile_passesCorrectRequestBody() = runTest {
        val fakeApi = FakeCustomerApi()
        val repo = AccountRepositoryImpl(fakeApi)

        val result = repo.updateProfile(name = "أحمد خالد", altPhone = "0987654321")

        assertTrue(result.isSuccess)
        val request = fakeApi.lastProfileRequest
        assertNotNull(request)
        assertEquals("أحمد خالد", request?.name)
        assertEquals("0987654321", request?.altPhone)
        assertEquals("أحمد خالد", result.getOrNull()?.name)
    }

    @Test
    fun updateProfile_returnsFailure_whenApiReturnsError() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            meResult = ApiResponse.Error(
                statusCode = 400,
                error = "BAD_REQUEST",
                message = "رقم بديل غير صالح"
            )
        }
        val repo = AccountRepositoryImpl(fakeApi)

        val result = repo.updateProfile(name = "أحمد خالد", altPhone = "12345")

        assertTrue(result.isFailure)
        assertEquals("رقم بديل غير صالح", result.exceptionOrNull()?.message)
    }

    @Test
    fun changePassword_passesCorrectRequestBody() = runTest {
        val fakeApi = FakeCustomerApi()
        val repo = AccountRepositoryImpl(fakeApi)

        repo.changePassword(password = "newPassword123")

        val request = fakeApi.lastPasswordRequest
        assertNotNull(request)
        assertEquals("newPassword123", request?.password)
    }

    @Test
    fun changePassword_returnsUnit_onSuccess_ignoringPayload() = runTest {
        val repo = AccountRepositoryImpl(FakeCustomerApi())

        val result = repo.changePassword(password = "newPassword123")

        assertTrue(result.isSuccess)
        assertEquals(Unit, result.getOrNull())
    }

    @Test
    fun changePassword_returnsFailure_whenApiReturnsError() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            meResult = ApiResponse.Error(
                statusCode = 400,
                error = "BAD_REQUEST",
                message = "كلمة المرور قصيرة"
            )
        }
        val repo = AccountRepositoryImpl(fakeApi)

        val result = repo.changePassword(password = "12345")

        assertTrue(result.isFailure)
        assertEquals("كلمة المرور قصيرة", result.exceptionOrNull()?.message)
    }

    @Test
    fun updateProfileRequest_serializesNameAndAltPhone_withoutPassword() {
        val moshi = Moshi.Builder().build()
        val request = UpdateProfileRequest(name = "أحمد خالد", altPhone = "0987654321")

        val json = moshi.adapter(UpdateProfileRequest::class.java).toJson(request)

        assertFalse(json.contains("password"))
        assertTrue(json.contains("\"name\":\"أحمد خالد\""))
        assertTrue(json.contains("\"altPhone\":\"0987654321\""))
    }

    @Test
    fun updateProfileRequest_serializesNullAltPhone_whenSerializeNullsEnabled() {
        val moshi = Moshi.Builder().build()
        val request = UpdateProfileRequest(name = "أحمد خالد", altPhone = null)

        val json = moshi.adapter(UpdateProfileRequest::class.java).serializeNulls().toJson(request)

        assertFalse(json.contains("password"))
        assertTrue(json.contains("\"name\":\"أحمد خالد\""))
        assertTrue(json.contains("\"altPhone\":null"))
    }

    @Test
    fun changePasswordRequest_serializesPasswordOnly_withoutNameOrAltPhone() {
        val moshi = Moshi.Builder().build()
        val request = ChangePasswordRequest(password = "newPassword123")

        val json = moshi.adapter(ChangePasswordRequest::class.java).toJson(request)

        assertFalse(json.contains("name"))
        assertFalse(json.contains("altPhone"))
        assertTrue(json.contains("\"password\":\"newPassword123\""))
    }
}
