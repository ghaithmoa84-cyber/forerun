package com.forerun.customer.ui.rating

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.usecase.order.GetOrderDetailUseCase
import com.forerun.customer.domain.usecase.order.SubmitRatingUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RatingUiState(
    val isLoading: Boolean = true,
    val isSubmitting: Boolean = false,
    val orderNumber: String = "",
    val runnerName: String = "",
    val stars: Int = 0,
    val note: String = "",
    val isExpired: Boolean = false,
    val isExistingRating: Boolean = false,
    val isSuccess: Boolean = false,
    val errorMessage: String? = null,
    val validationError: String? = null
)

sealed interface RatingIntent {
    data class SetStars(val stars: Int) : RatingIntent
    data class SetNote(val note: String) : RatingIntent
    data object Submit : RatingIntent
    data object ClearError : RatingIntent
}

@HiltViewModel
class RatingViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val getOrderDetailUseCase: GetOrderDetailUseCase,
    private val submitRatingUseCase: SubmitRatingUseCase,
    application: Application
) : AndroidViewModel(application) {

    val orderId: String = savedStateHandle.get<String>("orderId").orEmpty()

    private val _uiState = MutableStateFlow(RatingUiState())
    val uiState: StateFlow<RatingUiState> = _uiState.asStateFlow()

    init {
        if (orderId.isNotBlank()) {
            loadOrderInfo()
        } else {
            _uiState.update { it.copy(isLoading = false, errorMessage = getApplication<Application>().getString(R.string.error_invalid_order_id)) }
        }
    }

    fun onIntent(intent: RatingIntent) {
        when (intent) {
            is RatingIntent.SetStars -> {
                _uiState.update { it.copy(stars = intent.stars, validationError = null) }
            }
            is RatingIntent.SetNote -> {
                _uiState.update { it.copy(note = intent.note) }
            }
            RatingIntent.Submit -> submitRating()
            RatingIntent.ClearError -> {
                _uiState.update { it.copy(errorMessage = null, validationError = null) }
            }
        }
    }

    fun loadOrderInfo() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = getOrderDetailUseCase(orderId)
            result.onSuccess { order ->
                val runnerName = order.runner?.name
                    ?: getApplication<Application>().getString(R.string.label_runner_default)
                val existingStars = order.rating?.stars ?: 0
                val existingNote = order.rating?.note ?: ""
                val isExisting = order.rating != null

                var expired = false
                val deliveredAt = order.deliveredAt
                if (!deliveredAt.isNullOrBlank()) {
                    try {
                        val epoch = java.time.Instant.parse(deliveredAt).toEpochMilli()
                        val elapsed = System.currentTimeMillis() - epoch
                        if (elapsed > 24 * 60 * 60 * 1000) {
                            expired = true
                        }
                    } catch (_: Exception) {}
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        orderNumber = order.orderNumber,
                        runnerName = runnerName,
                        stars = existingStars,
                        note = existingNote,
                        isExistingRating = isExisting,
                        isExpired = expired
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = ErrorSanitizer.getGenericErrorMessage(
                            err,
                            context = getApplication(),
                            fallbackResId = R.string.order_detail_error_loading,
                            tag = "RatingViewModel"
                        )
                    )
                }
            }
        }
    }

    private val isSubmittingGuard = java.util.concurrent.atomic.AtomicBoolean(false)

    fun submitRating() {
        if (_uiState.value.isSubmitting || !isSubmittingGuard.compareAndSet(false, true)) {
            return
        }

        val state = _uiState.value
        if (state.isExpired) {
            isSubmittingGuard.set(false)
            _uiState.update {
                it.copy(validationError = getApplication<Application>().getString(R.string.rating_expired_warning))
            }
            return
        }

        if (state.stars < 1 || state.stars > 5) {
            isSubmittingGuard.set(false)
            _uiState.update {
                it.copy(validationError = getApplication<Application>().getString(R.string.rating_validation_stars_required))
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null, validationError = null) }
            try {
                val result = submitRatingUseCase(
                    orderId = orderId,
                    stars = state.stars,
                    note = state.note.trim().ifEmpty { null },
                    isUpdate = state.isExistingRating
                )

                result.onSuccess {
                    _uiState.update {
                        it.copy(isSubmitting = false, isSuccess = true)
                    }
                }.onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = ErrorSanitizer.getGenericErrorMessage(
                                err,
                                context = getApplication(),
                                fallbackResId = R.string.rating_error_submit,
                                tag = "RatingViewModel"
                            )
                        )
                    }
                }
            } finally {
                isSubmittingGuard.set(false)
            }
        }
    }
}
