package com.forerun.customer.ui.orders

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.model.CustomerOrder
import com.forerun.customer.domain.usecase.GetCustomerOrdersUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class OrderFilter {
    ALL,
    ACTIVE,
    DELIVERED,
    CANCELLED
}

sealed interface OrdersListIntent {
    data object LoadInitial : OrdersListIntent
    data object Refresh : OrdersListIntent
    data object LoadMore : OrdersListIntent
    data object RetryLoadMore : OrdersListIntent
    data class SetFilter(val filter: OrderFilter) : OrdersListIntent
    data object ClearError : OrdersListIntent
}

data class OrdersListUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isLoadingMore: Boolean = false,
    val allOrders: List<CustomerOrder> = emptyList(),
    val currentFilter: OrderFilter = OrderFilter.ALL,
    val page: Int = 1,
    val totalPages: Int = 1,
    val hasMore: Boolean = false,
    val errorMessage: String? = null,
    // Pagination failures are tracked separately from the initial-load error:
    // they must not blank the list, and they must not re-trigger the automatic
    // scroll listener (which would hammer a failing endpoint in a tight loop).
    val loadMoreError: String? = null
) {
    val displayedOrders: List<CustomerOrder>
        get() = when (currentFilter) {
            OrderFilter.ALL -> allOrders
            OrderFilter.ACTIVE -> allOrders.filter { it.status !in ACTIVE_EXCLUDED_STATUSES }
            OrderFilter.DELIVERED -> allOrders.filter { it.status == "DELIVERED" }
            OrderFilter.CANCELLED -> allOrders.filter { it.status == "CANCELLED" }
        }

    val activeCount: Int
        get() = allOrders.count { it.status !in ACTIVE_EXCLUDED_STATUSES }

    companion object {
        private val ACTIVE_EXCLUDED_STATUSES = setOf("DELIVERED", "CANCELLED")
    }
}

@HiltViewModel
class OrdersListViewModel @Inject constructor(
    private val getCustomerOrdersUseCase: GetCustomerOrdersUseCase,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(OrdersListUiState())
    val uiState: StateFlow<OrdersListUiState> = _uiState.asStateFlow()

    init {
        loadOrders(page = 1, isRefresh = false)
    }

    fun onIntent(intent: OrdersListIntent) {
        when (intent) {
            is OrdersListIntent.LoadInitial -> loadOrders(page = 1, isRefresh = false)
            is OrdersListIntent.Refresh -> refresh()
            is OrdersListIntent.LoadMore -> loadMore()
            is OrdersListIntent.RetryLoadMore -> retryLoadMore()
            is OrdersListIntent.SetFilter -> setFilter(intent.filter)
            is OrdersListIntent.ClearError -> _uiState.update { it.copy(errorMessage = null) }
        }
    }

    private fun loadOrders(page: Int, isRefresh: Boolean) {
        viewModelScope.launch {
            if (page == 1) {
                if (isRefresh) {
                    _uiState.update { it.copy(isRefreshing = true, errorMessage = null) }
                } else {
                    _uiState.update { it.copy(isLoading = true, errorMessage = null) }
                }
            } else {
                _uiState.update { it.copy(isLoadingMore = true, errorMessage = null) }
            }

            val result = getCustomerOrdersUseCase(page = page, limit = 20, status = null)
            result.fold(
                onSuccess = { ordersPage ->
                    _uiState.update { state ->
                        val combined = if (page == 1) {
                            ordersPage.orders
                        } else {
                            state.allOrders + ordersPage.orders.filter { newOrder ->
                                state.allOrders.none { it.id == newOrder.id }
                            }
                        }
                        state.copy(
                            isLoading = false,
                            isRefreshing = false,
                            isLoadingMore = false,
                            allOrders = combined,
                            page = ordersPage.page,
                            totalPages = ordersPage.totalPages,
                            hasMore = ordersPage.page < ordersPage.totalPages,
                            errorMessage = null,
                            loadMoreError = null
                        )
                    }
                },
                onFailure = { error ->
                    val message = ErrorSanitizer.getGenericErrorMessage(
                        error,
                        context = getApplication(),
                        fallbackResId = R.string.error_orders_load_failed,
                        tag = "OrdersListViewModel"
                    )
                    if (page == 1) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                isRefreshing = false,
                                isLoadingMore = false,
                                errorMessage = message
                            )
                        }
                    } else {
                        // Keep the already-loaded rows on screen; surface a
                        // retry affordance at the bottom instead.
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                isRefreshing = false,
                                isLoadingMore = false,
                                loadMoreError = message
                            )
                        }
                    }
                }
            )
        }
    }

    private fun refresh() {
        loadOrders(page = 1, isRefresh = true)
    }

    private fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore) return
        // Guard against the automatic scroll listener re-firing forever when
        // the endpoint keeps failing: the first failure parks pagination until
        // the user explicitly retries.
        if (state.loadMoreError != null) return
        loadOrders(page = state.page + 1, isRefresh = false)
    }

    private fun retryLoadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore) return
        _uiState.update { it.copy(loadMoreError = null) }
        loadOrders(page = state.page + 1, isRefresh = false)
    }

    private fun setFilter(filter: OrderFilter) {
        _uiState.update { it.copy(currentFilter = filter, loadMoreError = null) }
    }
}
