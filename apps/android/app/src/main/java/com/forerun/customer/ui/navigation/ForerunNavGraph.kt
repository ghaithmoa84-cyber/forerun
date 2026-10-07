package com.forerun.customer.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import com.forerun.customer.core.auth.SessionExpiryNotifier
import com.forerun.customer.ui.account.AccountScreen
import com.forerun.customer.ui.auth.login.LoginScreen
import com.forerun.customer.ui.auth.register.RegisterScreen
import com.forerun.customer.ui.auth.status.PendingVerificationScreen
import com.forerun.customer.ui.auth.status.SuspendedScreen
import com.forerun.customer.ui.home.HomeScreen
import com.forerun.customer.ui.address.AddressSetupScreen
import com.forerun.customer.ui.onboarding.OnboardingScreen
import com.forerun.customer.ui.order.create.CreateOrderScreen
import com.forerun.customer.ui.orders.OrdersScreen
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.forerun.customer.ui.order.confirmation.OrderConfirmationScreen
import com.forerun.customer.ui.splash.SplashDestination
import com.forerun.customer.ui.splash.SplashScreen
import com.forerun.customer.ui.support.SupportScreen

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val PENDING_VERIFICATION = "pending_verification"
    const val SUSPENDED = "suspended"
    const val HOME = "home"
    const val ORDERS = "orders"
    const val ACCOUNT = "account"
    const val SUPPORT = "support"
    const val ADDRESS_SETUP = "address_setup"
    const val CREATE_ORDER = "create_order"
    const val ORDER_CONFIRMATION = "order_confirmation/{orderNumber}?estimatedFee={estimatedFee}"
    fun orderConfirmation(orderNumber: String, estimatedFee: Int = 0): String =
        "order_confirmation/$orderNumber?estimatedFee=$estimatedFee"
    const val ORDER_DETAIL = "orders/{orderId}"
    fun orderDetail(orderId: String): String = "orders/$orderId"
    const val ORDER_RATING = "orders/{orderId}/rating"
    fun orderRating(orderId: String): String = "orders/$orderId/rating"
}

