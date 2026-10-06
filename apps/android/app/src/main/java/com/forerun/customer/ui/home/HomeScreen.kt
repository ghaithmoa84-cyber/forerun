package com.forerun.customer.ui.home

import android.content.Intent
import android.net.Uri
import com.forerun.customer.ui.order.getOrderStatusColors
import com.forerun.customer.ui.order.getOrderStatusLabelRes
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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocalTaxi
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.core.config.AppConfig
import com.forerun.customer.domain.model.ActiveOrder
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSuccess
import com.forerun.customer.ui.theme.ForerunSuccessLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.WhatsAppGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToCreateOrder: () -> Unit = {},
    onNavigateToOrderDetail: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(viewModel) {
        viewModel.navigateToLogin.collect {
            onNavigateToLogin()
        }
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
                    CircularProgressIndicator(color = ForerunGreen)
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
                        onClick = { viewModel.handleIntent(HomeIntent.Refresh) },
                        colors = ButtonDefaults.buttonColors(containerColor = ForerunGreen)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Text(stringResource(R.string.home_retry))
                    }
                }
            }

            is HomeUiState.Success -> {
                PullToRefreshBox(
                    isRefreshing = state.isRefreshing,
                    onRefresh = { viewModel.onIntent(HomeIntent.Refresh) },
                    modifier = Modifier.fillMaxSize()
                ) {
                    HomeContent(
                        profile = state.profile,
                        activeOrder = state.activeOrder,
                        onNewOrderClick = onNavigateToCreateOrder,
                        onOrderDetailClick = onNavigateToOrderDetail
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeContent(
    profile: CustomerProfile,
    activeOrder: ActiveOrder?,
    onNewOrderClick: () -> Unit,
    onOrderDetailClick: (String) -> Unit
) {
    var showServiceDialog by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current

    if (showServiceDialog) {
        AlertDialog(
            onDismissRequest = { showServiceDialog = false },
            title = {
                Text(
                    text = stringResource(R.string.service_in_dev_dialog_title),
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = ForerunTextPrimary
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
                        imageVector = Icons.Default.Chat,
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space16)
    ) {
        // 1. Top Bar: Avatar Greeting + Logo 48dp + Notification Icon
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // User Greeting with Avatar
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(ForerunGreenLight),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = profile.name.trim().take(1).ifEmpty { stringResource(R.string.label_avatar_fallback_letter) },
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreenDark
                    )
                }

                Column {
                    Text(
                        text = stringResource(R.string.home_greeting_morning, profile.name.substringBefore(" ")),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = ForerunGreenDark,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = stringResource(R.string.label_delivery_area),
                            fontSize = 11.sp,
                            color = ForerunTextMuted
                        )
                    }
                }
            }

            // Brand Logo (48dp) + Notification Bell
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.logo),
                    contentDescription = stringResource(R.string.app_name),
                    modifier = Modifier.size(48.dp)
                )

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(ForerunSoftSurface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                            contentDescription = stringResource(R.string.label_notifications),
                        tint = ForerunTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space16))

        // 2. Hero Gradient CTA Card (#7DDDD4 -> #3ABFB5, 20dp corners)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .clickable { onNewOrderClick() },
            colors = CardDefaults.cardColors(containerColor = Color.Transparent),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(ForerunGreen, ForerunGreenDark)
                        )
                    )
                    .padding(Dimens.Space20)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.home_cta_badge),
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.9f),
                            fontWeight = FontWeight.Medium
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(Color.White.copy(alpha = 0.22f))
                                .padding(horizontal = Dimens.Space8, vertical = Dimens.Space2)
                        ) {
                            Text(
                                text = stringResource(R.string.home_cta_delivery_badge),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space6))

                    Text(
                        text = stringResource(R.string.home_cta_title),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(Dimens.Space4))

                    Text(
                        text = stringResource(R.string.home_cta_subtitle),
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.92f)
                    )

                    Spacer(modifier = Modifier.height(Dimens.Space16))

                    Button(
                        onClick = onNewOrderClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(Dimens.RadiusPill),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White,
                            contentColor = ForerunGreenDark
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = ForerunGreenDark,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Text(
                            text = stringResource(R.string.home_cta_button),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunGreenDark
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // 3. Active Order Card (Real API Bound)
        if (activeOrder != null) {
            ActiveOrderCard(
                order = activeOrder,
                onClick = { onOrderDetailClick(activeOrder.id) }
            )
        } else {
            HomeNoActiveOrderCard(
                onNewOrderClick = onNewOrderClick
            )
        }
        Spacer(modifier = Modifier.height(Dimens.Space20))

        // 4. Services Section
        Text(
            text = stringResource(R.string.services_section_title),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunTextPrimary
        )
        Text(
            text = stringResource(R.string.services_section_subtitle),
            fontSize = 12.sp,
            color = ForerunTextMuted
        )

        Spacer(modifier = Modifier.height(Dimens.Space12))

        // Row 1: Grocery Card (Large Primary)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                .clickable { onNewOrderClick() },
            colors = CardDefaults.cardColors(containerColor = ForerunGreenLight)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(Dimens.Space16),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space12)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ForerunSurface),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Storefront,
                            contentDescription = null,
                            tint = ForerunGreenDark,
                            modifier = Modifier.size(26.dp)
                        )
                    }

                    Column {
                        Text(
                            text = stringResource(R.string.service_grocery_title),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunTextPrimary
                        )
                        Text(
                            text = stringResource(R.string.service_grocery_desc),
                            fontSize = 12.sp,
                            color = ForerunTextMuted
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(ForerunSurface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null,
                        tint = ForerunGreenDark,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space10))

        // Row 2: 2-Column Grid (Parcels + Rides)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Dimens.Space10)
        ) {
            // Parcels Card
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { showServiceDialog = true },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space14)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Inventory2,
                                contentDescription = null,
                                tint = ForerunGreenDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunSoftSurface)
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_parcels_tag),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForerunTextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space12))

                    Text(
                        text = stringResource(R.string.service_parcels_title),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = stringResource(R.string.service_parcels_desc),
                        fontSize = 11.sp,
                        color = ForerunTextMuted
                    )
                }
            }

            // Rides Card
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
                    .clickable { showServiceDialog = true },
                colors = CardDefaults.cardColors(containerColor = ForerunSurface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space14)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ForerunGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalTaxi,
                                contentDescription = null,
                                tint = ForerunGreenDark,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunSoftSurface)
                                .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.service_rides_tag),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForerunTextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space12))

                    Text(
                        text = stringResource(R.string.service_rides_title),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = stringResource(R.string.service_rides_desc),
                        fontSize = 11.sp,
                        color = ForerunTextMuted
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(Dimens.Space20))

        // 5. Account Stats Summary Card
        StatsCard(profile = profile)

        Spacer(modifier = Modifier.height(Dimens.Space24))
    }
}

