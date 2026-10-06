package com.forerun.customer.ui.address

import com.forerun.customer.data.FakeAddressRepository
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.service.GeocodingService
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.ReverseGeocodeUseCase
import com.forerun.customer.domain.usecase.UpdateCustomerAddressUseCase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
class AddressSetupViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeAddressRepository: FakeAddressRepository
    private lateinit var getCustomerAddressUseCase: GetCustomerAddressUseCase
    private lateinit var updateCustomerAddressUseCase: UpdateCustomerAddressUseCase
    private lateinit var fakeGeocodingService: FakeGeocodingService
    private lateinit var reverseGeocodeUseCase: ReverseGeocodeUseCase

    private class FakeGeocodingService : GeocodingService {
        var result: String? = "القنجرة - شارع البلدية"
        override suspend fun reverseGeocode(lat: Double, lng: Double): String? = result
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        fakeAddressRepository = FakeAddressRepository()
        getCustomerAddressUseCase = GetCustomerAddressUseCase(fakeAddressRepository)
        updateCustomerAddressUseCase = UpdateCustomerAddressUseCase(fakeAddressRepository)
        fakeGeocodingService = FakeGeocodingService()
        reverseGeocodeUseCase = ReverseGeocodeUseCase(fakeGeocodingService)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun loadAddress_setsEditModeTrue_whenAddressExists() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "اللاذقية - القنجرة")
        )
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertTrue(state.isEditMode)
        assertEquals(35.55, state.lat, 0.001)
        assertEquals(35.80, state.lng, 0.001)
        assertEquals("اللاذقية - القنجرة", state.description)
    }

    @Test
    fun loadAddress_setsEditModeFalse_whenAddressNotFound() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertFalse(state.isEditMode)
        assertEquals(33.5138, state.lat, 0.001)
        assertEquals(36.2765, state.lng, 0.001)
        assertEquals("", state.description)
    }

    @Test
    fun updateCoordinates_updatesLatAndLng() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.60, 35.85))

        val state = viewModel.uiState.value
        assertEquals(35.60, state.lat, 0.001)
        assertEquals(35.85, state.lng, 0.001)
    }

    @Test
    fun updateCoordinates_triggersDebouncedGeocoding_andUpdatesDescription() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.5534, 35.8000))
        advanceTimeBy(400)
        // Before 500ms debounce
        assertEquals("", viewModel.uiState.value.description)

        advanceTimeBy(200)
        // After 500ms debounce
        assertEquals("القنجرة - شارع البلدية", viewModel.uiState.value.description)
    }

    @Test
    fun updateCoordinates_leavesDescriptionUnchanged_whenGeocodingFails() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.Success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "العنوان الأصلي")
        )
        fakeGeocodingService.result = null // timeout / 403 / network error
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.60, 35.85))
        advanceTimeBy(600)

        // Description remains unchanged!
        assertEquals("العنوان الأصلي", viewModel.uiState.value.description)
    }

    @Test
    fun updateDescription_updatesDescription() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateDescription("شارع الكورنيش"))

        val state = viewModel.uiState.value
        assertEquals("شارع الكورنيش", state.description)
    }

    @Test
    fun saveAddress_failsValidation_whenDescriptionIsBlank() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateDescription("   "))
        viewModel.onIntent(AddressSetupIntent.SaveAddress)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.descriptionError)
        assertFalse(state.isSaving)
    }

    @Test
    fun saveAddress_succeeds_whenInputIsValid() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        fakeAddressRepository.updateAddressResult = Result.success(
            CustomerAddress(lat = 35.55, lng = 35.80, description = "العنوان المحفوظ")
        )
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateDescription("العنوان المحفوظ"))
        viewModel.onIntent(AddressSetupIntent.SaveAddress)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSaving)
        assertTrue(state.saveSuccess)
        assertTrue(state.isEditMode)
    }

    @Test
    fun saveAddress_setsErrorMessage_whenRepositoryFails() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        fakeAddressRepository.updateAddressResult = Result.failure(Exception("خطأ في الخادم"))
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateDescription("العنوان"))
        viewModel.onIntent(AddressSetupIntent.SaveAddress)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.isSaving)
        assertEquals("خطأ في الخادم", state.errorMessage)
    }

    @Test
    fun updateCoordinates_setsGeocodingLoadingTrue_andResetsToFalseOnSuccess() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.5534, 35.8000))

        // Immediately after dispatch, loading is true
        assertTrue(viewModel.uiState.value.isGeocodingLoading)
        assertNull(viewModel.uiState.value.geocodingError)

        advanceTimeBy(600)

        // After debounce and completion, loading is false and description populated
        assertFalse(viewModel.uiState.value.isGeocodingLoading)
        assertEquals("القنجرة - شارع البلدية", viewModel.uiState.value.description)
        assertNull(viewModel.uiState.value.geocodingError)
    }

    @Test
    fun updateCoordinates_setsGeocodingLoadingFalse_andSetsGeocodingErrorOnFailure() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        fakeGeocodingService.result = null // Nominatim network failure
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.60, 35.85))
        assertTrue(viewModel.uiState.value.isGeocodingLoading)

        advanceTimeBy(600)

        assertFalse(viewModel.uiState.value.isGeocodingLoading)
        assertNotNull(viewModel.uiState.value.geocodingError)
    }

    @Test
    fun updateCoordinates_rapidUpdates_cancelsPreviousRequest_andDebounces() = runTest(testDispatcher) {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound
        val viewModel = AddressSetupViewModel(getCustomerAddressUseCase, updateCustomerAddressUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        // 1st coordinate update
        fakeGeocodingService.result = "الموقع الأول"
        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.10, 35.10))
        advanceTimeBy(300) // Not yet completed (debounce 500ms)

        // 2nd coordinate update cancels 1st
        fakeGeocodingService.result = "الموقع الثاني"
        viewModel.onIntent(AddressSetupIntent.UpdateCoordinates(35.20, 35.20))
        advanceTimeBy(300) // 1st was cancelled, 2nd has 200ms remaining
        assertEquals("", viewModel.uiState.value.description)

        // Advance remaining time for 2nd
        advanceTimeBy(300)
        assertEquals("الموقع الثاني", viewModel.uiState.value.description)
        assertFalse(viewModel.uiState.value.isGeocodingLoading)
    }

    @Test
    fun saveAddress_double_click_invokes_update_only_once() = runTest(testDispatcher) {
        var updateCallCount = 0
        val countingRepo = object : com.forerun.customer.domain.repository.AddressRepository {
            override suspend fun getAddress(): AddressResult = AddressResult.NotFound
            override suspend fun updateAddress(
                lat: Double,
                lng: Double,
                description: String
            ): Result<CustomerAddress> {
                updateCallCount++
                kotlinx.coroutines.delay(100)
                return Result.success(CustomerAddress(lat = lat, lng = lng, description = description))
            }
        }
        val customGetUseCase = GetCustomerAddressUseCase(countingRepo)
        val customUpdateUseCase = UpdateCustomerAddressUseCase(countingRepo)
        val viewModel = AddressSetupViewModel(customGetUseCase, customUpdateUseCase, reverseGeocodeUseCase, ApplicationProvider.getApplicationContext())
        advanceUntilIdle()

        viewModel.onIntent(AddressSetupIntent.UpdateDescription("شارع الكورنيش"))

        // Simulate rapid double click
        viewModel.onIntent(AddressSetupIntent.SaveAddress)
        viewModel.onIntent(AddressSetupIntent.SaveAddress)
        advanceUntilIdle()

        assertEquals(1, updateCallCount)
        assertFalse(viewModel.uiState.value.isSaving)
        assertTrue(viewModel.uiState.value.saveSuccess)
    }
}