package com.forerun.customer.ui.order.create

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.R
import com.forerun.customer.core.error.ErrorSanitizer
import com.forerun.customer.domain.model.CreatedOrder
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import com.forerun.customer.domain.model.PricingDisclosure
import com.forerun.customer.domain.model.RunnerInfo
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.usecase.CreateOrderUseCase
import com.forerun.customer.domain.usecase.GetAvailableRunnersUseCase
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.order.GetPricingDisclosureUseCase
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

enum class OrderInputMode {
    QUICK,
    STRUCTURED
}

data class CreateOrderUiState(
    val inputMode: OrderInputMode = OrderInputMode.QUICK,
    val quickText: String = "",
    val isLoadingAddress: Boolean = true,
    val isLoadingRunners: Boolean = false,
    val isSubmitting: Boolean = false,
    val deliveryAddress: CustomerAddress? = null,
    val items: List<OrderItem> = listOf(OrderItem(itemName = "", quantity = "1")),
    val notes: String = "",
    val availableRunners: List<RunnerInfo> = emptyList(),
    val selectedRunnerId: String? = null,
    val waitForPreferred: Boolean = false,
    val validationError: String? = null,
    val createdOrder: CreatedOrder? = null,
    val errorMessage: String? = null,
    val showFeeDisclosure: Boolean = false,
    val isLoadingDisclosure: Boolean = false,
    val disclosurePricing: PricingDisclosure? = null
)

sealed interface CreateOrderIntent {
    data object LoadInitialData : CreateOrderIntent
    data class SetInputMode(val mode: OrderInputMode) : CreateOrderIntent
    data class UpdateQuickText(val text: String) : CreateOrderIntent
    data object AddItem : CreateOrderIntent
    data class RemoveItem(val id: String) : CreateOrderIntent
    data class UpdateItemName(val id: String, val name: String) : CreateOrderIntent
    data class UpdateItemQuantity(val id: String, val quantity: String) : CreateOrderIntent
    data class ToggleItemAnyStore(val id: String, val anyStore: Boolean) : CreateOrderIntent
    data class UpdateItemCustomStore(val id: String, val customStoreName: String) : CreateOrderIntent
    data class UpdateNotes(val notes: String) : CreateOrderIntent
    data class SelectRunner(val runnerId: String?) : CreateOrderIntent
    data class ToggleWaitForPreferred(val wait: Boolean) : CreateOrderIntent
    data object SubmitOrder : CreateOrderIntent
    data object DismissSuccess : CreateOrderIntent
    data object ClearError : CreateOrderIntent
    data object DismissFeeDisclosure : CreateOrderIntent
    data object ConfirmOrderSubmit : CreateOrderIntent
    data object AbandonOrder : CreateOrderIntent
}

sealed interface CreateOrderEvent {
    data class OrderCreated(val order: CreatedOrder) : CreateOrderEvent
    data class ShowToast(val message: String) : CreateOrderEvent
}