@Composable
private fun ActiveOrderCard(
    order: ActiveOrder,
    onClick: () -> Unit
) {
    val context = LocalContext.current
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alphaAnim by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(Dimens.Space16)) {
            // Header Row: Order number + Pulsing status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.ShoppingCart,
                        contentDescription = null,
                        tint = ForerunGreenDark,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space6))
                    Text(
                        text = stringResource(R.string.home_order_num, order.orderNumber),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                }

                val statusColors = getOrderStatusColors(order.status)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(Dimens.RadiusPill))
                        .background(statusColors.background)
                        .padding(horizontal = Dimens.Space10, vertical = Dimens.Space4)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(statusColors.text.copy(alpha = alphaAnim))
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space6))
                        Text(
                            text = stringResource(getOrderStatusLabelRes(order.status)),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = statusColors.text
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space14))

            // 4-Step Horizontal Stepper
            OrderStepper(status = order.status)

            // Runner Information & Direct Action Buttons (WhatsApp + Call)
            if (!order.runnerName.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(Dimens.Space12))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(ForerunSoftSurface)
                        .padding(Dimens.Space10),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(ForerunGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = order.runnerName.trim().take(1),
                                fontWeight = FontWeight.Bold,
                                color = ForerunGreenDark,
                                fontSize = 14.sp
                            )
                        }

                        Column {
                            Text(
                                text = stringResource(R.string.home_active_runner_name, order.runnerName),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunTextPrimary
                            )
                            Text(
                                text = stringResource(R.string.home_verified_runner),
                                fontSize = 11.sp,
                                color = ForerunTextMuted
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(Dimens.Space6)) {
                        if (!order.runnerWhatsapp.isNullOrBlank()) {
                            IconButton(
                                onClick = {
                                    val waUrl = "https://wa.me/${order.runnerWhatsapp}"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(waUrl))
                                    context.startActivity(intent)
                                },
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(WhatsAppGreen)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Chat,
                                    contentDescription = stringResource(R.string.label_runner_whatsapp),
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        val phoneToCall = order.runnerPhone ?: order.runnerWhatsapp
                        if (!phoneToCall.isNullOrBlank()) {
                            IconButton(
                                onClick = {
                                    val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneToCall"))
                                    context.startActivity(callIntent)
                                },
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(ForerunGreenDark)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Call,
                                    contentDescription = stringResource(R.string.label_runner_call),
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space10))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.home_items_fee_summary, order.itemCount, order.totalFee, stringResource(R.string.home_currency)),
                    fontSize = 12.sp,
                    color = ForerunTextMuted
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.home_track_order),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreenDark
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null,
                        tint = ForerunGreenDark,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeNoActiveOrderCard(
    onNewOrderClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp))
            .clickable { onNewOrderClick() },
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
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
                    .background(ForerunGreenLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ShoppingCart,
                    contentDescription = null,
                    tint = ForerunGreenDark,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(Dimens.Space14))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.home_no_active_orders),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = stringResource(R.string.home_no_active_orders_desc),
                    fontSize = 12.sp,
                    color = ForerunTextMuted
                )
            }
        }
    }
}

