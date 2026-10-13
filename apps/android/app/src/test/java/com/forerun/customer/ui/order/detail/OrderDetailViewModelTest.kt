package com.forerun.customer.ui.order.detail

import androidx.lifecycle.SavedStateHandle
import com.forerun.customer.core.storage.FakeTokenStorage
import com.forerun.customer.core.websocket.SocketManager
import com.forerun.customer.data.gateway.SocketOrderEventsGateway
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.data.FakeOrderRepository
import com.forerun.customer.domain.model.ApiException
import com.forerun.customer.domain.model.CancelOrderError
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.domain.model.DetailOrderItem
import com.forerun.customer.domain.model.OrderRunnerDetail
import com.forerun.customer.domain.usecase.order.CancelOrderUseCase
import com.forerun.customer.domain.usecase.order.GetOrderDetailUseCase
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class OrderDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeRepository: FakeOrderRepository
    private lateinit var socketManager: SocketManager
    private lateinit var getOrderDetailUseCase: GetOrderDetailUseCase
    private lateinit var cancelOrderUseCase: CancelOrderUseCase
    private lateinit var observeOrderEventsUseCase: ObserveOrderEventsUseCase

    private val sampleOrder = CustomerOrderDetail(
        id = "order_123",
        orderNumber = "FW-000123",
        status = "PENDING_REVIEW",
        isPeripheral = false,
        baseFee = 5000,
        peripheralFee = 0,
        extraStoresFee = 0,
        totalFee = 5000,
        deliveryDesc = "القنجرة",
        createdAt = "2026-09-28T12:00:00Z",
        items = listOf(
            DetailOrderItem(id = "item_1", itemName = "سكر", quantity = "1 كغ", anyStore = true)
        ),
        runner = null
    )

    private val sampleRunner = OrderRunnerDetail(
        id = "runner_1",
        name = "الكابتن محمد",
        avgRating = 4.9,
        totalRatings = 20,
        status = "AVAILABLE",
        whatsapp = "0912345678",
        phone = "0912345678"
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeRepository = FakeOrderRepository()
        fakeRepository.getOrderDetailResult = Result.success(sampleOrder)

        socketManager = SocketManager(FakeTokenStorage())
        getOrderDetailUseCase = GetOrderDetailUseCase(fakeRepository)
        cancelOrderUseCase = CancelOrderUseCase(fakeRepository)
        observeOrderEventsUseCase = ObserveOrderEventsUseCase(SocketOrderEventsGateway(socketManager))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(orderId: String = "order_123"): OrderDetailViewModel {
        val savedStateHandle = SavedStateHandle(mapOf("orderId" to orderId))
        return OrderDetailViewModel(
            savedStateHandle = savedStateHandle,
            getOrderDetailUseCase = getOrderDetailUseCase,
            cancelOrderUseCase = cancelOrderUseCase,
            observeOrderEventsUseCase = observeOrderEventsUseCase,
            application = ApplicationProvider.getApplicationContext()
        )
    }

    @Test
    fun loads_order_detail_successfully_on_init() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertFalse(state.isRefreshing)
        assertNotNull(state.order)
        assertEquals("order_123", state.order?.id)
        assertEquals("FW-000123", state.order?.orderNumber)
        assertEquals("PENDING_REVIEW", state.order?.status)
        assertEquals(5000, state.order?.totalFee)
        assertTrue(state.canCancel)
        assertFalse(state.canContactRunner) // PENDING_REVIEW -> cannot contact runner yet
    }

    @Test
    fun handles_order_detail_loading_failure() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.failure(Exception("الطلب غير موجود"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.order)
        assertEquals("الطلب غير موجود", state.errorMessage)
    }

    @Test
    fun refreshes_order_detail() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "ASSIGNED")
        )
        viewModel.onIntent(OrderDetailIntent.Refresh)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isRefreshing)
        assertEquals("ASSIGNED", state.order?.status)
    }

    @Test
    fun handles_websocket_status_changed_event() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "IN_PROGRESS", runner = sampleRunner)
        )

        viewModel.handleWebSocketEvent(
            WebSocketEvent.StatusChanged(
                orderId = "order_123",
                orderNumber = "FW-000123",
                oldStatus = "ASSIGNED",
                newStatus = "IN_PROGRESS"
            )
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("IN_PROGRESS", state.order?.status)
        assertFalse(state.canCancel) // IN_PROGRESS cannot be cancelled
        assertTrue(state.canContactRunner)
    }

    @Test
    fun canCancel_true_while_awaiting_preferred_runner() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "AWAITING_PREFERRED_RUNNER")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.canCancel)
    }

    @Test
    fun canCancel_true_while_awaiting_runner() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "AWAITING_RUNNER")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.canCancel)
    }

    @Test
    fun canCancel_false_while_under_review() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "UNDER_REVIEW")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.canCancel)
    }

    @Test
    fun handles_websocket_fee_updated_event() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(totalFee = 8000)
        )

        viewModel.handleWebSocketEvent(
            WebSocketEvent.FeeUpdated(
                orderId = "order_123",
                oldFee = 5000,
                newFee = 8000,
                reason = "EXTRA_STORE"
            )
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(8000, state.order?.totalFee)
        assertTrue(state.feeUpdatedNotice)
    }

    @Test
    fun handles_websocket_out_for_delivery_event() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "OUT_FOR_DELIVERY")
        )

        viewModel.handleWebSocketEvent(
            WebSocketEvent.OutForDelivery(orderId = "order_123")
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("OUT_FOR_DELIVERY", state.order?.status)
    }

    @Test
    fun handles_websocket_delivered_event() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        val recentDeliveredAt = java.time.Instant.now().toString()
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", deliveredAt = recentDeliveredAt)
        )

        viewModel.handleWebSocketEvent(
            WebSocketEvent.Delivered(
                orderId = "order_123",
                deliveredAt = recentDeliveredAt
            )
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("DELIVERED", state.order?.status)
        assertEquals(recentDeliveredAt, state.order?.deliveredAt)
        assertTrue(state.canRate)
    }

    @Test
    fun handles_websocket_cancelled_event() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "CANCELLED", cancelReason = "إلغاء بواسطة الإدارة")
        )

        viewModel.handleWebSocketEvent(
            WebSocketEvent.Cancelled(
                orderId = "order_123",
                reason = "إلغاء بواسطة الإدارة",
                cancelledBy = "ADMIN"
            )
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("CANCELLED", state.order?.status)
        assertEquals("إلغاء بواسطة الإدارة", state.order?.cancelReason)
        assertFalse(state.canCancel)
    }

    @Test
    fun shows_and_dismisses_cancel_dialog() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(OrderDetailIntent.ShowCancelDialog(true))
        assertTrue(viewModel.uiState.value.showCancelDialog)

        viewModel.onIntent(OrderDetailIntent.ShowCancelDialog(false))
        assertFalse(viewModel.uiState.value.showCancelDialog)
    }

    @Test
    fun cancels_order_successfully() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.cancelOrderResult = Result.success(Unit)
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "CANCELLED")
        )

        viewModel.onIntent(OrderDetailIntent.ConfirmCancel)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.cancelSuccess)
        assertFalse(state.isCancelling)
        assertFalse(state.showCancelDialog)
        assertEquals("CANCELLED", state.order?.status)
    }

    @Test
    fun handles_cancel_order_error() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.cancelOrderResult = Result.failure(
            ApiException(statusCode = 422, errorCode = "BUSINESS_RULE_VIOLATION")
        )

        viewModel.onIntent(OrderDetailIntent.ConfirmCancel)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.cancelSuccess)
        assertFalse(state.isCancelling)
        assertEquals(CancelOrderError.NotAllowed, state.cancelError)
    }

    @Test
    fun handles_cancel_order_conflict_error() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.cancelOrderResult = Result.failure(
            ApiException(statusCode = 409, errorCode = "CONFLICT")
        )

        viewModel.onIntent(OrderDetailIntent.ConfirmCancel)
        advanceUntilIdle()

        assertEquals(CancelOrderError.StateChanged, viewModel.uiState.value.cancelError)
    }

    @Test
    fun handles_cancel_order_network_error() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.cancelOrderResult = Result.failure(
            ApiException(statusCode = -1, errorCode = "NETWORK_ERROR")
        )

        viewModel.onIntent(OrderDetailIntent.ConfirmCancel)
        advanceUntilIdle()

        assertEquals(CancelOrderError.Network, viewModel.uiState.value.cancelError)
    }

    @Test
    fun canContactRunner_reflects_server_contact_fields() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        // PENDING_REVIEW with runner = null -> cannot contact runner
        assertFalse(viewModel.uiState.value.canContactRunner)
        assertTrue(viewModel.uiState.value.isAwaitingRunner)

        // ASSIGNED with contact numbers -> can contact
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "ASSIGNED", runner = sampleRunner)
        )
        viewModel.onIntent(OrderDetailIntent.Refresh)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.canContactRunner)
        assertFalse(viewModel.uiState.value.isAwaitingRunner)

        // DELIVERED with masked contact numbers (D35) -> cannot contact
        val maskedRunner = sampleRunner.copy(whatsapp = null, phone = null)
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", runner = maskedRunner)
        )
        viewModel.onIntent(OrderDetailIntent.Refresh)
        advanceUntilIdle()
        assertFalse(viewModel.uiState.value.canContactRunner)
    }

    @Test
    fun canRate_false_when_order_not_delivered() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals("PENDING_REVIEW", viewModel.uiState.value.order?.status)
        assertFalse(viewModel.uiState.value.canRate)
    }

    @Test
    fun canRate_true_when_delivered_without_deliveredAt() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", deliveredAt = null)
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.canRate)
    }

    @Test
    fun canRate_false_when_24h_window_expired() = runTest(testDispatcher) {
        val expired = java.time.Instant.now()
            .minus(25, java.time.temporal.ChronoUnit.HOURS)
            .toString()
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", deliveredAt = expired)
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals("DELIVERED", viewModel.uiState.value.order?.status)
        assertFalse(viewModel.uiState.value.canRate)
    }

    @Test
    fun canRate_true_when_delivered_within_24h_window() = runTest(testDispatcher) {
        val recent = java.time.Instant.now()
            .minus(2, java.time.temporal.ChronoUnit.HOURS)
            .toString()
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", deliveredAt = recent)
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.canRate)
    }

    @Test
    fun canRate_true_when_deliveredAt_is_unparseable() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            sampleOrder.copy(status = "DELIVERED", deliveredAt = "not-a-date")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.canRate)
    }
}