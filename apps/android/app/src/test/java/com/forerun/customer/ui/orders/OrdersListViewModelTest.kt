package com.forerun.customer.ui.orders

import com.forerun.customer.data.FakeOrderRepository
import com.forerun.customer.domain.model.CustomerOrder
import com.forerun.customer.domain.model.OrdersPage
import com.forerun.customer.domain.usecase.GetCustomerOrdersUseCase
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
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class OrdersListViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeRepository: FakeOrderRepository
    private lateinit var getOrdersUseCase: GetCustomerOrdersUseCase

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeRepository = FakeOrderRepository()
        getOrdersUseCase = GetCustomerOrdersUseCase(fakeRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun initialLoad_loadsOrdersSuccessfully() = runTest(testDispatcher) {
        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertFalse(state.isRefreshing)
        assertEquals(1, state.allOrders.size)
        assertEquals(1, state.displayedOrders.size)
        assertEquals("FW-000015", state.displayedOrders[0].orderNumber)
        assertEquals(80, state.displayedOrders[0].totalFee)
        assertEquals(1, state.activeCount)
    }

    @Test
    fun filterSwitching_filtersOrdersCorrectly() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_1",
                        orderNumber = "FW-000015",
                        status = "PENDING_REVIEW",
                        totalFee = 80,
                        itemCount = 3,
                        createdAt = "2026-09-28T12:00:00.000Z"
                    ),
                    CustomerOrder(
                        id = "order_2",
                        orderNumber = "FW-000014",
                        status = "DELIVERED",
                        totalFee = 100,
                        itemCount = 2,
                        createdAt = "2026-09-27T10:00:00.000Z"
                    ),
                    CustomerOrder(
                        id = "order_3",
                        orderNumber = "FW-000013",
                        status = "CANCELLED",
                        totalFee = 50,
                        itemCount = 1,
                        createdAt = "2026-09-26T08:00:00.000Z"
                    )
                ),
                total = 3,
                page = 1,
                limit = 20,
                totalPages = 1
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        // 1. ALL Filter
        assertEquals(3, vm.uiState.value.displayedOrders.size)
        assertEquals(1, vm.uiState.value.activeCount)

        // 2. ACTIVE Filter
        vm.onIntent(OrdersListIntent.SetFilter(OrderFilter.ACTIVE))
        assertEquals(1, vm.uiState.value.displayedOrders.size)
        assertEquals("FW-000015", vm.uiState.value.displayedOrders[0].orderNumber)

        // 3. DELIVERED Filter
        vm.onIntent(OrdersListIntent.SetFilter(OrderFilter.DELIVERED))
        assertEquals(1, vm.uiState.value.displayedOrders.size)
        assertEquals("FW-000014", vm.uiState.value.displayedOrders[0].orderNumber)

        // 4. CANCELLED Filter
        vm.onIntent(OrdersListIntent.SetFilter(OrderFilter.CANCELLED))
        assertEquals(1, vm.uiState.value.displayedOrders.size)
        assertEquals("FW-000013", vm.uiState.value.displayedOrders[0].orderNumber)
    }

    @Test
    fun refresh_reloadsOrdersList() = runTest(testDispatcher) {
        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_updated",
                        orderNumber = "FW-000016",
                        status = "IN_PROGRESS",
                        totalFee = 120,
                        itemCount = 5,
                        createdAt = "2026-09-28T14:00:00.000Z"
                    )
                ),
                total = 1,
                page = 1,
                limit = 20,
                totalPages = 1
            )
        )

        vm.onIntent(OrdersListIntent.Refresh)
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isRefreshing)
        assertEquals(1, state.allOrders.size)
        assertEquals("FW-000016", state.allOrders[0].orderNumber)
    }

    @Test
    fun loadMore_appendsOrdersWhenMorePagesAvailable() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p1",
                        orderNumber = "FW-000015",
                        status = "PENDING_REVIEW",
                        totalFee = 80,
                        itemCount = 3,
                        createdAt = "2026-09-28T12:00:00.000Z"
                    )
                ),
                total = 2,
                page = 1,
                limit = 1,
                totalPages = 2
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        assertTrue(vm.uiState.value.hasMore)

        // Page 2
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p2",
                        orderNumber = "FW-000014",
                        status = "DELIVERED",
                        totalFee = 100,
                        itemCount = 2,
                        createdAt = "2026-09-27T10:00:00.000Z"
                    )
                ),
                total = 2,
                page = 2,
                limit = 1,
                totalPages = 2
            )
        )

        vm.onIntent(OrdersListIntent.LoadMore)
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(2, state.allOrders.size)
        assertEquals("FW-000015", state.allOrders[0].orderNumber)
        assertEquals("FW-000014", state.allOrders[1].orderNumber)
        assertFalse(state.hasMore)
    }

    @Test
    fun initialLoad_failure_setsErrorMessage() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        val state = vm.uiState.value
        assertFalse(state.isLoading)
        assertNotNull(state.errorMessage)
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_network), state.errorMessage)
        assertEquals(0, state.allOrders.size)
    }

    @Test
    fun initialLoad_failure_withEmptyList_triggersErrorStateNotEmptyState() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        val state = vm.uiState.value
        // OrdersErrorState requires both: an error present AND an empty list
        assertNotNull(state.errorMessage)
        assertTrue(state.displayedOrders.isEmpty())
    }

    @Test
    fun retry_afterFailure_clearsErrorAndPopulatesOrders() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()
        assertNotNull(vm.uiState.value.errorMessage)
        assertTrue(vm.uiState.value.displayedOrders.isEmpty())

        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_retry",
                        orderNumber = "FW-000020",
                        status = "PENDING_REVIEW",
                        totalFee = 90,
                        itemCount = 2,
                        createdAt = "2026-09-29T10:00:00.000Z"
                    )
                ),
                total = 1,
                page = 1,
                limit = 20,
                totalPages = 1
            )
        )

        vm.onIntent(OrdersListIntent.LoadInitial)
        advanceUntilIdle()

        val state = vm.uiState.value
        assertNull(state.errorMessage)
        assertEquals(1, state.displayedOrders.size)
        assertEquals("FW-000020", state.displayedOrders[0].orderNumber)
    }

    @Test
    fun loadMore_failure_setsLoadMoreErrorAndKeepsList() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p1",
                        orderNumber = "FW-000015",
                        status = "PENDING_REVIEW",
                        totalFee = 80,
                        itemCount = 3,
                        createdAt = "2026-09-28T12:00:00.000Z"
                    )
                ),
                total = 2,
                page = 1,
                limit = 1,
                totalPages = 2
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))
        vm.onIntent(OrdersListIntent.LoadMore)
        advanceUntilIdle()

        val state = vm.uiState.value
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals(context.getString(R.string.error_network), state.loadMoreError)
        assertNull(state.errorMessage)
        assertEquals(1, state.allOrders.size)
        assertTrue(state.hasMore)
    }

    @Test
    fun loadMore_doesNotAutoRetryAfterFailure_noRetryStorm() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p1",
                        orderNumber = "FW-000015",
                        status = "PENDING_REVIEW",
                        totalFee = 80,
                        itemCount = 3,
                        createdAt = "2026-09-28T12:00:00.000Z"
                    )
                ),
                total = 2,
                page = 1,
                limit = 1,
                totalPages = 2
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()
        val callsBeforeFailure = fakeRepository.getCustomerOrdersCallCount

        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))
        vm.onIntent(OrdersListIntent.LoadMore)
        advanceUntilIdle()
        val callsAfterFirstFailure = fakeRepository.getCustomerOrdersCallCount

        // The scroll listener would keep firing LoadMore; each must be a no-op.
        repeat(5) { vm.onIntent(OrdersListIntent.LoadMore) }
        advanceUntilIdle()

        assertEquals(
            callsAfterFirstFailure,
            fakeRepository.getCustomerOrdersCallCount
        )
        assertEquals(1, callsAfterFirstFailure - callsBeforeFailure)
        assertNotNull(vm.uiState.value.loadMoreError)
    }

    @Test
    fun retryLoadMore_afterFailure_recoversAndClearsError() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p1",
                        orderNumber = "FW-000015",
                        status = "PENDING_REVIEW",
                        totalFee = 80,
                        itemCount = 3,
                        createdAt = "2026-09-28T12:00:00.000Z"
                    )
                ),
                total = 2,
                page = 1,
                limit = 1,
                totalPages = 2
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))
        vm.onIntent(OrdersListIntent.LoadMore)
        advanceUntilIdle()
        assertNotNull(vm.uiState.value.loadMoreError)

        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_p2",
                        orderNumber = "FW-000014",
                        status = "DELIVERED",
                        totalFee = 100,
                        itemCount = 2,
                        createdAt = "2026-09-27T10:00:00.000Z"
                    )
                ),
                total = 2,
                page = 2,
                limit = 1,
                totalPages = 2
            )
        )
        vm.onIntent(OrdersListIntent.RetryLoadMore)
        advanceUntilIdle()

        val state = vm.uiState.value
        assertNull(state.loadMoreError)
        assertEquals(2, state.allOrders.size)
    }

    @Test
    fun initialLoad_failure_withFilterMatchingNothing_keepsLoadedOrders() = runTest(testDispatcher) {
        fakeRepository.getCustomerOrdersResult = Result.success(
            OrdersPage(
                orders = listOf(
                    CustomerOrder(
                        id = "order_d1",
                        orderNumber = "FW-000014",
                        status = "DELIVERED",
                        totalFee = 100,
                        itemCount = 2,
                        createdAt = "2026-09-27T10:00:00.000Z"
                    )
                ),
                total = 1,
                page = 1,
                limit = 20,
                totalPages = 1
            )
        )

        val vm = OrdersListViewModel(getOrdersUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        vm.onIntent(OrdersListIntent.SetFilter(OrderFilter.ACTIVE))
        assertTrue(vm.uiState.value.displayedOrders.isEmpty())
        assertFalse(vm.uiState.value.allOrders.isEmpty())

        fakeRepository.getCustomerOrdersResult = Result.failure(Exception("Network Timeout"))
        vm.onIntent(OrdersListIntent.Refresh)
        advanceUntilIdle()

        val state = vm.uiState.value
        // OrdersErrorState keys on allOrders.isEmpty(); orders are still loaded.
        assertFalse(state.allOrders.isEmpty())
        assertEquals(1, state.allOrders.size)
    }
}