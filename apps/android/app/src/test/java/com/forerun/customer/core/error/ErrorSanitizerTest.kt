package com.forerun.customer.core.error

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

@RunWith(AndroidJUnit4::class)
class ErrorSanitizerTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        ErrorSanitizer.init(context)
    }

    @Test
    fun getGenericErrorMessage_withIOException_returnsNetworkErrorString() {
        val ioException = IOException("Connection reset by peer")
        val result = ErrorSanitizer.getGenericErrorMessage(ioException, context = context)

        val expected = context.getString(R.string.error_network)
        assertEquals(expected, result)
    }

    @Test
    fun getGenericErrorMessage_withNetworkString_returnsNetworkErrorString() {
        val result = ErrorSanitizer.getGenericErrorMessage("Network Timeout occurred", context = context)

        val expected = context.getString(R.string.error_network)
        assertEquals(expected, result)
    }

    @Test
    fun getGenericErrorMessage_withGenericException_returnsGenericErrorString() {
        val genericException = RuntimeException("NullPointerException at line 42")
        val result = ErrorSanitizer.getGenericErrorMessage(genericException, context = context)

        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, result)
    }

    @Test
    fun getGenericErrorMessage_withTechnicalEnglishString_returnsGenericErrorString() {
        val result = ErrorSanitizer.getGenericErrorMessage("Internal Server Error (500)", context = context)

        val expected = context.getString(R.string.error_generic)
        assertEquals(expected, result)
    }

    @Test
    fun getGenericErrorMessage_withFallbackResId_returnsFallbackString() {
        val result = ErrorSanitizer.getGenericErrorMessage(
            rawMessage = "Invalid credentials on server",
            context = context,
            fallbackResId = R.string.error_login_generic
        )

        val expected = context.getString(R.string.error_login_generic)
        assertEquals(expected, result)
    }

    @Test
    fun getGenericErrorMessage_withAlreadyArabicMessage_preservesArabicMessage() {
        // Retrieve an Arabic string from resources to adhere strictly to the zero-hardcoded-Arabic rule
        val arabicFromResources = context.getString(R.string.order_detail_cancel_error_not_found)
        val result = ErrorSanitizer.getGenericErrorMessage(arabicFromResources, context = context)

        assertEquals(arabicFromResources, result)
    }
}
