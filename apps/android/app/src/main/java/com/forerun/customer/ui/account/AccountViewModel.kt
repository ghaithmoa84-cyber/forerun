package com.forerun.customer.ui.account

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.LogoutUseCase
import com.forerun.customer.domain.usecase.account.ChangeAccountPasswordUseCase
import com.forerun.customer.domain.usecase.account.GetAccountProfileUseCase
import com.forerun.customer.domain.usecase.account.UpdateAccountProfileUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountUiState(
    val isLoading: Boolean = true,
    val profile: CustomerProfile? = null,
    val address: CustomerAddress? = null,
    val isSavingProfile: Boolean = false,
    val isChangingPassword: Boolean = false,
    val isLoggingOut: Boolean = false,
    val errorMessage: String? = null,
    // Failures of the initial profile/address fetch. Kept apart from
    // errorMessage (which also carries validation and save errors) so the screen
    // can offer a retry for the recoverable case only.
    val loadErrorMessage: String? = null,
    val profileSuccessMessage: String? = null,
    val passwordSuccessMessage: String? = null
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val getAccountProfile: GetAccountProfileUseCase,
    private val updateAccountProfile: UpdateAccountProfileUseCase,
    private val changeAccountPassword: ChangeAccountPasswordUseCase,
    private val getCustomerAddress: GetCustomerAddressUseCase,
    private val logoutUseCase: LogoutUseCase,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(AccountUiState())
    val uiState: StateFlow<AccountUiState> = _uiState.asStateFlow()

    private val _navigateToLogin = MutableSharedFlow<Unit>()
    val navigateToLogin: SharedFlow<Unit> = _navigateToLogin.asSharedFlow()

    init {
        loadAccountData()
    }

    fun loadAccountData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, loadErrorMessage = null)

            val profileResult = getAccountProfile()
            val addressResult = getCustomerAddress()

            var profile: CustomerProfile? = null
            var error: String? = null

            profileResult.fold(
                onSuccess = { profile = it },
                onFailure = {
                    error = ErrorSanitizer.getGenericErrorMessage(
                        it,
                        context = getApplication(),
                        fallbackResId = R.string.error_account_load_failed,
                        tag = "AccountViewModel"
                    )
                }
            )

            var address: CustomerAddress? = null
            when (addressResult) {
                is AddressResult.Success -> address = addressResult.address
                is AddressResult.NotFound -> { /* No address set yet */ }
                is AddressResult.Error -> {
                    if (error == null) {
                        error = ErrorSanitizer.getGenericErrorMessage(
                            rawMessage = addressResult.message,
                            context = getApplication(),
                            fallbackResId = R.string.error_account_load_failed,
                            tag = "AccountViewModel"
                        )
                    }
                }
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                profile = profile,
                address = address,
                errorMessage = null,
                loadErrorMessage = error
            )
        }
    }

    fun updateProfile(name: String, altPhone: String?) {
        val trimmedName = name.trim()
        if (trimmedName.length < 2) {
            _uiState.value = _uiState.value.copy(errorMessage = getApplication<Application>().getString(R.string.error_name_short))
            return
        }

        val trimmedAltPhone = altPhone?.trim()?.ifEmpty { null }
        if (trimmedAltPhone != null && !trimmedAltPhone.matches(Regex("^09\\d{8}$"))) {
            _uiState.value = _uiState.value.copy(errorMessage = getApplication<Application>().getString(R.string.error_alt_phone_invalid))
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isSavingProfile = true,
                errorMessage = null,
                profileSuccessMessage = null
            )
            val result = updateAccountProfile(name = trimmedName, altPhone = trimmedAltPhone)
            result.fold(
                onSuccess = { updatedProfile ->
                    _uiState.value = _uiState.value.copy(
                        isSavingProfile = false,
                        profile = updatedProfile,
                        profileSuccessMessage = getApplication<Application>().getString(R.string.account_profile_saved)
                    )
                },
                onFailure = { e ->
                    _uiState.value = _uiState.value.copy(
                        isSavingProfile = false,
                        errorMessage = ErrorSanitizer.getGenericErrorMessage(
                            e,
                            context = getApplication(),
                            fallbackResId = R.string.error_account_save_failed,
                            tag = "AccountViewModel"
                        )
                    )
                }
            )
        }
    }

    fun changePassword(newPassword: String, confirmPassword: String) {
        if (newPassword.length < 8) {
            _uiState.value = _uiState.value.copy(errorMessage = getApplication<Application>().getString(R.string.error_password_short))
            return
        }
        if (newPassword.toByteArray(Charsets.UTF_8).size > 72) {
            _uiState.value = _uiState.value.copy(errorMessage = getApplication<Application>().getString(R.string.error_password_too_long))
            return
        }
        if (newPassword != confirmPassword) {
            _uiState.value = _uiState.value.copy(errorMessage = getApplication<Application>().getString(R.string.account_error_passwords_dont_match))
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isChangingPassword = true,
                errorMessage = null,
                passwordSuccessMessage = null
            )
            val result = changeAccountPassword(password = newPassword)
            result.fold(
                onSuccess = {
                    _uiState.value = _uiState.value.copy(
                        isChangingPassword = false,
                        passwordSuccessMessage = getApplication<Application>().getString(R.string.account_password_changed)
                    )
                },
                onFailure = { e ->
                    _uiState.value = _uiState.value.copy(
                        isChangingPassword = false,
                        errorMessage = ErrorSanitizer.getGenericErrorMessage(
                            e,
                            context = getApplication(),
                            fallbackResId = R.string.error_password_change_failed,
                            tag = "AccountViewModel"
                        )
                    )
                }
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoggingOut = true)
            logoutUseCase()
            _uiState.value = _uiState.value.copy(isLoggingOut = false)
            _navigateToLogin.emit(Unit)
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            errorMessage = null,
            loadErrorMessage = null,
            profileSuccessMessage = null,
            passwordSuccessMessage = null
        )
    }
}
