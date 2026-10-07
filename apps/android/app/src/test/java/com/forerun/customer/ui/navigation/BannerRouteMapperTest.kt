package com.forerun.customer.ui.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BannerRouteMapperTest {

    @Test
    fun toRoute_mapsAllWhitelistedRoutesCorrectly() {
        assertEquals(Routes.CREATE_ORDER, BannerRouteMapper.toRoute("/create-order"))
        assertEquals(Routes.ORDERS, BannerRouteMapper.toRoute("/orders"))
        assertEquals(Routes.ACCOUNT, BannerRouteMapper.toRoute("/account"))
        assertEquals(Routes.SUPPORT, BannerRouteMapper.toRoute("/support"))
        assertEquals(Routes.HOME, BannerRouteMapper.toRoute("/home"))
    }

    @Test
    fun toRoute_handlesLeadingAndTrailingWhitespace() {
        assertEquals(Routes.CREATE_ORDER, BannerRouteMapper.toRoute("  /create-order  "))
        assertEquals(Routes.ORDERS, BannerRouteMapper.toRoute("\n/orders\t"))
        assertEquals(Routes.ACCOUNT, BannerRouteMapper.toRoute(" /account "))
        assertEquals(Routes.SUPPORT, BannerRouteMapper.toRoute("/support "))
        assertEquals(Routes.HOME, BannerRouteMapper.toRoute(" /home"))
    }

    @Test
    fun toRoute_handlesTrailingSlashesSafely() {
        assertEquals(Routes.CREATE_ORDER, BannerRouteMapper.toRoute("/create-order/"))
        assertEquals(Routes.ORDERS, BannerRouteMapper.toRoute("/orders/"))
        assertEquals(Routes.ACCOUNT, BannerRouteMapper.toRoute("/account/"))
        assertEquals(Routes.SUPPORT, BannerRouteMapper.toRoute("/support/"))
        assertEquals(Routes.HOME, BannerRouteMapper.toRoute("/home/"))
    }

    @Test
    fun toRoute_returnsNullForNullAndBlankInputs() {
        assertNull(BannerRouteMapper.toRoute(null))
        assertNull(BannerRouteMapper.toRoute(""))
        assertNull(BannerRouteMapper.toRoute("   "))
        assertNull(BannerRouteMapper.toRoute("\t\n"))
    }

    @Test
    fun toRoute_returnsNullSilentlyForUnknownRoutesWithoutCrashing() {
        // Unknown paths that might be added to backend in future or entered erroneously
        assertNull(BannerRouteMapper.toRoute("/unknown"))
        assertNull(BannerRouteMapper.toRoute("/settings"))
        assertNull(BannerRouteMapper.toRoute("/cart"))
        assertNull(BannerRouteMapper.toRoute("/orders/create"))
        assertNull(BannerRouteMapper.toRoute("https://forerun.sy/create-order"))
        assertNull(BannerRouteMapper.toRoute("create_order")) // raw Android constant without slash
        assertNull(BannerRouteMapper.toRoute("/"))
    }

    @Test
    fun isSupported_returnsTrueOnlyForWhitelistedRoutes() {
        assertTrue(BannerRouteMapper.isSupported("/create-order"))
        assertTrue(BannerRouteMapper.isSupported("/orders"))
        assertTrue(BannerRouteMapper.isSupported("/account"))
        assertTrue(BannerRouteMapper.isSupported("/support"))
        assertTrue(BannerRouteMapper.isSupported("/home"))

        assertFalse(BannerRouteMapper.isSupported("/unknown"))
        assertFalse(BannerRouteMapper.isSupported(null))
        assertFalse(BannerRouteMapper.isSupported(""))
    }

    @Test
    fun supportedBackendRoutes_containsExactlyFiveExpectedKeys() {
        val expected = setOf(
            "/create-order",
            "/orders",
            "/account",
            "/support",
            "/home"
        )
        assertEquals(expected, BannerRouteMapper.supportedBackendRoutes)
    }
}
