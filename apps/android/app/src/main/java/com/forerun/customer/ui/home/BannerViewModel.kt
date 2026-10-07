package com.forerun.customer.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.forerun.customer.domain.repository.BannerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for the promotional banners carousel on HomeScreen.
 */
sealed interface BannerUiState {
    data object Loading : BannerUiState
    data class Success(val banners: List<BannerDto>) : BannerUiState
    data object Empty : BannerUiState
    data object Failure : BannerUiState
}

@HiltViewModel
class BannerViewModel @Inject constructor(
    private val bannerRepository: BannerRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<BannerUiState>(BannerUiState.Loading)
    val uiState: StateFlow<BannerUiState> = _uiState.asStateFlow()

    init {
        loadBanners()
    }

    fun loadBanners() {
        viewModelScope.launch {
            _uiState.value = BannerUiState.Loading
            bannerRepository.getActiveBanners()
                .onSuccess { banners ->
                    if (banners.isEmpty()) {
                        _uiState.value = BannerUiState.Empty
                    } else {
                        _uiState.value = BannerUiState.Success(banners)
                    }
                }
                .onFailure {
                    _uiState.value = BannerUiState.Failure
                }
        }
    }
}
