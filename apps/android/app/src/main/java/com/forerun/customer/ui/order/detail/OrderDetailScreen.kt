package com.forerun.customer.ui.order.detail

import android.content.Intent
import android.net.Uri
import com.forerun.customer.ui.order.getOrderStatusColors
import com.forerun.customer.ui.order.getOrderStatusLabelRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
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
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.forerun.customer.domain.model.CancelOrderError
import com.forerun.customer.domain.model.CustomerOrderDetail
import com.forerun.customer.domain.model.OrderRunnerDetail
import com.forerun.customer.domain.model.OrderStoreDetail
import com.forerun.customer.domain.model.OrderTimeline
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSuccess
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.ForerunWarning
import com.forerun.customer.ui.theme.WhatsAppGreen
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    onNavigateBack: () -> Unit,
    onNavigateToRating: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: OrderDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    val cancelSuccessMsg = stringResource(R.string.order_detail_cancel_success)
    val feeUpdatedMsg = stringResource(R.string.order_detail_fee_updated_notice)

    val cancelErrorMsg = when (uiState.cancelError) {
        is CancelOrderError.NotAllowed -> stringResource(R.string.order_detail_cancel_error_not_allowed)
        is CancelOrderError.StateChanged -> stringResource(R.string.order_detail_cancel_error_state_changed)
        is CancelOrderError.NotFound -> stringResource(R.string.order_detail_cancel_error_not_found)
        is CancelOrderError.Network -> stringResource(R.string.order_detail_cancel_error_network)
        is CancelOrderError.Unknown -> stringResource(R.string.order_detail_cancel_error)
        null -> null
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onIntent(OrderDetailIntent.ClearError)
        }
    }

    LaunchedEffect(uiState.cancelError) {
        cancelErrorMsg?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.onIntent(OrderDetailIntent.ClearError)
        }
    }

    LaunchedEffect(uiState.cancelSuccess) {
        if (uiState.cancelSuccess) {
            snackbarHostState.showSnackbar(cancelSuccessMsg)
            viewModel.onIntent(OrderDetailIntent.ClearCancelSuccess)
        }
    }

    LaunchedEffect(uiState.feeUpdatedNotice) {
        if (uiState.feeUpdatedNotice) {
            snackbarHostState.showSnackbar(feeUpdatedMsg)
            viewModel.onIntent(OrderDetailIntent.ClearFeeNotice)
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = ForerunSoftSurface,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (uiState.order != null) {
                            stringResource(R.string.order_detail_number, uiState.order!!.orderNumber)
                        } else {
                            stringResource(R.string.order_detail_title)
                        },
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = null,
                            tint = ForerunTextPrimary
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.onIntent(OrderDetailIntent.Refresh) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            tint = ForerunTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ForerunSurface)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.onIntent(OrderDetailIntent.Refresh) },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = ForerunGreen)
                            Spacer(modifier = Modifier.height(Dimens.Space12))
                            Text(
                                text = stringResource(R.string.order_detail_loading),
                                color = ForerunTextMuted,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
                uiState.order == null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(Dimens.Space24),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = ForerunDanger,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(Dimens.Space12))
                            Text(
                                text = stringResource(R.string.order_detail_error_loading),
                                color = ForerunTextPrimary,
                                fontSize = 15.sp,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(Dimens.Space16))
                            Button(
                                onClick = { viewModel.onIntent(OrderDetailIntent.Load) },
                                colors = ButtonDefaults.buttonColors(containerColor = ForerunGreen)
                            ) {
                                Text(stringResource(R.string.order_detail_retry))
                            }
                        }
                    }
                }
                else -> {
                    val order = uiState.order!!
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(Dimens.Space16),
                        verticalArrangement = Arrangement.spacedBy(Dimens.Space16)
                    ) {
                        // 1. Status Banner
                        StatusBanner(order = order)

                        // 2. Delivered / Rating Action Card
                        if (order.status == "DELIVERED" && (uiState.canRate || order.rating != null)) {
                            DeliveredRatingCard(
                                order = order,
                                canRate = uiState.canRate,
                                onRateClick = { onNavigateToRating(order.id) }
                            )
                        }

                        // 3. Vertical Timeline Stepper
                        TimelineCard(
                            status = order.status,
                            timeline = order.timeline,
                            cancelReason = order.cancelReason
                        )

                        // 4. Runner Card
                        if (order.runner != null && uiState.canContactRunner) {
                            RunnerCard(
                                runner = order.runner,
                                onWhatsAppClick = { phone ->
                                    val url = com.forerun.customer.core.config.AppConfig.buildRunnerWhatsAppUrl(phone)
                                    try {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                    } catch (_: Exception) {}
                                },
                                onCallClick = { phone ->
                                    try {
                                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                                    } catch (_: Exception) {}
                                }
                            )
                        }

                        // 5. Stores and Items Card
                        StoresAndItemsCard(
                            stores = order.stores,
                            items = order.items
                        )

                        // 6. Pricing Breakdown Card
                        PricingCard(order = order)

                        // 7. Delivery Address & Notes Card
                        DeliveryInfoCard(order = order)

                        // 8. Cancel Order Button (Only for PENDING_REVIEW / ASSIGNED)
                        if (uiState.canCancel) {
                            CancelOrderSection(
                                isCancelling = uiState.isCancelling,
                                onCancelClick = {
                                    viewModel.onIntent(OrderDetailIntent.ShowCancelDialog(true))
                                }
                            )
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space24))
                    }
                }
            }
        }
    }

    // Cancel Confirmation Dialog
    if (uiState.showCancelDialog) {
        AlertDialog(
            onDismissRequest = {
                viewModel.onIntent(OrderDetailIntent.ShowCancelDialog(false))
            },
            title = {
                Text(
                    text = stringResource(R.string.order_detail_cancel_dialog_title),
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(text = stringResource(R.string.order_detail_cancel_dialog_desc))
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.onIntent(OrderDetailIntent.ConfirmCancel)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ForerunDanger)
                ) {
                    Text(stringResource(R.string.order_detail_cancel_dialog_confirm))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        viewModel.onIntent(OrderDetailIntent.ShowCancelDialog(false))
                    }
                ) {
                    Text(stringResource(R.string.order_detail_cancel_dialog_dismiss))
                }
            }
        )
    }
}

