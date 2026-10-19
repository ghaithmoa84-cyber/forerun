package com.forerun.customer.ui.onboarding

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.PhoneIphone
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunMint
import com.forerun.customer.ui.theme.ForerunMintDark
import com.forerun.customer.ui.theme.ForerunMintLight
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTheme
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(
    onNavigateToLogin: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    LaunchedEffect(viewModel) {
        viewModel.navigateToLogin.collect {
            onNavigateToLogin()
        }
    }

    OnboardingContent(
        onComplete = { viewModel.completeOnboarding() },
        onSkip = { viewModel.completeOnboarding() },
        modifier = modifier
    )
}

@Composable
fun OnboardingContent(
    onComplete: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
    initialPage: Int = 0
) {
    val pagerState = rememberPagerState(initialPage = initialPage, pageCount = { 3 })
    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space16)
    ) {
        // 1. Top Bar: Centered Brand Logo (130.dp) & Skip Button
        Box(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Centered Brand Logo (130.dp) positioned lower down towards the illustration
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = Dimens.Space24)
                    .size(130.dp),
                contentScale = ContentScale.Fit
            )

            // Skip action at the top level
            if (pagerState.currentPage < 2) {
                TextButton(
                    onClick = onSkip,
                    modifier = Modifier.align(Alignment.TopEnd)
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_skip),
                        color = ForerunTextMuted,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space4))

        // 2. Pager Content
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) { pageIndex ->
            when (pageIndex) {
                0 -> OnboardingPageOne()
                1 -> OnboardingPageTwo()
                2 -> OnboardingPageThree()
            }
        }

        // 3. Indicator Dots (Active is Orange pill, Inactive is Mint dot)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Dimens.Space12),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(3) { index ->
                val isSelected = pagerState.currentPage == index
                val width by animateDpAsState(
                    targetValue = if (isSelected) 26.dp else 8.dp,
                    label = "indicator_width"
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 3.dp)
                        .height(8.dp)
                        .width(width)
                        .clip(CircleShape)
                        .background(if (isSelected) ForerunOrange else ForerunMint)
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space12))

        // 4. Primary CTA Button (Strict Orange action color)
        Button(
            onClick = {
                if (pagerState.currentPage < 2) {
                    coroutineScope.launch {
                        pagerState.animateScrollToPage(pagerState.currentPage + 1)
                    }
                } else {
                    onComplete()
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(27.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = ForerunOrange,
                contentColor = Color.White
            ),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = stringResource(
                        if (pagerState.currentPage == 2) R.string.onboarding_start else R.string.onboarding_next
                    ),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.width(Dimens.Space8))
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        // 5. Bottom Login Link (Only on Page 3)
        if (pagerState.currentPage == 2) {
            Spacer(modifier = Modifier.height(Dimens.Space12))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.onboarding_already_have_account),
                    fontSize = 13.sp,
                    color = ForerunTextMuted
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = stringResource(R.string.onboarding_login_action),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunNavy,
                    modifier = Modifier.clickable { onComplete() }
                )
            }
        } else {
            Spacer(modifier = Modifier.height(28.dp))
        }

        Spacer(modifier = Modifier.height(Dimens.Space8))
    }
}

/**
 * Standard illustration container keeping identical proportion and scaling across all 3 pages
 */
@Composable
private fun IllustrationContainer(
    imageResId: Int,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(230.dp)
            .clip(RoundedCornerShape(32.dp))
            .background(ForerunMintLight.copy(alpha = 0.5f))
            .border(1.dp, ForerunMint.copy(alpha = 0.4f), RoundedCornerShape(32.dp)),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(imageResId),
            contentDescription = null,
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp)
                .clip(RoundedCornerShape(26.dp)),
            contentScale = ContentScale.Crop
        )
    }
}

/**
 * Screen 1: "كل مستلزماتك من دكاكين حارتك"
 */
