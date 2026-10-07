package com.forerun.customer.domain.repository

import com.forerun.customer.data.remote.dto.banner.BannerDto

interface BannerRepository {
    suspend fun getActiveBanners(): Result<List<BannerDto>>
}
