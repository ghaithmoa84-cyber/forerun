package com.forerun.customer.core.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigTest {

    @Test
    fun buildRunnerWhatsAppUrl_localFormatWithLeadingZero_normalizesToCountryCode() {
        val url = AppConfig.buildRunnerWhatsAppUrl("0912345678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_internationalWithPlus_normalizesToCountryCode() {
        val url = AppConfig.buildRunnerWhatsAppUrl("+963912345678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_internationalWithoutPlus_normalizesToCountryCode() {
        val url = AppConfig.buildRunnerWhatsAppUrl("963912345678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_nationalWithoutZero_keepsNationalPart() {
        val url = AppConfig.buildRunnerWhatsAppUrl("912345678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_surroundingWhitespace_isTrimmed() {
        val url = AppConfig.buildRunnerWhatsAppUrl("  0912345678  ")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_alwaysUsesWaMeDomain() {
        val url = AppConfig.buildRunnerWhatsAppUrl("0912345678")

        assertTrue(url.startsWith("https://wa.me/"))
    }

    @Test
    fun buildRunnerWhatsAppUrl_internalSpaces_areStripped() {
        val url = AppConfig.buildRunnerWhatsAppUrl("+963 912 345 678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_internalDashes_areStripped() {
        val url = AppConfig.buildRunnerWhatsAppUrl("0995-535-895")

        assertEquals("https://wa.me/963995535895", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_parenthesizedFormat_isStripped() {
        val url = AppConfig.buildRunnerWhatsAppUrl("(+963) 912-345-678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_doubleZeroInternationalPrefix_isNormalized() {
        val url = AppConfig.buildRunnerWhatsAppUrl("00963912345678")

        assertEquals("https://wa.me/963912345678", url)
    }

    @Test
    fun buildRunnerWhatsAppUrl_resultContainsOnlyDigitsAfterHost() {
        val url = AppConfig.buildRunnerWhatsAppUrl("+963 (912) 345-678")

        val path = url.removePrefix("https://wa.me/")
        assertTrue(path.all { it.isDigit() })
    }
}
