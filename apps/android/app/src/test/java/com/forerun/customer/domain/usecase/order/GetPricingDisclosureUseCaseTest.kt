package com.forerun.customer.domain.usecase.order

import com.forerun.customer.data.FakeOrderRepository
import com.forerun.customer.domain.model.PricingDisclosure
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GetPricingDisclosureUseCaseTest {

    private lateinit var fakeOrderRepository: FakeOrderRepository
    private lateinit var useCase: GetPricingDisclosureUseCase

    @Before
    fun setUp() {
        fakeOrderRepository = FakeOrderRepository()
        useCase = GetPricingDisclosureUseCase(fakeOrderRepository)
    }

    @Test
    fun invoke_success_returnsPricingDisclosure() = runTest {
        val expected = PricingDisclosure(baseFee = 70, extraStoreFee = 25, peripheralFee = 45)
        fakeOrderRepository.getPricingDisclosureResult = Result.success(expected)

        val result = useCase()

        assertTrue(result.isSuccess)
        assertEquals(expected, result.getOrThrow())
        assertEquals(1, fakeOrderRepository.getPricingDisclosureCallCount)
    }

    @Test
    fun invoke_failure_propagatesError() = runTest {
        val error = Exception("Network failure")
        fakeOrderRepository.getPricingDisclosureResult = Result.failure(error)

        val result = useCase()

        assertTrue(result.isFailure)
        assertEquals(error, result.exceptionOrNull())
    }
}
