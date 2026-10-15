package com.forerun.customer.ui.home

import com.forerun.customer.data.FakeAuthRepository
import com.forerun.customer.data.FakeHomeRepository
import com.forerun.customer.data.FakeOrderEventsGateway
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.model.OrderStatus
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.model.HomeData
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.domain.usecase.GetHomeDataUseCase
import com.forerun.customer.domain.usecase.LogoutUseCase
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class HomeViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeHomeRepository: FakeHomeRepository
    private lateinit var fakeAuthRepository: FakeAuthRepository
    private lateinit var fakeOrderEventsGateway: FakeOrderEventsGateway
    private lateinit var getHomeDataUseCase: GetHomeDataUseCase
    private lateinit var logoutUseCase: LogoutUseCase
    private lateinit var observeOrderEventsUseCase: ObserveOrderEventsUseCase
    private lateinit var viewModel: HomeViewModel

    @Before
    fun setup() {
        fakeHomeRepository = FakeHomeRepository()
        fakeAuthRepository = FakeAuthRepository()
        fakeOrderEventsGateway = FakeOrderEventsGateway()
        getHomeDataUseCase = GetHomeDataUseCase(fakeHomeRepository)
        logoutUseCase = LogoutUseCase(fakeAuthRepository)
        observeOrderEventsUseCase = ObserveOrderEventsUseCase(fakeOrderEventsGateway)
    }

    @Test
    fun loadHomeData_success_without_active_orders() = runTest {
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(
                profile = CustomerProfile(
                    id = "c1",
                    name = "عمر",
                    whatsapp = "0988888888",
                    altPhone = null,
                    status = UserStatus.VERIFIED,
                    completedOrders = 12,
                    totalFeesPaid = 60000
                ),
                activeOrder = null
            )
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())

        val state = viewModel.uiState.value
        assertTrue("State should be Success", state is HomeUiState.Success)
        val success = state as HomeUiState.Success
        assertEquals("عمر", success.profile.name)
        assertEquals(12, success.profile.completedOrders)
        assertNull(success.activeOrder)
    }

    @Test
    fun loadHomeData_success_with_active_order() = runTest {
        val testOrder = ActiveOrder(
            id = "o1",
            orderNumber = "FAW-1001",
            status = "OUT_FOR_DELIVERY",
            totalFee = 4500,
            itemCount = 3,
            createdAt = "2026-09-28T10:00:00Z",
            runnerName = "أبو حيدر",
            runnerWhatsapp = "0999000002"
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(
                profile = CustomerProfile(
                    id = "c1",
                    name = "عمر",
                    whatsapp = "0988888888",
                    altPhone = null,
                    status = UserStatus.VERIFIED,
                    completedOrders = 5,
                    totalFeesPaid = 20000
                ),
                activeOrder = testOrder
            )
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())

        val state = viewModel.uiState.value
        assertTrue("State should be Success", state is HomeUiState.Success)
        val success = state as HomeUiState.Success
        assertEquals("عمر", success.profile.name)
        assertEquals("FAW-1001", success.activeOrder?.orderNumber)
        assertEquals("أبو حيدر", success.activeOrder?.runnerName)
        assertEquals(4500, success.activeOrder?.totalFee)
    }

    @Test
    fun loadHomeData_network_error_sets_error_state() = runTest {
        fakeHomeRepository.homeDataResult = Result.failure(
            Exception("تعذر الاتصال بالخادم")
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())

        val state = viewModel.uiState.value
        assertTrue("State should be Error", state is HomeUiState.Error)
        val error = state as HomeUiState.Error
        assertEquals("تعذر الاتصال بالخادم", error.message)
    }

    @Test
    fun onIntent_refresh_updates_home_data() = runTest {
        val initialProfile = CustomerProfile(
            id = "c1",
            name = "عمر",
            whatsapp = "0988888888",
            altPhone = null,
            status = UserStatus.VERIFIED,
            completedOrders = 0,
            totalFeesPaid = 0
        )
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = initialProfile, activeOrder = null)
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())
        assertEquals(0, (viewModel.uiState.value as HomeUiState.Success).profile.completedOrders)

        val updatedProfile = initialProfile.copy(completedOrders = 1)
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = updatedProfile, activeOrder = null)
        )

        viewModel.onIntent(HomeIntent.Refresh)

        val refreshedState = viewModel.uiState.value
        assertTrue(refreshedState is HomeUiState.Success)
        val success = refreshedState as HomeUiState.Success
        assertEquals(1, success.profile.completedOrders)
        assertEquals(false, success.isRefreshing)
    }

    @Test
    fun loadHomeData_withActiveOrder_includesRunnerPhoneAndDetails() = runTest {
        val testOrder = ActiveOrder(
            id = "o2",
            orderNumber = "FAW-2002",
            status = "IN_PROGRESS",
            totalFee = 6000,
            itemCount = 2,
            createdAt = "2026-09-29T11:00:00Z",
            runnerName = "الكابتن باسل",
            runnerWhatsapp = "0981571936",
            runnerPhone = "0981571936"
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(
                profile = CustomerProfile(
                    id = "c1",
                    name = "علي",
                    whatsapp = "0988888888",
                    altPhone = null,
                    status = UserStatus.VERIFIED,
                    completedOrders = 3,
                    totalFeesPaid = 12000
                ),
                activeOrder = testOrder
            )
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())

        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Success)
        val success = state as HomeUiState.Success
        assertEquals("FAW-2002", success.activeOrder?.orderNumber)
        assertEquals("الكابتن باسل", success.activeOrder?.runnerName)
        assertEquals("0981571936", success.activeOrder?.runnerWhatsapp)
        assertEquals("0981571936", success.activeOrder?.runnerPhone)
    }

    @Test
    fun loadHomeData_withActiveOrder_nullRunnerPhone_handledGracefully() = runTest {
        val testOrder = ActiveOrder(
            id = "o3",
            orderNumber = "FAW-3003",
            status = "OUT_FOR_DELIVERY",
            totalFee = 3500,
            itemCount = 1,
            createdAt = "2026-09-29T12:00:00Z",
            runnerName = "الكابتن سمير",
            runnerWhatsapp = "0988112233",
            runnerPhone = null
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(
                profile = CustomerProfile(
                    id = "c1",
                    name = "مريم",
                    whatsapp = "0988888888",
                    altPhone = null,
                    status = UserStatus.VERIFIED,
                    completedOrders = 8,
                    totalFeesPaid = 35000
                ),
                activeOrder = testOrder
            )
        )

        viewModel = HomeViewModel(getHomeDataUseCase, logoutUseCase, ApplicationProvider.getApplicationContext())

        val state = viewModel.uiState.value
        assertTrue(state is HomeUiState.Success)
        val success = state as HomeUiState.Success
        assertEquals("FAW-3003", success.activeOrder?.orderNumber)
        assertNull(success.activeOrder?.runnerPhone)
    }

    @Test
    fun webSocketEvent_orderStatusChanged_updates_activeOrder_immediately_and_silently_refreshes() = runTest {
        val testOrder = ActiveOrder(
            id = "o1",
            orderNumber = "FAW-1001",
            status = "AWAITING_RUNNER",
            totalFee = 4500,
            itemCount = 3,
            createdAt = "2026-09-28T10:00:00Z"
        )

        val profile = CustomerProfile(
            id = "c1",
            name = "عمر",
            whatsapp = "0988888888",
            altPhone = null,
            status = UserStatus.VERIFIED,
            completedOrders = 5,
            totalFeesPaid = 20000
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        val initialSuccess = viewModel.uiState.value as HomeUiState.Success
        assertEquals("AWAITING_RUNNER", initialSuccess.activeOrder?.status)

        // Update repository response to simulate server data for silent refresh
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder.copy(status = "ASSIGNED", runnerName = "كابتن أحمد"))
        )

        // Emit WebSocket event for the active order
        fakeOrderEventsGateway.emitEvent(
            WebSocketEvent.OrderStatusChanged(
                orderId = "o1",
                status = OrderStatus.ASSIGNED,
                orderNumber = "FAW-1001",
                oldStatus = "AWAITING_RUNNER"
            )
        )

        val updatedState = viewModel.uiState.value
        assertTrue(updatedState is HomeUiState.Success)
        val success = updatedState as HomeUiState.Success
        assertEquals("ASSIGNED", success.activeOrder?.status)
        assertEquals("كابتن أحمد", success.activeOrder?.runnerName)
        assertEquals(false, success.isRefreshing)
    }

    @Test
    fun webSocketEvent_runnerAssigned_updates_runnerName() = runTest {
        val testOrder = ActiveOrder(
            id = "o1",
            orderNumber = "FAW-1001",
            status = "AWAITING_RUNNER",
            totalFee = 4500,
            itemCount = 3,
            createdAt = "2026-09-28T10:00:00Z",
            runnerName = null
        )

        val profile = CustomerProfile("c1", "عمر", "0988888888", null, UserStatus.VERIFIED, 5, 20000)

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        // Server has assigned runner
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder.copy(runnerName = "الكابتن باسل"))
        )

        fakeOrderEventsGateway.emitEvent(
            WebSocketEvent.RunnerAssigned(
                orderId = "o1",
                runnerName = "الكابتن باسل"
            )
        )

        val success = viewModel.uiState.value as HomeUiState.Success
        assertEquals("الكابتن باسل", success.activeOrder?.runnerName)
    }

    @Test
    fun webSocketEvent_feeUpdated_updates_totalFee() = runTest {
        val testOrder = ActiveOrder(
            id = "o1",
            orderNumber = "FAW-1001",
            status = "IN_PROGRESS",
            totalFee = 4500,
            itemCount = 3,
            createdAt = "2026-09-28T10:00:00Z"
        )

        val profile = CustomerProfile("c1", "عمر", "0988888888", null, UserStatus.VERIFIED, 5, 20000)

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        // Server has updated the fee
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder.copy(totalFee = 6500))
        )

        fakeOrderEventsGateway.emitEvent(
            WebSocketEvent.FeeUpdated(
                orderId = "o1",
                oldFee = 4500,
                newFee = 6500,
                reason = "إضافة متجر إضافي"
            )
        )

        val success = viewModel.uiState.value as HomeUiState.Success
        assertEquals(6500, success.activeOrder?.totalFee)
    }

    @Test
    fun webSocketEvent_delivered_whenCompleted_clears_activeOrder() = runTest {
        val testOrder = ActiveOrder(
            id = "o1",
            orderNumber = "FAW-1001",
            status = "OUT_FOR_DELIVERY",
            totalFee = 4500,
            itemCount = 3,
            createdAt = "2026-09-28T10:00:00Z"
        )

        val profile = CustomerProfile("c1", "عمر", "0988888888", null, UserStatus.VERIFIED, 5, 20000)

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = testOrder)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        assertEquals("o1", (viewModel.uiState.value as HomeUiState.Success).activeOrder?.id)

        // After delivery, repository returns no active orders
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile.copy(completedOrders = 6), activeOrder = null)
        )

        fakeOrderEventsGateway.emitEvent(
            WebSocketEvent.Delivered(
                orderId = "o1",
                deliveredAt = "2026-09-28T12:00:00Z"
            )
        )

        val success = viewModel.uiState.value as HomeUiState.Success
        assertNull("activeOrder should become null once delivered", success.activeOrder)
        assertEquals(6, success.profile.completedOrders)
    }

    @Test
    fun webSocketEvent_whenNoActiveOrder_triggers_silent_refresh_to_load_new_order() = runTest {
        val profile = CustomerProfile("c1", "عمر", "0988888888", null, UserStatus.VERIFIED, 5, 20000)

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = null)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        assertNull((viewModel.uiState.value as HomeUiState.Success).activeOrder)

        val newOrder = ActiveOrder(
            id = "new_o9",
            orderNumber = "FAW-9999",
            status = "PENDING_REVIEW",
            totalFee = 5000,
            itemCount = 1,
            createdAt = "2026-09-28T13:00:00Z"
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = profile, activeOrder = newOrder)
        )

        // Emit an event for a newly submitted order
        fakeOrderEventsGateway.emitEvent(
            WebSocketEvent.OrderStatusChanged(
                orderId = "new_o9",
                status = OrderStatus.PENDING_REVIEW,
                orderNumber = "FAW-9999"
            )
        )

        val success = viewModel.uiState.value as HomeUiState.Success
        assertEquals("new_o9", success.activeOrder?.id)
        assertEquals("FAW-9999", success.activeOrder?.orderNumber)
    }

    @Test
    fun refreshSilently_updates_data_without_setting_isRefreshing_true() = runTest {
        val initialProfile = CustomerProfile("c1", "عمر", "0988888888", null, UserStatus.VERIFIED, 0, 0)
        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = initialProfile, activeOrder = null)
        )

        viewModel = HomeViewModel(
            getHomeDataUseCase,
            logoutUseCase,
            observeOrderEventsUseCase,
            ApplicationProvider.getApplicationContext()
        )

        fakeHomeRepository.homeDataResult = Result.success(
            HomeData(profile = initialProfile.copy(completedOrders = 2), activeOrder = null)
        )

        viewModel.refreshSilently()

        val success = viewModel.uiState.value as HomeUiState.Success
        assertEquals(2, success.profile.completedOrders)
        assertEquals("isRefreshing must remain false during silent refresh", false, success.isRefreshing)
    }
}