package com.forerun.customer.ui.order.detail

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.domain.model.CancelOrderError
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.domain.model.OrderRatingInfo
import com.forerun.customer.domain.usecase.order.CancelOrderUseCase
import com.forerun.customer.domain.usecase.order.GetOrderDetailUseCase
import com.forerun.customer.domain.usecase.order.SubmitRatingUseCase
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OrderDetailUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val isCancelling: Boolean = false,
    val order: CustomerOrderDetail? = null,
    val errorMessage: String? = null,
    val cancelSuccess: Boolean = false,
    val cancelError: CancelOrderError? = null,
    val showCancelDialog: Boolean = false,
    val feeUpdatedNotice: Boolean = false,
    val isSubmittingRating: Boolean = false,
    val ratingSuccess: Boolean = false
) {
    val canCancel: Boolean
        get() {
            val status = order?.status ?: return false
            return status in setOf(
                "PENDING_REVIEW",
                "AWAITING_RUNNER",
                "AWAITING_PREFERRED_RUNNER",
                "ASSIGNED"
            )
        }

    val canContactRunner: Boolean
        get() {
            val runner = order?.runner ?: return false
            return runner.whatsapp != null || runner.phone != null
        }

    val canRate: Boolean
        get() {
            val o = order ?: return false
            if (o.status != "DELIVERED") return false
            // Check 24 hours window if deliveredAt is known
            val deliveredDate = o.deliveredAt ?: return true
            return try {
                val epoch = java.time.Instant.parse(deliveredDate).toEpochMilli()
                val now = System.currentTimeMillis()
                (now - epoch) <= 24 * 60 * 60 * 1000
            } catch (_: Exception) {
                true
            }
        }
}

