package com.forerun.customer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection

private val ForerunColorScheme = lightColorScheme(
    // 1. Primary: Vibrant Orange (#FF751F) - المحرك الأساسي للإجراءات والأزرار (CTA)
    primary = ForerunOrange,
    onPrimary = Color.White,
    primaryContainer = ForerunOrangeLight,
    onPrimaryContainer = ForerunOrangeDark,

    // 2. Secondary: Fresh Mint (#86ECE6) - هوية العلامة التجارية والخلفيات والدوائر
    secondary = ForerunMint,
    onSecondary = ForerunNavy,
    secondaryContainer = ForerunMintLight,
    onSecondaryContainer = ForerunMintDark,

    // 3. Tertiary: Deep Slate Navy (#2D3B4D) - العناوين والعناصر الداكنة
    tertiary = ForerunNavy,
    onTertiary = Color.White,
    tertiaryContainer = ForerunNavyLight,
    onTertiaryContainer = Color.White,

    background = ForerunBackground,
    onBackground = ForerunTextPrimary,

    surface = ForerunSurface,
    onSurface = ForerunTextPrimary,
    surfaceVariant = ForerunSoftSurface,
    onSurfaceVariant = ForerunTextMuted,

    outline = ForerunBorder,
    outlineVariant = ForerunBorder,

    error = ForerunDanger,
    onError = Color.White,
    errorContainer = ForerunDangerLight,
    onErrorContainer = ForerunDanger
)

@Composable
fun ForerunTheme(
    content: @Composable () -> Unit
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = ForerunColorScheme,
            typography = ForerunTypography,
            content = content
        )
    }
}