@Composable
private fun StatusBanner(order: CustomerOrderDetail) {
    val (bgColor, textColor, bannerText) = when (order.status) {
        "DELIVERED" -> Triple(
            ForerunGreenLight,
            ForerunGreenDark,
            stringResource(R.string.order_detail_status_banner_delivered)
        )
        "CANCELLED" -> Triple(
            Color(0xFFFFEBEE),
            ForerunDanger,
            stringResource(R.string.order_detail_status_banner_cancelled)
        )
        else -> Triple(
            ForerunGreenLight,
            ForerunGreenDark,
            stringResource(R.string.order_detail_status_banner_active)
        )
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = bannerText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )
                val statusColors = getOrderStatusColors(order.status)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(Dimens.RadiusPill))
                        .background(statusColors.background)
                        .padding(horizontal = Dimens.Space10, vertical = Dimens.Space4)
                ) {
                    Text(
                        text = stringResource(getOrderStatusLabelRes(order.status)),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColors.text
                    )
                }
            }

            if (order.status == "CANCELLED" && !order.cancelReason.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(Dimens.Space8))
                Text(
                    text = stringResource(R.string.order_detail_cancel_reason, order.cancelReason),
                    fontSize = 13.sp,
                    color = ForerunDanger
                )
            }
        }
    }
}

