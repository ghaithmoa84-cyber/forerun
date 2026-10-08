package com.forerun.customer.ui.onboarding

import androidx.compose.animation.core.animateDpAsState
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ElectricBolt
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.forerun.customer.ui.theme.ForerunMintSoft
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextPrimary
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(
    onNavigateToLogin: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val pagerState = rememberPagerState(pageCount = { 3 })
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(viewModel) {
        viewModel.navigateToLogin.collect {
            onNavigateToLogin()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space16)
    ) {
        // 1. Top Bar: Branding on right, Skip button on left
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = Dimens.Space8),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Right / Brand: "فَوْراً" with mint icon circle
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(ForerunMint),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(ForerunNavy)
                    )
                }
                Spacer(modifier = Modifier.width(Dimens.Space8))
                Text(
                    text = stringResource(R.string.app_name),
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = ForerunNavy
                )
            }

            // Left / Action: Skip
            if (pagerState.currentPage < 2) {
                TextButton(
                    onClick = { viewModel.completeOnboarding() }
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_skip),
                        color = ForerunTextMuted,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(40.dp))
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space8))

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

        // 4. Primary CTA Button (Vibrant Orange with White text and Arrow)
        Button(
            onClick = {
                if (pagerState.currentPage < 2) {
                    coroutineScope.launch {
                        pagerState.animateScrollToPage(pagerState.currentPage + 1)
                    }
                } else {
                    viewModel.completeOnboarding()
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

        // 5. Bottom Login Link (Shown on page 3)
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
                    modifier = Modifier.clickable { viewModel.completeOnboarding() }
                )
            }
        } else {
            Spacer(modifier = Modifier.height(28.dp))
        }

        Spacer(modifier = Modifier.height(Dimens.Space8))
    }
}

/**
 * Screen 1: "اطلب، وريّحك من التعب" (Feature highlights: توصيل برق + دكاكين حارتك)
 */
@Composable
private fun OnboardingPageOne() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Mint Illustration Container
        Box(
            modifier = Modifier
                .size(210.dp)
                .clip(CircleShape)
                .background(ForerunMintSoft),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.LocalShipping,
                    contentDescription = null,
                    modifier = Modifier.size(72.dp),
                    tint = ForerunNavy
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(Dimens.RadiusPill))
                        .background(ForerunOrange)
                        .padding(horizontal = 10.dp, vertical = 3.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ElectricBolt,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "سريع وآمن",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space24))

        // Title
        Text(
            text = stringResource(R.string.onboarding_title_1),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        // Subtitle
        Text(
            text = stringResource(R.string.onboarding_desc_1),
            fontSize = 14.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // Two feature pill cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FeaturePillCard(
                icon = Icons.Default.ElectricBolt,
                title = stringResource(R.string.onboarding_badge_speed),
                subtitle = stringResource(R.string.onboarding_badge_speed_sub),
                modifier = Modifier.weight(1f)
            )
            FeaturePillCard(
                icon = Icons.Default.Storefront,
                title = stringResource(R.string.onboarding_badge_stores),
                subtitle = stringResource(R.string.onboarding_badge_stores_sub),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * Screen 2: "اختار أي محل تحب" (Steps: ١. اطلب، ٢. نشتريك، ٣. نوصلك)
 */
@Composable
private fun OnboardingPageTwo() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Mint Illustration Container
        Box(
            modifier = Modifier
                .size(210.dp)
                .clip(CircleShape)
                .background(ForerunMintSoft),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Storefront,
                    contentDescription = null,
                    modifier = Modifier.size(68.dp),
                    tint = ForerunNavy
                )
                Spacer(modifier = Modifier.height(Dimens.Space6))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(ForerunMintDark))
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(ForerunOrange))
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(ForerunNavy))
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space16))

        // Badge: خطوات بسيطة وواضحة
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(Dimens.RadiusPill))
                .background(ForerunMintLight)
                .padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.TaskAlt,
                    contentDescription = null,
                    tint = ForerunMintDark,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = stringResource(R.string.onboarding_steps_badge),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunNavy
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        // Title
        Text(
            text = stringResource(R.string.onboarding_title_2),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        // Subtitle
        Text(
            text = stringResource(R.string.onboarding_desc_2),
            fontSize = 14.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // Three Step Mini Cards
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
 * Screen 3: "جاهز تبدأ؟" (Final CTA with Handover graphic & Orange Checkmark)
 */
@Composable
private fun OnboardingPageThree() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = Dimens.Space8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Mint Illustration Container with Orange Checkmark
        Box(
            modifier = Modifier
                .size(210.dp)
                .clip(CircleShape)
                .background(ForerunMintSoft),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingBag,
                    contentDescription = null,
                    modifier = Modifier.size(72.dp),
                    tint = ForerunNavy
                )
            }

            // Orange Checkmark Pill in top-right
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(14.dp)
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(ForerunOrange),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space24))

        // Title
        Text(
            text = stringResource(R.string.onboarding_title_3),
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        // Subtitle
        Text(
            text = stringResource(R.string.onboarding_desc_3),
            fontSize = 14.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )
    }
}

@Composable
private fun FeaturePillCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier
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
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(ForerunMintLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = ForerunMintDark,
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
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = ForerunSoftSurface),
        border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = ForerunOrange,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stepText,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy
            )
        }
    }
}

