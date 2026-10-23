package com.forerun.customer

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.rememberNavController
import com.forerun.customer.core.auth.SessionExpiryNotifier
import com.forerun.customer.core.notification.DeepLinkHolder
import com.forerun.customer.core.notification.NotificationPayloadParser
import com.forerun.customer.ui.navigation.ForerunNavGraph
import com.forerun.customer.ui.navigation.Routes
import com.forerun.customer.ui.theme.ForerunTheme
import com.forerun.customer.core.version.AppUpdateHolder
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

private val AUTHENTICATED_ROUTES = setOf(
    Routes.HOME,
    Routes.ORDERS,
    Routes.ACCOUNT,
    Routes.SUPPORT,
    Routes.PENDING_VERIFICATION,
    Routes.SUSPENDED
)

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var sessionExpiryNotifier: SessionExpiryNotifier

    @Inject
    lateinit var deepLinkHolder: DeepLinkHolder

    @Inject
    lateinit var appUpdateHolder: AppUpdateHolder

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)

        val initialOrderId = NotificationPayloadParser.extractOrderId(intent)
        if (!initialOrderId.isNullOrBlank()) {
            deepLinkHolder.setPendingOrderId(initialOrderId)
        }

        setContent {
            ForerunTheme {
                val navController = rememberNavController()

                // POST_NOTIFICATIONS permission request for Android 13+ (API 33+)
                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    Log.d("MainActivity", "POST_NOTIFICATIONS granted: $isGranted")
                }

                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val permission = Manifest.permission.POST_NOTIFICATIONS
                        if (ContextCompat.checkSelfPermission(this@MainActivity, permission) != PackageManager.PERMISSION_GRANTED) {
                            notificationPermissionLauncher.launch(permission)
                        }
                    }
                }

                // Handle deep linking from notification payload while app is already past splash.
                // Only navigate when already inside the authenticated area: otherwise a
                // logged-out user tapping a notification lands on an order detail that
                // can only fail with 401.
                LaunchedEffect(navController) {
                    deepLinkHolder.pendingOrderId.collect { orderId ->
                        if (!orderId.isNullOrBlank()) {
                            val currentRoute = navController.currentDestination?.route
                            if (currentRoute in AUTHENTICATED_ROUTES) {
                                val consumed = deepLinkHolder.consumePendingOrderId()
                                if (!consumed.isNullOrBlank()) {
                                    navController.navigate(Routes.orderDetail(consumed)) {
                                        launchSingleTop = true
                                    }
                                }
                            }
                        }
                    }
                }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ForerunNavGraph(
                        navController = navController,
                        sessionExpiryNotifier = sessionExpiryNotifier,
                        appUpdateHolder = appUpdateHolder
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val orderId = NotificationPayloadParser.extractOrderId(intent)
        if (!orderId.isNullOrBlank()) {
            deepLinkHolder.setPendingOrderId(orderId)
        }
    }
}