@Composable
private fun DeliveredRatingCard(
    order: CustomerOrderDetail,
    canRate: Boolean,
    onRateClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = stringResource(R.string.rating_screen_title),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                    if (order.rating != null) {
                        Spacer(modifier = Modifier.height(Dimens.Space4))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = Color(0xFFFFB300),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(Dimens.Space4))
                            Text(
                                text = stringResource(R.string.order_detail_rated_label, order.rating.stars),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForerunTextPrimary
                            )
                        }
                    }
                }

                if (canRate) {
                    Button(
                        onClick = onRateClick,
                        colors = ButtonDefaults.buttonColors(containerColor = ForerunGreen),
                        shape = RoundedCornerShape(Dimens.RadiusMedium)
                    ) {
                        Text(
                            text = if (order.rating != null) {
                                stringResource(R.string.order_detail_edit_rating_btn)
                            } else {
                                stringResource(R.string.order_detail_rate_runner_btn)
                            },
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

private data class TimelineStep(
    val title: String,
    val timestamp: String?,
    val isCompleted: Boolean,
    val isCurrent: Boolean
)

@Composable
private fun TimelineCard(
    status: String,
    timeline: OrderTimeline,
    cancelReason: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Text(
                text = stringResource(R.string.order_detail_timeline_title),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
            Spacer(modifier = Modifier.height(Dimens.Space16))

            val isCancelled = status == "CANCELLED"
            val statusHierarchy = listOf(
                "DRAFT",
                "PENDING_REVIEW",
                "UNDER_REVIEW",
                "AWAITING_RUNNER",
                "AWAITING_PREFERRED_RUNNER",
                "ASSIGNED",
                "IN_PROGRESS",
                "OUT_FOR_DELIVERY",
                "DELIVERED"
            )

            val currentRank = if (isCancelled) -1 else statusHierarchy.indexOf(status)

            val steps = listOf(
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_created),
                    timestamp = timeline.createdAt,
                    isCompleted = currentRank >= 0 || isCancelled,
                    isCurrent = status == "PENDING_REVIEW"
                ),
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_review),
                    timestamp = timeline.reviewedAt,
                    isCompleted = currentRank >= 3,
                    isCurrent = status == "UNDER_REVIEW" || status == "AWAITING_RUNNER" || status == "AWAITING_PREFERRED_RUNNER"
                ),
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_assigned),
                    timestamp = timeline.assignedAt,
                    isCompleted = currentRank >= 5,
                    isCurrent = status == "ASSIGNED"
                ),
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_in_progress),
                    timestamp = timeline.startedAt,
                    isCompleted = currentRank >= 6,
                    isCurrent = status == "IN_PROGRESS"
                ),
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_out_for_delivery),
                    timestamp = null,
                    isCompleted = currentRank >= 7,
                    isCurrent = status == "OUT_FOR_DELIVERY"
                ),
                TimelineStep(
                    title = stringResource(R.string.order_detail_step_delivered),
                    timestamp = timeline.deliveredAt,
                    isCompleted = currentRank >= 8,
                    isCurrent = status == "DELIVERED"
                )
            )

            steps.forEachIndexed { index, step ->
                TimelineNodeItem(
                    step = step,
                    isLast = index == steps.lastIndex && !isCancelled
                )
            }

            if (isCancelled) {
                TimelineNodeItem(
                    step = TimelineStep(
                        title = stringResource(R.string.order_detail_step_cancelled),
                        timestamp = timeline.cancelledAt,
                        isCompleted = true,
                        isCurrent = true
                    ),
                    isLast = true,
                    isCancelledNode = true
                )
            }
        }
    }
}

@Composable
private fun TimelineNodeItem(
    step: TimelineStep,
    isLast: Boolean,
    isCancelledNode: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(32.dp)
        ) {
            val circleColor = when {
                isCancelledNode -> ForerunDanger
                step.isCompleted -> ForerunGreen
                step.isCurrent -> ForerunGreenDark
                else -> ForerunSoftSurface
            }
            val iconTint = when {
                step.isCompleted || isCancelledNode || step.isCurrent -> Color.White
                else -> ForerunTextMuted
            }

            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(circleColor),
                contentAlignment = Alignment.Center
            ) {
                if (isCancelledNode) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(14.dp)
                    )
                } else if (step.isCompleted) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(14.dp)
                    )
                } else if (step.isCurrent) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                    )
                }
            }

            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(30.dp)
                        .background(if (step.isCompleted) ForerunGreen else ForerunBorder)
                )
            }
        }

        Spacer(modifier = Modifier.width(Dimens.Space12))

        Column(modifier = Modifier.padding(bottom = if (isLast) 0.dp else Dimens.Space16)) {
            Text(
                text = step.title,
                fontSize = 14.sp,
                fontWeight = if (step.isCurrent || step.isCompleted) FontWeight.Bold else FontWeight.Normal,
                color = if (isCancelledNode) ForerunDanger else if (step.isCurrent || step.isCompleted) ForerunTextPrimary else ForerunTextMuted
            )
            if (!step.timestamp.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = formatTimestamp(step.timestamp),
                    fontSize = 11.sp,
                    color = ForerunTextMuted
                )
            }
        }
    }
}