@Composable
fun ForerunNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    startDestination: String = Routes.SPLASH,
    sessionExpiryNotifier: SessionExpiryNotifier? = null
) {
    if (sessionExpiryNotifier != null) {
        LaunchedEffect(sessionExpiryNotifier) {
            sessionExpiryNotifier.sessionExpiredEvent.collect {
                if (navController.currentDestination?.route != Routes.LOGIN) {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute in setOf(Routes.HOME, Routes.ORDERS, Routes.ACCOUNT)

    Scaffold(
        modifier = modifier,
        bottomBar = {
            if (showBottomBar) {
                ForerunBottomNavBar(
                    currentRoute = currentRoute,
                    onNavigateToRoute = { route ->
                        if (route == Routes.HOME) {
                            navController.navigate(Routes.HOME) {
                                popUpTo(Routes.HOME) {
                                    inclusive = false
                                }
                                launchSingleTop = true
                            }
                        } else {
                            navController.navigate(route) {
                                popUpTo(Routes.HOME) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding)
        ) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onNavigate = { destination ->
                    when (destination) {
                        SplashDestination.Onboarding -> {
                            navController.navigate(Routes.ONBOARDING) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                        SplashDestination.Login -> {
                            navController.navigate(Routes.LOGIN) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                        SplashDestination.Home -> {
                            navController.navigate(Routes.HOME) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                        SplashDestination.PendingVerification -> {
                            navController.navigate(Routes.PENDING_VERIFICATION) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                        SplashDestination.Suspended -> {
                            navController.navigate(Routes.SUSPENDED) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        }
                        is SplashDestination.OrderDetail -> {
                            navController.navigate(Routes.HOME) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                            navController.navigate(Routes.orderDetail(destination.orderId)) {
                                launchSingleTop = true
                            }
                        }
                    }
                }
            )
        }
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                onNavigateToHome = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToPending = {
                    navController.navigate(Routes.PENDING_VERIFICATION) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToSuspended = {
                    navController.navigate(Routes.SUSPENDED) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Routes.REGISTER)
                }
            )
        }
        composable(Routes.REGISTER) {
            RegisterScreen(
                onNavigateToPending = {
                    navController.navigate(Routes.PENDING_VERIFICATION) {
                        popUpTo(Routes.LOGIN) { inclusive = false }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }
        composable(Routes.PENDING_VERIFICATION) {
            PendingVerificationScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToHome = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.PENDING_VERIFICATION) { inclusive = true }
                    }
                }
            )
        }
        composable(Routes.SUSPENDED) {
            SuspendedScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable(Routes.HOME) {
            HomeScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToCreateOrder = {
                    navController.navigate(Routes.CREATE_ORDER)
                },
                onNavigateToOrderDetail = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                },
                onNavigateToRoute = { route ->
                    if (route == Routes.HOME) {
                        navController.navigate(Routes.HOME) {
                            popUpTo(Routes.HOME) { inclusive = false }
                            launchSingleTop = true
                        }
                    } else {
                        navController.navigate(route) {
                            popUpTo(Routes.HOME) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                }
            )
        }
        composable(Routes.ORDERS) {
            OrdersScreen(
                onNavigateToCreateOrder = {
                    navController.navigate(Routes.CREATE_ORDER)
                },
                onNavigateToOrderDetail = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                }
            )
        }
        composable(Routes.ACCOUNT) {
            AccountScreen(
                onNavigateToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToAddressSetup = {
                    navController.navigate(Routes.ADDRESS_SETUP)
                },
                onNavigateToSupport = {
                    navController.navigate(Routes.SUPPORT)
                }
            )
        }
        composable(Routes.SUPPORT) {
            SupportScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
        composable(Routes.ADDRESS_SETUP) {
            AddressSetupScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
        composable(Routes.CREATE_ORDER) {
            CreateOrderScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToAddressSetup = {
                    navController.navigate(Routes.ADDRESS_SETUP)
                },
                onNavigateToOrders = {
                    navController.navigate(Routes.ORDERS) {
                        popUpTo(Routes.HOME)
                    }
                },
                onNavigateToConfirmation = { orderNumber, estimatedFee ->
                    navController.navigate(Routes.orderConfirmation(orderNumber, estimatedFee)) {
                        popUpTo(Routes.HOME)
                    }
                }
            )
        }
        composable(
            route = Routes.ORDER_CONFIRMATION,
            arguments = listOf(
                navArgument("orderNumber") { type = NavType.StringType },
                navArgument("estimatedFee") { type = NavType.IntType; defaultValue = 0 }
            )
        ) { backStackEntry ->
            val orderNumber = backStackEntry.arguments?.getString("orderNumber") ?: ""
            val estimatedFee = backStackEntry.arguments?.getInt("estimatedFee") ?: 0
            OrderConfirmationScreen(
                orderNumber = orderNumber,
                estimatedFee = estimatedFee,
                onTrackOrder = {
                    navController.navigate(Routes.ORDERS) {
                        popUpTo(Routes.HOME)
                    }
                },
                onNewOrder = {
                    navController.navigate(Routes.CREATE_ORDER) {
                        popUpTo(Routes.HOME)
                    }
                }
            )
        }
        composable(
            route = Routes.ORDER_DETAIL,
            arguments = listOf(
                navArgument("orderId") { type = NavType.StringType }
            ),
            deepLinks = listOf(
                navDeepLink { uriPattern = "forerun://orders/{orderId}" },
                navDeepLink { uriPattern = "https://forerun.app/orders/{orderId}" }
            )
        ) {
            com.forerun.customer.ui.order.detail.OrderDetailScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToRating = { orderId ->
                    navController.navigate(Routes.orderRating(orderId))
                }
            )
        }
        composable(
            route = Routes.ORDER_RATING,
            arguments = listOf(
                navArgument("orderId") { type = NavType.StringType }
            )
        ) {
            com.forerun.customer.ui.rating.RatingScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
}
