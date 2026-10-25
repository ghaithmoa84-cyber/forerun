package com.forerun.customer.ui.rating

import androidx.lifecycle.SavedStateHandle
import com.forerun.customer.R
import com.forerun.customer.data.FakeOrderRepository
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.domain.model.OrderRatingInfo
import com.forerun.customer.domain.model.OrderRunnerDetail
import com.forerun.customer.domain.model.RatingResult
import com.forerun.customer.domain.usecase.order.GetOrderDetailUseCase
import com.forerun.customer.domain.usecase.order.SubmitRatingUseCase
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
import org.junit.Assert.assertTrue
import org.junit.Before
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import java.time.Instant
import org.junit.runner.RunWith

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class RatingViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeRepository: FakeOrderRepository
    private lateinit var getOrderDetailUseCase: GetOrderDetailUseCase
    private lateinit var submitRatingUseCase: SubmitRatingUseCase

    private val recentDeliveredAt = Instant.now().minusSeconds(3600).toString() // 1 hour ago
    private val expiredDeliveredAt = Instant.now().minusSeconds(90000).toString() // 25 hours ago

    private val deliveredOrder = CustomerOrderDetail(
        id = "order_123",
        orderNumber = "FW-000123",
        status = "DELIVERED",
        isPeripheral = false,
        baseFee = 5000,
        peripheralFee = 0,
        extraStoresFee = 0,
        totalFee = 5000,
        deliveryDesc = "القنجرة",
        createdAt = "2026-09-28T10:00:00Z",
        deliveredAt = recentDeliveredAt,
        runner = OrderRunnerDetail(
            id = "runner_1",
            name = "الكابتن سمير",
            avgRating = 4.8,
            totalRatings = 15,
            status = "AVAILABLE",
            whatsapp = "0999111222",
            phone = "0999111222"
        )
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeRepository = FakeOrderRepository()
        fakeRepository.getOrderDetailResult = Result.success(deliveredOrder)

        getOrderDetailUseCase = GetOrderDetailUseCase(fakeRepository)
        submitRatingUseCase = SubmitRatingUseCase(fakeRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel(orderId: String = "order_123"): RatingViewModel {
        val savedStateHandle = SavedStateHandle(mapOf("orderId" to orderId))
        return RatingViewModel(
            savedStateHandle = savedStateHandle,
            getOrderDetailUseCase = getOrderDetailUseCase,
            submitRatingUseCase = submitRatingUseCase,
            application = ApplicationProvider.getApplicationContext()
        )
    }

    @Test
    fun loads_order_and_runner_info_on_init() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals("FW-000123", state.orderNumber)
        assertEquals("الكابتن سمير", state.runnerName)
        assertEquals(0, state.stars)
        assertFalse(state.isExpired)
        assertFalse(state.isExistingRating)
    }

    @Test
    fun setStars_and_setNote_updates_state() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(RatingIntent.SetStars(4))
        viewModel.onIntent(RatingIntent.SetNote("توصيل سريع وممتاز"))

        val state = viewModel.uiState.value
        assertEquals(4, state.stars)
        assertEquals("توصيل سريع وممتاز", state.note)
    }

    @Test
    fun validation_fails_when_stars_is_zero() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSubmitting)
        assertFalse(state.isSuccess)
        assertNotNull(state.validationError)
        assertEquals("يرجى اختيار عدد النجوم (من 1 إلى 5)", state.validationError)
    }

    @Test
    fun validation_succeeds_when_stars_is_valid() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeRepository.submitRatingResult = Result.success(
            RatingResult(
                id = "rate_99",
                orderId = "order_123",
                stars = 5,
                note = "ممتاز جداً",
                isFinal = false,
                expiresAt = null
            )
        )

        viewModel.onIntent(RatingIntent.SetStars(5))
        viewModel.onIntent(RatingIntent.SetNote("ممتاز جداً"))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSubmitting)
        assertTrue(state.isSuccess)
    }

    @Test
    fun prevents_submission_when_delivered_over_24_hours_ago() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            deliveredOrder.copy(deliveredAt = expiredDeliveredAt)
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isExpired)

        viewModel.onIntent(RatingIntent.SetStars(5))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSuccess)
        assertNotNull(state.validationError)
        assertTrue(state.validationError?.contains("انتهت مهلة التقييم") == true)
    }

    @Test
    fun allows_submission_when_within_24_hours() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.isExpired)

        viewModel.onIntent(RatingIntent.SetStars(4))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isSuccess)
    }

    @Test
    fun submits_existing_rating_as_update() = runTest(testDispatcher) {
        fakeRepository.getOrderDetailResult = Result.success(
            deliveredOrder.copy(
                rating = OrderRatingInfo(stars = 3, note = "ملاحظة سابقة")
            )
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.isExistingRating)
        assertEquals(3, state.stars)
        assertEquals("ملاحظة سابقة", state.note)

        viewModel.onIntent(RatingIntent.SetStars(5))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isSuccess)
    }

    @Test
    fun handles_rating_submission_server_error() = runTest(testDispatcher) {
        fakeRepository.submitRatingResult = Result.failure(Exception("انتهت صلاحية الجلسة"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(RatingIntent.SetStars(5))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSuccess)
        assertFalse(state.isSubmitting)
        assertEquals("انتهت صلاحية الجلسة", state.errorMessage)
    }

    @Test
    fun submitRating_double_click_invokes_useCase_only_once() = runTest(testDispatcher) {
        fakeRepository.submitRatingDelayMs = 100
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(RatingIntent.SetStars(5))

        // Simulate rapid double submit
        viewModel.onIntent(RatingIntent.Submit)
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        assertEquals(1, fakeRepository.submitRatingCallCount)
        assertFalse(viewModel.uiState.value.isSubmitting)
        assertTrue(viewModel.uiState.value.isSuccess)
    }

    @Test
    fun submitRating_technicalEnglishServerError_sanitizesToGenericArabic() = runTest(testDispatcher) {
        fakeRepository.submitRatingResult = Result.failure(Exception("HTTP 500: Database transaction rolled back"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(RatingIntent.SetStars(5))
        viewModel.onIntent(RatingIntent.Submit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSuccess)
        assertFalse(state.isSubmitting)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        assertEquals(context.getString(R.string.rating_error_submit), state.errorMessage)
    }
}