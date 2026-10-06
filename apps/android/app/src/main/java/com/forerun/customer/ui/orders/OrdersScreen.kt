package com.forerun.customer.ui.orders

import com.forerun.customer.ui.order.getOrderStatusColors
import com.forerun.customer.ui.order.getOrderStatusLabelRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.forerun.customer.R
import com.forerun.customer.domain.model.CustomerOrder
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.ForerunWarning
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onNavigateToCreateOrder: () -> Unit = {},
    onNavigateToOrderDetail: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    viewModel: OrdersListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val listState = rememberLazyListState()

    // Surface load errors as a snackbar only when orders are already on screen.
    // Keyed on allOrders, not displayedOrders: with a filter that matches
    // nothing, displayedOrders is empty even though the list is fully loaded.
    LaunchedEffect(uiState.errorMessage) {
        val error = uiState.errorMessage
        if (error != null && uiState.allOrders.isNotEmpty()) {
            snackbarHostState.showSnackbar(error)
            viewModel.onIntent(OrdersListIntent.ClearError)
        }
    }

    // Pagination trigger when scrolling near the end.
    // Stops on loadMoreError so a failing endpoint cannot be hammered in a loop.
    val shouldLoadMore by remember {
        derivedStateOf {
            val totalItems = listState.layoutInfo.totalItemsCount
            val lastVisibleIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            totalItems > 0 &&
                lastVisibleIndex >= totalItems - 2 &&
                uiState.hasMore &&
                !uiState.isLoadingMore &&
                uiState.loadMoreError == null
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            viewModel.onIntent(OrdersListIntent.LoadMore)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunSoftSurface)
    ) {
        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.onIntent(OrdersListIntent.Refresh) },
            modifier = Modifier.fillMaxSize()
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // 1. Top Header (Stitch Design)
                OrdersHeader(activeCount = uiState.activeCount)

                // 2. Filter Chips Row
                OrdersFilterChipsRow(
                    selectedFilter = uiState.currentFilter,
                    onFilterSelected = { viewModel.onIntent(OrdersListIntent.SetFilter(it)) }
                )

                Spacer(modifier = Modifier.height(Dimens.Space8))

                // 3. Body: Loading, Empty, or List
                when {
                    uiState.isLoading && !uiState.isRefreshing -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = ForerunGreen)
                        }
                    }

                    uiState.errorMessage != null && uiState.allOrders.isEmpty() -> {
                        OrdersErrorState(
                            onRetryClick = { viewModel.onIntent(OrdersListIntent.LoadInitial) }
                        )
                    }

                    uiState.displayedOrders.isEmpty() -> {
                        OrdersEmptyState(
                            onNewOrderClick = onNavigateToCreateOrder
                        )
                    }

                    else -> {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(
                                start = Dimens.Space16,
                                end = Dimens.Space16,
                                top = Dimens.Space8,
                                bottom = 80.dp
                            ),
                            verticalArrangement = Arrangement.spacedBy(Dimens.Space12)
                        ) {
                            items(
                                items = uiState.displayedOrders,
                                key = { it.id }
                            ) { order ->
                                OrderCard(
                                    order = order,
                                    onClick = { onNavigateToOrderDetail(order.id) }
                                )
                            }

                            if (uiState.isLoadingMore) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(Dimens.Space16),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = ForerunGreen,
                                            strokeWidth = 2.dp
                                        )
                                    }
                                }
                            }

                            if (uiState.loadMoreError != null) {
                                item {
                                    LoadMoreRetryRow(
                                        onRetryClick = {
                                            viewModel.onIntent(OrdersListIntent.RetryLoadMore)
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(Dimens.Space16)
        )
    }
}

@Composable
private fun OrdersHeader(activeCount: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ForerunSurface)
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space16),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = stringResource(R.string.orders_list_title),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary
            )
            Text(
                text = stringResource(R.string.orders_subtitle),
                fontSize = 12.sp,
                color = ForerunTextMuted
            )
        }

        if (activeCount > 0) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                    .background(ForerunGreenLight)
                    .padding(horizontal = Dimens.Space12, vertical = Dimens.Space4)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(ForerunGreen)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.orders_active_count, activeCount),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreen
                    )
                }
            }
        }
    }
}

@Composable
private fun OrdersFilterChipsRow(
    selectedFilter: OrderFilter,
    onFilterSelected: (OrderFilter) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ForerunSurface)
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = Dimens.ScreenMargin, vertical = Dimens.Space8),
        horizontalArrangement = Arrangement.spacedBy(Dimens.Space8)
    ) {
        OrderFilterChip(
            title = stringResource(R.string.orders_filter_all),
            isSelected = selectedFilter == OrderFilter.ALL,
            onClick = { onFilterSelected(OrderFilter.ALL) }
        )
        OrderFilterChip(
            title = stringResource(R.string.orders_filter_active),
            isSelected = selectedFilter == OrderFilter.ACTIVE,
            onClick = { onFilterSelected(OrderFilter.ACTIVE) }
        )
        OrderFilterChip(
            title = stringResource(R.string.orders_filter_delivered),
            isSelected = selectedFilter == OrderFilter.DELIVERED,
            onClick = { onFilterSelected(OrderFilter.DELIVERED) }
        )
        OrderFilterChip(
            title = stringResource(R.string.orders_filter_cancelled),
            isSelected = selectedFilter == OrderFilter.CANCELLED,
            onClick = { onFilterSelected(OrderFilter.CANCELLED) }
        )
    }
}

