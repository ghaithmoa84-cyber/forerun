package com.forerun.customer

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.util.Log
import com.forerun.customer.core.websocket.SocketManager
import com.google.android.gms.maps.MapsInitializer
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class ForerunApp : Application() {

    @Inject
    lateinit var socketManager: SocketManager

    override fun onCreate() {
        super.onCreate()
        com.forerun.customer.core.error.ErrorSanitizer.init(this)
        try {
            MapsInitializer.initialize(applicationContext, MapsInitializer.Renderer.LATEST) { renderer ->
                Log.d("ForerunApp", "Google Maps initialized with renderer: $renderer")
            }
        } catch (e: Throwable) {
            Log.e("ForerunApp", "Failed to initialize Google Maps", e)
        }

        try {
            com.forerun.customer.core.notification.NotificationHelper.createNotificationChannels(this)
        } catch (e: Throwable) {
            Log.e("ForerunApp", "Failed to initialize Notification Channels", e)
        }

        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            private var startedActivityCount = 0

            override fun onActivityStarted(activity: Activity) {
                if (++startedActivityCount == 1) {
                    socketManager.onAppForegrounded()
                }
            }

            override fun onActivityStopped(activity: Activity) {
                if (--startedActivityCount == 0) {
                    socketManager.onAppBackgrounded()
                }
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }
}
