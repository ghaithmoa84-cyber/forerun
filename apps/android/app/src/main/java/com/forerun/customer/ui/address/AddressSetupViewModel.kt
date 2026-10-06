package com.forerun.customer.ui.address

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.UpdateCustomerAddressUseCase
import com.forerun.customer.domain.usecase.ReverseGeocodeUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AddressSetupUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val isEditMode: Boolean = false,
    val isGeocodingLoading: Boolean = false,
    val geocodingError: String? = null,
    val lat: Double = 33.5138,
    val lng: Double = 36.2765,
    val description: String = "",
    val descriptionError: String? = null,
    val errorMessage: String? = null,
    val saveSuccess: Boolean = false
)

sealed interface AddressSetupIntent {
    data object LoadAddress : AddressSetupIntent
    data class UpdateCoordinates(val lat: Double, val lng: Double) : AddressSetupIntent
    data class UpdateDescription(val description: String) : AddressSetupIntent
    data object SaveAddress : AddressSetupIntent
    data object ClearError : AddressSetupIntent
}

sealed interface AddressSetupEvent {
    data class AddressSaved(val address: CustomerAddress) : AddressSetupEvent
    data class ShowToast(val message: String) : AddressSetupEvent
}

@HiltViewModel
class AddressSetupViewModel @Inject constructor(
    private val getCustomerAddressUseCase: GetCustomerAddressUseCase,
    private val updateCustomerAddressUseCase: UpdateCustomerAddressUseCase,
    private val reverseGeocodeUseCase: ReverseGeocodeUseCase,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(AddressSetupUiState())
    val uiState: StateFlow<AddressSetupUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<AddressSetupEvent>()
    val events: SharedFlow<AddressSetupEvent> = _events.asSharedFlow()

    private var reverseGeocodeJob: Job? = null

    init {
        loadAddress()
    }

    fun onIntent(intent: AddressSetupIntent) {
        when (intent) {
            is AddressSetupIntent.LoadAddress -> loadAddress()
            is AddressSetupIntent.UpdateCoordinates -> {
                _uiState.update {
                    it.copy(
                        lat = intent.lat,
                        lng = intent.lng,
                        isGeocodingLoading = true,
                        geocodingError = null
                    )
                }
                reverseGeocodeJob?.cancel()
                reverseGeocodeJob = viewModelScope.launch {
                    try {
                        delay(500)
                        val placeName = reverseGeocodeUseCase(intent.lat, intent.lng)
                        if (!placeName.isNullOrBlank()) {
                            _uiState.update {
                                it.copy(
                                    description = placeName,
                                    descriptionError = null,
                                    isGeocodingLoading = false,
                                    geocodingError = null
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    isGeocodingLoading = false,
                                    geocodingError = getApplication<Application>().getString(R.string.error_geocoding_failed)
                                )
                            }
                        }
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        _uiState.update {
                            it.copy(
                                isGeocodingLoading = false,
                                geocodingError = getApplication<Application>().getString(R.string.error_geocoding_failed)
                            )
                        }
                    }
                }
            }
            is AddressSetupIntent.UpdateDescription -> {
                _uiState.update {
                    it.copy(
                        description = intent.description,
                        descriptionError = if (intent.description.isNotBlank()) null else it.descriptionError
                    )
                }
            }
            is AddressSetupIntent.SaveAddress -> saveAddress()
            is AddressSetupIntent.ClearError -> {
                _uiState.update { it.copy(errorMessage = null) }
            }
        }
    }

    private fun loadAddress() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = getCustomerAddressUseCase()) {
                is AddressResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isEditMode = true,
                            lat = result.address.lat,
                            lng = result.address.lng,
                            description = result.address.description
                        )
                    }
                }
                is AddressResult.NotFound -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isEditMode = false,
                            lat = 33.5138,
                            lng = 36.2765,
                            description = ""
                        )
                    }
                }
                is AddressResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    private val isSavingGuard = java.util.concurrent.atomic.AtomicBoolean(false)

    private fun saveAddress() {
        if (_uiState.value.isSaving || !isSavingGuard.compareAndSet(false, true)) {
            return
        }

        val currentState = _uiState.value
        val trimmedDesc = currentState.description.trim()

        if (trimmedDesc.isEmpty()) {
            isSavingGuard.set(false)
            _uiState.update { it.copy(descriptionError = getApplication<Application>().getString(R.string.error_address_description_required)) }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, errorMessage = null, descriptionError = null) }
            try {
                val result = updateCustomerAddressUseCase(
                    lat = currentState.lat,
                    lng = currentState.lng,
                    description = trimmedDesc
                )
                result.fold(
                    onSuccess = { savedAddress ->
                        _uiState.update {
                            it.copy(
                                isSaving = false,
                                isEditMode = true,
                                saveSuccess = true,
                                description = savedAddress.description
                            )
                        }
                        _events.emit(AddressSetupEvent.AddressSaved(savedAddress))
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(
                                isSaving = false,
                                errorMessage = error.localizedMessage
                                    ?: getApplication<Application>().getString(R.string.error_address_save_failed_generic)
                            )
                        }
                    }
                )
            } finally {
                isSavingGuard.set(false)
            }
        }
    }
}
