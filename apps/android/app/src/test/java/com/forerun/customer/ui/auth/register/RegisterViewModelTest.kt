package com.forerun.customer.ui.auth.register

import app.cash.turbine.test
import com.forerun.customer.R
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.FakeAuthRepository
import com.forerun.customer.domain.usecase.RegisterUseCase
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RegisterViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeAuthRepository: FakeAuthRepository
    private lateinit var registerUseCase: RegisterUseCase
    private lateinit var viewModel: RegisterViewModel

    @Before
    fun setup() {
        fakeAuthRepository = FakeAuthRepository()
        registerUseCase = RegisterUseCase(fakeAuthRepository)
        viewModel = RegisterViewModel(registerUseCase, ApplicationProvider.getApplicationContext())
    }

    @Test
    fun register_validation_fails_on_empty_fields() = runTest {
        viewModel.register()

        assertEquals(R.string.error_name_short, viewModel.uiState.value.nameErrorRes)
        assertEquals(R.string.error_phone_invalid, viewModel.uiState.value.whatsappErrorRes)
        assertEquals(R.string.error_password_short, viewModel.uiState.value.passwordErrorRes)
        assertEquals(R.string.error_address_required, viewModel.uiState.value.addressErrorRes)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun register_success_emits_navigation_success() = runTest {
        viewModel.onNameChanged("أحمد محمد")
        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("password123")
        viewModel.onAddressDescriptionChanged("القنجرة - جانب البلدية")

        viewModel.navigationEvent.test {
            viewModel.register()
            val event = awaitItem()
            assertEquals(RegisterNavigationEvent.Success, event)
        }
    }

    @Test
    fun register_failure_updates_general_error() = runTest {
        fakeAuthRepository.registerResult = ApiResponse.Error(
            statusCode = 409,
            error = "Conflict",
            message = "رقم الواتساب هذا مسجل مسبقًا"
        )

        viewModel.onNameChanged("أحمد محمد")
        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("password123")
        viewModel.onAddressDescriptionChanged("القنجرة - جانب البلدية")

        viewModel.register()

        assertEquals("رقم الواتساب هذا مسجل مسبقًا", viewModel.uiState.value.generalError)
        assertFalse(viewModel.uiState.value.isLoading)
    }
}