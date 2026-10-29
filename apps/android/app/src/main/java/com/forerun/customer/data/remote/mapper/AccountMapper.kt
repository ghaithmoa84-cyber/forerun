package com.forerun.customer.data.remote.mapper

import com.forerun.customer.data.remote.dto.customer.CustomerProfileDto
import com.forerun.customer.domain.model.CustomerProfile
import com.forerun.customer.domain.model.UserStatus
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

object AccountMapper {

    fun CustomerProfileDto.toDomain(): CustomerProfile = CustomerProfile(
        id = id,
        name = name,
        whatsapp = whatsapp,
        altPhone = altPhone,
        status = UserStatus.fromString(status),
        completedOrders = completedOrders,
        totalFeesPaid = totalFeesPaid,
        createdAt = parseCreatedAt(createdAt),
        freeOrdersRemaining = freeOrdersRemaining
    )

    // The API contract does not guarantee the timestamp shape. An unparseable
    // value must never fail the whole profile fetch, so it degrades to null.
    private fun parseCreatedAt(raw: String): Instant? {
        if (raw.isBlank()) return null
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            try {
                OffsetDateTime.parse(raw).toInstant()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }
}
