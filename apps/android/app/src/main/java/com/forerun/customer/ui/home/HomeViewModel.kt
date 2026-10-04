package com.forerun.customer.ui.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.usecase.GetHomeDataUseCase
import com.forerun.customer.domain.usecase.LogoutUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface HomeUiState {
    data object Loading : HomeUiState
    data class Success(
        val profile: CustomerProfile,
        val activeOrder: ActiveOrder? = null,
        val isRefreshing: Boolean = false
    ) : HomeUiState
    data class Error(val message: String) : HomeUiState
}

sealed interface HomeIntent {
    data object Refresh : HomeIntent
    data object Logout : HomeIntent
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getHomeDataUseCase: GetHomeDataUseCase,
    private val logoutUseCase: LogoutUseCase,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _navigateToLogin = MutableSharedFlow<Unit>()
    val navigateToLogin: SharedFlow<Unit> = _navigateToLogin.asSharedFlow()

    init {
        loadHomeData()
    }

    fun onIntent(intent: HomeIntent) {
        handleIntent(intent)
    }

    fun handleIntent(intent: HomeIntent) {
        when (intent) {
            is HomeIntent.Refresh -> refreshHomeData()
            is HomeIntent.Logout -> logout()
        }
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            getHomeDataUseCase()
                .onSuccess { data ->
                    _uiState.value = HomeUiState.Success(
                        profile = data.profile,
                        activeOrder = data.activeOrder,
                        isRefreshing = false
                    )
                }
                .onFailure { throwable ->
                    _uiState.value = HomeUiState.Error(
                        message = throwable.message
                            ?: getApplication<Application>().getString(R.string.error_home_data_load_failed)
                    )
                }
        }
    }

    private fun refreshHomeData() {
        val currentState = _uiState.value
        if (currentState is HomeUiState.Success) {
            _uiState.value = currentState.copy(isRefreshing = true)
        }
        viewModelScope.launch {
            getHomeDataUseCase()
                .onSuccess { data ->
                    _uiState.value = HomeUiState.Success(
                        profile = data.profile,
                        activeOrder = data.activeOrder,
                        isRefreshing = false
                    )
                }
                .onFailure { throwable ->
                    if (currentState is HomeUiState.Success) {
                        _uiState.value = currentState.copy(isRefreshing = false)
                    } else {
                        _uiState.value = HomeUiState.Error(
                            message = throwable.message
                                ?: getApplication<Application>().getString(R.string.error_home_data_load_failed)
                        )
                    }
                }
        }
    }

    fun logout() {
        viewModelScope.launch {
            try {
                logoutUseCase()
            } finally {
                _navigateToLogin.emit(Unit)
            }
        }
    }
}
