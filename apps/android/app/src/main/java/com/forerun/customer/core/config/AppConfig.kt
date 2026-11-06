package com.forerun.customer.core.config

object AppConfig {
    /**
     * Official Admin WhatsApp number in international format without '+' for wa.me links.
     * Replaces temporary placeholders across the app (BUG-ANDROID-001).
     */
    const val ADMIN_WHATSAPP = "963995535895"
    const val ADMIN_WHATSAPP_NUMBER = "963995535895"
    const val ADMIN_WHATSAPP_DISPLAY = "+963 995 535 895"
    const val ADMIN_SUPPORT_WHATSAPP = "963995535895"
    const val ADMIN_SUPPORT_PHONE = "+963995535895"
    const val ADMIN_SUPPORT_DISPLAY = "+963 995 535 895"

    fun buildWhatsAppUrl(message: String): String {
        val encodedMessage = java.net.URLEncoder.encode(message, "UTF-8")
        return "https://wa.me/$ADMIN_WHATSAPP_NUMBER?text=$encodedMessage"
    }

    const val DEFAULT_COUNTRY_CODE = "963"

    /**
     * Builds a wa.me deep link for a runner phone number (BUG-ANDROID-005).
     * Strips every non-digit character first, so formatted inputs such as
     * "+963 995 535 895" or "0995-535-895" resolve to the same wa.me id as the
     * clean "0995535895". wa.me rejects anything but contiguous digits.
     */
    fun buildRunnerWhatsAppUrl(phone: String): String {
        val digits = phone.filter { it.isDigit() }
        val national = digits
            .removePrefix("00")
            .removePrefix(DEFAULT_COUNTRY_CODE)
            .removePrefix("0")
        return "https://wa.me/$DEFAULT_COUNTRY_CODE$national"
    }
}
