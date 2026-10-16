package com.forerun.customer.ui.order.detail

import android.content.Intent
import android.net.Uri
import com.forerun.customer.ui.order.getOrderStatusColors
import com.forerun.customer.ui.order.getOrderStatusLabelRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.forerun.customer.core.config.AppConfig
import com.forerun.customer.domain.model.OrderTimeline
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunMintDark
import com.forerun.customer.ui.theme.ForerunMintSoft
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunMint
import com.forerun.customer.ui.theme.ForerunOrange
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
                                colors = ButtonDefaults.buttonColors(containerColor = ForerunOrange)
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
                        if (order.status == "DELIVERED") {
                            // 1. Simplified Status Banner: "تم التسليم ✅" + date/time
                            DeliveredStatusCard(order = order)

                            // 2. Prominent Rating Card: 5 directly clickable stars or rated state
                            if (uiState.canRate || order.rating != null) {
                                DeliveredRatingCard(
                                    order = order,
                                    canRate = uiState.canRate,
                                    isSubmitting = uiState.isSubmittingRating,
                                    isJustRated = uiState.ratingSuccess,
                                    onSubmitRating = { stars, note ->
                                        viewModel.onIntent(OrderDetailIntent.SubmitRating(stars, note))
                                    }
                                )
                            }
                        } else {
                            // 1. Status Banner
                            StatusBanner(order = order)

                            // 2. Vertical Timeline Stepper
                            TimelineCard(
                                status = order.status,
                                timeline = order.timeline,
                                cancelReason = order.cancelReason
                            )
                        }

                        // 4. Runner Card or Awaiting Runner Card
                        if (order.runner != null && uiState.canContactRunner) {
                            RunnerCard(
                                runner = order.runner,
                                onWhatsAppClick = { phone ->
                                    val url = AppConfig.buildRunnerWhatsAppUrl(phone)
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
                        } else if (order.status !in setOf("DELIVERED", "CANCELLED")) {
                            OrderDetailAwaitingRunnerCard()
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

                        // 8. Admin Support Card
                        OrderDetailAdminSupportCard()

                        // 9. Cancel Order Button (Only for PENDING_REVIEW / ASSIGNED)
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
private fun DeliveredStatusCard(order: CustomerOrderDetail) {
    val deliveredTime = order.deliveredAt ?: order.timeline.deliveredAt
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunGreenLight)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.Space16, vertical = Dimens.Space14),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.order_detail_delivered_simplified_status),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunGreenDark
            )
            if (!deliveredTime.isNullOrBlank()) {
                Text(
                    text = formatTimestamp(deliveredTime),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = ForerunGreenDark
                )
            }
        }
    }
}

