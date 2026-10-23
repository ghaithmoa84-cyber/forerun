package com.forerun.customer.data.remote.dto.version

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AppVersionDto(
    @Json(name = "platform") val platform: String,
    @Json(name = "latestVersionCode") val latestVersionCode: Int,
    @Json(name = "latestVersionName") val latestVersionName: String,
    @Json(name = "minSupportedVersionCode") val minSupportedVersionCode: Int,
    @Json(name = "downloadUrl") val downloadUrl: String,
    @Json(name = "releaseNotes") val releaseNotes: String? = null
)