sealed interface OrderDetailIntent {
    data object Load : OrderDetailIntent
    data object Refresh : OrderDetailIntent
    data class ShowCancelDialog(val show: Boolean) : OrderDetailIntent
    data object ConfirmCancel : OrderDetailIntent
    data object ClearError : OrderDetailIntent
    data object ClearCancelSuccess : OrderDetailIntent
    data object ClearFeeNotice : OrderDetailIntent
    data class SubmitRating(val stars: Int, val note: String? = null) : OrderDetailIntent
}

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val getOrderDetailUseCase: GetOrderDetailUseCase,
    private val cancelOrderUseCase: CancelOrderUseCase,
    private val observeOrderEventsUseCase: ObserveOrderEventsUseCase,
    private val submitRatingUseCase: SubmitRatingUseCase,
    application: Application
) : AndroidViewModel(application) {

    val orderId: String = savedStateHandle.get<String>("orderId").orEmpty()

    private val _uiState = MutableStateFlow(OrderDetailUiState())
    val uiState: StateFlow<OrderDetailUiState> = _uiState.asStateFlow()

    init {
        if (orderId.isNotBlank()) {
            loadDetail(showLoading = true)
            observeWebSocketEvents()
        } else {
            _uiState.update { it.copy(isLoading = false, errorMessage = getApplication<Application>().getString(R.string.error_invalid_order_id)) }
        }
    }

    fun onIntent(intent: OrderDetailIntent) {
        when (intent) {
            OrderDetailIntent.Load -> loadDetail(showLoading = true)
            OrderDetailIntent.Refresh -> loadDetail(showLoading = false, isRefresh = true)
            is OrderDetailIntent.ShowCancelDialog -> {
                _uiState.update { it.copy(showCancelDialog = intent.show) }
            }
            OrderDetailIntent.ConfirmCancel -> cancelOrder()
            OrderDetailIntent.ClearError -> {
                _uiState.update { it.copy(errorMessage = null, cancelError = null) }
            }
            OrderDetailIntent.ClearCancelSuccess -> {
                _uiState.update { it.copy(cancelSuccess = false) }
            }
            OrderDetailIntent.ClearFeeNotice -> {
                _uiState.update { it.copy(feeUpdatedNotice = false) }
            }
            is OrderDetailIntent.SubmitRating -> submitRating(intent.stars, intent.note)
        }
    }

    private val isSubmittingRatingGuard = java.util.concurrent.atomic.AtomicBoolean(false)

    fun submitRating(stars: Int, note: String? = null) {
        if (stars !in 1..5) return
        val currentOrder = _uiState.value.order ?: return
        if (currentOrder.status != "DELIVERED") return
        if (currentOrder.rating == null && !_uiState.value.canRate) return
        if (_uiState.value.isSubmittingRating || !isSubmittingRatingGuard.compareAndSet(false, true)) {
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmittingRating = true, errorMessage = null) }
            try {
                val isUpdate = currentOrder.rating != null
                val cleanNote = note?.trim()?.ifEmpty { null }
                val result = submitRatingUseCase(
                    orderId = orderId,
                    stars = stars,
                    note = cleanNote,
                    isUpdate = isUpdate
                )
                result.onSuccess { ratingResult ->
                    _uiState.update { current ->
                        current.copy(
                            isSubmittingRating = false,
                            ratingSuccess = true,
                            order = current.order?.copy(
                                rating = OrderRatingInfo(
                                    stars = ratingResult.stars,
                                    note = ratingResult.note
                                )
                            )
                        )
                    }
                }.onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isSubmittingRating = false,
                            errorMessage = ErrorSanitizer.getGenericErrorMessage(
                                err,
                                context = getApplication(),
                                fallbackResId = R.string.rating_error_submit,
                                tag = "OrderDetailViewModel"
                            )
                        )
                    }
                }
            } finally {
                isSubmittingRatingGuard.set(false)
            }
        }
    }

    fun loadDetail(showLoading: Boolean = true, isRefresh: Boolean = false) {
        viewModelScope.launch {
            if (showLoading) {
                _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            } else if (isRefresh) {
                _uiState.update { it.copy(isRefreshing = true, errorMessage = null) }
            }

            val result = getOrderDetailUseCase(orderId)
            result.onSuccess { orderDetail ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        order = orderDetail,
                        errorMessage = null
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        errorMessage = ErrorSanitizer.getGenericErrorMessage(
                            err,
                            context = getApplication(),
                            fallbackResId = R.string.order_detail_error_loading,
                            tag = "OrderDetailViewModel"
                        )
                    )
                }
            }
        }
    }

    private fun cancelOrder() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCancelling = true, cancelError = null) }
            val result = cancelOrderUseCase(orderId)
            result.onSuccess {
                _uiState.update {
                    it.copy(
                        isCancelling = false,
                        cancelSuccess = true,
                        showCancelDialog = false
                    )
                }
                loadDetail(showLoading = false)
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isCancelling = false,
                        cancelError = CancelOrderError.from(err),
                        showCancelDialog = false
                    )
                }
            }
        }
    }

    private fun observeWebSocketEvents() {
        viewModelScope.launch {
            observeOrderEventsUseCase(orderId).collect { event ->
                handleWebSocketEvent(event)
            }
        }
    }

    fun handleWebSocketEvent(event: WebSocketEvent) {
        when (event) {
            is WebSocketEvent.OrderStatusChanged -> {
                _uiState.update { current ->
                    current.copy(
                        order = current.order?.copy(status = event.newStatus)
                    )
                }
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.RunnerAssigned -> {
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.FeeUpdated -> {
                _uiState.update { current ->
                    current.copy(
                        order = current.order?.copy(totalFee = event.newFee),
                        feeUpdatedNotice = true
                    )
                }
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.StorePurchased,
            is WebSocketEvent.StoreSkipped -> {
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.OutForDelivery -> {
                _uiState.update { current ->
                    current.copy(
                        order = current.order?.copy(status = "OUT_FOR_DELIVERY")
                    )
                }
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.Delivered -> {
                _uiState.update { current ->
                    current.copy(
                        order = current.order?.copy(
                            status = "DELIVERED",
                            deliveredAt = event.deliveredAt ?: current.order.deliveredAt
                        )
                    )
                }
                loadDetail(showLoading = false)
            }
            is WebSocketEvent.Cancelled -> {
                _uiState.update { current ->
                    current.copy(
                        order = current.order?.copy(
                            status = "CANCELLED",
                            cancelReason = event.reason ?: current.order.cancelReason
                        )
                    )
                }
                loadDetail(showLoading = false)
            }
            else -> Unit
        }
    }
}
