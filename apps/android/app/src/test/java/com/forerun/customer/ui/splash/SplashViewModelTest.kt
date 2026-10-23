package com.forerun.customer.ui.splash

import app.cash.turbine.test
import com.forerun.customer.data.FakeAuthRepository
import com.forerun.customer.domain.model.SessionState
import com.forerun.customer.domain.model.User
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.usecase.CheckSessionUseCase
import com.forerun.customer.data.FakeOrderEventsGateway
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import com.forerun.customer.core.version.AppUpdateHolder
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.domain.repository.AppVersionRepository
import com.forerun.customer.domain.usecase.CheckAppVersionUseCase
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class SplashViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun splash_when_onboarding_needed_routes_to_onboarding() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.NeedsOnboarding
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val viewModel = SplashViewModel(useCase, defaultDeepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Onboarding, destination)
        }
    }

    @Test
    fun splash_when_unauthenticated_routes_to_login() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Unauthenticated
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val viewModel = SplashViewModel(useCase, defaultDeepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Login, destination)
        }
    }

    @Test
    fun splash_when_verified_routes_to_home() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_1", "Test", "CUSTOMER", UserStatus.VERIFIED)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val viewModel = SplashViewModel(useCase, defaultDeepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Home, destination)
        }
    }

    @Test
    fun splash_when_pending_routes_to_pending_verification() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_2", "Pending User", "CUSTOMER", UserStatus.PENDING_VERIFICATION)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val viewModel = SplashViewModel(useCase, defaultDeepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.PendingVerification, destination)
        }
    }

    @Test
    fun splash_when_suspended_routes_to_suspended() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_3", "Suspended User", "CUSTOMER", UserStatus.SUSPENDED)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val viewModel = SplashViewModel(useCase, defaultDeepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Suspended, destination)
        }
    }

    @Test
    fun splash_when_verified_and_has_pending_deep_link_routes_to_order_detail() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_1", "Test", "CUSTOMER", UserStatus.VERIFIED)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder().apply {
            setPendingOrderId("order_abc_123")
        }
        val viewModel = SplashViewModel(useCase, deepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.OrderDetail("order_abc_123"), destination)
        }
    }

    @Test
    fun splash_when_unauthenticated_and_has_pending_deep_link_routes_to_login() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Unauthenticated
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder().apply {
            setPendingOrderId("order_abc_123")
        }
        val viewModel = SplashViewModel(useCase, deepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Login, destination)
        }
    }

    @Test
    fun splash_when_pending_and_has_deep_link_routes_to_pending() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_2", "Pending User", "CUSTOMER", UserStatus.PENDING_VERIFICATION)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder().apply {
            setPendingOrderId("order_abc_123")
        }
        val viewModel = SplashViewModel(useCase, deepLinkHolder)

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.PendingVerification, destination)
        }
    }

    @Test
    fun `splash when AccountVerified event received rechecks session immediately and routes to home`() = runTest {
        val fakeRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("user_pending", "Pending User", "CUSTOMER", UserStatus.PENDING_VERIFICATION)
            )
        }
        val useCase = CheckSessionUseCase(fakeRepo)
        val defaultDeepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        val fakeGateway = FakeOrderEventsGateway()
        val observeOrderEventsUseCase = ObserveOrderEventsUseCase(fakeGateway)

        val viewModel = SplashViewModel(
            checkSessionUseCase = useCase,
            deepLinkHolder = defaultDeepLinkHolder,
            observeOrderEventsUseCase = observeOrderEventsUseCase
        )

        viewModel.destination.test {
            // Initial checkSession with 500ms delay
            advanceTimeBy(600)
            assertEquals(SplashDestination.PendingVerification, awaitItem())

            // Simulate account verification by admin
            fakeRepo.sessionStateResult = SessionState.Authenticated(
                User("user_pending", "Pending User", "CUSTOMER", UserStatus.VERIFIED)
            )

            // Emit AccountVerified from fake gateway
            fakeGateway.emitEvent(WebSocketEvent.AccountVerified)

            // Re-check happens immediately without waiting for delay
            advanceTimeBy(100)
            val updatedDestination = awaitItem()
            assertEquals(SplashDestination.Home, updatedDestination)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun splash_whenMandatoryUpdateAvailable_routesToUpdateRequiredAndBlocks() = runTest {
        val fakeAuthRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("u1", "Verified User", "CUSTOMER", UserStatus.VERIFIED)
            )
        }
        val mandatoryVersion = AppVersion(
            platform = "android",
            latestVersionCode = 10,
            latestVersionName = "2.0.0",
            minSupportedVersionCode = 8,
            downloadUrl = "https://faow.run/download/app.apk",
            releaseNotes = "Major security upgrade"
        )
        val fakeVersionRepo = object : AppVersionRepository {
            override suspend fun getAppVersion(platform: String) = Result.success(mandatoryVersion)
        }
        val checkVersionUseCase = CheckAppVersionUseCase(fakeVersionRepo)
        val updateHolder = AppUpdateHolder()

        val viewModel = SplashViewModel(
            checkSessionUseCase = CheckSessionUseCase(fakeAuthRepo),
            checkAppVersionUseCase = checkVersionUseCase,
            appUpdateHolder = updateHolder,
            deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        )

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.UpdateRequired(mandatoryVersion), destination)
            assertEquals(mandatoryVersion, updateHolder.mandatoryUpdate.value)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun splash_whenOptionalUpdateAvailable_setsHolderAndProceedsToHome() = runTest {
        val fakeAuthRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("u1", "Verified User", "CUSTOMER", UserStatus.VERIFIED)
            )
        }
        val optionalVersion = AppVersion(
            platform = "android",
            latestVersionCode = 10,
            latestVersionName = "2.0.0",
            minSupportedVersionCode = 1,
            downloadUrl = "https://faow.run/download/app.apk",
            releaseNotes = "New features"
        )
        val fakeVersionRepo = object : AppVersionRepository {
            override suspend fun getAppVersion(platform: String) = Result.success(optionalVersion)
        }
        val checkVersionUseCase = CheckAppVersionUseCase(fakeVersionRepo)
        val updateHolder = AppUpdateHolder()

        val viewModel = SplashViewModel(
            checkSessionUseCase = CheckSessionUseCase(fakeAuthRepo),
            checkAppVersionUseCase = checkVersionUseCase,
            appUpdateHolder = updateHolder,
            deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        )

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Home, destination)
            assertEquals(optionalVersion, updateHolder.optionalUpdate.value)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun splash_whenVersionCheckFailsOnNetwork_gracefullyProceedsToHome() = runTest {
        val fakeAuthRepo = FakeAuthRepository().apply {
            sessionStateResult = SessionState.Authenticated(
                User("u1", "Verified User", "CUSTOMER", UserStatus.VERIFIED)
            )
        }
        val fakeVersionRepo = object : AppVersionRepository {
            override suspend fun getAppVersion(platform: String) = Result.failure<AppVersion?>(IOException("Timeout"))
        }
        val checkVersionUseCase = CheckAppVersionUseCase(fakeVersionRepo)
        val updateHolder = AppUpdateHolder()

        val viewModel = SplashViewModel(
            checkSessionUseCase = CheckSessionUseCase(fakeAuthRepo),
            checkAppVersionUseCase = checkVersionUseCase,
            appUpdateHolder = updateHolder,
            deepLinkHolder = com.forerun.customer.core.notification.DeepLinkHolder()
        )

        viewModel.destination.test {
            advanceTimeBy(600)
            val destination = awaitItem()
            assertEquals(SplashDestination.Home, destination)
            cancelAndIgnoreRemainingEvents()
        }
    }
}
