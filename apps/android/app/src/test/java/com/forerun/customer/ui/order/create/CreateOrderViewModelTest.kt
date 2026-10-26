package com.forerun.customer.ui.order.create

import com.forerun.customer.R
import com.forerun.customer.data.FakeAddressRepository
import com.forerun.customer.data.FakeOrderRepository
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.usecase.CreateOrderUseCase
import com.forerun.customer.domain.usecase.GetAvailableRunnersUseCase
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.order.GetPricingDisclosureUseCase
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
class CreateOrderViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeOrderRepository: FakeOrderRepository
    private lateinit var fakeAddressRepository: FakeAddressRepository
    private lateinit var createOrderUseCase: CreateOrderUseCase
    private lateinit var getCustomerAddressUseCase: GetCustomerAddressUseCase
    private lateinit var getAvailableRunnersUseCase: GetAvailableRunnersUseCase
    private lateinit var getPricingDisclosureUseCase: GetPricingDisclosureUseCase

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeOrderRepository = FakeOrderRepository()
        fakeAddressRepository = FakeAddressRepository()
        createOrderUseCase = CreateOrderUseCase(fakeOrderRepository)
        getCustomerAddressUseCase = GetCustomerAddressUseCase(fakeAddressRepository)
        getAvailableRunnersUseCase = GetAvailableRunnersUseCase(fakeOrderRepository)
        getPricingDisclosureUseCase = GetPricingDisclosureUseCase(fakeOrderRepository)
    }

    private fun createViewModel(): CreateOrderViewModel {
        return CreateOrderViewModel(
            createOrderUseCase,
            getCustomerAddressUseCase,
            getAvailableRunnersUseCase,
            getPricingDisclosureUseCase,
            ApplicationProvider.getApplicationContext()
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun loadInitialData_loadsAddressAndRunners() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoadingAddress)
        assertFalse(state.isLoadingRunners)
        assertEquals("بسنادا", state.deliveryAddress?.description)
        assertEquals(1, state.availableRunners.size)
        assertEquals("الكابتن أحمد", state.availableRunners.first().name)
    }

    @Test
    fun setInputMode_updatesState() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals(OrderInputMode.QUICK, viewModel.uiState.value.inputMode)
        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        assertEquals(OrderInputMode.STRUCTURED, viewModel.uiState.value.inputMode)
        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        assertEquals(OrderInputMode.QUICK, viewModel.uiState.value.inputMode)
    }

    @Test
    fun updateQuickText_updatesState() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals("", viewModel.uiState.value.quickText)
        val text = "حليب 2 لتر\nخبز سياحي 3 ربطات"
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText(text))
        assertEquals(text, viewModel.uiState.value.quickText)
    }

    @Test
    fun submitOrder_quickMode_parsesLinesCorrectly_andSubmits() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "القنجرة - الحارة الغربية")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("حليب نيدو 2 كغ\nخبز 3 ربطات\nشاي لبتون"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSubmitting)
        assertNull(state.validationError)
        assertNotNull(state.createdOrder)
        assertEquals("ORD-001", state.createdOrder?.orderNumber)

        // Verify sent items through fake repository
        val submittedItems = fakeOrderRepository.lastCreatedItems
        assertNotNull(submittedItems)
        assertEquals(3, submittedItems?.size)
        assertEquals("حليب نيدو 2 كغ", submittedItems?.get(0)?.itemName)
        assertEquals("1", submittedItems?.get(0)?.quantity)
        assertTrue(submittedItems?.get(0)?.anyStore == true)
        assertNull(submittedItems?.get(0)?.customStoreName)

        assertEquals("خبز 3 ربطات", submittedItems?.get(1)?.itemName)
        assertEquals("1", submittedItems?.get(1)?.quantity)

        assertEquals("شاي لبتون", submittedItems?.get(2)?.itemName)
        assertEquals("1", submittedItems?.get(2)?.quantity)
    }

    @Test
    fun submitOrder_quickMode_trimsAndFiltersBlankLines() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "القنجرة")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("\n   موز 1 كغ   \n\n   تفاح 2 كغ \n  \n"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val submittedItems = fakeOrderRepository.lastCreatedItems
        assertNotNull(submittedItems)
        assertEquals(2, submittedItems?.size)
        assertEquals("موز 1 كغ", submittedItems?.get(0)?.itemName)
        assertEquals("تفاح 2 كغ", submittedItems?.get(1)?.itemName)
    }

    @Test
    fun submitOrder_quickMode_failsValidation_whenQuickTextIsEmpty() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "القنجرة")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText(""))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
        assertNull(state.createdOrder)
    }

    @Test
    fun submitOrder_quickMode_failsValidation_whenQuickTextHasOnlyWhitespaceOrNewlines() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "القنجرة")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("   \n\n   \n\t  "))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
    }

    @Test
    fun submitOrder_quickMode_failsValidation_whenAddressMissing() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("حليب 1 لتر"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
        assertNull(state.createdOrder)
    }

    @Test
    fun addItem_increasesItemsCount() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals(1, viewModel.uiState.value.items.size)
        viewModel.onIntent(CreateOrderIntent.AddItem)
        assertEquals(2, viewModel.uiState.value.items.size)
    }

    @Test
    fun removeItem_removesItemWhenMultipleExist() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.AddItem)
        val firstItemId = viewModel.uiState.value.items[0].id
        assertEquals(2, viewModel.uiState.value.items.size)

        viewModel.onIntent(CreateOrderIntent.RemoveItem(firstItemId))
        assertEquals(1, viewModel.uiState.value.items.size)
    }

    @Test
    fun removeItem_doesNotRemoveLastItem() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        val singleItemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.RemoveItem(singleItemId))
        assertEquals(1, viewModel.uiState.value.items.size)
    }

    @Test
    fun updateItemFields_updatesCorrectItem() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "سكر"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "2 كغ"))
        viewModel.onIntent(CreateOrderIntent.ToggleItemAnyStore(itemId, false))
        viewModel.onIntent(CreateOrderIntent.UpdateItemCustomStore(itemId, "بقالية السلام"))

        val item = viewModel.uiState.value.items[0]
        assertEquals("سكر", item.itemName)
        assertEquals("2 كغ", item.quantity)
        assertFalse(item.anyStore)
        assertEquals("بقالية السلام", item.customStoreName)
    }

    @Test
    fun submitOrder_failsValidation_whenAddressMissing() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "سكر"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "1 كغ"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
        assertNull(state.createdOrder)
    }

    @Test
    fun submitOrder_failsValidation_whenItemNameEmpty() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "1 كغ"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
    }

    @Test
    fun submitOrder_failsValidation_whenItemQuantityEmpty() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "حليب"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, ""))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
    }

    @Test
    fun submitOrder_failsValidation_whenCustomStoreEmptyAndNotAnyStore() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "حليب"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "1 علبة"))
        viewModel.onIntent(CreateOrderIntent.ToggleItemAnyStore(itemId, false))
        viewModel.onIntent(CreateOrderIntent.UpdateItemCustomStore(itemId, "  "))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.validationError)
        assertFalse(state.isSubmitting)
    }

    @Test
    fun submitOrder_succeeds_whenInputIsValid() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "سكر"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "2 كغ"))
        viewModel.onIntent(CreateOrderIntent.UpdateNotes("يرجى التأكد من نظافة الكيس"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        // Modal intercepted before createOrderUseCase
        assertTrue(viewModel.uiState.value.showFeeDisclosure)
        assertNull(viewModel.uiState.value.createdOrder)
        assertEquals(0, fakeOrderRepository.createOrderCallCount)

        // Confirm inside modal submits order
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.showFeeDisclosure)
        assertFalse(state.isSubmitting)
        assertNotNull(state.createdOrder)
        assertEquals("ORD-001", state.createdOrder?.orderNumber)
        assertEquals(1, fakeOrderRepository.createOrderCallCount)
    }

    @Test
    fun submitOrder_setsError_whenUseCaseFails() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        fakeOrderRepository.createOrderResult = Result.failure(Exception("خطأ في الاتصال بالخادم"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.STRUCTURED))
        val itemId = viewModel.uiState.value.items[0].id
        viewModel.onIntent(CreateOrderIntent.UpdateItemName(itemId, "سكر"))
        viewModel.onIntent(CreateOrderIntent.UpdateItemQuantity(itemId, "2 كغ"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.showFeeDisclosure)

        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.showFeeDisclosure)
        assertFalse(state.isSubmitting)
        assertNull(state.createdOrder)
        assertEquals("خطأ في الاتصال بالخادم", state.errorMessage)
    }

    @Test
    fun submitOrder_double_click_calls_useCase_only_once() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        fakeOrderRepository.createOrderDelayMs = 100
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("حليب\nخبز"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.showFeeDisclosure)

        // Rapid double confirm
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        assertEquals(1, fakeOrderRepository.createOrderCallCount)
        assertFalse(viewModel.uiState.value.isSubmitting)
        assertNotNull(viewModel.uiState.value.createdOrder)
    }

    @Test
    fun dismissFeeDisclosure_hidesModal_doesNotSendOrder() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("تفاح 1 كغ"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.showFeeDisclosure)
        assertEquals(0, fakeOrderRepository.createOrderCallCount)

        viewModel.onIntent(CreateOrderIntent.DismissFeeDisclosure)
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.showFeeDisclosure)
        assertEquals(0, fakeOrderRepository.createOrderCallCount)
        assertNull(viewModel.uiState.value.createdOrder)
    }

    @Test
    fun submitOrder_loadsPricingDisclosure_andGracefullyDegradesOnFailure() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        // Failure on pricing disclosure network call
        fakeOrderRepository.getPricingDisclosureResult = Result.failure(Exception("Pricing network failure"))

        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("موز 1 كغ"))

        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        // Modal still opens, pricing is null (triggers fallback text), but confirmation works
        assertTrue(viewModel.uiState.value.showFeeDisclosure)
        assertNull(viewModel.uiState.value.disclosurePricing)
        assertFalse(viewModel.uiState.value.isLoadingDisclosure)

        // Customer can still confirm successfully
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        assertNotNull(viewModel.uiState.value.createdOrder)
        assertEquals(1, fakeOrderRepository.createOrderCallCount)
    }

    @Test
    fun refreshAddress_picksUpAddressChangedOnMapScreen() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "العنوان القديم")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals("العنوان القديم", viewModel.uiState.value.deliveryAddress?.description)

        // Simulate the user picking a new pin on the map and coming back
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.61, lng = 35.92, description = "العنوان الجديد من الخريطة")
        )
        viewModel.refreshAddress()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoadingAddress)
        assertEquals("العنوان الجديد من الخريطة", state.deliveryAddress?.description)
        assertEquals(35.61, state.deliveryAddress?.lat)
    }

    @Test
    fun refreshAddress_notFound_clearsDeliveryAddress() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        val viewModel = createViewModel()
        advanceUntilIdle()

        assertNotNull(viewModel.uiState.value.deliveryAddress)

        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        viewModel.refreshAddress()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoadingAddress)
        assertNull(state.deliveryAddress)
    }

    @Test
    fun refreshAddress_error_setsErrorMessage() = runTest(testDispatcher) {
        val viewModel = createViewModel()
        advanceUntilIdle()

        fakeAddressRepository.getAddressResult = AddressResult.Error("تعذر جلب العنوان")
        viewModel.refreshAddress()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoadingAddress)
        assertEquals("تعذر جلب العنوان", state.errorMessage)
    }

    @Test
    fun submitOrder_technicalEnglishServerError_sanitizesToGenericArabic() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        fakeOrderRepository.createOrderResult = Result.failure(Exception("HTTP 500: Internal Server Error occurred"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("حليب\nخبز"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSubmitting)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        assertEquals(context.getString(R.string.error_create_order_failed), state.errorMessage)
    }

    @Test
    fun submitOrder_reusesSameIdempotencyKeyAcrossRetriesAndClearsOnSuccess() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        // First attempt fails with network error
        fakeOrderRepository.createOrderResult = Result.failure(Exception("Network timeout"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("حليب\nخبز"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        // Verify first attempt failed and captured a valid key
        assertEquals(1, fakeOrderRepository.idempotencyKeysSent.size)
        val firstKey = fakeOrderRepository.idempotencyKeysSent[0]
        assertNotNull(firstKey)
        assertEquals(firstKey, viewModel.activeIdempotencyKey)
        assertFalse(viewModel.uiState.value.isSubmitting)
        assertNotNull(viewModel.uiState.value.errorMessage)

        // Second attempt (retry) succeeds
        fakeOrderRepository.createOrderResult = Result.success(
            com.forerun.customer.domain.model.CreatedOrder(
                id = "order_123",
                orderNumber = "FW-000001",
                status = "PENDING_REVIEW",
                totalFee = 60,
                feeNote = "تقديري"
            )
        )
        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        // Verify second attempt used the EXACT SAME idempotencyKey
        assertEquals(2, fakeOrderRepository.idempotencyKeysSent.size)
        val secondKey = fakeOrderRepository.idempotencyKeysSent[1]
        assertNotNull(secondKey)
        assertEquals("The same idempotencyKey MUST be used across retries for the same order session", firstKey, secondKey)

        // Verify key is cleared after confirmed success
        assertNull("idempotencyKey MUST be cleared after successful order creation", viewModel.activeIdempotencyKey)
        assertNotNull(viewModel.uiState.value.createdOrder)
    }

    @Test
    fun submitOrder_abandonOrder_clearsIdempotencyKey() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "بسنادا")
        )
        fakeOrderRepository.createOrderResult = Result.failure(Exception("Connection lost"))
        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.SetInputMode(OrderInputMode.QUICK))
        viewModel.onIntent(CreateOrderIntent.UpdateQuickText("تفاح"))
        viewModel.onIntent(CreateOrderIntent.SubmitOrder)
        advanceUntilIdle()

        viewModel.onIntent(CreateOrderIntent.ConfirmOrderSubmit)
        advanceUntilIdle()

        val initialKey = viewModel.activeIdempotencyKey
        assertNotNull(initialKey)

        // User explicitly abandons order (back button / dismiss screen)
        viewModel.onIntent(CreateOrderIntent.AbandonOrder)
        assertNull(viewModel.activeIdempotencyKey)
    }
}