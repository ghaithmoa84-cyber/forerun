package com.forerun.customer.ui.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeliveryDining
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunBackground
import com.forerun.customer.ui.theme.ForerunBorder
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenDark
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunMint
import com.forerun.customer.ui.theme.ForerunNavy
import com.forerun.customer.ui.theme.ForerunOrange
import com.forerun.customer.ui.theme.ForerunOrangeLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.ForerunTheme

@Composable
fun ColorCard(
    name: String,
    hex: String,
    description: String,
    color: Color,
    textColor: Color = Color.White
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = color),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = name,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = textColor.copy(alpha = 0.85f)
                )
            }
            Text(
                text = hex,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = textColor
            )
        }
    }
}

@Preview(name = "لوحة الألوان المحدثة - البرتقالي هو اللون الأساسي للتفاعل", showBackground = true, widthDp = 390)
@Composable
fun BrandPalettePreview() {
    ForerunTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = ForerunBackground
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(Dimens.Space16)
            ) {
                // Header
                Text(
                    text = "هوية فور رن - البرتقالي هو لون التفاعل الأساسي",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Text(
                    text = "البرتقالي للأزرار والإجراءات، النعناعي للعلامة والدوائر، الكحلي للنصوص",
                    fontSize = 13.sp,
                    color = ForerunTextMuted
                )

                Spacer(modifier = Modifier.height(Dimens.Space16))

                // 1. Primary Colors
                Text(
                    text = "1. الألوان الأساسية الثلاثة",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))

                ColorCard(
                    name = "Vibrant Orange (الأساسي للإجراءات)",
                    hex = "#FF751F",
                    description = "الأزرار الرئيسية، الإجراءات، المؤشرات النشطة، الطاقة",
                    color = ForerunOrange,
                    textColor = Color.White
                )

                ColorCard(
                    name = "Fresh Mint (هوية العلامة والدوائر)",
                    hex = "#86ECE6",
                    description = "شعار التطبيق، الدوائر التوضيحية، الشارات والبطاقات",
                    color = ForerunMint,
                    textColor = ForerunNavy
                )

                ColorCard(
                    name = "Deep Slate Navy (العناوين والتباين)",
                    hex = "#2D3B4D",
                    description = "العناوين، النصوص، شريط الحالة، التباين العالي",
                    color = ForerunNavy,
                    textColor = Color.White
                )

                Spacer(modifier = Modifier.height(Dimens.Space20))

                // 2. Buttons Showcase
                Text(
                    text = "2. الأزرار التفاعلية",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))

                // Orange CTA Button (Pill)
                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(Dimens.RadiusPill),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunOrange,
                        contentColor = Color.White
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "التالي",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(Dimens.Space8))
                        Icon(
                            imageVector = Icons.Default.DeliveryDining,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))

                // Mint Secondary Button
                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(Dimens.RadiusPill),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunMint,
                        contentColor = ForerunNavy
                    )
                ) {
                    Text(
                        text = "زر ثانوي نعناعي (#86ECE6)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = ForerunNavy
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space20))

                // 3. Status & Dots Indicator Showcase
                Text(
                    text = "3. مؤشرات الصفحات (مثل شاشات الترحيب)",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(28.dp)
                            .height(8.dp)
                            .clip(CircleShape)
                            .background(ForerunOrange)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(ForerunMint)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(ForerunMint)
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space24))
            }
        }
    }
}
