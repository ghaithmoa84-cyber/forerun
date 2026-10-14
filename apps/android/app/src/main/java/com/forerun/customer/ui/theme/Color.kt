package com.forerun.customer.ui.theme

import androidx.compose.ui.graphics.Color

// =========================================================================
// Brand Colors (الألوان المعتمدة الثلاثة)
// =========================================================================
// 1. Vibrant Orange (#FF751F) - اللون الأساسي للإجراءات والأزرار والطاقة (Primary Action & CTA)
val ForerunOrange = Color(0xFFFF751F)
val ForerunOrangeDark = Color(0xFFE05E0D)
val ForerunOrangeLight = Color(0xFFFFF2E8)
val ForerunOrangeSoft = Color(0xFFFFEAD9)

// 2. Fresh Mint / Turquoise (#86ECE6) - هوية العلامة التجارية والخلفيات والدوائر والانتعاش
val ForerunMint = Color(0xFF86ECE6)
val ForerunMintDark = Color(0xFF2EA59D)
val ForerunMintLight = Color(0xFFE8FAF9)
val ForerunMintSoft = Color(0xFFD6F7F5)

// 3. Deep Slate Navy (#2D3B4D) - العناوين والنصوص والفخامة والتباين العالي
val ForerunNavy = Color(0xFF2D3B4D)
val ForerunNavyDark = Color(0xFF1E2835)
val ForerunNavyLight = Color(0xFF43546A)

// =========================================================================
// Semantic Roles
// =========================================================================
// البرتقالي هو لون الأزرار والإجراءات التفاعلية الأساسية (CTA)
val ForerunPrimary = ForerunOrange
val ForerunPrimaryDark = ForerunOrangeDark
val ForerunPrimaryLight = ForerunOrangeLight

// النعناعي هو اللون المميز للعلامة والدوائر التوضيحية وشارات الهوية
val ForerunSecondary = ForerunMint
val ForerunSecondaryDark = ForerunMintDark
val ForerunSecondaryLight = ForerunMintLight

// للتوافق العكسي مع الكود القائم:
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
val ForerunSoftSurface = Color(0xFFF6F9FA)
val ForerunBorder = Color(0xFFE2E8F0)

// =========================================================================
// Typography & Text Contrasts
// =========================================================================
val ForerunTextPrimary = ForerunNavy        // #2D3B4D للنصوص الرئيسية
val ForerunTextMuted = Color(0xFF677788)     // رمادي كحلي متناسق
val ForerunTextOnPrimary = Color(0xFFFFFFFF)// أبيض ناصع عالي التباين على الزر البرتقالي (#FF751F)
val ForerunTextOnSecondary = ForerunNavy   // كحلي داكن على النعناعي (#86ECE6)
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

