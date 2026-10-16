package com.forerun.customer.ui.home

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.forerun.customer.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ComingSoonFeatureStringsTest {

    private lateinit var context: Context

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
    }

    @Test
    fun storeCatalog_strings_arePresentAndCorrect() {
        val title = context.getString(R.string.service_store_catalog_title)
        val desc = context.getString(R.string.service_store_catalog_desc)
        val dialogTitle = context.getString(R.string.service_store_catalog_dialog_title)
        val dialogDesc = context.getString(R.string.service_store_catalog_dialog_desc)

        assertEquals("اختر متجرك", title)
        assertEquals("تسوق من متجرك المفضل", desc)
        assertTrue("Store catalog dialog title should not be empty", dialogTitle.isNotEmpty())
        assertTrue("Store catalog dialog desc should not be empty", dialogDesc.isNotEmpty())
    }

    @Test
    fun productSearch_strings_arePresentAndCorrect() {
        val title = context.getString(R.string.service_product_search_title)
        val desc = context.getString(R.string.service_product_search_desc)
        val dialogTitle = context.getString(R.string.service_product_search_dialog_title)
        val dialogDesc = context.getString(R.string.service_product_search_dialog_desc)

        assertEquals("ابحث عن منتجك", title)
        assertEquals("إيجاد أغراضك من المتاجر المتاحة", desc)
        assertTrue("Product search dialog title should not be empty", dialogTitle.isNotEmpty())
        assertTrue("Product search dialog desc should not be empty", dialogDesc.isNotEmpty())
    }

    @Test
    fun inDevelopmentNotice_isUnambiguous() {
        val notice = context.getString(R.string.coming_soon_feature_in_dev_notice)
        assertEquals("هذه الخدمة قيد التطوير حالياً وغير متاحة بعد.", notice)
    }

    @Test
    fun comingSoonBadgeAndDismiss_strings_areCorrect() {
        val badge = context.getString(R.string.service_tag_coming_soon)
        val dismiss = context.getString(R.string.coming_soon_dialog_dismiss)
        val learnMore = context.getString(R.string.service_card_learn_more)

        assertEquals("قريباً", badge)
        assertEquals("إغلاق", dismiss)
        assertEquals("تفاصيل الخدمة", learnMore)
    }
}
