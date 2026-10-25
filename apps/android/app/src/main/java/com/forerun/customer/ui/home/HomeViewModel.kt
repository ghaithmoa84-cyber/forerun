package com.forerun.customer.ui.home

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.gateway.OrderEventsGateway
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.domain.usecase.GetHomeDataUseCase
import com.forerun.customer.domain.usecase.LogoutUseCase
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.update
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
    data object RefreshSilent : HomeIntent
    data object Logout : HomeIntent
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getHomeDataUseCase: GetHomeDataUseCase,
    private val logoutUseCase: LogoutUseCase,
    private val observeOrderEventsUseCase: ObserveOrderEventsUseCase,
    application: Application
) : AndroidViewModel(application) {

    // Secondary constructor for testing or callers that don't supply observeOrderEventsUseCase
    constructor(
        getHomeDataUseCase: GetHomeDataUseCase,
        logoutUseCase: LogoutUseCase,
        application: Application
    ) : this(
        getHomeDataUseCase,
        logoutUseCase,
        ObserveOrderEventsUseCase(object : OrderEventsGateway {
            override fun observeEvents(): Flow<WebSocketEvent> = emptyFlow()
            override fun observeEvents(orderId: String): Flow<WebSocketEvent> = emptyFlow()
        }),
        application
    )

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _navigateToLogin = MutableSharedFlow<Unit>()
    val navigateToLogin: SharedFlow<Unit> = _navigateToLogin.asSharedFlow()

    init {
        loadHomeData()
        observeWebSocketEvents()
    }

    fun onIntent(intent: HomeIntent) {
        handleIntent(intent)
    }

    fun handleIntent(intent: HomeIntent) {
        when (intent) {
            is HomeIntent.Refresh -> refreshHomeData()
            is HomeIntent.RefreshSilent -> refreshSilently()
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
                        message = ErrorSanitizer.getGenericErrorMessage(
                            throwable,
                            context = getApplication(),
                            fallbackResId = R.string.error_home_data_load_failed,
                            tag = "HomeViewModel"
                        )
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
                            message = ErrorSanitizer.getGenericErrorMessage(
                                throwable,
                                context = getApplication(),
                                fallbackResId = R.string.error_home_data_load_failed,
                                tag = "HomeViewModel"
                            )
                        )
                    }
                }
        }
    }

    fun refreshSilently() {
        viewModelScope.launch {
            getHomeDataUseCase()
                .onSuccess { data ->
                    _uiState.update { current ->
                        if (current is HomeUiState.Success) {
                            current.copy(
                                profile = data.profile,
                                activeOrder = data.activeOrder,
                                isRefreshing = false
                            )
                        } else {
                            HomeUiState.Success(
                                profile = data.profile,
                                activeOrder = data.activeOrder,
                                isRefreshing = false
                            )
                        }
                    }
                }
        }
    }

    private fun observeWebSocketEvents() {
        viewModelScope.launch {
            observeOrderEventsUseCase().collect { event ->
                handleWebSocketEvent(event)
            }
        }
    }

    fun handleWebSocketEvent(event: WebSocketEvent) {
        val eventOrderId = event.orderId ?: return
        val currentState = _uiState.value

        if (currentState is HomeUiState.Success) {
            val currentOrder = currentState.activeOrder
            if (currentOrder != null && currentOrder.id == eventOrderId) {
                // 1. Immediate in-memory update for instant visual feedback
                when (event) {
                    is WebSocketEvent.OrderStatusChanged -> {
                        _uiState.update { state ->
                            if (state is HomeUiState.Success && state.activeOrder?.id == eventOrderId) {
                                state.copy(activeOrder = state.activeOrder.copy(status = event.newStatus))
                            } else state
                        }
                    }
                    is WebSocketEvent.OutForDelivery -> {
                        _uiState.update { state ->
                            if (state is HomeUiState.Success && state.activeOrder?.id == eventOrderId) {
                                state.copy(activeOrder = state.activeOrder.copy(status = "OUT_FOR_DELIVERY"))
                            } else state
                        }
                    }
                    is WebSocketEvent.RunnerAssigned -> {
                        _uiState.update { state ->
                            if (state is HomeUiState.Success && state.activeOrder?.id == eventOrderId) {
                                state.copy(activeOrder = state.activeOrder.copy(runnerName = event.runnerName))
                            } else state
                        }
                    }
                    is WebSocketEvent.FeeUpdated -> {
                        _uiState.update { state ->
                            if (state is HomeUiState.Success && state.activeOrder?.id == eventOrderId) {
                                state.copy(activeOrder = state.activeOrder.copy(totalFee = event.newFee))
                            } else state
                        }
                    }
                    else -> Unit
                }
                // 2. Silent background sync to get full server state (runner contact, delivery transition, etc.)
                refreshSilently()
            } else if (currentOrder == null) {
                // If there's currently no active order displayed, any customer order event could signify a new active order
                refreshSilently()
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
