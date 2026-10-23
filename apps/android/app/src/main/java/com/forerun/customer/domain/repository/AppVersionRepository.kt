package com.forerun.customer.domain.repository

import com.forerun.customer.domain.model.AppVersion

interface AppVersionRepository {
    suspend fun getAppVersion(platform: String = "android"): Result<AppVersion?>
}