@HiltViewModel
class CreateOrderViewModel @Inject constructor(
    private val createOrderUseCase: CreateOrderUseCase,
    private val getCustomerAddressUseCase: GetCustomerAddressUseCase,
    private val getAvailableRunnersUseCase: GetAvailableRunnersUseCase,
    private val getPricingDisclosureUseCase: GetPricingDisclosureUseCase,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(CreateOrderUiState())
    val uiState: StateFlow<CreateOrderUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<CreateOrderEvent>()
    val events: SharedFlow<CreateOrderEvent> = _events.asSharedFlow()

    init {
        loadInitialData()
    }

    fun onIntent(intent: CreateOrderIntent) {
        when (intent) {
            is CreateOrderIntent.LoadInitialData -> loadInitialData()
            is CreateOrderIntent.SetInputMode -> _uiState.update { it.copy(inputMode = intent.mode, validationError = null) }
            is CreateOrderIntent.UpdateQuickText -> _uiState.update { it.copy(quickText = intent.text, validationError = null) }
            is CreateOrderIntent.AddItem -> addItem()
            is CreateOrderIntent.RemoveItem -> removeItem(intent.id)
            is CreateOrderIntent.UpdateItemName -> updateItemName(intent.id, intent.name)
            is CreateOrderIntent.UpdateItemQuantity -> updateItemQuantity(intent.id, intent.quantity)
            is CreateOrderIntent.ToggleItemAnyStore -> toggleItemAnyStore(intent.id, intent.anyStore)
            is CreateOrderIntent.UpdateItemCustomStore -> updateItemCustomStore(intent.id, intent.customStoreName)
            is CreateOrderIntent.UpdateNotes -> _uiState.update { it.copy(notes = intent.notes) }
            is CreateOrderIntent.SelectRunner -> _uiState.update { it.copy(selectedRunnerId = intent.runnerId) }
            is CreateOrderIntent.ToggleWaitForPreferred -> _uiState.update { it.copy(waitForPreferred = intent.wait) }
            is CreateOrderIntent.SubmitOrder -> submitOrder()
            is CreateOrderIntent.DismissSuccess -> {
                currentIdempotencyKey = null
                _uiState.update { it.copy(createdOrder = null) }
            }
            is CreateOrderIntent.ClearError -> _uiState.update { it.copy(errorMessage = null, validationError = null) }
            is CreateOrderIntent.DismissFeeDisclosure -> _uiState.update { it.copy(showFeeDisclosure = false) }
            is CreateOrderIntent.ConfirmOrderSubmit -> confirmOrderSubmit()
            is CreateOrderIntent.AbandonOrder -> {
                currentIdempotencyKey = null
            }
        }
    }


    private fun loadInitialData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingAddress = true, isLoadingRunners = true) }

            // 1. Load Address
            when (val addressResult = getCustomerAddressUseCase()) {
                is AddressResult.Success -> {
                    _uiState.update { it.copy(isLoadingAddress = false, deliveryAddress = addressResult.address) }
                }
                is AddressResult.NotFound -> {
                    _uiState.update { it.copy(isLoadingAddress = false, deliveryAddress = null) }
                }
                is AddressResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoadingAddress = false,
                            errorMessage = ErrorSanitizer.getGenericErrorMessage(
                                rawMessage = addressResult.message,
                                context = getApplication(),
                                fallbackResId = R.string.error_generic,
                                tag = "CreateOrderViewModel"
                            )
                        )
                    }
                }
            }

            // 2. Load Available Runners
            val runnersResult = getAvailableRunnersUseCase()
            runnersResult.fold(
                onSuccess = { runners ->
                    _uiState.update { it.copy(isLoadingRunners = false, availableRunners = runners) }
                },
                onFailure = {
                    _uiState.update { it.copy(isLoadingRunners = false) }
                }
            )
        }
    }

    fun refreshAddress() {
        viewModelScope.launch {
            when (val addressResult = getCustomerAddressUseCase()) {
                is AddressResult.Success -> {
                    _uiState.update { it.copy(isLoadingAddress = false, deliveryAddress = addressResult.address) }
                }
                is AddressResult.NotFound -> {
                    _uiState.update { it.copy(isLoadingAddress = false, deliveryAddress = null) }
                }
                is AddressResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoadingAddress = false,
                            errorMessage = ErrorSanitizer.getGenericErrorMessage(
                                rawMessage = addressResult.message,
                                context = getApplication(),
                                fallbackResId = R.string.error_generic,
                                tag = "CreateOrderViewModel"
                            )
                        )
                    }
                }
            }
        }
    }

    private fun addItem() {
        _uiState.update { state ->
            state.copy(items = state.items + OrderItem(itemName = "", quantity = "1"))
        }
    }

    private fun removeItem(id: String) {
        _uiState.update { state ->
            if (state.items.size > 1) {
                state.copy(items = state.items.filterNot { it.id == id })
            } else {
                state
            }
        }
    }

    private fun updateItemName(id: String, name: String) {
        _uiState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == id) it.copy(itemName = name) else it
                },
                validationError = null
            )
        }
    }

    private fun updateItemQuantity(id: String, quantity: String) {
        _uiState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == id) it.copy(quantity = quantity) else it
                },
                validationError = null
            )
        }
    }

    private fun toggleItemAnyStore(id: String, anyStore: Boolean) {
        _uiState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == id) it.copy(anyStore = anyStore) else it
                }
            )
        }
    }

    private fun updateItemCustomStore(id: String, customStoreName: String) {
        _uiState.update { state ->
            state.copy(
                items = state.items.map {
                    if (it.id == id) it.copy(customStoreName = customStoreName) else it
                },
                validationError = null
            )
        }
    }

    private var currentIdempotencyKey: String? = null

    val activeIdempotencyKey: String?
        get() = currentIdempotencyKey

    private val isSubmittingGuard = java.util.concurrent.atomic.AtomicBoolean(false)

    private fun validateOrderInput(): List<OrderItem>? {
        val state = _uiState.value

        // Validation
        if (state.deliveryAddress == null) {
            _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_address_missing)) }
            return null
        }

        return when (state.inputMode) {
            OrderInputMode.QUICK -> {
                val lines = state.quickText.lines()
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }

                if (lines.isEmpty()) {
                    _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_empty_items)) }
                    return null
                }

                lines.map { line ->
                    OrderItem(
                        itemName = line,
                        quantity = "1",
                        anyStore = true,
                        customStoreName = null
                    )
                }
            }
            OrderInputMode.STRUCTURED -> {
                if (state.items.isEmpty()) {
                    _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_empty_items)) }
                    return null
                }

                for (item in state.items) {
                    if (item.itemName.trim().isEmpty()) {
                        _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_item_name)) }
                        return null
                    }
                    if (item.quantity.trim().isEmpty()) {
                        _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_item_quantity_named, item.itemName)) }
                        return null
                    }
                    if (!item.anyStore && (item.customStoreName == null || item.customStoreName.trim().isEmpty())) {
                        _uiState.update { it.copy(validationError = getApplication<Application>().getString(R.string.create_order_validation_custom_store_named, item.itemName)) }
                        return null
                    }
                }

                state.items.map {
                    it.copy(
                        itemName = it.itemName.trim(),
                        quantity = it.quantity.trim(),
                        customStoreName = if (it.anyStore) null else it.customStoreName?.trim()
                    )
                }
            }
        }
    }

    private fun submitOrder() {
        if (_uiState.value.isSubmitting) {
            return
        }

        // Validate first; if invalid, show error and do NOT open modal
        validateOrderInput() ?: return

        // Open modal
        _uiState.update { it.copy(showFeeDisclosure = true, validationError = null) }

        // Fetch disclosure if not yet fetched
        fetchPricingDisclosure()
    }

    private fun fetchPricingDisclosure() {
        if (_uiState.value.disclosurePricing != null || _uiState.value.isLoadingDisclosure) {
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDisclosure = true) }
            getPricingDisclosureUseCase().fold(
                onSuccess = { pricing ->
                    _uiState.update { it.copy(isLoadingDisclosure = false, disclosurePricing = pricing) }
                },
                onFailure = {
                    // Graceful degradation: keeps disclosurePricing null, allows order creation to proceed
                    _uiState.update { it.copy(isLoadingDisclosure = false) }
                }
            )
        }
    }

    private fun confirmOrderSubmit() {
        _uiState.update { it.copy(showFeeDisclosure = false) }
        executeSubmitOrder()
    }

    private fun executeSubmitOrder() {
        if (_uiState.value.isSubmitting || !isSubmittingGuard.compareAndSet(false, true)) {
            return
        }

        val orderItems = validateOrderInput()
        if (orderItems == null) {
            isSubmittingGuard.set(false)
            return
        }

        if (currentIdempotencyKey == null) {
            currentIdempotencyKey = java.util.UUID.randomUUID().toString()
        }
        val idempotencyKey = currentIdempotencyKey

        val state = _uiState.value

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null, validationError = null) }
            try {
                val result = createOrderUseCase(
                    items = orderItems,
                    notes = state.notes,
                    preferredRunnerId = state.selectedRunnerId,
                    waitForPreferred = state.waitForPreferred,
                    deliveryAddress = state.deliveryAddress!!,
                    idempotencyKey = idempotencyKey
                )
                result.fold(
                    onSuccess = { createdOrder ->
                        currentIdempotencyKey = null
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                createdOrder = createdOrder
                            )
                        }
                        _events.emit(CreateOrderEvent.OrderCreated(createdOrder))
                    },
                    onFailure = { error ->
                        _uiState.update {
                            it.copy(
                                isSubmitting = false,
                                errorMessage = ErrorSanitizer.getGenericErrorMessage(
                                    error,
                                    context = getApplication(),
                                    fallbackResId = R.string.error_create_order_failed,
                                    tag = "CreateOrderViewModel"
                                )
                            )
                        }
                    }
                )
            } finally {
                isSubmittingGuard.set(false)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        currentIdempotencyKey = null
    }
}
