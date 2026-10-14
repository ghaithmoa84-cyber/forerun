package com.forerun.customer.domain.usecase.order

import com.forerun.customer.domain.model.PricingDisclosure
import com.forerun.customer.domain.repository.OrderRepository
import javax.inject.Inject

class GetPricingDisclosureUseCase @Inject constructor(
    private val orderRepository: OrderRepository
) {
    suspend operator fun invoke(): Result<PricingDisclosure> {
        return orderRepository.getPricingDisclosure()
    }
}
