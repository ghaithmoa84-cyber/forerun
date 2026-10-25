package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.dto.address.CustomerAddressDto
import com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest
import com.forerun.customer.data.remote.dto.customer.CustomerProfileDto
import com.forerun.customer.domain.repository.AddressResult
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AddressRepositoryImplTest {

    private class FakeCustomerApi : CustomerApi {
        var getAddressResult: ApiResponse<CustomerAddressDto> = ApiResponse.Success(
            CustomerAddressDto(lat = 35.52, lng = 35.80, description = "اللاذقية - القنجرة")
        )
        var updateAddressResult: ApiResponse<CustomerAddressDto> = ApiResponse.Success(
            CustomerAddressDto(lat = 35.55, lng = 35.82, description = "العنوان الجديد")
        )

        override suspend fun me(): ApiResponse<CustomerProfileDto> = throw NotImplementedError()
        override suspend fun updateProfile(body: com.forerun.customer.data.remote.dto.customer.UpdateProfileRequest): ApiResponse<CustomerProfileDto> = throw NotImplementedError()
        override suspend fun changePassword(body: com.forerun.customer.data.remote.dto.customer.ChangePasswordRequest): ApiResponse<CustomerProfileDto> = throw NotImplementedError()

        override suspend fun getAddress(): ApiResponse<CustomerAddressDto> = getAddressResult

        override suspend fun updateAddress(body: UpdateCustomerAddressRequest): ApiResponse<CustomerAddressDto> =
            updateAddressResult
    }

    @Test
    fun getAddress_returnsSuccess_whenApiReturns200() = runTest {
        val fakeApi = FakeCustomerApi()
        val repo = AddressRepositoryImpl(fakeApi)

        val result = repo.getAddress()

        assertTrue(result is AddressResult.Success)
        val success = result as AddressResult.Success
        assertEquals(35.52, success.address.lat, 0.001)
        assertEquals(35.80, success.address.lng, 0.001)
        assertEquals("اللاذقية - القنجرة", success.address.description)
    }

    @Test
    fun getAddress_returnsNotFound_whenApiReturns404() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            getAddressResult = ApiResponse.Error(
                statusCode = 404,
                error = "NOT_FOUND",
                message = "Address not found"
            )
        }
        val repo = AddressRepositoryImpl(fakeApi)

        val result = repo.getAddress()

        assertTrue(result is AddressResult.NotFound)
    }

    @Test
    fun getAddress_returnsError_whenApiReturns500() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            getAddressResult = ApiResponse.Error(
                statusCode = 500,
                error = "INTERNAL_SERVER_ERROR",
                message = "Database connection error"
            )
        }
        val repo = AddressRepositoryImpl(fakeApi)

        val result = repo.getAddress()

        assertTrue(result is AddressResult.Error)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, (result as AddressResult.Error).message)
    }

    @Test
    fun updateAddress_returnsSuccess_whenApiSucceeds() = runTest {
        val fakeApi = FakeCustomerApi()
        val repo = AddressRepositoryImpl(fakeApi)

        val result = repo.updateAddress(35.55, 35.82, "العنوان الجديد")

        assertTrue(result.isSuccess)
        val address = result.getOrNull()!!
        assertEquals(35.55, address.lat, 0.001)
        assertEquals(35.82, address.lng, 0.001)
        assertEquals("العنوان الجديد", address.description)
    }

    @Test
    fun updateAddress_returnsFailure_whenApiReturnsError() = runTest {
        val fakeApi = FakeCustomerApi().apply {
            updateAddressResult = ApiResponse.Error(
                statusCode = 400,
                error = "BAD_REQUEST",
                message = "description cannot be empty"
            )
        }
        val repo = AddressRepositoryImpl(fakeApi)

        val result = repo.updateAddress(35.55, 35.82, "")

        assertTrue(result.isFailure)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, result.exceptionOrNull()?.message)
    }
}
