package com.forerun.customer.ui.support

import com.forerun.customer.core.config.AppConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SupportViewModelTest {

    private lateinit var viewModel: SupportViewModel

    @Before
    fun setUp() {
        viewModel = SupportViewModel(ApplicationProvider.getApplicationContext())
    }

    @Test
    fun initialState_hasFaqList_andAdminPhone() {
        val state = viewModel.uiState.value

        assertEquals(AppConfig.ADMIN_WHATSAPP_DISPLAY, state.adminPhone)
        assertEquals(6, state.faqs.size)
        assertTrue(state.faqs.none { it.isExpanded })
    }

    @Test
    fun toggleFaq_expandsAndCollapsesItem() {
        val targetId = 1
        assertFalse(viewModel.uiState.value.faqs.first { it.id == targetId }.isExpanded)

        // Expand
        viewModel.toggleFaq(targetId)
        assertTrue(viewModel.uiState.value.faqs.first { it.id == targetId }.isExpanded)

        // Collapse
        viewModel.toggleFaq(targetId)
        assertFalse(viewModel.uiState.value.faqs.first { it.id == targetId }.isExpanded)
    }

    @Test
    fun getWhatsAppUrl_defaultMessage_returnsValidWaMeUrlWithPhone() {
        val url = viewModel.getWhatsAppUrl()

        assertTrue(url.startsWith("https://wa.me/${AppConfig.ADMIN_WHATSAPP_NUMBER}"))
        assertTrue(url.contains("text="))
    }

    @Test
    fun getWhatsAppUrl_customMessage_returnsEncodedUrl() {
        val custom = "رسالة تجريبية"
        val url = viewModel.getWhatsAppUrl(custom)

        assertTrue(url.startsWith("https://wa.me/${AppConfig.ADMIN_WHATSAPP_NUMBER}"))
        assertTrue(url.contains("text="))
    }

    @Test
    fun toggleFaq_nonExistentId_leavesFaqsUnchanged() {
        viewModel.toggleFaq(999)
        assertTrue(viewModel.uiState.value.faqs.none { it.isExpanded })
    }
}