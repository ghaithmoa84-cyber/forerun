package com.forerun.customer.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.forerun.customer.R
import com.forerun.customer.core.config.AppConfig
import com.forerun.customer.data.remote.dto.banner.BannerActionType
import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.forerun.customer.ui.navigation.BannerRouteMapper
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunGreen
import kotlinx.coroutines.delay

/**
 * Promotional banners carousel composable displaying active banners at the top of HomeScreen.
 *
 * Requirements:
 * - 16:7 aspect ratio.
 * - Auto-scrolls every 5 seconds; pauses when dragged or during active scroll, and resumes cleanly.
 * - Simple dots indicator.
 * - Respects system layout direction (RTL / LTR) without forcing LTR.
 * - Coil AsyncImage with local placeholder/error drawables.
 * - Safe navigation and fallbacks:
 *     - IN_APP_ROUTE -> resolved via [BannerRouteMapper], silent no-op on null.
 *     - EXTERNAL_URL -> verified to start with https:// before launching Intent.
 *     - WHATSAPP_ADMIN -> [AppConfig.buildWhatsAppUrl] with string resource.
 *     - NONE -> not clickable.
 * - If state is Loading, Empty, or Failure, completely vanishes with zero user-visible error text.
 */
@Composable
fun BannersSection(
    uiState: BannerUiState,
    onNavigateToRoute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val banners = (uiState as? BannerUiState.Success)?.banners ?: return
    if (banners.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { banners.size })
    val isDragged by pagerState.interactionSource.collectIsDraggedAsState()

    // Auto-scroll every 5 seconds, paused while user is interacting
    LaunchedEffect(pagerState, isDragged, banners.size) {
        if (banners.size <= 1 || isDragged) return@LaunchedEffect
        while (true) {
            delay(5000L)
            if (!pagerState.isScrollInProgress && !isDragged) {
                val nextPage = (pagerState.currentPage + 1) % banners.size
                pagerState.animateScrollToPage(nextPage)
            }
        }
    }

    Column(
        modifier = modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Dimens.RadiusLarge))
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 7f)
            ) { page ->
                val banner = banners[page]
                BannerCard(
                    banner = banner,
                    onNavigateToRoute = onNavigateToRoute
                )
            }

            if (banners.size > 1) {
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Dimens.Space8)
                        .clip(RoundedCornerShape(Dimens.RadiusPill))
                        .background(Color.Black.copy(alpha = 0.35f))
                        .padding(horizontal = Dimens.Space8, vertical = Dimens.Space4),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space4),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(banners.size) { index ->
                        val isSelected = pagerState.currentPage == index
                        Box(
                            modifier = Modifier
                                .size(if (isSelected) 7.dp else 5.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isSelected) ForerunGreen else Color.White.copy(alpha = 0.6f)
                                )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space16))
    }
}

@Composable
private fun BannerCard(
    banner: BannerDto,
    onNavigateToRoute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val actionType = banner.resolvedActionType
    val isClickable = actionType != BannerActionType.NONE

    Card(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(16f / 7f)
            .clip(RoundedCornerShape(Dimens.RadiusLarge))
            .then(
                if (isClickable) {
                    Modifier.clickable {
                        when (actionType) {
                            BannerActionType.NONE -> {
                                // Non-clickable
                            }
                            BannerActionType.IN_APP_ROUTE -> {
                                val route = BannerRouteMapper.toRoute(banner.actionValue)
                                if (route != null) {
                                    onNavigateToRoute(route)
                                }
                            }
                            BannerActionType.EXTERNAL_URL -> {
                                val url = banner.actionValue?.trim().orEmpty()
                                if (url.startsWith("https://", ignoreCase = true)) {
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                        context.startActivity(intent)
                                    } catch (_: Exception) {
                                        // Silent fallback
                                    }
                                }
                            }
                            BannerActionType.WHATSAPP_ADMIN -> {
                                try {
                                    val message = context.getString(R.string.banner_whatsapp_inquiry)
                                    val url = AppConfig.buildWhatsAppUrl(message)
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                } catch (_: Exception) {
                                    // Silent fallback
                                }
                            }
                        }
                    }
                } else {
                    Modifier
                }
            ),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = banner.imageUrl,
                contentDescription = banner.headline ?: stringResource(R.string.banner_image_description),
                placeholder = painterResource(id = R.drawable.banner_placeholder),
                error = painterResource(id = R.drawable.banner_placeholder),
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Dark gradient overlay for text readability when text fields are present
            val hasText = !banner.headline.isNullOrBlank() || !banner.subtitle.isNullOrBlank() || !banner.ctaLabel.isNullOrBlank()
            if (hasText) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.70f)
                                ),
                                startY = 80f
                            )
                        )
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(horizontal = Dimens.Space16, vertical = Dimens.Space12)
                ) {
                    if (!banner.headline.isNullOrBlank()) {
                        Text(
                            text = banner.headline,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (!banner.subtitle.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = banner.subtitle,
                            color = Color.White.copy(alpha = 0.9f),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (!banner.ctaLabel.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(Dimens.Space4))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunGreen)
                                .padding(horizontal = Dimens.Space8, vertical = Dimens.Space2)
                        ) {
                            Text(
                                text = banner.ctaLabel,
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