@Composable
private fun DeliveredRatingCard(
    order: CustomerOrderDetail,
    canRate: Boolean,
    isSubmitting: Boolean,
    isJustRated: Boolean,
    onSubmitRating: (stars: Int, note: String?) -> Unit
) {
    val isRated = order.rating != null
    val currentStars = order.rating?.stars ?: 0
    val currentNote = order.rating?.note.orEmpty()

    var isEditing by remember(order.id) { mutableStateOf(false) }
    var selectedStars by remember(order.id, order.rating?.stars) { mutableIntStateOf(order.rating?.stars ?: 0) }
    var noteText by remember(order.id, order.rating?.note) { mutableStateOf(order.rating?.note.orEmpty()) }

    LaunchedEffect(order.rating, isJustRated) {
        if (isJustRated) {
            isEditing = false
        }
    }

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
            if (!isRated) {
                // 1. Unrated state
                Text(
                    text = stringResource(R.string.rating_headline),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )

                val runnerName = order.runner?.name
                if (!runnerName.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.rating_subtitle, runnerName),
                        fontSize = 12.sp,
                        color = ForerunTextMuted
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space12))

                // Interactive 5 stars
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    for (star in 1..5) {
                        val isFilled = star <= selectedStars
                        Icon(
                            imageVector = if (isFilled) Icons.Default.Star else Icons.Outlined.Star,
                            contentDescription = "$star",
                            tint = if (isFilled) Color(0xFFFFB300) else Color(0xFFBDBDBD),
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .clickable(enabled = !isSubmitting && canRate) {
                                    selectedStars = star
                                }
                                .padding(4.dp)
                        )
                    }
                }

                // If stars selected, expand note input + submit button
                AnimatedVisibility(visible = selectedStars > 0) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Spacer(modifier = Modifier.height(Dimens.Space8))
                        val starLabel = when (selectedStars) {
                            1 -> stringResource(R.string.rating_score_1)
                            2 -> stringResource(R.string.rating_score_2)
                            3 -> stringResource(R.string.rating_score_3)
                            4 -> stringResource(R.string.rating_score_4)
                            5 -> stringResource(R.string.rating_score_5)
                            else -> ""
                        }
                        Text(
                            text = starLabel,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunGreenDark
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        OutlinedTextField(
                            value = noteText,
                            onValueChange = { if (it.length <= 1000) noteText = it },
                            placeholder = {
                                Text(
                                    text = stringResource(R.string.rating_note_hint),
                                    fontSize = 13.sp,
                                    color = ForerunTextMuted
                                )
                            },
                            enabled = !isSubmitting,
                            minLines = 2,
                            maxLines = 4,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(Dimens.RadiusMedium),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = ForerunOrange,
                                unfocusedBorderColor = ForerunBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Button(
                            onClick = { onSubmitRating(selectedStars, noteText.trim().ifEmpty { null }) },
                            enabled = selectedStars in 1..5 && !isSubmitting,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(Dimens.RadiusPill),
                            colors = ButtonDefaults.buttonColors(containerColor = ForerunOrange)
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White
                                )
                            } else {
                                Text(
                                    text = stringResource(R.string.rating_submit_btn),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            } else if (!isEditing) {
                // 2. Rated state (View mode)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isJustRated) stringResource(R.string.order_detail_rating_thanks) else stringResource(R.string.order_detail_already_rated),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreenDark
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = ForerunOrange
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.order_detail_rated_label, currentStars),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = ForerunTextMuted
                            )
                            if (canRate) {
                                Spacer(modifier = Modifier.width(Dimens.Space8))
                                TextButton(
                                    onClick = {
                                        selectedStars = currentStars
                                        noteText = currentNote
                                        isEditing = true
                                    },
                                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                    modifier = Modifier.height(30.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = ForerunOrange
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = stringResource(R.string.rating_edit_action),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ForerunOrange
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space10))

                // Display rated stars
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    for (star in 1..5) {
                        val isFilled = star <= currentStars
                        Icon(
                            imageVector = if (isFilled) Icons.Default.Star else Icons.Outlined.Star,
                            contentDescription = null,
                            tint = if (isFilled) Color(0xFFFFB300) else Color(0xFFE5E7EB),
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }

                // If there is a note, display it under the stars
                if (currentNote.isNotBlank()) {
                    Spacer(modifier = Modifier.height(Dimens.Space10))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ForerunSoftSurface, RoundedCornerShape(Dimens.RadiusMedium))
                            .padding(horizontal = Dimens.Space12, vertical = Dimens.Space8)
                    ) {
                        Column {
                            Text(
                                text = stringResource(R.string.rating_note_title),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForerunTextMuted
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = currentNote,
                                fontSize = 13.sp,
                                color = ForerunTextPrimary
                            )
                        }
                    }
                }
            } else {
                // 3. Rated state (Edit mode)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.order_detail_edit_rating_btn),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space12))

                // Interactive 5 stars for editing
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space12),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    for (star in 1..5) {
                        val isFilled = star <= selectedStars
                        Icon(
                            imageVector = if (isFilled) Icons.Default.Star else Icons.Outlined.Star,
                            contentDescription = "$star",
                            tint = if (isFilled) Color(0xFFFFB300) else Color(0xFFBDBDBD),
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .clickable(enabled = !isSubmitting) {
                                    selectedStars = star
                                }
                                .padding(4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))
                val starLabel = when (selectedStars) {
                    1 -> stringResource(R.string.rating_score_1)
                    2 -> stringResource(R.string.rating_score_2)
                    3 -> stringResource(R.string.rating_score_3)
                    4 -> stringResource(R.string.rating_score_4)
                    5 -> stringResource(R.string.rating_score_5)
                    else -> ""
                }
                Text(
                    text = starLabel,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunGreenDark
                )

                Spacer(modifier = Modifier.height(Dimens.Space12))

                OutlinedTextField(
                    value = noteText,
                    onValueChange = { if (it.length <= 1000) noteText = it },
                    placeholder = {
                        Text(
                            text = stringResource(R.string.rating_note_hint),
                            fontSize = 13.sp,
                            color = ForerunTextMuted
                        )
                    },
                    enabled = !isSubmitting,
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ForerunOrange,
                        unfocusedBorderColor = ForerunBorder
                    )
                )

                Spacer(modifier = Modifier.height(Dimens.Space12))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.Space8),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { onSubmitRating(selectedStars, noteText.trim().ifEmpty { null }) },
                        enabled = selectedStars in 1..5 && !isSubmitting,
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        shape = RoundedCornerShape(Dimens.RadiusPill),
                        colors = ButtonDefaults.buttonColors(containerColor = ForerunOrange)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.rating_update_btn),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    OutlinedButton(
                        onClick = {
                            selectedStars = currentStars
                            noteText = currentNote
                            isEditing = false
                        },
                        enabled = !isSubmitting,
                        modifier = Modifier.height(44.dp),
                        shape = RoundedCornerShape(Dimens.RadiusPill),
                        border = BorderStroke(1.dp, ForerunBorder)
                    ) {
                        Text(
                            text = stringResource(R.string.rating_cancel_action),
                            fontSize = 14.sp,
                            color = ForerunTextPrimary
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
                step.isCompleted -> ForerunMint
                step.isCurrent -> ForerunOrange
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
                        .background(if (step.isCompleted) ForerunMint else ForerunBorder)
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
                    onClick = { runner.whatsapp?.let { onWhatsAppClick(it) } },
                    enabled = runner.whatsapp != null,
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
                    onClick = { phone?.let { onCallClick(it) } },
                    enabled = phone != null,
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
private fun OrderDetailAwaitingRunnerCard(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Card(
        modifier = modifier.fillMaxWidth(),
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
                        .background(ForerunMintSoft),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = ForerunMintDark,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(Dimens.Space12))
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = stringResource(R.string.order_detail_awaiting_runner_title),
                            fontSize = 15.sp,
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
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.order_detail_awaiting_runner_desc),
                        fontSize = 12.sp,
                        color = ForerunTextMuted,
                        lineHeight = 18.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space12))
            HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
            Spacer(modifier = Modifier.height(Dimens.Space12))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
            ) {
                Button(
                    onClick = {
                        val url = "https://wa.me/${AppConfig.ADMIN_SUPPORT_WHATSAPP}"
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {}
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(Dimens.ButtonHeight),
                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                    shape = RoundedCornerShape(Dimens.RadiusMedium)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.home_btn_whatsapp),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                OutlinedButton(
                    onClick = {
                        try {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${AppConfig.ADMIN_SUPPORT_PHONE}")))
                        } catch (_: Exception) {}
                    },
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
                        text = stringResource(R.string.home_btn_call),
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
private fun OrderDetailAdminSupportCard(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Card(
        modifier = modifier.fillMaxWidth(),
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
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(ForerunOrangeLight.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        tint = ForerunOrange,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(Dimens.Space12))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.order_detail_admin_support_title),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunNavy
                    )
                    Text(
                        text = stringResource(R.string.order_detail_admin_support_desc),
                        fontSize = 11.sp,
                        color = ForerunTextMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space12))
            HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
            Spacer(modifier = Modifier.height(Dimens.Space12))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
            ) {
                Button(
                    onClick = {
                        val url = "https://wa.me/${AppConfig.ADMIN_SUPPORT_WHATSAPP}"
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {}
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(Dimens.ButtonHeight),
                    colors = ButtonDefaults.buttonColors(containerColor = WhatsAppGreen),
                    shape = RoundedCornerShape(Dimens.RadiusMedium)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.home_btn_whatsapp),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                OutlinedButton(
                    onClick = {
                        try {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${AppConfig.ADMIN_SUPPORT_PHONE}")))
                        } catch (_: Exception) {}
                    },
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
                        text = stringResource(R.string.home_btn_call),
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