@Composable
fun OnboardingPageOne(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        IllustrationContainer(imageResId = R.drawable.onboarding_shopping)

        Spacer(modifier = Modifier.height(Dimens.Space16))

        CategoryBadge(
            icon = Icons.Default.Storefront,
            text = stringResource(R.string.onboarding_badge_1),
            accentDot = true // Single subtle orange accent dot
        )

        Spacer(modifier = Modifier.height(Dimens.Space12))

        Text(
            text = stringResource(R.string.onboarding_title_1),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.onboarding_desc_1),
            fontSize = 13.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 21.sp,
            modifier = Modifier.padding(horizontal = Dimens.Space4)
        )

        Spacer(modifier = Modifier.height(Dimens.Space20))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FeaturePillCard(
                icon = Icons.Default.Storefront,
                title = stringResource(R.string.onboarding_feat1_title),
                subtitle = stringResource(R.string.onboarding_feat1_sub),
                modifier = Modifier.weight(1f)
            )
            FeaturePillCard(
                icon = Icons.Default.ShoppingBag,
                title = stringResource(R.string.onboarding_feat2_title),
                subtitle = stringResource(R.string.onboarding_feat2_sub),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * Screen 2: "مندوبنا بيوصل لعندك فورا"
 */
@Composable
fun OnboardingPageTwo(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        IllustrationContainer(imageResId = R.drawable.onboarding_delivery)

        Spacer(modifier = Modifier.height(Dimens.Space16))

        CategoryBadge(
            icon = Icons.Default.ElectricBolt,
            text = stringResource(R.string.onboarding_badge_2),
            iconTint = ForerunOrange // Single subtle orange accent
        )

        Spacer(modifier = Modifier.height(Dimens.Space12))

        Text(
            text = stringResource(R.string.onboarding_title_2),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.onboarding_desc_2),
            fontSize = 13.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 21.sp,
            modifier = Modifier.padding(horizontal = Dimens.Space4)
        )

        Spacer(modifier = Modifier.height(Dimens.Space20))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            StepMiniCard(
                stepText = stringResource(R.string.onboarding_step_1),
                icon = Icons.Default.PhoneIphone,
                modifier = Modifier.weight(1f)
            )
            StepMiniCard(
                stepText = stringResource(R.string.onboarding_step_2),
                icon = Icons.Default.ShoppingBag,
                modifier = Modifier.weight(1f)
            )
            StepMiniCard(
                stepText = stringResource(R.string.onboarding_step_3),
                icon = Icons.Default.LocalShipping,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * Screen 3: "طلبك لعندك.. طازج ومرتاح"
 */
@Composable
fun OnboardingPageThree(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        IllustrationContainer(imageResId = R.drawable.onboarding_arrival)

        Spacer(modifier = Modifier.height(Dimens.Space16))

        CategoryBadge(
            icon = Icons.Default.TaskAlt,
            text = stringResource(R.string.onboarding_badge_3)
        )

        Spacer(modifier = Modifier.height(Dimens.Space12))

        Text(
            text = stringResource(R.string.onboarding_title_3),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.onboarding_desc_3),
            fontSize = 13.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 21.sp,
            modifier = Modifier.padding(horizontal = Dimens.Space4)
        )

        Spacer(modifier = Modifier.height(Dimens.Space20))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FeaturePillCard(
                icon = Icons.Default.CheckCircle,
                title = stringResource(R.string.onboarding_feat3_title),
                subtitle = stringResource(R.string.onboarding_feat3_sub),
                iconTint = ForerunOrange, // Single subtle orange accent
                modifier = Modifier.weight(1f)
            )
            FeaturePillCard(
                icon = Icons.Default.Home,
                title = stringResource(R.string.onboarding_feat4_title),
                subtitle = stringResource(R.string.onboarding_feat4_sub),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun CategoryBadge(
    icon: ImageVector,
    text: String,
    modifier: Modifier = Modifier,
    iconTint: Color = ForerunMintDark,
    accentDot: Boolean = false
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(Dimens.RadiusPill))
            .background(ForerunMintLight)
            .border(1.dp, ForerunMint.copy(alpha = 0.5f), RoundedCornerShape(Dimens.RadiusPill))
            .padding(horizontal = 12.dp, vertical = 5.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(15.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = text,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy
            )
            if (accentDot) {
                Spacer(modifier = Modifier.width(6.dp))
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(ForerunOrange)
                )
            }
        }
    }
}

@Composable
private fun FeaturePillCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    iconTint: Color = ForerunMintDark
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = ForerunSoftSurface),
        border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(ForerunMintLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunNavy
                )
                Text(
                    text = subtitle,
                    fontSize = 10.sp,
                    color = ForerunTextMuted
                )
            }
        }
    }
}

@Composable
private fun StepMiniCard(
    stepText: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = ForerunSoftSurface),
        border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(ForerunMintLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = ForerunNavy,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = stepText,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy,
                textAlign = TextAlign.Center
            )
        }
    }
}

// =========================================================================
// Previews for Android Studio
// =========================================================================

@Preview(name = "Onboarding - Full Flow (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 844, locale = "ar")
@Composable
private fun OnboardingScreenPreview() {
    ForerunTheme {
        OnboardingContent(
            initialPage = 0,
            onComplete = {},
            onSkip = {}
        )
    }
}

@Preview(name = "Page 1 - Local Stores (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 640, locale = "ar")
@Composable
private fun OnboardingPageOnePreview() {
    ForerunTheme {
        Box(modifier = Modifier.fillMaxSize().background(ForerunBackground)) {
            OnboardingPageOne()
        }
    }
}

@Preview(name = "Page 2 - Runner Delivery (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 640, locale = "ar")
@Composable
private fun OnboardingPageTwoPreview() {
    ForerunTheme {
        Box(modifier = Modifier.fillMaxSize().background(ForerunBackground)) {
            OnboardingPageTwo()
        }
    }
}

@Preview(name = "Page 3 - Doorstep Arrival (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 640, locale = "ar")
@Composable
private fun OnboardingPageThreePreview() {
    ForerunTheme {
        Box(modifier = Modifier.fillMaxSize().background(ForerunBackground)) {
            OnboardingPageThree()
        }
    }
}
