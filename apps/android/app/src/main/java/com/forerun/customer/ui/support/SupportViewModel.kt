package com.forerun.customer.ui.support

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.forerun.customer.R
import com.forerun.customer.core.config.AppConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class FaqItem(
    val id: Int,
    val question: String,
    val answer: String,
    val isExpanded: Boolean = false
)

data class SupportUiState(
    val adminPhone: String = AppConfig.ADMIN_WHATSAPP_DISPLAY,
    val faqs: List<FaqItem> = emptyList()
)

@HiltViewModel
class SupportViewModel @Inject constructor(
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(SupportUiState(faqs = defaultFaqs()))
    val uiState: StateFlow<SupportUiState> = _uiState.asStateFlow()

    fun toggleFaq(id: Int) {
        val currentFaqs = _uiState.value.faqs
        val updatedFaqs = currentFaqs.map { faq ->
            if (faq.id == id) faq.copy(isExpanded = !faq.isExpanded) else faq
        }
        _uiState.value = _uiState.value.copy(faqs = updatedFaqs)
    }

    fun getWhatsAppUrl(customMessage: String? = null): String {
        val message = customMessage
            ?: getApplication<Application>().getString(R.string.support_default_message)
        return AppConfig.buildWhatsAppUrl(message)
    }

    private fun defaultFaqs(): List<FaqItem> {
        val context = getApplication<Application>()
        return listOf(
            FaqItem(
                id = 1,
                question = context.getString(R.string.support_faq_1_question),
                answer = context.getString(R.string.support_faq_1_answer)
            ),
            FaqItem(
                id = 2,
                question = context.getString(R.string.support_faq_2_question),
                answer = context.getString(R.string.support_faq_2_answer)
            ),
            FaqItem(
                id = 3,
                question = context.getString(R.string.support_faq_3_question),
                answer = context.getString(R.string.support_faq_3_answer)
            ),
            FaqItem(
                id = 4,
                question = context.getString(R.string.support_faq_4_question),
                answer = context.getString(R.string.support_faq_4_answer)
            ),
            FaqItem(
                id = 5,
                question = context.getString(R.string.support_faq_5_question),
                answer = context.getString(R.string.support_faq_5_answer)
            ),
            FaqItem(
                id = 6,
                question = context.getString(R.string.support_faq_6_question),
                answer = context.getString(R.string.support_faq_6_answer)
            )
        )
    }
}
