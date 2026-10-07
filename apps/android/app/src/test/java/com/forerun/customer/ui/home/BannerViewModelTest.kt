package com.forerun.customer.ui.home

import com.forerun.customer.data.FakeBannerRepository
import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.forerun.customer.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BannerViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var fakeBannerRepository: FakeBannerRepository

    @Before
    fun setup() {
        fakeBannerRepository = FakeBannerRepository()
    }

    @Test
    fun init_successWithBanners_transitionsToSuccessState() = runTest {
        val sampleBanners = listOf(
            BannerDto(
                id = "b1",
                headline = "Special Offer",
                subtitle = "Great deals today",
                imageUrl = "https://example.com/banner1.webp",
                actionType = "IN_APP_ROUTE",
                actionValue = "/create-order",
                ctaLabel = "Order Now",
                sortOrder = 0
            )
        )
        fakeBannerRepository.bannersResult = Result.success(sampleBanners)

        val viewModel = BannerViewModel(fakeBannerRepository)

        val state = viewModel.uiState.value
        assertTrue(state is BannerUiState.Success)
        assertEquals(sampleBanners, (state as BannerUiState.Success).banners)
    }

    @Test
    fun init_successWithEmptyList_transitionsToEmptyState() = runTest {
        fakeBannerRepository.bannersResult = Result.success(emptyList())

        val viewModel = BannerViewModel(fakeBannerRepository)

        val state = viewModel.uiState.value
        assertEquals(BannerUiState.Empty, state)
    }

    @Test
    fun init_repositoryFailure_transitionsToFailureState() = runTest {
        fakeBannerRepository.bannersResult = Result.failure(Exception("Network error"))

        val viewModel = BannerViewModel(fakeBannerRepository)

        val state = viewModel.uiState.value
        assertEquals(BannerUiState.Failure, state)
    }

    @Test
    fun loadBanners_refreshesStateProperly() = runTest {
        fakeBannerRepository.bannersResult = Result.failure(Exception("Initial failure"))
        val viewModel = BannerViewModel(fakeBannerRepository)
        assertEquals(BannerUiState.Failure, viewModel.uiState.value)

        // Simulate successful retry
        val updatedBanners = listOf(
            BannerDto(
                id = "b2",
                imageUrl = "https://example.com/banner2.webp",
                actionType = "NONE",
                sortOrder = 1
            )
        )
        fakeBannerRepository.bannersResult = Result.success(updatedBanners)

        viewModel.loadBanners()

        val newState = viewModel.uiState.value
        assertTrue(newState is BannerUiState.Success)
        assertEquals(updatedBanners, (newState as BannerUiState.Success).banners)
    }
}
