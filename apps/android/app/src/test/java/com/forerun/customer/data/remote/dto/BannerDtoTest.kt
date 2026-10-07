package com.forerun.customer.data.remote.dto

import com.forerun.customer.data.remote.dto.banner.BannerActionType
import com.forerun.customer.data.remote.dto.banner.BannerDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class BannerDtoTest {

    private lateinit var moshi: Moshi

    @Before
    fun setup() {
        moshi = Moshi.Builder().build()
    }

    @Test
    fun parse_fullBannerJson_deserializesAllFieldsCorrectly() {
        val json = """
            {
                "id": "ban_123",
                "headline": "Special Offer Today",
                "subtitle": "Exclusive discount on your first order",
                "imageUrl": "https://example.com/banner.webp",
                "actionType": "IN_APP_ROUTE",
                "actionValue": "/create-order",
                "ctaLabel": "Order Now",
                "sortOrder": 1
            }
        """.trimIndent()

        val adapter = moshi.adapter(BannerDto::class.java)
        val banner = adapter.fromJson(json)

        requireNotNull(banner)
        assertEquals("ban_123", banner.id)
        assertEquals("Special Offer Today", banner.headline)
        assertEquals("Exclusive discount on your first order", banner.subtitle)
        assertEquals("https://example.com/banner.webp", banner.imageUrl)
        assertEquals("IN_APP_ROUTE", banner.actionType)
        assertEquals(BannerActionType.IN_APP_ROUTE, banner.resolvedActionType)
        assertEquals("/create-order", banner.actionValue)
        assertEquals("Order Now", banner.ctaLabel)
        assertEquals(1, banner.sortOrder)
    }

    @Test
    fun parse_nullableFieldsAsNull_deserializesWithoutErrors() {
        val json = """
            {
                "id": "ban_456",
                "headline": null,
                "subtitle": null,
                "imageUrl": "https://example.com/image.png",
                "actionType": "NONE",
                "actionValue": null,
                "ctaLabel": null,
                "sortOrder": 2
            }
        """.trimIndent()

        val adapter = moshi.adapter(BannerDto::class.java)
        val banner = adapter.fromJson(json)

        requireNotNull(banner)
        assertEquals("ban_456", banner.id)
        assertNull(banner.headline)
        assertNull(banner.subtitle)
        assertEquals("https://example.com/image.png", banner.imageUrl)
        assertEquals("NONE", banner.actionType)
        assertEquals(BannerActionType.NONE, banner.resolvedActionType)
        assertNull(banner.actionValue)
        assertNull(banner.ctaLabel)
        assertEquals(2, banner.sortOrder)
    }

    @Test
    fun parse_missingOptionalFields_usesDefaults() {
        val json = """
            {
                "id": "ban_789",
                "imageUrl": "https://example.com/simple.jpg",
                "actionType": "WHATSAPP_ADMIN",
                "sortOrder": 3
            }
        """.trimIndent()

        val adapter = moshi.adapter(BannerDto::class.java)
        val banner = adapter.fromJson(json)

        requireNotNull(banner)
        assertEquals("ban_789", banner.id)
        assertNull(banner.headline)
        assertNull(banner.subtitle)
        assertEquals("https://example.com/simple.jpg", banner.imageUrl)
        assertEquals(BannerActionType.WHATSAPP_ADMIN, banner.resolvedActionType)
        assertNull(banner.actionValue)
        assertNull(banner.ctaLabel)
        assertEquals(3, banner.sortOrder)
    }

    @Test
    fun parse_listOfBanners_deserializesArrayCorrectly() {
        val json = """
            [
                {
                    "id": "b1",
                    "imageUrl": "https://example.com/1.png",
                    "actionType": "EXTERNAL_URL",
                    "actionValue": "https://forerun.sy",
                    "sortOrder": 0
                },
                {
                    "id": "b2",
                    "imageUrl": "https://example.com/2.png",
                    "actionType": "NONE",
                    "sortOrder": 1
                }
            ]
        """.trimIndent()

        val type = Types.newParameterizedType(List::class.java, BannerDto::class.java)
        val adapter = moshi.adapter<List<BannerDto>>(type)
        val list = adapter.fromJson(json)

        requireNotNull(list)
        assertEquals(2, list.size)
        assertEquals("b1", list[0].id)
        assertEquals(BannerActionType.EXTERNAL_URL, list[0].resolvedActionType)
        assertEquals("b2", list[1].id)
        assertEquals(BannerActionType.NONE, list[1].resolvedActionType)
    }

    @Test
    fun resolvedActionType_mapsAllActionTypesCorrectly() {
        val noneBanner = BannerDto(id = "1", imageUrl = "https://x.com", actionType = "NONE", sortOrder = 0)
        val urlBanner = BannerDto(id = "2", imageUrl = "https://x.com", actionType = "EXTERNAL_URL", sortOrder = 1)
        val routeBanner = BannerDto(id = "3", imageUrl = "https://x.com", actionType = "IN_APP_ROUTE", sortOrder = 2)
        val whatsappBanner = BannerDto(id = "4", imageUrl = "https://x.com", actionType = "WHATSAPP_ADMIN", sortOrder = 3)

        assertEquals(BannerActionType.NONE, noneBanner.resolvedActionType)
        assertEquals(BannerActionType.EXTERNAL_URL, urlBanner.resolvedActionType)
        assertEquals(BannerActionType.IN_APP_ROUTE, routeBanner.resolvedActionType)
        assertEquals(BannerActionType.WHATSAPP_ADMIN, whatsappBanner.resolvedActionType)
    }

    @Test
    fun resolvedActionType_handlesCaseInsensitivityAndFallbacks() {
        val lowerCase = BannerDto(id = "1", imageUrl = "https://x.com", actionType = "in_app_route", sortOrder = 0)
        val whitespace = BannerDto(id = "2", imageUrl = "https://x.com", actionType = "  EXTERNAL_URL  ", sortOrder = 1)
        val unknown = BannerDto(id = "3", imageUrl = "https://x.com", actionType = "FUTURE_UNSUPPORTED_TYPE", sortOrder = 2)
        val empty = BannerDto(id = "4", imageUrl = "https://x.com", actionType = "", sortOrder = 3)

        assertEquals(BannerActionType.IN_APP_ROUTE, lowerCase.resolvedActionType)
        assertEquals(BannerActionType.EXTERNAL_URL, whitespace.resolvedActionType)
        assertEquals(BannerActionType.NONE, unknown.resolvedActionType)
        assertEquals(BannerActionType.NONE, empty.resolvedActionType)
    }
}
