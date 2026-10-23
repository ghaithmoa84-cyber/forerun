package com.forerun.customer.domain.model

data class AppVersion(
    val platform: String,
    val latestVersionCode: Int,
    val latestVersionName: String,
    val minSupportedVersionCode: Int,
    val downloadUrl: String,
    val releaseNotes: String? = null
)

sealed interface AppUpdateStatus {
    data object UpToDate : AppUpdateStatus
    data class OptionalUpdate(val appVersion: AppVersion) : AppUpdateStatus
    data class MandatoryUpdate(val appVersion: AppVersion) : AppUpdateStatus
}