@Composable
private fun OrderFilterChip(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        selected = isSelected,
        onClick = onClick,
        label = {
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
        },
        shape = RoundedCornerShape(Dimens.RadiusPill),
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = ForerunGreen,
            selectedLabelColor = ForerunTextOnPrimary,
            containerColor = ForerunSoftSurface,
            labelColor = ForerunTextPrimary
        ),
        border = null
    )
}

@Composable
private fun OrderCard(
    order: CustomerOrder,
    onClick: () -> Unit = {}
) {
    val statusColors = getOrderStatusColors(order.status)
    val statusBg = statusColors.background
    val statusTextColor = statusColors.text
    val statusText = stringResource(getOrderStatusLabelRes(order.status))
    val formattedDate = formatOrderDate(order.createdAt)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        colors = CardDefaults.cardColors(containerColor = ForerunSurface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.Space16)
        ) {
            // Header Row: Order Number + Status Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(ForerunGreenLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.List,
                            contentDescription = null,
                            tint = ForerunGreen,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = "#${order.orderNumber}",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunTextPrimary
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(Dimens.RadiusPill))
                        .background(statusBg)
                        .padding(horizontal = Dimens.Space10, vertical = Dimens.Space4)
                ) {
                    Text(
                        text = statusText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusTextColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space12))
            HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
            Spacer(modifier = Modifier.height(Dimens.Space12))

            // Body Info
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Item count & Date
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ShoppingCart,
                            contentDescription = null,
                            tint = ForerunTextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space4))
                        Text(
                            text = stringResource(R.string.orders_item_count, order.itemCount),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ForerunTextPrimary
                        )
                    }
                    Spacer(modifier = Modifier.height(Dimens.Space4))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.DateRange,
                            contentDescription = null,
                            tint = ForerunTextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space4))
                        Text(
                            text = formattedDate,
                            fontSize = 11.sp,
                            color = ForerunTextMuted
                        )
                    }
                }

                // Total Fee
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = stringResource(R.string.orders_delivery_fee),
                        fontSize = 11.sp,
                        color = ForerunTextMuted
                    )
                    Text(
                        text = "${order.totalFee} ${stringResource(R.string.orders_currency)}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForerunGreen
                    )
                }
            }

            // Runner info if assigned
            if (!order.runnerName.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(Dimens.Space10))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Dimens.RadiusMedium))
                        .background(ForerunSoftSurface)
                        .padding(horizontal = Dimens.Space8, vertical = Dimens.Space4),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = ForerunGreen,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space4))
                    Text(
                        text = stringResource(R.string.orders_runner_name, order.runnerName),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = ForerunTextPrimary
                    )
                }
            }
        }
    }
}

@Composable
private fun LoadMoreRetryRow(onRetryClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(Dimens.Space16),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = stringResource(R.string.orders_load_more_failed),
            fontSize = 13.sp,
            color = ForerunTextMuted
        )
        Spacer(modifier = Modifier.width(Dimens.Space12))
        OutlinedButton(
            onClick = onRetryClick,
            shape = RoundedCornerShape(Dimens.RadiusPill),
            border = androidx.compose.foundation.BorderStroke(1.dp, ForerunGreen)
        ) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = ForerunGreen
            )
            Spacer(modifier = Modifier.width(Dimens.Space4))
            Text(
                text = stringResource(R.string.home_retry),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunGreen
            )
        }
    }
}

@Composable
private fun OrdersErrorState(onRetryClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Dimens.ScreenMargin),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(Color(0xFFFFEBEE)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = null,
                tint = ForerunDanger,
                modifier = Modifier.size(44.dp)
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space16))

        Text(
            text = stringResource(R.string.orders_error_loading),
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunTextPrimary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(Dimens.Space24))

        Button(
            onClick = onRetryClick,
            shape = RoundedCornerShape(Dimens.RadiusPill),
            colors = ButtonDefaults.buttonColors(
                containerColor = ForerunGreen,
                contentColor = ForerunTextOnPrimary
            ),
            contentPadding = PaddingValues(horizontal = Dimens.Space24, vertical = Dimens.Space12)
        ) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.Space8))
            Text(
                text = stringResource(R.string.home_retry),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun OrdersEmptyState(onNewOrderClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Dimens.ScreenMargin),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(ForerunGreenLight),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.ShoppingCart,
                contentDescription = null,
                tint = ForerunGreen,
                modifier = Modifier.size(44.dp)
            )
        }

        Spacer(modifier = Modifier.height(Dimens.Space16))

        Text(
            text = stringResource(R.string.orders_empty_title),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = ForerunTextPrimary
        )

        Spacer(modifier = Modifier.height(Dimens.Space8))

        Text(
            text = stringResource(R.string.orders_empty_desc),
            fontSize = 14.sp,
            color = ForerunTextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.85f)
        )

        Spacer(modifier = Modifier.height(Dimens.Space24))

        Button(
            onClick = onNewOrderClick,
            shape = RoundedCornerShape(Dimens.RadiusPill),
            colors = ButtonDefaults.buttonColors(
                containerColor = ForerunGreen,
                contentColor = ForerunTextOnPrimary
            ),
            contentPadding = PaddingValues(horizontal = Dimens.Space24, vertical = Dimens.Space12)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.Space8))
            Text(
                text = stringResource(R.string.orders_empty_btn),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}



private fun formatOrderDate(isoString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = inputFormat.parse(isoString.take(19)) ?: return isoString.take(10)
        val outputFormat = SimpleDateFormat("dd/MM/yyyy - hh:mm a", Locale("ar"))
        outputFormat.format(date)
    } catch (_: Exception) {
        isoString.take(10)
    }
}