@Composable
private fun OrderStepper(status: String) {
    val stepIndex = when (status) {
        "PENDING_REVIEW", "UNDER_REVIEW", "AWAITING_RUNNER", "AWAITING_PREFERRED_RUNNER", "ASSIGNED" -> 1
        "IN_PROGRESS" -> 2
        "OUT_FOR_DELIVERY" -> 3
        "DELIVERED" -> 4
        else -> 1
    }

    val steps = listOf(
        stringResource(R.string.home_step_picked_up),
        stringResource(R.string.home_step_purchasing),
        stringResource(R.string.home_step_on_the_way),
        stringResource(R.string.home_step_delivered)
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
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
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                isDone -> ForerunGreenDark
                                isCurrent -> ForerunGreen
                                else -> ForerunSoftSurface
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isDone) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                    } else {
                        Text(
                            text = "$stepNumber",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isCurrent) Color.White else ForerunTextMuted
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = stepLabel,
                    fontSize = 10.sp,
                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                    color = if (isCurrent) ForerunGreenDark else ForerunTextMuted,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}


@Composable
private fun StatsCard(profile: CustomerProfile) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, ForerunBorder, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Text(
                text = stringResource(R.string.home_stats_title),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )

            Spacer(modifier = Modifier.height(Dimens.Space12))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${profile.completedOrders}",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreenDark
                    )
                    Text(
                        text = stringResource(R.string.home_completed_orders),
                        fontSize = 12.sp,
                        color = ForerunTextMuted
                    )
                }

                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(36.dp)
                        .background(ForerunBorder)
                )

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${profile.totalFeesPaid} ${stringResource(R.string.home_currency)}",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreenDark
                    )
                    Text(
                        text = stringResource(R.string.home_total_fees),
                        fontSize = 12.sp,
                        color = ForerunTextMuted
                    )
                }
            }
        }
    }
}

