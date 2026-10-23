package com.forerun.customer.data.remote.mapper

import com.forerun.customer.data.remote.dto.version.AppVersionDto
import com.forerun.customer.domain.model.AppVersion

fun AppVersionDto.toDomain(): AppVersion = AppVersion(
    platform = platform,
    latestVersionCode = latestVersionCode,
    latestVersionName = latestVersionName,
    minSupportedVersionCode = minSupportedVersionCode,
    downloadUrl = downloadUrl,
    releaseNotes = releaseNotes
)
