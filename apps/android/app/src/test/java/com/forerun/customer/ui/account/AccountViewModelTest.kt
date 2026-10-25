package com.forerun.customer.ui.account

import app.cash.turbine.test
import com.forerun.customer.R
import com.forerun.customer.data.FakeAccountRepository
import com.forerun.customer.data.FakeAddressRepository
import com.forerun.customer.data.FakeAuthRepository
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.repository.AddressResult
import com.forerun.customer.domain.usecase.GetCustomerAddressUseCase
import com.forerun.customer.domain.usecase.LogoutUseCase
import com.forerun.customer.domain.usecase.account.ChangeAccountPasswordUseCase
import com.forerun.customer.domain.usecase.account.GetAccountProfileUseCase
import com.forerun.customer.domain.usecase.account.UpdateAccountProfileUseCase
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
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

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class AccountViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeAccountRepository: FakeAccountRepository
    private lateinit var fakeAddressRepository: FakeAddressRepository
    private lateinit var fakeAuthRepository: FakeAuthRepository
    private lateinit var viewModel: AccountViewModel

    @Before
    fun setUp() {
        fakeAccountRepository = FakeAccountRepository()
        fakeAddressRepository = FakeAddressRepository().apply {
            getAddressResult = AddressResult.Success(
                CustomerAddress(lat = 35.52, lng = 35.80, description = "القنجرة - جانب البلدية")
            )
        }
        fakeAuthRepository = FakeAuthRepository()
        viewModel = createViewModel()
    }

    private fun createViewModel() = AccountViewModel(
        getAccountProfile = GetAccountProfileUseCase(fakeAccountRepository),
        updateAccountProfile = UpdateAccountProfileUseCase(fakeAccountRepository),
        changeAccountPassword = ChangeAccountPasswordUseCase(fakeAccountRepository),
        getCustomerAddress = GetCustomerAddressUseCase(fakeAddressRepository),
        logoutUseCase = LogoutUseCase(fakeAuthRepository),
        application = ApplicationProvider.getApplicationContext()
    )

    @Test
    fun init_loadsAccountData_success_populatesProfileAndAddress() {
        val state = viewModel.uiState.value

        assertFalse(state.isLoading)
        assertNotNull(state.profile)
        assertEquals("محمد علي", state.profile?.name)
        assertEquals(7, state.profile?.completedOrders)
        assertNotNull(state.address)
        assertEquals("القنجرة - جانب البلدية", state.address?.description)
        assertNull(state.errorMessage)
        assertNull(state.loadErrorMessage)
    }

    @Test
    fun init_loadsAccountData_failure_setsErrorMessage() {
        fakeAccountRepository.getProfileError = "فشل الاتصال بالخادم"
        val errorVm = createViewModel()

        val state = errorVm.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.profile)
        assertEquals("فشل الاتصال بالخادم", state.loadErrorMessage)
    }

    @Test
    fun updateProfile_validData_callsRepositoryAndSetsSuccess() {
        viewModel.updateProfile(name = "أحمد خالد", altPhone = "0987654321")

        val state = viewModel.uiState.value
        assertFalse(state.isSavingProfile)
        assertEquals("أحمد خالد", state.profile?.name)
        assertEquals("أحمد خالد", fakeAccountRepository.lastUpdatedName)
        assertEquals("0987654321", fakeAccountRepository.lastUpdatedAltPhone)
        assertEquals("تم حفظ معلومات الحساب بنجاح", state.profileSuccessMessage)
        assertNull(state.errorMessage)
    }

    @Test
    fun updateProfile_nullAltPhone_sendsNullAltPhone() {
        viewModel.updateProfile(name = "أحمد خالد", altPhone = null)

        val state = viewModel.uiState.value
        assertFalse(state.isSavingProfile)
        assertEquals("أحمد خالد", fakeAccountRepository.lastUpdatedName)
        assertNull(fakeAccountRepository.lastUpdatedAltPhone)
        assertNull(state.profile?.altPhone)
        assertEquals("تم حفظ معلومات الحساب بنجاح", state.profileSuccessMessage)
    }

    @Test
    fun updateProfile_blankAltPhone_isNormalizedToNull() {
        viewModel.updateProfile(name = "أحمد خالد", altPhone = "   ")

        assertNull(fakeAccountRepository.lastUpdatedAltPhone)
    }

    @Test
    fun updateProfile_invalidName_setsErrorMessage_withoutCallingRepository() {
        viewModel.updateProfile(name = "A", altPhone = null)

        val state = viewModel.uiState.value
        assertNull(fakeAccountRepository.lastUpdatedName)
        assertEquals(0, fakeAccountRepository.updateProfileCallCount)
        assertEquals("الاسم يجب أن يكون حرفين على الأقل", state.errorMessage)
        assertNull(state.profileSuccessMessage)
    }

    @Test
    fun updateProfile_invalidAltPhone_setsErrorMessage_withoutCallingRepository() {
        viewModel.updateProfile(name = "أحمد محمد", altPhone = "12345")

        val state = viewModel.uiState.value
        assertNull(fakeAccountRepository.lastUpdatedName)
        assertEquals(0, fakeAccountRepository.updateProfileCallCount)
        assertEquals("الرقم البديل يجب أن يبدأ بـ 09 ويتكون من 10 أرقام", state.errorMessage)
        assertNull(state.profileSuccessMessage)
    }

    @Test
    fun updateProfile_apiFailure_setsErrorMessage() {
        fakeAccountRepository.updateProfileError = "خطأ في تحديث الملف"

        viewModel.updateProfile(name = "أحمد خالد", altPhone = null)

        val state = viewModel.uiState.value
        assertFalse(state.isSavingProfile)
        assertEquals("خطأ في تحديث الملف", state.errorMessage)
        assertNull(state.profileSuccessMessage)
    }

    @Test
    fun changePassword_validPassword_callsRepositoryAndSetsSuccess() {
        viewModel.changePassword(newPassword = "newPassword123", confirmPassword = "newPassword123")

        val state = viewModel.uiState.value
        assertFalse(state.isChangingPassword)
        assertEquals("newPassword123", fakeAccountRepository.lastChangedPassword)
        assertEquals("تم تغيير كلمة المرور بنجاح", state.passwordSuccessMessage)
        assertNull(state.errorMessage)
    }

    @Test
    fun changePassword_mismatchedConfirm_setsErrorMessage() {
        viewModel.changePassword(newPassword = "newPassword123", confirmPassword = "differentPassword")

        val state = viewModel.uiState.value
        assertNull(fakeAccountRepository.lastChangedPassword)
        assertEquals("كلمتا المرور غير متطابقتين", state.errorMessage)
        assertNull(state.passwordSuccessMessage)
    }

    @Test
    fun changePassword_tooShortPassword_setsErrorMessage() {
        viewModel.changePassword(newPassword = "12345", confirmPassword = "12345")

        val state = viewModel.uiState.value
        assertNull(fakeAccountRepository.lastChangedPassword)
        assertEquals(ApplicationProvider.getApplicationContext<android.content.Context>().getString(com.forerun.customer.R.string.error_password_short), state.errorMessage)
        assertNull(state.passwordSuccessMessage)
    }

    @Test
    fun changePassword_tooLongInBytes_setsErrorMessage() {
        viewModel.changePassword(newPassword = "ا".repeat(80), confirmPassword = "ا".repeat(80))

        val state = viewModel.uiState.value
        assertNull(fakeAccountRepository.lastChangedPassword)
        assertEquals("كلمة المرور لا يجب أن تتجاوز 72 بايت", state.errorMessage)
    }

    @Test
    fun changePassword_apiFailure_setsErrorMessage() {
        fakeAccountRepository.changePasswordError = "خطأ في تغيير كلمة المرور"

        viewModel.changePassword(newPassword = "validPassword88", confirmPassword = "validPassword88")

        val state = viewModel.uiState.value
        assertFalse(state.isChangingPassword)
        assertEquals("خطأ في تغيير كلمة المرور", state.errorMessage)
        assertNull(state.passwordSuccessMessage)
    }

    @Test
    fun logout_callsRepositoryAndEmitsNavigateToLogin() = runTest {
        viewModel.navigateToLogin.test {
            viewModel.logout()

            assertEquals(1, fakeAuthRepository.logoutCallCount)
            assertFalse(viewModel.uiState.value.isLoggingOut)
            awaitItem()
        }
    }

    @Test
    fun clearMessages_clearsErrorAndSuccessBanners() {
        viewModel.updateProfile(name = "A", altPhone = null)
        assertNotNull(viewModel.uiState.value.errorMessage)

        viewModel.clearMessages()
        assertNull(viewModel.uiState.value.errorMessage)
        assertNull(viewModel.uiState.value.profileSuccessMessage)
        assertNull(viewModel.uiState.value.passwordSuccessMessage)
    }

    @Test
    fun initialState_beforeLoadCompletes_isLoading() {
        val fresh = AccountUiState()

        assertTrue(fresh.isLoading)
        assertNull(fresh.profile)
        assertNull(fresh.errorMessage)
    }

    @Test
    fun loadAccountData_afterFailure_recoversOnRetry() {
        fakeAccountRepository.getProfileError = "فشل الاتصال بالخادم"
        val errorVm = createViewModel()

        assertNull(errorVm.uiState.value.profile)
        assertEquals("فشل الاتصال بالخادم", errorVm.uiState.value.loadErrorMessage)

        fakeAccountRepository.getProfileError = null
        errorVm.loadAccountData()

        val state = errorVm.uiState.value
        assertFalse(state.isLoading)
        assertNotNull(state.profile)
        assertEquals("محمد علي", state.profile?.name)
        assertNull(state.loadErrorMessage)
    }

    @Test
    fun loadAccountData_noAddress_keepsProfileAndNullAddress() {
        fakeAddressRepository.getAddressResult = AddressResult.NotFound

        val state = createViewModel().uiState.value

        assertNotNull(state.profile)
        assertNull(state.address)
        assertNull(state.loadErrorMessage)
    }

    @Test
    fun updateProfile_technicalEnglishServerError_sanitizesToGenericArabic() {
        fakeAccountRepository.updateProfileError = "Internal Server Error: Row lock deadlock detected"
        viewModel.updateProfile(name = "أحمد خالد", altPhone = "0987654321")

        val state = viewModel.uiState.value
        assertFalse(state.isSavingProfile)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        assertEquals(context.getString(R.string.error_account_save_failed), state.errorMessage)
    }
}