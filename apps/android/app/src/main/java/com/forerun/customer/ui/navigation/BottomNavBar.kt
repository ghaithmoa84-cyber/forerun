package com.forerun.customer.ui.navigation

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.forerun.customer.R
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextPrimary

sealed class BottomNavItem(
    val route: String,
    @StringRes val titleRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Home : BottomNavItem(
        route = Routes.HOME,
        titleRes = R.string.nav_home,
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    )

    data object Orders : BottomNavItem(
        route = Routes.ORDERS,
        titleRes = R.string.nav_orders,
        selectedIcon = Icons.AutoMirrored.Filled.List,
        unselectedIcon = Icons.AutoMirrored.Outlined.List
    )

    data object Account : BottomNavItem(
        route = Routes.ACCOUNT,
        titleRes = R.string.nav_account,
        selectedIcon = Icons.Filled.Person,
        unselectedIcon = Icons.Outlined.Person
    )

    companion object {
        val items: List<BottomNavItem>
            get() = listOf(Home, Orders, Account)
    }
}

@Composable
fun ForerunBottomNavBar(
    currentRoute: String?,
    onNavigateToRoute: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        HorizontalDivider(
            color = ForerunBorder.copy(alpha = 0.6f),
            thickness = 0.8.dp
        )
        NavigationBar(
            containerColor = ForerunSurface,
            contentColor = ForerunTextPrimary,
            tonalElevation = 0.dp
        ) {
            BottomNavItem.items.forEach { item ->
                val isSelected = currentRoute == item.route
                NavigationBarItem(
                    selected = isSelected,
                    onClick = {
                        if (currentRoute != item.route) {
                            onNavigateToRoute(item.route)
                        }
                    },
                    icon = {
                        Icon(
                            imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = stringResource(item.titleRes),
                            modifier = Modifier.size(24.dp)
                        )
                    },
                    label = {
                        Text(
                            text = stringResource(item.titleRes),
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = ForerunOrange,
                        selectedTextColor = ForerunOrange,
                        indicatorColor = ForerunOrangeLight.copy(alpha = 0.35f),
                        unselectedIconColor = ForerunTextMuted,
                        unselectedTextColor = ForerunTextMuted
                    )
                )
            }
        }
    }
}
