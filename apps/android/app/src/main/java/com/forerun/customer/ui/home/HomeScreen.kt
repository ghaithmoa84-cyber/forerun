package com.forerun.customer.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.LocalTaxi
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.core.config.AppConfig
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.ui.order.getOrderStatusColors
import com.forerun.customer.ui.order.getOrderStatusLabelRes
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunMint
import com.forerun.customer.ui.theme.ForerunMintDark
import com.forerun.customer.ui.theme.ForerunMintLight
import com.forerun.customer.ui.theme.ForerunMintSoft
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunOrangeDark
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.ForerunTheme
import com.forerun.customer.ui.theme.WhatsAppGreen
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.runtime.CompositionLocalProvider

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToCreateOrder: () -> Unit = {},
    onNavigateToOrderDetail: (String) -> Unit = {},
    onNavigateToRoute: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = hiltViewModel(),
    bannerViewModel: BannerViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val bannerUiState by bannerViewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.navigateToLogin.collect {
            onNavigateToLogin()
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current

    // Refresh home data silently upon resuming the screen (e.g. returning from background or another screen).
    // The very first ON_RESUME is skipped because viewModel.init already fetches initial data.
    var hasResumedOnce by rememberSaveable { mutableStateOf(false) }
    DisposableEffect(lifecycleOwner, viewModel) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (hasResumedOnce) {
                    viewModel.refreshSilently()
                } else {
                    hasResumedOnce = true
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunBackground)
    ) {
        when (val state = uiState) {
            is HomeUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = ForerunOrange)
                }
            }

            is HomeUiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(Dimens.Space24),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = state.message,
                        fontSize = 16.sp,
                        color = ForerunTextMuted,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(Dimens.Space16))
                    Button(
                        onClick = {
                            viewModel.handleIntent(HomeIntent.Refresh)
                            bannerViewModel.loadBanners()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForerunOrange)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Text(stringResource(R.string.home_retry), color = Color.White)
                    }
                }
            }

            is HomeUiState.Success -> {
                PullToRefreshBox(
                    isRefreshing = state.isRefreshing,
                    onRefresh = {
                        viewModel.onIntent(HomeIntent.Refresh)
                        bannerViewModel.loadBanners()
                    },
                    modifier = Modifier.fillMaxSize()
                ) {
                    HomeContent(
                        profile = state.profile,
                        activeOrder = state.activeOrder,
                        bannerUiState = bannerUiState,
                        onNewOrderClick = onNavigateToCreateOrder,
                        onOrderDetailClick = onNavigateToOrderDetail,
                        onNavigateToRoute = onNavigateToRoute
                    )
                }
            }
        }
    }
}

