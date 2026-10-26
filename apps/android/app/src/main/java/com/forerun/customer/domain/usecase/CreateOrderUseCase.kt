package com.forerun.customer.domain.usecase

import com.forerun.customer.domain.model.CreatedOrder
import com.forerun.customer.domain.model.CustomerAddress
import com.forerun.customer.domain.model.OrderItem
import com.forerun.customer.domain.repository.OrderRepository
import javax.inject.Inject

class CreateOrderUseCase @Inject constructor(
    private val repository: OrderRepository
) {
    suspend operator fun invoke(
        items: List<OrderItem>,
        notes: String?,
        preferredRunnerId: String?,
        waitForPreferred: Boolean,
        deliveryAddress: CustomerAddress,
        idempotencyKey: String? = null
    ): Result<CreatedOrder> {
        return repository.createOrder(
            items = items,
            notes = notes,
            preferredRunnerId = preferredRunnerId,
            waitForPreferred = waitForPreferred,
            deliveryAddress = deliveryAddress,
            idempotencyKey = idempotencyKey
        )
    }
}
