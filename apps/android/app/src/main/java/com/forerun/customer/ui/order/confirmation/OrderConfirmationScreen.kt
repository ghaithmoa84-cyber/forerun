package com.forerun.customer.ui.order.confirmation

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.forerun.customer.R
import com.forerun.customer.ui.theme.Dimens
import com.forerun.customer.ui.theme.ForerunGreen
import com.forerun.customer.ui.theme.ForerunGreenLight
import com.forerun.customer.ui.theme.ForerunSoftSurface
import com.forerun.customer.ui.theme.ForerunSuccess
import com.forerun.customer.ui.theme.ForerunSurface
import com.forerun.customer.ui.theme.ForerunTextMuted
import com.forerun.customer.ui.theme.ForerunTextOnPrimary
import com.forerun.customer.ui.theme.ForerunTextPrimary
import com.forerun.customer.ui.theme.ForerunWarning

/**
 * Screen 5: Order Confirmation Screen (Commit 5)
 * Displays the created order confirmation details received via navigation arguments.
 * No ViewModel is used here per specification.
 */
@Composable
fun OrderConfirmationScreen(
    orderNumber: String,
    estimatedFee: Int,
    onTrackOrder: () -> Unit,
    onNewOrder: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ForerunSoftSurface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Dimens.ScreenMargin),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(Dimens.Space24))

            // Big Success Badge
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(ForerunGreenLight),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(ForerunGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = ForerunTextOnPrimary,
                        modifier = Modifier.size(40.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space24))

            // Headline & Subtitle
            Text(
                text = stringResource(R.string.order_confirmation_success_headline),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = ForerunTextPrimary,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(Dimens.Space8))

            Text(
                text = stringResource(R.string.order_confirmation_success_subtitle),
                fontSize = 14.sp,
                color = ForerunTextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.9f)
            )

            Spacer(modifier = Modifier.height(Dimens.Space32))

            // Order Details Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Dimens.RadiusLarge),
                colors = CardDefaults.cardColors(containerColor = ForerunSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.Space20)
                ) {
                    // Order Number Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.order_confirmation_num_label),
                            fontSize = 14.sp,
                            color = ForerunTextMuted
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(Dimens.RadiusPill))
                                .background(ForerunGreenLight)
                                .padding(horizontal = Dimens.Space12, vertical = Dimens.Space4)
                        ) {
                            Text(
                                text = orderNumber,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = ForerunGreen
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space16))
                    HorizontalDivider(color = ForerunSoftSurface, thickness = 1.dp)
                    Spacer(modifier = Modifier.height(Dimens.Space16))

                    // Estimated Fee Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.order_confirmation_fee_label),
                            fontSize = 14.sp,
                            color = ForerunTextMuted
                        )
                        Text(
                            text = stringResource(R.string.order_confirmation_fee_value, estimatedFee),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = ForerunTextPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(Dimens.Space12))

                    // Fee Note Box
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Dimens.RadiusMedium))
                            .background(Color(0xFFFFF8E1))
                            .padding(Dimens.Space12)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = ForerunWarning,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(Dimens.Space8))
                            Text(
                                text = stringResource(R.string.order_confirmation_fee_note),
                                fontSize = 12.sp,
                                color = Color(0xFFB78103),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(Dimens.Space32))

            // Action Buttons
            Button(
                onClick = onTrackOrder,
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
                    imageVector = Icons.AutoMirrored.Filled.List,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(Dimens.Space8))
                Text(
                    text = stringResource(R.string.order_confirmation_track_btn),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(Dimens.Space12))

            OutlinedButton(
                onClick = onNewOrder,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Dimens.ButtonHeight),
                shape = RoundedCornerShape(Dimens.RadiusMedium),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = ForerunGreen
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(Dimens.Space8))
                Text(
                    text = stringResource(R.string.order_confirmation_new_order_btn),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(Dimens.Space24))
        }
    }
}