@Composable
fun HomeContent(
    profile: CustomerProfile,
    activeOrder: ActiveOrder?,
    bannerUiState: BannerUiState,
    onNewOrderClick: () -> Unit,
    onOrderDetailClick: (String) -> Unit,
    onNavigateToRoute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showServiceDialog by rememberSaveable { mutableStateOf(false) }
    var activeComingSoonFeature by rememberSaveable { mutableStateOf<ComingSoonFeature?>(null) }
    val context = LocalContext.current

    if (showServiceDialog) {
        AlertDialog(
            onDismissRequest = { showServiceDialog = false },
            title = {
                Text(
                    text = stringResource(R.string.service_in_dev_dialog_title),
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = ForerunNavy
                )
            },
            text = {
                Text(
                    text = stringResource(R.string.service_in_dev_dialog_desc),
                    fontSize = 14.sp,
                    color = ForerunTextMuted,
                    lineHeight = 22.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showServiceDialog = false
                        val url = AppConfig.buildWhatsAppUrl(context.getString(R.string.service_in_dev_whatsapp_msg))
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = stringResource(R.string.service_in_dev_dialog_btn),
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showServiceDialog = false }) {
                    Text(
                        text = stringResource(R.string.service_in_dev_dialog_dismiss),
                        color = ForerunTextMuted
                    )
                }
            },
            shape = RoundedCornerShape(20.dp),
            containerColor = ForerunSurface
        )
    }

    activeComingSoonFeature?.let { feature ->
        ComingSoonFeatureDialog(
            feature = feature,
            onDismiss = { activeComingSoonFeature = null }
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space16)
    ) {
        // 1. Top Header: User Greeting + Location Dropdown + Real FORERUN Logo
        HomeTopHeader(
            profile = profile,
            onLocationClick = { onNavigateToRoute("account") }
        )

        Spacer(modifier = Modifier.height(Dimens.Space14))

        // 2. Promotional Banners Carousel (Or local banner fallback)
        HomeBannersSection(
            bannerUiState = bannerUiState,
            onNewOrderClick = onNewOrderClick,
            onNavigateToRoute = onNavigateToRoute
        )

        Spacer(modifier = Modifier.height(Dimens.Space16))

        // 3. Active Order Card (Or friendly prompt and Admin Contact if no active order)
        if (activeOrder != null) {
            ActiveOrderCard(
                order = activeOrder,
                onClick = { onOrderDetailClick(activeOrder.id) }
            )
        } else {
            HomeNoActiveOrderCard(
                onNewOrderClick = onNewOrderClick
            )

            Spacer(modifier = Modifier.height(Dimens.Space14))

            // Admin Support & Direct Coordination Card (preserved from D38)
            HomeAdminContactCard()
        }

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // 4. Core FORERUN Services (Grocery Delivery + Secondary Services)
        QuickServicesSection(
            onGroceryClick = onNewOrderClick,
            onSecondaryServiceClick = { showServiceDialog = true },
            onStoreCatalogClick = { activeComingSoonFeature = ComingSoonFeature.STORE_CATALOG },
            onProductSearchClick = { activeComingSoonFeature = ComingSoonFeature.PRODUCT_SEARCH }
        )

        // Bottom breathing room
        Spacer(modifier = Modifier.height(Dimens.Space24))
    }
}

/**
 * 1. Top Header Component matching mockup
 */
@Composable
private fun HomeTopHeader(
    profile: CustomerProfile,
    onLocationClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Right in RTL: User greeting + Location badge (without avatar circle)
        Column(
            modifier = Modifier.weight(1f, fill = false)
        ) {
            Text(
                text = stringResource(R.string.home_greeting_user, profile.name.substringBefore(" ")),
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy
            )
            Spacer(modifier = Modifier.height(2.dp))
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                    .clickable { onLocationClick() }
                    .padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = ForerunOrange,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = stringResource(R.string.home_location_default),
                    fontSize = 12.sp,
                    color = ForerunTextMuted,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.width(2.dp))
                Icon(
                    imageVector = Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = ForerunTextMuted,
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(Dimens.Space12))

        // Left in RTL: Real FORERUN Brand Logo Asset (doubled in size: 72.dp)
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = stringResource(R.string.app_name),
            modifier = Modifier.size(72.dp),
            contentScale = ContentScale.Fit
        )
    }
}

/**
 * 2. Promotional Banners section (with fallback promo banner matching mockup)
 */
@Composable
private fun HomeBannersSection(
    bannerUiState: BannerUiState,
    onNewOrderClick: () -> Unit,
    onNavigateToRoute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val hasBanners = (bannerUiState as? BannerUiState.Success)?.banners?.isNotEmpty() == true

    if (hasBanners) {
        BannersSection(
            uiState = bannerUiState,
            onNavigateToRoute = onNavigateToRoute,
            modifier = modifier
        )
    } else {
        // Fallback promo card matching the mockup when banners are loading or empty
        Column(modifier = modifier.fillMaxWidth()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 8f)
                    .clip(RoundedCornerShape(20.dp))
                    .clickable { onNewOrderClick() },
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    Image(
                        painter = painterResource(R.drawable.grocery_promo),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Scrim gradient for readability
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color.Black.copy(alpha = 0.2f),
                                        Color.Black.copy(alpha = 0.75f)
                                    )
                                )
                            )
                    )

                    // Overlay Content
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(Dimens.Space14),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Top Tags
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                                    .background(ForerunMint)
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = stringResource(R.string.home_banner_badge_instant),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ForerunNavy
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                                    .background(Color.Black.copy(alpha = 0.45f))
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = stringResource(R.string.home_banner_location_tag),
                                    fontSize = 11.sp,
                                    color = Color.White
                                )
                            }
                        }

                        // Bottom Title & CTA Button
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Text(
                                text = stringResource(R.string.home_banner_promo_title),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                lineHeight = 19.sp,
                                modifier = Modifier.weight(1f)
                            )

                            Spacer(modifier = Modifier.width(Dimens.Space8))

                            Button(
                                onClick = onNewOrderClick,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = ForerunOrange,
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(Dimens.RadiusPill),
                                elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = stringResource(R.string.home_cta_button),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space8))

            // Carousel dots
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 3.dp)
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(ForerunBorder)
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 3.dp)
                        .height(6.dp)
                        .width(18.dp)
                        .clip(CircleShape)
                        .background(ForerunOrange)
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 3.dp)
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(ForerunBorder)
                )
            }
        }
    }
}

