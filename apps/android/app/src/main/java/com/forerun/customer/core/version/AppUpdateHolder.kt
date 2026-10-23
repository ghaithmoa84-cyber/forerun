package com.forerun.customer.core.version

import com.forerun.customer.domain.model.AppVersion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppUpdateHolder @Inject constructor() {
    private val _mandatoryUpdate = MutableStateFlow<AppVersion?>(null)
    val mandatoryUpdate: StateFlow<AppVersion?> = _mandatoryUpdate.asStateFlow()

    private val _optionalUpdate = MutableStateFlow<AppVersion?>(null)
    val optionalUpdate: StateFlow<AppVersion?> = _optionalUpdate.asStateFlow()

    fun setMandatoryUpdate(version: AppVersion) {
        _mandatoryUpdate.value = version
    }

    fun setOptionalUpdate(version: AppVersion?) {
        _optionalUpdate.value = version
    }

    fun dismissOptionalUpdate() {
        _optionalUpdate.value = null
    }
}
