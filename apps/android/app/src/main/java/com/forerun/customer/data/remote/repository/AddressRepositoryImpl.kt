package com.forerun.customer.data.remote.repository

import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.remote.api.CustomerApi
import com.forerun.customer.data.remote.dto.address.UpdateCustomerAddressRequest
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.repository.AddressRepository
import com.forerun.customer.domain.repository.AddressResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AddressRepositoryImpl @Inject constructor(
    private val customerApi: CustomerApi
) : AddressRepository {

    override suspend fun getAddress(): AddressResult {
        return when (val response = customerApi.getAddress()) {
            is ApiResponse.Success -> {
                AddressResult.Success(
                    CustomerAddress(
                        lat = response.data.lat,
                        lng = response.data.lng,
                        description = response.data.description
                    )
                )
            }
            is ApiResponse.Error -> {
                if (response.statusCode == 404) {
                    AddressResult.NotFound
                } else {
                    AddressResult.Error(
                        ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "AddressRepo")
                    )
                }
            }
        }
    }

    override suspend fun updateAddress(
        lat: Double,
        lng: Double,
        description: String
    ): Result<CustomerAddress> {
        val request = UpdateCustomerAddressRequest(lat = lat, lng = lng, description = description)
        return when (val response = customerApi.updateAddress(request)) {
            is ApiResponse.Success -> {
                Result.success(
                    CustomerAddress(
                        lat = response.data.lat,
                        lng = response.data.lng,
                        description = response.data.description
                    )
                )
            }
            is ApiResponse.Error -> {
                Result.failure(
                    Exception(
                        ErrorSanitizer.getGenericErrorMessage(rawMessage = response.message, tag = "AddressRepo")
                    )
                )
            }
        }
    }
}