/**
 * 3. Active Order Card Component
 */
@Composable
private fun ActiveOrderCard(
    order: ActiveOrder,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alphaAnim by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    val statusColors = getOrderStatusColors(order.status)
    val statusLabelRes = getOrderStatusLabelRes(order.status)

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(1.dp, ForerunMint.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Top orange accent highlight line
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(ForerunOrange)
            )

            Column(modifier = Modifier.padding(Dimens.Space16)) {
                // Header: Line 1 (طلب جاري + شارة الحالة بأفق واحد) + Line 2 (رقم الطلب الكامل بلا اقتطاع) + أيقونة السلة
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        // السطر الأول: "طلب جاري" وبجانبه شارة الحالة في نفس السطر بدون انكسار
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
                        ) {
                            Text(
                                text = stringResource(R.string.home_active_order_label),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunNavy,
                                maxLines = 1,
                                softWrap = false
                            )

                            // Dynamic Status pill on a single line (لا ينكسر لسطرين)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                                    .background(statusColors.background)
                                    .padding(horizontal = 9.dp, vertical = 3.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(statusColors.text.copy(alpha = alphaAnim))
                                    )
                                    Text(
                                        text = stringResource(statusLabelRes),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = statusColors.text,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // السطر الثاني: رقم الطلب ممتد بالكامل مع تفاصيل المواد والرسوم دون أي اقتطاع
                        Text(
                            text = stringResource(
                                R.string.home_order_summary_full,
                                "\u200E#${order.orderNumber}\u200E",
                                order.itemCount,
                                order.totalFee
                            ),
                            fontSize = 12.sp,
                            color = ForerunTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.width(Dimens.Space10))

                    // أيقونة السلة الأنيقة
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ForerunOrangeLight.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ShoppingCart,
                            contentDescription = null,
                            tint = ForerunOrange,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space16))

                // 4-Step Stepper matching FORERUN State Machine
                HomeOrderStepper(status = order.status)

                Spacer(modifier = Modifier.height(Dimens.Space14))

                // Runner Information Bar (أو رسالة انتظار تعيين المندوب)
                if (order.runnerName != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ForerunMintLight.copy(alpha = 0.4f))
                            .padding(Dimens.Space10),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(ForerunMintSoft),
                                contentAlignment = Alignment.Center
                            ) {
                                val initial = order.runnerName.trim().firstOrNull()?.toString()
                                if (!initial.isNullOrBlank()) {
                                    Text(
                                        text = initial,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        color = ForerunMintDark
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = null,
                                        tint = ForerunNavy,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }

                            Column {
                                Text(
                                    text = order.runnerName,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ForerunNavy,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = stringResource(R.string.home_runner_role_certified),
                                    fontSize = 11.sp,
                                    color = ForerunTextMuted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(Dimens.Space8))

                        // أزرار سريعة دائرية (واتساب + اتصال) تلغي الازدحام الأفقي تماماً
                        Row(horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)) {
                            val runnerWa = order.runnerWhatsapp ?: order.runnerPhone
                            if (runnerWa != null) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(WhatsAppGreen)
                                        .clickable {
                                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$runnerWa"))
                                            context.startActivity(intent)
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Chat,
                                        contentDescription = stringResource(R.string.home_btn_whatsapp),
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }

                            val runnerPhone = order.runnerPhone
                            if (runnerPhone != null) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(ForerunSurface)
                                        .border(1.dp, ForerunBorder, CircleShape)
                                        .clickable {
                                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$runnerPhone"))
                                            context.startActivity(intent)
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Call,
                                        contentDescription = stringResource(R.string.home_btn_call),
                                        tint = ForerunNavy,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ForerunMintLight.copy(alpha = 0.35f))
                            .padding(horizontal = Dimens.Space12, vertical = Dimens.Space10),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            modifier = Modifier.weight(1f, fill = false),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(30.dp)
                                    .clip(CircleShape)
                                    .background(ForerunMintSoft),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = ForerunMintDark,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(Dimens.Space8))
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = stringResource(R.string.home_awaiting_runner_badge),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ForerunNavy
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(Dimens.RadiusPill))
                                            .background(ForerunMintSoft)
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = stringResource(R.string.tag_direct_coord),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ForerunMintDark
                                        )
                                    }
                                }
                                Text(
                                    text = stringResource(R.string.home_awaiting_runner),
                                    fontSize = 10.sp,
                                    color = ForerunTextMuted
                                )
                            }
                        }

                        // Contact Admin button when awaiting runner
                        Button(
                            onClick = {
                                val url = "https://wa.me/${AppConfig.ADMIN_SUPPORT_WHATSAPP}"
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                } catch (_: Exception) {}
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                            shape = RoundedCornerShape(Dimens.RadiusPill),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Chat,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = stringResource(R.string.tag_via_admin),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                // Bottom action: زر متابعة تفاصيل وتتبع الطلب بدقة (عريض وبارز كزر CTA حقيقي)
                Spacer(modifier = Modifier.height(Dimens.Space12))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(ForerunOrangeLight.copy(alpha = 0.2f))
                        .clickable { onClick() }
                        .padding(vertical = 10.dp, horizontal = Dimens.Space12),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = stringResource(R.string.home_track_order_action),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunOrange
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = ForerunOrange,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Modern 4-Step Stepper Component
 */
@Composable
private fun HomeOrderStepper(status: String) {
    val stepIndex = when (status) {
        "PENDING_REVIEW", "UNDER_REVIEW", "AWAITING_RUNNER", "AWAITING_PREFERRED_RUNNER", "ASSIGNED" -> 1
        "IN_PROGRESS" -> 2
        "OUT_FOR_DELIVERY" -> 3
        "DELIVERED" -> 4
        else -> 1
    }

    val steps = listOf(
        stringResource(R.string.home_step_confirmed),
        stringResource(R.string.home_step_purchasing),
        stringResource(R.string.home_step_on_the_way),
        stringResource(R.string.home_step_delivered)
    )

    Box(modifier = Modifier.fillMaxWidth()) {
        // Connecting track line behind circles
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Spacer(modifier = Modifier.weight(0.5f))
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(3.dp)
                    .background(if (stepIndex > 1) ForerunOrange else ForerunBorder)
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(3.dp)
                    .background(if (stepIndex > 2) ForerunOrange else ForerunBorder)
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(3.dp)
                    .background(if (stepIndex > 3) ForerunOrange else ForerunBorder)
            )
            Spacer(modifier = Modifier.weight(0.5f))
        }

        // 4 Step Nodes
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            steps.forEachIndexed { index, stepLabel ->
                val stepNumber = index + 1
                val isDone = stepNumber < stepIndex
                val isCurrent = stepNumber == stepIndex

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    isDone -> ForerunOrange
                                    isCurrent -> ForerunOrange
                                    else -> ForerunSoftSurface
                                }
                            )
                            .border(
                                width = if (isCurrent) 2.dp else 1.dp,
                                color = when {
                                    isCurrent -> ForerunOrangeLight
                                    !isDone -> ForerunBorder
                                    else -> Color.Transparent
                                },
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        when {
                            isDone -> {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                            isCurrent -> {
                                Icon(
                                    imageVector = Icons.Default.LocalShipping,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                            else -> {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(ForerunBorder)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(5.dp))

                    Text(
                        text = stepLabel,
                        fontSize = 11.sp,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                        color = when {
                            isCurrent -> ForerunOrange
                            isDone -> ForerunNavy
                            else -> ForerunTextMuted
                        },
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/**
 * Card displayed when there is no active order
 */
@Composable
private fun HomeNoActiveOrderCard(
    onNewOrderClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .border(1.dp, ForerunMint.copy(alpha = 0.5f), RoundedCornerShape(18.dp))
            .clickable { onNewOrderClick() },
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(ForerunMintSoft),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingCart,
                    contentDescription = null,
                    tint = ForerunMintDark,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(Dimens.Space12))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.home_no_active_orders),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunNavy
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.home_no_active_orders_desc),
                    fontSize = 11.sp,
                    color = ForerunTextMuted
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = ForerunOrange,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

/**
 * 4. Core FORERUN Services Component (Grocery + Parcels + Passenger Rides)
 */
@Composable
private fun QuickServicesSection(
    onGroceryClick: () -> Unit,
    onSecondaryServiceClick: () -> Unit,
    onStoreCatalogClick: () -> Unit = {},
    onProductSearchClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        // Section Title
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.services_section_title),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy
            )
            Text(
                text = stringResource(R.string.services_section_subtitle),
                fontSize = 11.sp,
                color = ForerunMintDark,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        // Main Feature: Grocery Delivery (Hero Service Card)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .border(1.dp, ForerunMint.copy(alpha = 0.5f), RoundedCornerShape(18.dp))
                .clickable { onGroceryClick() },
            colors = CardDefaults.cardColors(containerColor = ForerunSurface),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Dimens.Space16)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ForerunMintSoft),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Storefront,
                            contentDescription = null,
                            tint = ForerunNavy,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    Text(
                        text = stringResource(R.string.service_grocery_title),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))

                Text(
                    text = stringResource(R.string.service_grocery_desc),
                    fontSize = 12.sp,
                    color = ForerunTextMuted,
                    lineHeight = 18.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(Dimens.Space12))

                // Prominent Full-Width Orange Action Button (+ اطلب حاجياتك الآن)
                Button(
                    onClick = onGroceryClick,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunOrange,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(42.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space6))
                        Text(
                            text = stringResource(R.string.home_service_grocery_btn),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // Secondary Section Sub-Header: خدمات تنطلق قريباً
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.services_coming_soon_title),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunNavy
            )
            Text(
                text = stringResource(R.string.services_coming_soon_subtitle),
                fontSize = 11.sp,
                color = ForerunTextMuted,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        // Secondary 2-Column Grid (Parcels & Passenger Rides with "قريباً" badge and WhatsApp coordination dialog)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
        ) {
            // Card 1: Parcels & Deliveries (طرود وأمانات)
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { onSecondaryServiceClick() },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space12)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunMintSoft),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Inventory2,
                                contentDescription = null,
                                tint = ForerunNavy,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        // Badge: "قريباً"
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunSoftSurface)
                                .border(1.dp, ForerunBorder.copy(alpha = 0.7f), RoundedCornerShape(Dimens.RadiusPill))
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_tag_coming_soon),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunTextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space8))

                    Text(
                        text = stringResource(R.string.service_parcels_title),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.service_parcels_desc),
                        fontSize = 10.sp,
                        color = ForerunTextMuted,
                        lineHeight = 14.sp
                    )

                    Spacer(modifier = Modifier.height(Dimens.Space10))

                    // WhatsApp coordination prompt
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(ForerunMintLight)
                            .padding(vertical = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Chat,
                                contentDescription = null,
                                tint = ForerunMintDark,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(R.string.service_card_whatsapp_coord),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunMintDark
                            )
                        }
                    }
                }
            }

            // Card 2: Passenger Rides (مشاوير ركاب)
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { onSecondaryServiceClick() },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space12)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunMintSoft),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalTaxi,
                                contentDescription = null,
                                tint = ForerunNavy,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        // Badge: "قريباً"
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunSoftSurface)
                                .border(1.dp, ForerunBorder.copy(alpha = 0.7f), RoundedCornerShape(Dimens.RadiusPill))
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_tag_coming_soon),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunTextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space8))

                    Text(
                        text = stringResource(R.string.service_rides_title),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.service_rides_desc),
                        fontSize = 10.sp,
                        color = ForerunTextMuted,
                        lineHeight = 14.sp
                    )

                    Spacer(modifier = Modifier.height(Dimens.Space10))

                    // WhatsApp coordination prompt
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(ForerunMintLight)
                            .padding(vertical = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Chat,
                                contentDescription = null,
                                tint = ForerunMintDark,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(R.string.service_card_whatsapp_coord),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunMintDark
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        // Secondary Coming Soon Grid: Store Catalog & Product Search (Awareness only / D30)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Max),
            horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
        ) {
            // Card 3: Store Catalog (اختيار متجر محدد والتسوق منه مباشرة)
            Card(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { onStoreCatalogClick() },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(Dimens.Space12)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunMintSoft),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Store,
                                contentDescription = null,
                                tint = ForerunNavy,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        // Distinct "قريباً" Badge
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunOrangeLight)
                                .border(1.dp, ForerunOrange.copy(alpha = 0.35f), RoundedCornerShape(Dimens.RadiusPill))
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_tag_coming_soon),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunOrangeDark
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space8))

                    Text(
                        text = stringResource(R.string.service_store_catalog_title),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.service_store_catalog_desc),
                        fontSize = 10.sp,
                        color = ForerunTextMuted,
                        lineHeight = 14.sp
                    )

                    Spacer(modifier = Modifier.weight(1f))
                    Spacer(modifier = Modifier.height(Dimens.Space10))

                    // Awareness info prompt
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(ForerunMintLight)
                            .padding(vertical = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = ForerunMintDark,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(R.string.service_card_learn_more),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunMintDark
                            )
                        }
                    }
                }
            }

            // Card 4: Product Search (البحث عن غرض عبر المتاجر)
            Card(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { onProductSearchClick() },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(Dimens.Space12)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunMintSoft),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = ForerunNavy,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        // Distinct "قريباً" Badge
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunOrangeLight)
                                .border(1.dp, ForerunOrange.copy(alpha = 0.35f), RoundedCornerShape(Dimens.RadiusPill))
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_tag_coming_soon),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunOrangeDark
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space8))

                    Text(
                        text = stringResource(R.string.service_product_search_title),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.service_product_search_desc),
                        fontSize = 10.sp,
                        color = ForerunTextMuted,
                        lineHeight = 14.sp
                    )

                    Spacer(modifier = Modifier.weight(1f))
                    Spacer(modifier = Modifier.height(Dimens.Space10))

                    // Awareness info prompt
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(ForerunMintLight)
                            .padding(vertical = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = ForerunMintDark,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(R.string.service_card_learn_more),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunMintDark
                            )
                        }
                    }
                }
            }
        }
    }
}

