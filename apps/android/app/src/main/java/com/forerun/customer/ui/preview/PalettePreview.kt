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

@Preview(name = "لوحة الألوان الجديدة - FAWRUN Brand Palette", showBackground = true, widthDp = 390)
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
                    text = "هوية فور رن البصرية الجديدة",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Text(
                    text = "الألوان المعتمدة الثلاثة وتطبيقاتها على العناصر",
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
                    name = "Fresh Mint (الأساسي)",
                    hex = "#86ECE6",
                    description = "الأزرار الرئيسية، الأيقونات، العناصر التفاعلية",
                    color = ForerunMint,
                    textColor = ForerunNavy
                )

                ColorCard(
                    name = "Vibrant Orange (الثانوي)",
                    hex = "#FF751F",
                    description = "التوصيل النشط، الشارات، العروض، الطاقة",
                    color = ForerunOrange,
                    textColor = Color.White
                )

                ColorCard(
                    name = "Deep Slate Navy (الداكن)",
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

                // Mint Button with Dark Navy text
                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunGreen,
                        contentColor = ForerunTextOnPrimary
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.ShoppingBag,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = "زر رئيسي (#86ECE6 مع نص #2D3B4D)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))

                // Orange Action Button
                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForerunOrange,
                        contentColor = Color.White
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.DeliveryDining,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(Dimens.Space8))
                    Text(
                        text = "إجراء تفاعلي نشط (#FF751F)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space8))

                // Outlined Button
                OutlinedButton(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Dimens.ButtonHeight),
                    shape = RoundedCornerShape(Dimens.RadiusMedium),
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, ForerunNavy)
                ) {
                    Text(
                        text = "زر محدد بإطار (#2D3B4D)",
                        fontWeight = FontWeight.SemiBold,
                        color = ForerunNavy,
                        fontSize = 15.sp
                    )
                }

                Spacer(modifier = Modifier.height(Dimens.Space20))

                // 3. Status Badges
                Text(
                    text = "3. شارات الحالات والطلبات",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Delivering (Orange)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(Dimens.RadiusPill))
                            .background(ForerunOrangeLight)
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "جاري التوصيل",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunOrange
                        )
                    }

                    // Delivered (Mint)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(Dimens.RadiusPill))
                            .background(ForerunGreenLight)
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "تم التسليم",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunNavy
                        )
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space20))

                // 4. Sample Order Card
                Text(
                    text = "4. بطاقة طلب نموذجية",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForerunTextPrimary
                )
                Spacer(modifier = Modifier.height(Dimens.Space8))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = ForerunSoftSurface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ForerunBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "طلب #FW-00124",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = ForerunTextPrimary
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(Dimens.RadiusPill))
                                    .background(ForerunOrangeLight)
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "جاري التوصيل",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = ForerunOrange
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Text(
                            text = "سوبرماركت المدينة • 4 مواد",
                            fontSize = 13.sp,
                            color = ForerunTextMuted
                        )

                        Spacer(modifier = Modifier.height(Dimens.Space12))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "المجموع: 4,500 ل.س",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = ForerunTextPrimary
                            )
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(ForerunGreen),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocalShipping,
                                    contentDescription = null,
                                    tint = ForerunNavy,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(Dimens.Space24))
            }
        }
    }
}
