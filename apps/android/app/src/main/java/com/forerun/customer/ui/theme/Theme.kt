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
    primary = ForerunMint,
    onPrimary = ForerunNavy,
    primaryContainer = ForerunMintLight,
    onPrimaryContainer = ForerunMintDark,

    secondary = ForerunOrange,
    onSecondary = Color.White,
    secondaryContainer = ForerunOrangeLight,
    onSecondaryContainer = ForerunOrangeDark,

    tertiary = ForerunNavy,
    onTertiary = Color.White,

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