@Composable
private fun RunnerCard(
    runner: OrderRunnerDetail,
    onWhatsAppClick: (String) -> Unit,
    onCallClick: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(ForerunGreenLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(Dimens.Space12))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.order_detail_runner_card_title),
                        fontSize = 12.sp,
                        color = ForerunTextMuted
                    )
                    Text(
                        text = runner.name,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                    if (runner.avgRating != null && runner.avgRating > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = Color(0xFFFFB300),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(Dimens.Space4))
                            Text(
                                text = stringResource(
                                    R.string.order_detail_runner_rating_format,
                                    runner.avgRating,
                                    runner.totalRatings ?: 0
                                ),
                                fontSize = 12.sp,
                                color = ForerunTextMuted
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space16))
            HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
            Spacer(modifier = Modifier.height(Dimens.Space12))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
            ) {
                // WhatsApp Button
                Button(
                    onClick = { onWhatsAppClick(runner.whatsapp) },
                    modifier = Modifier
                        .weight(1f)
                        .height(Dimens.ButtonHeight),
                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                    shape = RoundedCornerShape(Dimens.RadiusMedium)
                ) {
                    Text(
                        text = stringResource(R.string.order_detail_runner_whatsapp),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                // Call Button
                val phone = runner.phone ?: runner.whatsapp
                OutlinedButton(
                    onClick = { onCallClick(phone) },
                    modifier = Modifier
                        .weight(1f)
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusMedium)
                ) {
                    Icon(
                        imageVector = Icons.Default.Call,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = ForerunTextPrimary
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.order_detail_runner_call),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ForerunTextPrimary
                    )
                }
            }
        }
    }
}

