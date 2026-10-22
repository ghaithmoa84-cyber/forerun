package com.forerun.customer.data.remote.dto

import com.forerun.customer.data.remote.dto.order.CancelOrderResponseDto
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class CancelOrderResponseDtoTest {

    private lateinit var moshi: Moshi

    @Before
    fun setup() {
        moshi = Moshi.Builder().build()
    }

    @Test
    fun parse_actualBackendResponse_deserializesAllFieldsCorrectly() {
        // Matches the exact backend payload from customerOrdersService.cancelOrder
        val json = """
            {
                "id": "ord_cuid_test_123",
                "orderNumber": "FW-000042",
                "status": "CANCELLED",
                "cancelledAt": "2026-10-22T13:45:00.000Z"
            }
        """.trimIndent()

        val adapter = moshi.adapter(CancelOrderResponseDto::class.java)
        val response = adapter.fromJson(json)

        assertNotNull(response)
        requireNotNull(response)
        assertEquals("ord_cuid_test_123", response.id)
        assertEquals("FW-000042", response.orderNumber)
        assertEquals("CANCELLED", response.status)
        assertEquals("2026-10-22T13:45:00.000Z", response.cancelledAt)
    }

    @Test
    fun parse_responseWithoutCancelledAt_defaultsToNull() {
        val json = """
            {
                "id": "ord_cuid_test_456",
                "orderNumber": "FW-000099",
                "status": "CANCELLED"
            }
        """.trimIndent()

        val adapter = moshi.adapter(CancelOrderResponseDto::class.java)
        val response = adapter.fromJson(json)

        assertNotNull(response)
        requireNotNull(response)
        assertEquals("ord_cuid_test_456", response.id)
        assertEquals("FW-000099", response.orderNumber)
        assertEquals("CANCELLED", response.status)
        assertNull(response.cancelledAt)
    }

    @Test
    fun parse_responseWithNullCancelledAt_parsesAsNull() {
        val json = """
            {
                "id": "ord_cuid_test_789",
                "orderNumber": "FW-000100",
                "status": "CANCELLED",
                "cancelledAt": null
            }
        """.trimIndent()

        val adapter = moshi.adapter(CancelOrderResponseDto::class.java)
        val response = adapter.fromJson(json)

        assertNotNull(response)
        requireNotNull(response)
        assertEquals("ord_cuid_test_789", response.id)
        assertEquals("FW-000100", response.orderNumber)
        assertEquals("CANCELLED", response.status)
        assertNull(response.cancelledAt)
    }
}
