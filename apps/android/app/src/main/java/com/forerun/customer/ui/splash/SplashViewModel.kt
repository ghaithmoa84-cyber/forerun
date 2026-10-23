package com.forerun.customer.ui.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.core.version.AppUpdateHolder
import com.forerun.customer.domain.gateway.OrderEventsGateway
import com.forerun.customer.domain.model.AppUpdateStatus
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.domain.model.SessionState
import com.forerun.customer.domain.model.UserStatus
import com.forerun.customer.domain.model.WebSocketEvent
import com.forerun.customer.domain.repository.AppVersionRepository
import com.forerun.customer.domain.usecase.CheckAppVersionUseCase
import com.forerun.customer.domain.usecase.CheckSessionUseCase
import com.forerun.customer.domain.usecase.ObserveOrderEventsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface SplashDestination {
    data object Onboarding : SplashDestination
    data object Login : SplashDestination
    data object Home : SplashDestination
    data object PendingVerification : SplashDestination
    data object Suspended : SplashDestination
    data class OrderDetail(val orderId: String) : SplashDestination
    data class UpdateRequired(val appVersion: AppVersion) : SplashDestination
}

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val checkSessionUseCase: CheckSessionUseCase,
    private val checkAppVersionUseCase: CheckAppVersionUseCase,
    private val appUpdateHolder: AppUpdateHolder,
    private val deepLinkHolder: com.forerun.customer.core.notification.DeepLinkHolder,
    private val observeOrderEventsUseCase: ObserveOrderEventsUseCase
) : ViewModel() {

    // Overload for testing or callers with version use case
    constructor(
        checkSessionUseCase: CheckSessionUseCase,
        checkAppVersionUseCase: CheckAppVersionUseCase,
        appUpdateHolder: AppUpdateHolder,
        deepLinkHolder: com.forerun.customer.core.notification.DeepLinkHolder
    ) : this(
        checkSessionUseCase = checkSessionUseCase,
        checkAppVersionUseCase = checkAppVersionUseCase,
        appUpdateHolder = appUpdateHolder,
        deepLinkHolder = deepLinkHolder,
        observeOrderEventsUseCase = ObserveOrderEventsUseCase(object : OrderEventsGateway {
            override fun observeEvents(): Flow<WebSocketEvent> = emptyFlow()
        })
    )

    // Overload for backward-compatibility with existing tests
    constructor(
        checkSessionUseCase: CheckSessionUseCase,
        deepLinkHolder: com.forerun.customer.core.notification.DeepLinkHolder
    ) : this(
        checkSessionUseCase = checkSessionUseCase,
        checkAppVersionUseCase = CheckAppVersionUseCase(object : AppVersionRepository {
            override suspend fun getAppVersion(platform: String) = Result.success(null)
        }),
        appUpdateHolder = AppUpdateHolder(),
        deepLinkHolder = deepLinkHolder,
        observeOrderEventsUseCase = ObserveOrderEventsUseCase(object : OrderEventsGateway {
            override fun observeEvents(): Flow<WebSocketEvent> = emptyFlow()
        })
    )

    // Overload for tests supplying observeOrderEventsUseCase
    constructor(
        checkSessionUseCase: CheckSessionUseCase,
        deepLinkHolder: com.forerun.customer.core.notification.DeepLinkHolder,
        observeOrderEventsUseCase: ObserveOrderEventsUseCase
    ) : this(
        checkSessionUseCase = checkSessionUseCase,
        checkAppVersionUseCase = CheckAppVersionUseCase(object : AppVersionRepository {
            override suspend fun getAppVersion(platform: String) = Result.success(null)
        }),
        appUpdateHolder = AppUpdateHolder(),
        deepLinkHolder = deepLinkHolder,
        observeOrderEventsUseCase = observeOrderEventsUseCase
    )

    private val _destination = MutableSharedFlow<SplashDestination>(replay = 1)
    val destination: SharedFlow<SplashDestination> = _destination.asSharedFlow()

    init {
        checkSession(withDelay = true)
        observeAccountEvents()
    }

    private fun observeAccountEvents() {
        viewModelScope.launch {
            observeOrderEventsUseCase().collect { event ->
                if (event is WebSocketEvent.AccountVerified) {
                    checkSession(withDelay = false)
                }
            }
        }
    }

    fun checkSession(withDelay: Boolean = true) {
        viewModelScope.launch {
            if (withDelay) {
                // A subtle delay for visual smoothness and branding display
                delay(500)
            }
            try {
                // 1. Version enforcement / advisory check
                val updateStatus = try {
                    kotlinx.coroutines.withTimeoutOrNull(3000L) {
                        checkAppVersionUseCase()
                    } ?: AppUpdateStatus.UpToDate
                } catch (_: Exception) {
                    AppUpdateStatus.UpToDate
                }

                when (updateStatus) {
                    is AppUpdateStatus.MandatoryUpdate -> {
                        appUpdateHolder.setMandatoryUpdate(updateStatus.appVersion)
                        _destination.emit(SplashDestination.UpdateRequired(updateStatus.appVersion))
                        return@launch
                    }
                    is AppUpdateStatus.OptionalUpdate -> {
                        appUpdateHolder.setOptionalUpdate(updateStatus.appVersion)
                    }
                    AppUpdateStatus.UpToDate -> {
                        // Up to date or no-op
                    }
                }

                // 2. Session check
                kotlinx.coroutines.withTimeoutOrNull(4000L) {
                    when (val state = checkSessionUseCase()) {
                        is SessionState.NeedsOnboarding -> _destination.emit(SplashDestination.Onboarding)
                        is SessionState.Unauthenticated -> _destination.emit(SplashDestination.Login)
                        is SessionState.Authenticated -> {
                            when (state.user.status) {
                                UserStatus.VERIFIED -> {
                                    val pendingOrderId = deepLinkHolder.consumePendingOrderId()
                                    if (!pendingOrderId.isNullOrBlank()) {
                                        _destination.emit(SplashDestination.OrderDetail(pendingOrderId))
                                    } else {
                                        _destination.emit(SplashDestination.Home)
                                    }
                                }
                                UserStatus.PENDING_VERIFICATION -> _destination.emit(SplashDestination.PendingVerification)
                                UserStatus.SUSPENDED -> _destination.emit(SplashDestination.Suspended)
                                else -> _destination.emit(SplashDestination.Login)
                            }
                        }
                    }
                } ?: _destination.emit(SplashDestination.Login)
            } catch (_: Exception) {
                _destination.emit(SplashDestination.Login)
            }
        }
    }
}