@Composable
private fun StoresAndItemsCard(
    stores: List<OrderStoreDetail>,
    items: List<com.forerun.customer.domain.model.DetailOrderItem>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Text(
                text = stringResource(R.string.order_detail_items_title),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
            Spacer(modifier = Modifier.height(Dimens.Space12))

            if (stores.isNotEmpty()) {
                stores.forEachIndexed { sIndex, store ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Dimens.RadiusMedium))
                            .background(ForerunSoftSurface)
                            .padding(Dimens.Space12)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = store.storeName,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunTextPrimary
                            )
                            val (badgeBg, badgeText) = when (store.status) {
                                "PURCHASED" -> Pair(
                                    ForerunGreenLight,
                                    stringResource(R.string.order_detail_store_status_purchased)
                                )
                                "SKIPPED" -> Pair(
                                    Color(0xFFFFEBEE),
                                    stringResource(R.string.order_detail_store_status_skipped)
                                )
                                else -> Pair(
                                    Color(0xFFFFF8E1),
                                    stringResource(R.string.order_detail_store_status_pending)
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                                    .background(badgeBg)
                                    .padding(horizontal = Dimens.Space8, vertical = 2.dp)
                            ) {
                                Text(
                                    text = badgeText,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (store.status == "SKIPPED") ForerunDanger else ForerunGreenDark
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space8))
                        store.items.forEach { item ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "• ${item.itemName}",
                                    fontSize = 13.sp,
                                    color = ForerunTextPrimary
                                )
                                Text(
                                    text = item.quantity,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = ForerunTextMuted
                                )
                            }
                        }
                    }
                    if (sIndex < stores.lastIndex) {
                        Spacer(modifier = Modifier.height(Dimens.Space8))
                    }
                }
            } else {
                // Fallback to items list
                items.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = Dimens.Space4),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "• ${item.itemName}",
                            fontSize = 14.sp,
                            color = ForerunTextPrimary
                        )
                        Text(
                            text = item.quantity,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextMuted
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PricingCard(order: CustomerOrderDetail) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Text(
                text = stringResource(R.string.order_detail_pricing_title),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
            Spacer(modifier = Modifier.height(Dimens.Space12))

            PricingRow(
                label = stringResource(R.string.order_detail_base_fee),
                value = order.baseFee
            )

            if (order.peripheralFee > 0) {
                Spacer(modifier = Modifier.height(Dimens.Space4))
                PricingRow(
                    label = stringResource(R.string.order_detail_peripheral_fee),
                    value = order.peripheralFee
                )
            }

            if (order.extraStoresFee > 0) {
                Spacer(modifier = Modifier.height(Dimens.Space4))
                PricingRow(
                    label = stringResource(R.string.order_detail_extra_stores_fee),
                    value = order.extraStoresFee
                )
            }

            if (order.customFee > 0) {
                Spacer(modifier = Modifier.height(Dimens.Space4))
                PricingRow(
                    label = stringResource(R.string.order_detail_custom_fee),
                    value = order.customFee
                )
            }

            if (!order.customFeeReason.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(Dimens.Space4))
                Text(
                    text = stringResource(R.string.order_detail_custom_fee_reason, order.customFeeReason),
                    fontSize = 12.sp,
                    color = ForerunTextMuted
                )
            }

            Spacer(modifier = Modifier.height(Dimens.Space8))
            HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
            Spacer(modifier = Modifier.height(Dimens.Space8))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.order_detail_total_fee),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Text(
                    text = "${order.totalFee} ${stringResource(R.string.order_detail_currency)}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunGreen
                )
            }
        }
    }
}

@Composable
private fun PricingRow(label: String, value: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 13.sp, color = ForerunTextMuted)
        Text(
            text = "$value ${stringResource(R.string.order_detail_currency)}",
            fontSize = 13.sp,
            color = ForerunTextPrimary
        )
    }
}

@Composable
private fun DeliveryInfoCard(order: CustomerOrderDetail) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            Text(
                text = stringResource(R.string.order_detail_address_title),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
            Spacer(modifier = Modifier.height(Dimens.Space4))
            Text(
                text = order.deliveryDesc ?: stringResource(R.string.order_detail_default_area),
                fontSize = 13.sp,
                color = ForerunTextMuted
            )

            if (!order.notes.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(Dimens.Space12))
                HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
                Spacer(modifier = Modifier.height(Dimens.Space12))
                Text(
                    text = stringResource(R.string.order_detail_notes_title),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space4))
                Text(
                    text = order.notes,
                    fontSize = 13.sp,
                    color = ForerunTextMuted
                )
            }
        }
    }
}

@Composable
private fun CancelOrderSection(
    isCancelling: Boolean,
    onCancelClick: () -> Unit
) {
    OutlinedButton(
        onClick = onCancelClick,
        enabled = !isCancelling,
        modifier = Modifier
            .fillMaxWidth()
            .height(Dimens.ButtonHeightLarge),
        shape = RoundedCornerShape(Dimens.RadiusPill),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = ForerunDanger),
        border = androidx.compose.foundation.BorderStroke(1.dp, ForerunDanger)
    ) {
        if (isCancelling) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = ForerunDanger,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(Dimens.Space8))
            Text(stringResource(R.string.order_detail_cancelling_btn))
        } else {
            Text(
                text = stringResource(R.string.order_detail_cancel_btn),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunDanger
            )
        }
    }
}


private fun formatTimestamp(isoString: String): String {
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = parser.parse(isoString.take(19))
        val formatter = SimpleDateFormat("hh:mm a - yyyy/MM/dd", Locale("ar"))
        if (date != null) formatter.format(date) else isoString
    } catch (_: Exception) {
        isoString
    }
}
