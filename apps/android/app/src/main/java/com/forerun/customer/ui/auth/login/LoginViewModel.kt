package com.forerun.customer.ui.auth.login

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.domain.model.User
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.usecase.LoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val whatsapp: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val whatsappErrorRes: Int? = null,
    val passwordErrorRes: Int? = null,
    val generalError: String? = null
)

sealed interface LoginNavigationEvent {
    data class Success(val user: User) : LoginNavigationEvent
    data object NavigateToRegister : LoginNavigationEvent
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val socketManager: com.forerun.customer.core.websocket.SocketManager,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<LoginNavigationEvent>()
    val navigationEvent: SharedFlow<LoginNavigationEvent> = _navigationEvent.asSharedFlow()

    fun onWhatsappChanged(value: String) {
        val filtered = value.filter { it.isDigit() }.take(10)
        _uiState.update {
            it.copy(
                whatsapp = filtered,
                whatsappErrorRes = null,
                generalError = null
            )
        }
    }

    fun onPasswordChanged(value: String) {
        _uiState.update {
            it.copy(
                password = value,
                passwordErrorRes = null,
                generalError = null
            )
        }
    }

    fun onRegisterClicked() {
        viewModelScope.launch {
            _navigationEvent.emit(LoginNavigationEvent.NavigateToRegister)
        }
    }

    fun login() {
        if (_uiState.value.isLoading) return
        val state = _uiState.value
        val isPhoneValid = state.whatsapp.matches(Regex("^09\\d{8}$"))
        val isPasswordValid = state.password.length >= 8

        if (!isPhoneValid || !isPasswordValid) {
            _uiState.update {
                it.copy(
                    whatsappErrorRes = if (!isPhoneValid) R.string.error_phone_invalid else null,
                    passwordErrorRes = if (!isPasswordValid) R.string.error_password_short else null
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, generalError = null) }
            when (val response = loginUseCase(state.whatsapp, state.password)) {
                is ApiResponse.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    try {
                        socketManager.connect()
                    } catch (_: Exception) {}
                    _navigationEvent.emit(LoginNavigationEvent.Success(response.data))
                }
                is ApiResponse.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            generalError = ErrorSanitizer.getGenericErrorMessage(
                                rawMessage = response.message,
                                context = getApplication(),
                                fallbackResId = R.string.error_login_generic,
                                tag = "LoginViewModel"
                            )
                        )
                    }
                }
            }
        }
    }
}
