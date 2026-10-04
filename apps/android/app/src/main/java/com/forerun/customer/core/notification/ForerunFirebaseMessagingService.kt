package com.forerun.customer.core.notification

import android.util.Log
import com.forerun.customer.BuildConfig
import com.forerun.customer.core.storage.TokenStorage
import com.forerun.customer.domain.repository.DeviceTokenRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ForerunFirebaseMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var tokenStorage: TokenStorage

    @Inject
    lateinit var deviceTokenRepository: DeviceTokenRepository

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "Refreshed FCM token received: $token")
        }
        tokenStorage.setDeviceToken(token)

        if (tokenStorage.hasValidAccessToken()) {
            serviceScope.launch {
                try {
                    deviceTokenRepository.registerDeviceToken(token)
                    Log.d(TAG, "Successfully registered new FCM token on server")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to register new FCM token on server", e)
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "FCM message received from: ${remoteMessage.from}")

        val title = remoteMessage.notification?.title
        val body = remoteMessage.notification?.body
        val data = remoteMessage.data

        val payload = NotificationPayloadParser.parse(
            data = data,
            notificationTitle = title,
            notificationBody = body
        )

        NotificationHelper.showOrderNotification(
            context = applicationContext,
            payload = payload
        )
    }

    companion object {
        private const val TAG = "ForerunFcmService"
    }
}
