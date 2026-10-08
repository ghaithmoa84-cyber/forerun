package com.forerun.customer.ui.theme

import androidx.compose.ui.graphics.Color

// =========================================================================
// Brand Colors (الألوان المعتمدة الجديدة)
// =========================================================================
// 1. Fresh Mint / Turquoise (#86ece6) - الهوية الرئيسية والانتعاش
val ForerunMint = Color(0xFF86ECE6)
val ForerunMintDark = Color(0xFF2EA59D)
val ForerunMintLight = Color(0xFFE8FAF9)

// 2. Vibrant Orange (#ff751f) - الحيوية والإجراءات التفاعلية وحالة التوصيل
val ForerunOrange = Color(0xFFFF751F)
val ForerunOrangeDark = Color(0xFFE05E0D)
val ForerunOrangeLight = Color(0xFFFFF2E8)

// 3. Deep Slate Navy (#2d3b4d) - الفخامة وتباين النصوص والعناصر الداكنة
val ForerunNavy = Color(0xFF2D3B4D)
val ForerunNavyDark = Color(0xFF1E2835)
val ForerunNavyLight = Color(0xFF43546A)

// =========================================================================
// Brand Aliases (للتوافق الفوري والشامل مع جميع الواجهات الحالية)
// =========================================================================
val ForerunGreen = ForerunMint
val ForerunGreenDark = ForerunMintDark
val ForerunGreenLight = ForerunMintLight
val ForerunAccent = ForerunOrange
val ForerunDark = ForerunNavy
val WhatsAppGreen = Color(0xFF25D366)

// =========================================================================
// Surfaces & Backgrounds
// =========================================================================
val ForerunBackground = Color(0xFFFFFFFF)
val ForerunSurface = Color(0xFFFFFFFF)
val ForerunSoftSurface = Color(0xFFF4F7F9)
val ForerunBorder = Color(0xFFE2E8F0)

// =========================================================================
// Typography & Text Contrasts
// =========================================================================
val ForerunTextPrimary = ForerunNavy        // #2D3B4D للنصوص الرئيسية يمنح هوية واضحة ومميزة
val ForerunTextMuted = Color(0xFF677788)     // رمادي كحلي متناسق مع النص الأساسي
val ForerunTextOnPrimary = ForerunNavy      // تباين عالي ومقروء بنسبة 8:1 على النعناعي #86ECE6
val ForerunTextOnDark = Color(0xFFFFFFFF)   // أبيض على الخلفيات الداكنة
val ForerunTextOnOrange = Color(0xFFFFFFFF) // أبيض على البرتقالي

// =========================================================================
// Semantic
// =========================================================================
val ForerunDanger = Color(0xFFEF4444)
val ForerunDangerLight = Color(0xFFFEE2E2)
val ForerunWarning = Color(0xFFF59E0B)
val ForerunWarningLight = Color(0xFFFEF3C7)
val ForerunSuccess = Color(0xFF10B981)
val ForerunSuccessLight = Color(0xFFD1FAE5)

// Status colors
val StatusPending = Color(0xFFF59E0B)        // amber
val StatusInProgress = Color(0xFF3B82F6)     // blue
val StatusDelivering = ForerunOrange         // orange #FF751F
val StatusDelivered = Color(0xFF10B981)      // green
val StatusCancelled = Color(0xFFEF4444)      // red

