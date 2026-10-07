package com.forerun.customer.data

import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.forerun.customer.domain.repository.BannerRepository

class FakeBannerRepository : BannerRepository {
    var bannersResult: Result<List<BannerDto>> = Result.success(emptyList())

    override suspend fun getActiveBanners(): Result<List<BannerDto>> {
        return bannersResult
    }
}
