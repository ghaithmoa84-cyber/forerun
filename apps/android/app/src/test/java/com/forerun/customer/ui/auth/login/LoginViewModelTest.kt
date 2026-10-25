package com.forerun.customer.ui.auth.login

import app.cash.turbine.test
import com.forerun.customer.R
import com.forerun.customer.core.network.ApiResponse
import com.forerun.customer.data.FakeAuthRepository
import com.forerun.customer.domain.model.User
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.usecase.LoginUseCase
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LoginViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeAuthRepository: FakeAuthRepository
    private lateinit var loginUseCase: LoginUseCase
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setup() {
        fakeAuthRepository = FakeAuthRepository()
        loginUseCase = LoginUseCase(fakeAuthRepository)
        val fakeStorage = com.forerun.customer.core.storage.FakeTokenStorage(token = "token")
        val fakeSocket = object : com.forerun.customer.core.websocket.SocketManager(fakeStorage) {}
        viewModel = LoginViewModel(loginUseCase, fakeSocket, ApplicationProvider.getApplicationContext())
    }

    @Test
    fun whatsapp_input_filters_non_digits_and_limits_to_10() {
        viewModel.onWhatsappChanged("0912abc345678999")
        assertEquals("0912345678", viewModel.uiState.value.whatsapp)
    }

    @Test
    fun login_with_invalid_phone_sets_error_and_does_not_call_api() = runTest {
        viewModel.onWhatsappChanged("0812345678")
        viewModel.onPasswordChanged("password123")
        viewModel.login()

        assertEquals(R.string.error_phone_invalid, viewModel.uiState.value.whatsappErrorRes)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun login_with_short_password_sets_error() = runTest {
        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("short")
        viewModel.login()

        assertEquals(R.string.error_password_short, viewModel.uiState.value.passwordErrorRes)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun login_success_emits_navigation_success_event() = runTest {
        val testUser = User(
            id = "user_1",
            name = "أحمد",
            role = "CUSTOMER",
            status = UserStatus.VERIFIED
        )
        fakeAuthRepository.loginResult = ApiResponse.Success(testUser)

        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("password123")

        viewModel.navigationEvent.test {
            viewModel.login()
            val event = awaitItem()
            assertTrue(event is LoginNavigationEvent.Success)
            assertEquals(testUser, (event as LoginNavigationEvent.Success).user)
        }
    }

    @Test
    fun login_failure_sets_general_error_in_ui_state() = runTest {
        fakeAuthRepository.loginResult = ApiResponse.Error(
            statusCode = 401,
            error = "Unauthorized",
            message = "رقم الهاتف أو كلمة المرور غير صحيحة"
        )

        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("password123")
        viewModel.login()

        assertEquals("رقم الهاتف أو كلمة المرور غير صحيحة", viewModel.uiState.value.generalError)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun register_clicked_emits_NavigateToRegister() = runTest {
        viewModel.navigationEvent.test {
            viewModel.onRegisterClicked()
            val event = awaitItem()
            assertEquals(LoginNavigationEvent.NavigateToRegister, event)
        }
    }

    @Test
    fun login_success_triggers_socket_connect() = runTest {
        var connectCalled = false
        val fakeStorage = com.forerun.customer.core.storage.FakeTokenStorage(token = "token")
        val fakeSocket = object : com.forerun.customer.core.websocket.SocketManager(fakeStorage) {
            override fun connect() {
                connectCalled = true
            }
        }
        val vm = LoginViewModel(loginUseCase, fakeSocket, ApplicationProvider.getApplicationContext())
        vm.onWhatsappChanged("0912345678")
        vm.onPasswordChanged("password123")
        vm.login()

        assertTrue(connectCalled)
    }

    @Test
    fun login_failure_withTechnicalEnglishServerError_sanitizesToGenericArabic() = runTest {
        fakeAuthRepository.loginResult = ApiResponse.Error(
            statusCode = 500,
            error = "INTERNAL_SERVER_ERROR",
            message = "PostgreSQL deadlock at auth_controller.ts:89"
        )

        viewModel.onWhatsappChanged("0912345678")
        viewModel.onPasswordChanged("password123")
        viewModel.login()

        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        assertEquals(context.getString(R.string.error_login_generic), viewModel.uiState.value.generalError)
        assertFalse(viewModel.uiState.value.isLoading)
    }
}