private enum class ComingSoonFeature {
    STORE_CATALOG,
    PRODUCT_SEARCH
}

/**
 * Awareness dialog for upcoming store & search features (D30 / Pre-launch awareness).
 * Purely local presentation with zero API or repository calls.
 */
@Composable
private fun ComingSoonFeatureDialog(
    feature: ComingSoonFeature,
    onDismiss: () -> Unit
) {
    val (titleRes, descRes, icon) = when (feature) {
        ComingSoonFeature.STORE_CATALOG -> Triple(
            R.string.service_store_catalog_dialog_title,
            R.string.service_store_catalog_dialog_desc,
            Icons.Default.Store
        )
        ComingSoonFeature.PRODUCT_SEARCH -> Triple(
            R.string.service_product_search_dialog_title,
            R.string.service_product_search_dialog_desc,
            Icons.Default.Search
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(ForerunOrangeLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = ForerunOrangeDark,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = stringResource(titleRes),
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = ForerunNavy
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
            ) {
                Text(
                    text = stringResource(descRes),
                    fontSize = 13.sp,
                    color = ForerunNavy,
                    lineHeight = 20.sp
                )

                // Callout banner with explicit notice that this feature is in development
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(ForerunSoftSurface)
                        .border(1.dp, ForerunBorder, RoundedCornerShape(12.dp))
                        .padding(horizontal = Dimens.Space12, vertical = Dimens.Space10)
                ) {
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = ForerunOrange,
                            modifier = Modifier
                                .size(16.dp)
                                .padding(top = 2.dp)
                        )
                        Text(
                            text = stringResource(R.string.coming_soon_feature_in_dev_notice),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = ForerunTextMuted,
                            lineHeight = 18.sp
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ForerunNavy,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
            ) {
                Text(
                    text = stringResource(R.string.coming_soon_dialog_dismiss),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        },
        shape = RoundedCornerShape(20.dp),
        containerColor = ForerunSurface
    )
}

/**
 * 5. Account Stats Summary Component
 */
@Composable
private fun HomeStatsSection(
    profile: CustomerProfile,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                    contentDescription = null,
                    tint = ForerunNavy,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = stringResource(R.string.home_stats_heading),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunNavy
                )
            }
            Text(
                text = stringResource(R.string.home_stats_month),
                fontSize = 11.sp,
                color = ForerunTextMuted
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
        ) {
            // Card 1: Completed Orders
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunMint.copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = ForerunMintLight.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = stringResource(R.string.home_stats_completed_label),
                            fontSize = 11.sp,
                            color = ForerunTextMuted
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = stringResource(R.string.home_stats_orders_count, profile.completedOrders),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunNavy
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(ForerunMintSoft),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = ForerunMintDark,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Card 2: Savings / Fees
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunOrange.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = ForerunOrangeLight.copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = stringResource(R.string.home_stats_savings_label),
                            fontSize = 11.sp,
                            color = ForerunTextMuted
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${profile.totalFeesPaid} ${stringResource(R.string.home_currency)}",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunOrange
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(ForerunOrange.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ShoppingCart,
                            contentDescription = null,
                            tint = ForerunOrange,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Admin Support and Direct Coordination Card
 */
@Composable
fun HomeAdminContactCard(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(1.dp, ForerunBorder.copy(alpha = 0.6f), RoundedCornerShape(20.dp)),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space12)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(ForerunOrangeLight.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        tint = ForerunOrange,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Text(
                        text = stringResource(R.string.home_admin_support_title),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Text(
                        text = stringResource(R.string.home_admin_support_subtitle),
                        fontSize = 11.sp,
                        color = ForerunTextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(Dimens.Space6)) {
                // WhatsApp Admin Button
                Button(
                    onClick = {
                        val url = "https://wa.me/${AppConfig.ADMIN_SUPPORT_WHATSAPP}"
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {}
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                    shape = RoundedCornerShape(Dimens.RadiusPill),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = stringResource(R.string.home_btn_whatsapp),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                // Call Admin Button
                OutlinedButton(
                    onClick = {
                        val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${AppConfig.ADMIN_SUPPORT_PHONE}"))
                        try {
                            context.startActivity(dialIntent)
                        } catch (_: Exception) {}
                    },
                    shape = RoundedCornerShape(Dimens.RadiusPill),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ForerunNavy),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Call,
                        contentDescription = null,
                        tint = ForerunNavy,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = stringResource(R.string.home_btn_call),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                }
            }
        }
    }
}

// =========================================================================
// Previews for Android Studio
// =========================================================================

@Preview(name = "HomeScreen - With Active Order (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 920, locale = "ar")
@Composable
private fun HomeScreenFullPreview() {
    val sampleProfile = CustomerProfile(
        id = "cust-1",
        name = "أحمد محمد",
        whatsapp = "0912345678",
        status = com.forerun.customer.domain.model.UserStatus.VERIFIED,
        completedOrders = 14,
        totalFeesPaid = 25000,
        createdAt = java.time.Instant.now()
    )

    val sampleOrder = ActiveOrder(
        id = "ord-1",
        orderNumber = "4892",
        status = "OUT_FOR_DELIVERY",
        itemCount = 5,
        totalFee = 5000,
        createdAt = "2026-10-10T10:00:00Z",
        runnerName = "سامر",
        runnerPhone = "0912345678",
        runnerWhatsapp = "0912345678"
    )

    ForerunTheme {
        HomeContent(
            profile = sampleProfile,
            activeOrder = sampleOrder,
            bannerUiState = BannerUiState.Empty,
            onNewOrderClick = {},
            onOrderDetailClick = {},
            onNavigateToRoute = {}
        )
    }
}

@Preview(name = "HomeScreen - No Active Order (RTL Arabic)", showBackground = true, widthDp = 390, heightDp = 844, locale = "ar")
@Composable
private fun HomeScreenIdlePreview() {
    val sampleProfile = CustomerProfile(
        id = "cust-1",
        name = "أحمد محمد",
        whatsapp = "0912345678",
        status = com.forerun.customer.domain.model.UserStatus.VERIFIED,
        completedOrders = 3,
        totalFeesPaid = 4500,
        createdAt = java.time.Instant.now()
    )

    ForerunTheme {
        HomeContent(
            profile = sampleProfile,
            activeOrder = null,
            bannerUiState = BannerUiState.Empty,
            onNewOrderClick = {},
            onOrderDetailClick = {},
            onNavigateToRoute = {}
        )
    }
}
