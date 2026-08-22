package com.tangjiawei.postcard.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Colors = lightColorScheme(
    primary = Color(0xFF7A4F44),
    onPrimary = Color.White,
    secondary = Color(0xFF41665A),
    onSecondary = Color.White,
    background = Color(0xFFF7F5F0),
    onBackground = Color(0xFF282725),
    surface = Color(0xFFFFFEFB),
    onSurface = Color(0xFF282725),
    surfaceVariant = Color(0xFFECE8DF),
    outline = Color(0xFF817B72),
    error = Color(0xFFB3261E),
)

@Composable
fun PostcardTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Colors,
        typography = MaterialTheme.typography.copy(
            headlineSmall = TextStyle(fontFamily = FontFamily.Serif, fontSize = 24.sp, fontWeight = FontWeight.Medium),
            titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontSize = 20.sp, fontWeight = FontWeight.Medium),
            bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
        ),
        content = content,
    )
}
