package com.forerun.customer.core.error

import android.content.Context
import android.util.Log
import androidx.annotation.StringRes
import com.forerun.customer.R
import java.io.IOException

object ErrorSanitizer {

    private const val DEFAULT_TAG = "ErrorSanitizer"

    @Volatile
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun isNetworkError(throwable: Throwable?, message: String?): Boolean {
        if (throwable is IOException) return true
        val msg = (message ?: throwable?.message)?.lowercase() ?: return false
        return msg.contains("network") ||
                msg.contains("timeout") ||
                msg.contains("socket") ||
                msg.contains("unknownhost") ||
                msg.contains("econnrefused") ||
                msg.contains("offline") ||
                msg.contains("no internet") ||
                msg.contains("failed to connect") ||
                msg.contains("connection refused") ||
                msg.contains("connection reset") ||
                msg.contains("connection timed out") ||
                msg.contains("unreachable")
    }

    private fun isArabic(text: String): Boolean {
        return text.any { it in '\u0600'..'\u06FF' }
    }

    fun getGenericErrorMessage(
        error: Throwable?,
        rawMessage: String? = null,
        context: Context? = null,
        @StringRes fallbackResId: Int? = null,
        tag: String = DEFAULT_TAG
    ): String {
        val technicalMessage = rawMessage ?: error?.localizedMessage ?: error?.message
        if (error != null) {
            Log.e(tag, "Technical error captured: $technicalMessage", error)
        } else {
            Log.e(tag, "Technical error captured: $technicalMessage")
        }

        // If the message is already an Arabic localized message, preserve it
        if (!technicalMessage.isNullOrBlank() && isArabic(technicalMessage)) {
            return technicalMessage
        }

        val resolvedContext = getContext(context)
        val resId = when {
            isNetworkError(error, technicalMessage) -> R.string.error_network
            fallbackResId != null -> fallbackResId
            else -> R.string.error_generic
        }

        return resolvedContext?.getString(resId) ?: run {
            // Test/dev fallback only when Android context is completely unavailable
            if (resId == R.string.error_network) "Network connection error" else "An unexpected error occurred"
        }
    }

    fun getGenericErrorMessage(
        rawMessage: String?,
        context: Context? = null,
        @StringRes fallbackResId: Int? = null,
        tag: String = DEFAULT_TAG
    ): String = getGenericErrorMessage(
        error = null,
        rawMessage = rawMessage,
        context = context,
        fallbackResId = fallbackResId,
        tag = tag
    )

    private fun getContext(explicitContext: Context?): Context? {
        if (explicitContext != null) return explicitContext
        if (appContext != null) return appContext
        return try {
            val clazz = Class.forName("androidx.test.core.app.ApplicationProvider")
            val method = clazz.getMethod("getApplicationContext")
            method.invoke(null) as? Context
        } catch (_: Throwable) {
            null
        }
    }
}
