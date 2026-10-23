package com.forerun.customer.domain.usecase

import com.forerun.customer.BuildConfig
import com.forerun.customer.domain.model.AppUpdateStatus
import com.forerun.customer.domain.repository.AppVersionRepository
import javax.inject.Inject

class CheckAppVersionUseCase @Inject constructor(
    private val appVersionRepository: AppVersionRepository
) {
    suspend operator fun invoke(
        currentVersionCode: Int = BuildConfig.VERSION_CODE
    ): AppUpdateStatus {
        val result = appVersionRepository.getAppVersion("android")
        val version = result.getOrNull() ?: return AppUpdateStatus.UpToDate

        return when {
            currentVersionCode < version.minSupportedVersionCode -> {
                AppUpdateStatus.MandatoryUpdate(version)
            }
            currentVersionCode < version.latestVersionCode -> {
                AppUpdateStatus.OptionalUpdate(version)
            }
            else -> {
                AppUpdateStatus.UpToDate
            }
        }
    }
}
