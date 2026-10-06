package com.forerun.customer.ui.order

import androidx.annotation.StringRes
import androidx.compose.ui.graphics.Color
import com.forerun.customer.R
import com.forerun.customer.domain.model.OrderStatus
import com.forerun.customer.ui.theme.ForerunDanger
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight

/**
 * Unified badge color scheme for an order status.
 */
data class OrderStatusColors(
    val background: Color,
    val text: Color
)

/**
 * Unified order status string resource provider for UI display.
 * Resolves redundant status mapping functions across HomeScreen, OrderDetailScreen, and OrdersScreen.
 */
@StringRes
fun getOrderStatusLabelRes(status: String?): Int {
    return when (OrderStatus.fromString(status)) {
        OrderStatus.DRAFT -> R.string.orders_status_draft
        OrderStatus.PENDING_REVIEW -> R.string.orders_status_pending_review
        OrderStatus.UNDER_REVIEW -> R.string.orders_status_under_review
        OrderStatus.AWAITING_RUNNER -> R.string.orders_status_awaiting_runner
        OrderStatus.AWAITING_PREFERRED_RUNNER -> R.string.orders_status_awaiting_preferred
        OrderStatus.ASSIGNED -> R.string.orders_status_assigned
        OrderStatus.IN_PROGRESS -> R.string.orders_status_in_progress
        OrderStatus.OUT_FOR_DELIVERY -> R.string.orders_status_out_for_delivery
        OrderStatus.DELIVERED -> R.string.orders_status_delivered
        OrderStatus.CANCELLED -> R.string.orders_status_cancelled
        OrderStatus.UNKNOWN -> R.string.orders_status_unknown
    }
}

/**
 * Unified order status badge colors across HomeScreen, OrderDetailScreen, and OrdersScreen.
 */
fun getOrderStatusColors(status: String?): OrderStatusColors {
    return when (OrderStatus.fromString(status)) {
        OrderStatus.DELIVERED -> OrderStatusColors(ForerunGreenLight, ForerunGreen)
        OrderStatus.CANCELLED -> OrderStatusColors(Color(0xFFFFEBEE), ForerunDanger)
        OrderStatus.PENDING_REVIEW, OrderStatus.UNDER_REVIEW ->
            OrderStatusColors(Color(0xFFFFF8E1), Color(0xFFB78103))
        OrderStatus.AWAITING_RUNNER, OrderStatus.AWAITING_PREFERRED_RUNNER ->
            OrderStatusColors(Color(0xFFE3F2FD), Color(0xFF1565C0))
        OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS, OrderStatus.OUT_FOR_DELIVERY ->
            OrderStatusColors(ForerunGreenLight, ForerunGreenDark)
        OrderStatus.DRAFT, OrderStatus.UNKNOWN ->
            OrderStatusColors(Color(0xFFEEEEEE), Color(0xFF616161))
    }
}
